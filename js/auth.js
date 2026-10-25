/**
 * js/auth.js — Supabase Authentication Flow
 * Concept Deep-Dive — Master One Idea at a Time
 *
 * Implements:
 *   - Login (email & password) with friendly errors for wrong credentials,
 *     unconfirmed email (with resend link), and network errors
 *   - Sign up with name, email, password (>=8 chars), and required privacy policy consent
 *   - Automatic saving of consent_at on the learner's profiles row on first login
 *   - Forgot password & reset password via Supabase recovery email
 *   - Resend confirmation link
 *   - Syncing views with #/login, #/signup, #/forgot, #/reset
 */

(function initAuth() {
  'use strict';

  const authTabs           = document.getElementById('auth-tabs');
  const tabLogin           = document.getElementById('tab-login');
  const tabSignup          = document.getElementById('tab-signup');
  const panelLogin         = document.getElementById('panel-login');
  const panelSignup        = document.getElementById('panel-signup');
  const panelVerifyEmail   = document.getElementById('panel-verify-email');
  const panelForgot        = document.getElementById('panel-forgot-password');
  const panelResetSent     = document.getElementById('panel-reset-sent');
  const panelNewPassword   = document.getElementById('panel-new-password');

  const formLogin          = document.getElementById('form-login');
  const formSignup         = document.getElementById('form-signup');
  const formForgot         = document.getElementById('form-forgot-password');
  const formNewPassword    = document.getElementById('form-new-password');

  const btnLogin           = document.getElementById('btn-login');
  const btnSignup          = document.getElementById('btn-signup');
  const btnForgotSubmit    = document.getElementById('btn-forgot-submit');
  const btnNewPwSubmit     = document.getElementById('btn-new-password-submit');
  const btnResendVerify    = document.getElementById('btn-resend-verify');
  const btnResendReset     = document.getElementById('btn-resend-reset');

  const consentCheckbox    = document.getElementById('signup-consent');
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const unconfirmedNotice  = document.getElementById('login-unconfirmed-notice');
  const btnLoginResend     = document.getElementById('btn-login-resend-link');

  const verifyEmailTarget  = document.getElementById('verify-email-target');
  const resetEmailTarget   = document.getElementById('reset-email-target');
  const verifyResendStatus = document.getElementById('verify-resend-status');
  const resetResendStatus  = document.getElementById('reset-resend-status');

  const alertBanner        = document.getElementById('auth-alert-banner');
  const alertContent       = document.getElementById('auth-alert-content');
  const alertClose         = document.getElementById('auth-alert-close');

  let lastSignupEmail = '';
  let lastLoginEmail = '';

  const panels = {
    login: panelLogin,
    signup: panelSignup,
    'verify-email': panelVerifyEmail,
    'forgot-password': panelForgot,
    'reset-sent': panelResetSent,
    'new-password': panelNewPassword,
  };

  /* ── Alert banner helper ────────────────────────────────── */
  function showAlert(message, type = 'danger') {
    if (!alertBanner || !alertContent) return;
    alertBanner.className = `auth-alert-banner auth-alert-banner--${type}`;
    alertContent.innerHTML = message;
    alertBanner.classList.remove('auth-alert-banner--hidden');
  }

  function hideAlert() {
    if (!alertBanner) return;
    alertBanner.classList.add('auth-alert-banner--hidden');
  }

  alertClose?.addEventListener('click', hideAlert);

  /* ── View switcher ──────────────────────────────────────── */
  function showAuthView(view, syncHash = false) {
    if (unconfirmedNotice && view !== 'login') {
      unconfirmedNotice.hidden = true;
    }

    const isMainTab = (view === 'login' || view === 'signup');
    if (authTabs) {
      authTabs.classList.toggle('auth-tabs--hidden', !isMainTab);
    }

    if (isMainTab) {
      const isLogin = (view === 'login');
      tabLogin?.classList.toggle('auth-tab--active', isLogin);
      tabSignup?.classList.toggle('auth-tab--active', !isLogin);
      tabLogin?.setAttribute('aria-selected', String(isLogin));
      tabSignup?.setAttribute('aria-selected', String(!isLogin));
    }

    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('auth-form-panel--hidden', key !== view);
    });

    if (syncHash && window.Router) {
      if (view === 'login' && Router.current() !== '/login') Router.go('/login');
      if (view === 'signup' && Router.current() !== '/signup') Router.go('/signup');
      if (view === 'forgot-password' && Router.current() !== '/forgot') Router.go('/forgot');
      if (view === 'new-password' && Router.current() !== '/reset') Router.go('/reset');
    }
  }

  // Navigation listeners
  tabLogin?.addEventListener('click',  () => {
    hideAlert();
    if (window.Router) Router.go('/login');
    else showAuthView('login');
  });

  tabSignup?.addEventListener('click', () => {
    hideAlert();
    if (window.Router) Router.go('/signup');
    else showAuthView('signup');
  });

  document.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => {
      hideAlert();
      const tab = b.dataset.tab;
      if (window.Router) {
        Router.go(tab === 'login' ? '/login' : '/signup');
      } else {
        showAuthView(tab);
      }
    });
  });

  document.querySelectorAll('[data-switch]').forEach(b => {
    b.addEventListener('click', () => {
      hideAlert();
      const sw = b.dataset.switch;
      if (window.Router) {
        if (sw === 'login') Router.go('/login');
        else if (sw === 'signup') Router.go('/signup');
        else if (sw === 'forgot-password' || sw === 'forgot') Router.go('/forgot');
        else showAuthView(sw);
      } else {
        showAuthView(sw);
      }
    });
  });

  linkForgotPassword?.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    if (window.Router) Router.go('/forgot');
    else showAuthView('forgot-password');
  });

  /* ── Consent checkbox → enable / disable signup button ─── */
  function syncSignupButton() {
    const enabled = consentCheckbox && consentCheckbox.checked;
    if (btnSignup) {
      btnSignup.disabled = !enabled;
      btnSignup.setAttribute('aria-disabled', String(!enabled));
    }
  }
  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', syncSignupButton);
    syncSignupButton();
  }

  /* ── Field helpers ──────────────────────────────────────── */
  const showErr  = (i, e, m) => { if (i) i.classList.add('field-input--error'); if (e) e.textContent = m; };
  const clearErr = (i, e)    => { if (i) i.classList.remove('field-input--error'); if (e) e.textContent = ''; };
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function setLoading(btn, on) {
    if (!btn) return;
    btn.classList.toggle('btn--loading', on);
    btn.disabled = on;
  }

  /* ── Clear errors on type ───────────────────────────────── */
  document.querySelectorAll('.field-input').forEach(input => {
    const errorEl = document.getElementById(input.id + '-error');
    if (errorEl) input.addEventListener('input', () => clearErr(input, errorEl));
  });

  /* ── Shake animation ────────────────────────────────────── */
  function shake(form) {
    if (!form) return;
    form.style.animation = 'none';
    requestAnimationFrame(() => { form.style.animation = 'shake 0.4s ease'; });
  }

  /* ── Supabase client getter helper ──────────────────────── */
  function getClient() {
    return window.supabaseClient || (typeof getSupabaseClient === 'function' ? getSupabaseClient() : null);
  }

  /* ── Store consent_at on profiles table ──────────────────── */
  async function storeConsentAtOnProfile(user) {
    const client = getClient();
    if (!client || !user || !user.id) return;

    const consentAt = user.user_metadata?.consent_at || new Date().toISOString();
    try {
      // Check if profiles row exists
      const { data: profile, error: selectErr } = await client
        .from('profiles')
        .select('user_id, consent_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selectErr) {
        console.warn('[auth] Could not fetch profile to check consent_at:', selectErr.message);
      }

      if (!profile) {
        // Insert new row with consent_at
        const { error: insertErr } = await client
          .from('profiles')
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Learner',
            consent_at: consentAt,
            created_at: new Date().toISOString()
          });
        if (insertErr) {
          console.warn('[auth] Insert profile consent_at failed:', insertErr.message);
        } else {
          console.log('[auth] Successfully stored consent_at on profiles row.');
        }
      } else if (!profile.consent_at) {
        // Update existing row
        const { error: updateErr } = await client
          .from('profiles')
          .update({
            consent_at: consentAt
          })
          .eq('user_id', user.id);
        if (updateErr) {
          console.warn('[auth] Update profile consent_at failed:', updateErr.message);
        } else {
          console.log('[auth] Successfully updated consent_at on profiles row.');
        }
      }
    } catch (err) {
      console.warn('[auth] Error while storing consent_at on profile:', err);
    }
  }

  /* ── Helper to resolve destination after login ───────────── */
  function getPostLoginRoute() {
    if (typeof Roadmap !== 'undefined') {
      if (Roadmap.isInitialized && !Roadmap.isInitialized()) {
        Roadmap.init();
      }
      const curr = Roadmap.getCurrentStep ? Roadmap.getCurrentStep() : null;
      if (curr && curr.id) {
        return '/step/' + curr.id;
      }
    }
    if (typeof PathStore !== 'undefined') {
      const data = PathStore.load ? PathStore.load() : null;
      if (data && Array.isArray(data.path) && data.path.length > 0) {
        const idx = data.currentIndex || 0;
        const stepId = data.path[idx] || data.path[0];
        if (stepId) return '/step/' + stepId;
      }
    }
    return '/welcome';
  }

  /* ── 1. LOGIN (Supabase Email & Password) ─────────────────── */
  formLogin?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    if (unconfirmedNotice) unconfirmedNotice.hidden = true;

    const email = document.getElementById('login-email');
    const pw    = document.getElementById('login-password');
    const eErr  = document.getElementById('login-email-error');
    const pErr  = document.getElementById('login-password-error');
    let ok = true;

    clearErr(email, eErr); clearErr(pw, pErr);

    if (!email.value.trim())           { showErr(email, eErr, 'Email is required.'); ok = false; }
    else if (!validEmail(email.value)) { showErr(email, eErr, 'Enter a valid email.'); ok = false; }
    if (!pw.value)                     { showErr(pw, pErr, 'Password is required.'); ok = false; }
    if (!ok) return;

    const client = getClient();
    if (!client) {
      showAlert('Supabase client is not configured. Check js/config.js.', 'danger');
      return;
    }

    setLoading(btnLogin, true);

    const enteredEmail = email.value.trim().toLowerCase();
    const enteredPw    = pw.value;
    lastLoginEmail = enteredEmail;

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: enteredEmail,
        password: enteredPw
      });

      setLoading(btnLogin, false);

      if (error) {
        const errMsg = error.message || '';
        const isWrongPassword = errMsg.toLowerCase().includes('invalid login credentials') ||
                                errMsg.toLowerCase().includes('invalid credentials') ||
                                error.status === 400;
        const isUnconfirmed = errMsg.toLowerCase().includes('email not confirmed') ||
                              errMsg.toLowerCase().includes('email_not_confirmed');
        const isNetworkErr = !navigator.onLine ||
                             errMsg.toLowerCase().includes('failed to fetch') ||
                             errMsg.toLowerCase().includes('network');

        if (isUnconfirmed) {
          if (unconfirmedNotice) {
            unconfirmedNotice.hidden = false;
            const noticeText = document.getElementById('login-unconfirmed-text');
            if (noticeText) noticeText.textContent = 'Email not confirmed yet.';
          }
          showAlert('Please confirm your email before signing in. Click "Resend email" below if you need a new link.', 'warning');
          shake(formLogin);
          return;
        }

        if (isNetworkErr) {
          showAlert('Network connection error. Please check your internet and try again.', 'danger');
          shake(formLogin);
          return;
        }

        if (isWrongPassword) {
          showErr(pw, pErr, 'Incorrect email or password. Please try again.');
          showAlert('Incorrect email or password. Please try again.', 'danger');
          shake(formLogin);
          return;
        }

        showAlert(errMsg || 'Failed to sign in. Please try again.', 'danger');
        shake(formLogin);
        return;
      }

      if (data && data.user) {
        const userObj = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Learner',
          user_metadata: data.user.user_metadata
        };

        await State.initFromSupabase(userObj);
        if (typeof PathStore !== 'undefined') {
          PathStore.setSessionUser(userObj);
        }

        // Store consent_at on the learner's profiles row after first successful login
        await storeConsentAtOnProfile(data.user);

        // Sync and hydrate with CloudStore (Prompt S2)
        if (typeof CloudStore !== 'undefined' && CloudStore.onLogin) {
          await CloudStore.onLogin(userObj);
        }

        // Continue to saved current step if one exists, otherwise #/welcome
        const nextRoute = getPostLoginRoute();
        if (window.Router) {
          Router.go(nextRoute);
        } else {
          window.location.hash = '#' + nextRoute;
        }
      }
    } catch (err) {
      setLoading(btnLogin, false);
      const isNetwork = !navigator.onLine || String(err).toLowerCase().includes('failed to fetch');
      showAlert(isNetwork ? 'Network connection error. Please check your internet.' : (err.message || 'An unexpected error occurred.'), 'danger');
      shake(formLogin);
    }
  });

  /* ── 2. SIGN UP (Name, Email, Password >= 8 chars, Consent) ── */
  formSignup?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();

    const name  = document.getElementById('signup-name');
    const email = document.getElementById('signup-email');
    const pw    = document.getElementById('signup-password');
    const nErr  = document.getElementById('signup-name-error');
    const eErr  = document.getElementById('signup-email-error');
    const pErr  = document.getElementById('signup-password-error');
    const cErr  = document.getElementById('signup-consent-error');
    let ok = true;

    clearErr(name, nErr);
    clearErr(email, eErr);
    clearErr(pw, pErr);
    if (cErr) cErr.textContent = '';

    if (!name.value.trim()) {
      showErr(name, nErr, 'Name is required.');
      ok = false;
    }

    if (!email.value.trim()) {
      showErr(email, eErr, 'Email is required.');
      ok = false;
    } else if (!validEmail(email.value)) {
      showErr(email, eErr, 'Enter a valid email.');
      ok = false;
    }

    if (!pw.value) {
      showErr(pw, pErr, 'Password is required.');
      ok = false;
    } else if (pw.value.length < 8) {
      showErr(pw, pErr, 'Password must be at least 8 characters.');
      ok = false;
    }

    if (!consentCheckbox || !consentCheckbox.checked) {
      if (cErr) cErr.textContent = 'You must agree to the privacy policy to continue.';
      ok = false;
    }

    if (!ok) {
      shake(formSignup);
      return;
    }

    const client = getClient();
    if (!client) {
      showAlert('Supabase client is not configured. Check js/config.js.', 'danger');
      return;
    }

    setLoading(btnSignup, true);

    const enteredName  = name.value.trim();
    const enteredEmail = email.value.trim().toLowerCase();
    const enteredPw    = pw.value;
    lastSignupEmail    = enteredEmail;

    try {
      const { data, error } = await client.auth.signUp({
        email: enteredEmail,
        password: enteredPw,
        options: {
          data: {
            name: enteredName,
            consent_at: new Date().toISOString()
          },
          emailRedirectTo: window.location.origin + window.location.pathname + '#/login'
        }
      });

      setLoading(btnSignup, false);

      if (error) {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('already registered')) {
          showErr(email, eErr, 'This email is already registered. Try signing in.');
          showAlert('An account with this email already exists. <button type="button" class="auth-link-btn" onclick="window.Router?Router.go(\'/login\'):window.Auth.showView(\'login\')">Sign in here</button>', 'warning');
        } else if (!navigator.onLine || msg.toLowerCase().includes('failed to fetch')) {
          showAlert('Network error. Please check your connection and try again.', 'danger');
        } else {
          showAlert(msg || 'Sign up failed. Please try again.', 'danger');
        }
        shake(formSignup);
        return;
      }

      // Check if user was created and confirmation is pending
      if (data && data.user) {
        if (verifyEmailTarget) {
          verifyEmailTarget.textContent = enteredEmail;
        }
        showAuthView('verify-email');
        showAlert('Check your email to confirm your account. We sent a verification link to ' + enteredEmail, 'success');
      }
    } catch (err) {
      setLoading(btnSignup, false);
      const isNetwork = !navigator.onLine || String(err).toLowerCase().includes('failed to fetch');
      showAlert(isNetwork ? 'Network connection error. Please check your connection.' : (err.message || 'An unexpected error occurred.'), 'danger');
      shake(formSignup);
    }
  });

  /* ── Resend verification email handlers ──────────────────── */
  async function resendVerification(targetEmail, statusEl, btnEl) {
    if (!targetEmail) {
      showAlert('Please enter your email first.', 'warning');
      return;
    }

    const client = getClient();
    if (!client) {
      showAlert('Supabase client is not configured.', 'danger');
      return;
    }

    if (btnEl) setLoading(btnEl, true);
    if (statusEl) statusEl.textContent = 'Sending email...';

    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname + '#/login'
        }
      });

      if (btnEl) setLoading(btnEl, false);

      if (error) {
        if (statusEl) statusEl.textContent = error.message;
        showAlert('Error resending email: ' + error.message, 'danger');
      } else {
        if (statusEl) statusEl.textContent = 'Confirmation link sent! Check your inbox.';
        showAlert('Confirmation link resent to ' + targetEmail + '. Please check your inbox.', 'success');
      }
    } catch (err) {
      if (btnEl) setLoading(btnEl, false);
      if (statusEl) statusEl.textContent = 'Failed to resend.';
      showAlert('Network error resending email: ' + err.message, 'danger');
    }
  }

  btnResendVerify?.addEventListener('click', () => {
    const emailToUse = lastSignupEmail || document.getElementById('signup-email')?.value.trim() || lastLoginEmail;
    resendVerification(emailToUse, verifyResendStatus, btnResendVerify);
  });

  btnLoginResend?.addEventListener('click', () => {
    const emailToUse = lastLoginEmail || document.getElementById('login-email')?.value.trim();
    resendVerification(emailToUse, null, btnLoginResend);
  });

  /* ── 3. FORGOT PASSWORD (Supabase Email Flow) ─────────────── */
  formForgot?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('forgot-email');
    const eErr  = document.getElementById('forgot-email-error');
    clearErr(email, eErr);

    if (!email.value.trim()) {
      showErr(email, eErr, 'Email is required.');
      shake(formForgot);
      return;
    }
    if (!validEmail(email.value)) {
      showErr(email, eErr, 'Enter a valid email.');
      shake(formForgot);
      return;
    }

    const client = getClient();
    if (!client) {
      showAlert('Supabase client is not configured.', 'danger');
      return;
    }

    setLoading(btnForgotSubmit, true);
    const targetEmail = email.value.trim().toLowerCase();

    try {
      const redirectUrl = window.location.origin + window.location.pathname + '#/reset';
      const { error } = await client.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl
      });

      setLoading(btnForgotSubmit, false);

      if (error) {
        if (!navigator.onLine || error.message.toLowerCase().includes('failed to fetch')) {
          showAlert('Network error. Check your connection.', 'danger');
        } else {
          showAlert(error.message, 'danger');
        }
        shake(formForgot);
        return;
      }

      if (resetEmailTarget) {
        resetEmailTarget.textContent = targetEmail;
      }
      showAuthView('reset-sent');
      showAlert('Password reset link sent! Check your email inbox.', 'success');
    } catch (err) {
      setLoading(btnForgotSubmit, false);
      showAlert(err.message || 'Failed to send reset link.', 'danger');
      shake(formForgot);
    }
  });

  /* ── Resend reset password link ──────────────────────────── */
  btnResendReset?.addEventListener('click', async () => {
    const email = resetEmailTarget?.textContent || document.getElementById('forgot-email')?.value.trim();
    if (!email) return;

    const client = getClient();
    if (!client) return;

    setLoading(btnResendReset, true);
    if (resetResendStatus) resetResendStatus.textContent = 'Sending reset email...';

    try {
      const redirectUrl = window.location.origin + window.location.pathname + '#/reset';
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      setLoading(btnResendReset, false);

      if (error) {
        if (resetResendStatus) resetResendStatus.textContent = error.message;
        showAlert('Error: ' + error.message, 'danger');
      } else {
        if (resetResendStatus) resetResendStatus.textContent = 'Reset link resent! Check your inbox.';
        showAlert('Reset link resent to ' + email, 'success');
      }
    } catch (err) {
      setLoading(btnResendReset, false);
      if (resetResendStatus) resetResendStatus.textContent = 'Failed to resend.';
    }
  });

  /* ── 4. NEW PASSWORD (#/reset) ────────────────────────────── */
  formNewPassword?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();

    const pw = document.getElementById('new-password');
    const cpw = document.getElementById('confirm-new-password');
    const pErr = document.getElementById('new-password-error');
    const cpErr = document.getElementById('confirm-new-password-error');

    clearErr(pw, pErr);
    clearErr(cpw, cpErr);

    let ok = true;
    if (!pw.value) {
      showErr(pw, pErr, 'New password is required.');
      ok = false;
    } else if (pw.value.length < 8) {
      showErr(pw, pErr, 'Password must be at least 8 characters.');
      ok = false;
    }

    if (!cpw.value) {
      showErr(cpw, cpErr, 'Please confirm your new password.');
      ok = false;
    } else if (pw.value !== cpw.value) {
      showErr(cpw, cpErr, 'Passwords do not match.');
      ok = false;
    }

    if (!ok) {
      shake(formNewPassword);
      return;
    }

    const client = getClient();
    if (!client) {
      showAlert('Supabase client is not configured.', 'danger');
      return;
    }

    setLoading(btnNewPwSubmit, true);

    try {
      const { error } = await client.auth.updateUser({
        password: pw.value
      });

      setLoading(btnNewPwSubmit, false);

      if (error) {
        showAlert(error.message || 'Failed to update password.', 'danger');
        shake(formNewPassword);
        return;
      }

      showAlert('Password updated successfully! You can now sign in with your new password.', 'success');
      pw.value = '';
      cpw.value = '';

      setTimeout(() => {
        if (window.Router) {
          Router.go('/login');
        } else {
          showAuthView('login');
        }
      }, 1200);
    } catch (err) {
      setLoading(btnNewPwSubmit, false);
      showAlert(err.message || 'An error occurred updating your password.', 'danger');
      shake(formNewPassword);
    }
  });

  /* ── Expose auth controller globally ─────────────────────── */
  window.Auth = {
    showView: showAuthView,
    showAlert,
    hideAlert,
    storeConsentAtOnProfile,
    getPostLoginRoute,
  };

})();
