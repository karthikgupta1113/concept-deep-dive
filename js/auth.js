/**
 * auth.js — Login, Sign-up, Email Verification & Password Reset flows
 */

(function initAuth() {

  const authTabs         = document.getElementById('auth-tabs');
  const tabLogin         = document.getElementById('tab-login');
  const tabSignup        = document.getElementById('tab-signup');
  const panelLogin       = document.getElementById('panel-login');
  const panelSignup      = document.getElementById('panel-signup');
  const panelVerifyEmail = document.getElementById('panel-verify-email');
  const panelForgot      = document.getElementById('panel-forgot-password');
  const panelResetSent   = document.getElementById('panel-reset-sent');
  const panelNewPassword = document.getElementById('panel-new-password');

  const formLogin        = document.getElementById('form-login');
  const formSignup       = document.getElementById('form-signup');
  const formForgot       = document.getElementById('form-forgot-password');
  const formNewPassword  = document.getElementById('form-new-password');

  const btnLogin         = document.getElementById('btn-login');
  const btnSignup        = document.getElementById('btn-signup');
  const btnForgotSubmit  = document.getElementById('btn-forgot-submit');
  const btnNewPwSubmit   = document.getElementById('btn-new-password-submit');
  const btnResendVerify  = document.getElementById('btn-resend-verify');
  const btnResendReset   = document.getElementById('btn-resend-reset');

  const consentCheckbox  = document.getElementById('signup-consent');
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const unconfirmedNotice= document.getElementById('login-unconfirmed-notice');
  const btnLoginResend   = document.getElementById('btn-login-resend-link');

  // Ensure unconfirmed banner is hidden by default on load
  if (unconfirmedNotice) {
    unconfirmedNotice.hidden = true;
  }

  const alertBanner      = document.getElementById('auth-alert-banner');
  const alertContent     = document.getElementById('auth-alert-content');
  const alertClose       = document.getElementById('auth-alert-close');

  const panels = {
    login: panelLogin,
    signup: panelSignup,
    'verify-email': panelVerifyEmail,
    'forgot-password': panelForgot,
    'reset-sent': panelResetSent,
    'new-password': panelNewPassword,
  };

  let _pendingVerificationEmail = '';
  let _pendingResetEmail = '';
  const _cooldownTimers = {};

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

  /* ── Cooldown timer helper (30s) ────────────────────────── */
  function startCooldown(buttonId, labelId, defaultText, durationSeconds = 30) {
    const btn = document.getElementById(buttonId);
    const label = document.getElementById(labelId);
    if (!btn || !label) return;

    if (_cooldownTimers[buttonId]) {
      clearInterval(_cooldownTimers[buttonId]);
    }

    let remaining = durationSeconds;
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    label.textContent = `Resend in ${remaining}s`;

    _cooldownTimers[buttonId] = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        label.textContent = `Resend in ${remaining}s`;
      } else {
        clearInterval(_cooldownTimers[buttonId]);
        delete _cooldownTimers[buttonId];
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        label.textContent = defaultText;
      }
    }, 1000);
  }

  /* ── View switcher ──────────────────────────────────────── */
  function showAuthView(view, data = {}) {
    // Hide unconfirmed notice whenever switching views or tabs
    if (unconfirmedNotice) {
      unconfirmedNotice.hidden = true;
    }

    // Toggle tabs visibility: only show on main login/signup
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

    // Show selected panel, hide others
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('auth-form-panel--hidden', key !== view);
    });

    // View-specific initialization
    if (view === 'verify-email') {
      const targetEl = document.getElementById('verify-email-target');
      const email = data.email || _pendingVerificationEmail || 'your email';
      _pendingVerificationEmail = email;
      if (targetEl) targetEl.textContent = email;
      const statusEl = document.getElementById('verify-resend-status');
      if (statusEl) statusEl.textContent = '';
      if (data.startCooldown) {
        startCooldown('btn-resend-verify', 'btn-resend-verify-label', 'Resend email', 30);
      }
    } else if (view === 'reset-sent') {
      const targetEl = document.getElementById('reset-email-target');
      const email = data.email || _pendingResetEmail || 'your email';
      _pendingResetEmail = email;
      if (targetEl) targetEl.textContent = email;
      const statusEl = document.getElementById('reset-resend-status');
      if (statusEl) statusEl.textContent = '';
      if (data.startCooldown) {
        startCooldown('btn-resend-reset', 'btn-resend-reset-label', 'Resend reset link', 30);
      }
    } else if (view === 'forgot-password') {
      const forgotEmailInput = document.getElementById('forgot-email');
      const loginEmailInput = document.getElementById('login-email');
      if (forgotEmailInput && !forgotEmailInput.value && loginEmailInput?.value) {
        forgotEmailInput.value = loginEmailInput.value;
      }
    } else if (view === 'new-password') {
      const p1 = document.getElementById('new-password');
      const p2 = document.getElementById('confirm-new-password');
      if (p1) p1.value = '';
      if (p2) p2.value = '';
      clearErr(p1, document.getElementById('new-password-error'));
      clearErr(p2, document.getElementById('confirm-new-password-error'));
    }
  }

  // Navigation listeners
  tabLogin?.addEventListener('click',  () => showAuthView('login'));
  tabSignup?.addEventListener('click', () => showAuthView('signup'));
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showAuthView(b.dataset.tab)));
  document.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => showAuthView(b.dataset.switch)));

  linkForgotPassword?.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    showAuthView('forgot-password');
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
  if (!document.getElementById('shake-style')) {
    const s = document.createElement('style');
    s.id = 'shake-style';
    s.textContent = `
      @keyframes shake {
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-8px)}
        40%{transform:translateX(6px)}
        60%{transform:translateX(-4px)}
        80%{transform:translateX(2px)}
      }
      @media(prefers-reduced-motion:reduce){@keyframes shake{0%,100%{transform:none}}}
    `;
    document.head.appendChild(s);
  }

  /* ── LOGIN ──────────────────────────────────────────────── */
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

    setLoading(btnLogin, true);
    const res = await window.SupabaseService.signIn(email.value.trim().toLowerCase(), pw.value);
    setLoading(btnLogin, false);

    if (!res.ok) {
      const errLower = (res.error || '').toLowerCase();
      // Handle unconfirmed email edge case specifically
      if (errLower.includes('email not confirmed') || errLower.includes('not confirmed')) {
        _pendingVerificationEmail = email.value.trim().toLowerCase();
        showErr(email, eErr, 'Email address is not yet confirmed.');
        if (unconfirmedNotice) unconfirmedNotice.hidden = false;
        shake(formLogin);
        return;
      }

      const isEmailErr = errLower.includes('email') || errLower.includes('user');
      showErr(isEmailErr ? email : pw, isEmailErr ? eErr : pErr, res.error);
      shake(formLogin);
      return;
    }

    await State.initFromSupabase(res.user, res.session);
    if (unconfirmedNotice) unconfirmedNotice.hidden = true;
    window.App.showDashboard();
  });

  // Action link to resend confirmation from login screen
  btnLoginResend?.addEventListener('click', async () => {
    if (!_pendingVerificationEmail) {
      const emailInput = document.getElementById('login-email');
      _pendingVerificationEmail = emailInput?.value.trim().toLowerCase() || '';
    }
    if (_pendingVerificationEmail) {
      showAuthView('verify-email', { email: _pendingVerificationEmail, startCooldown: true });
      window.SupabaseService.resendSignupEmail(_pendingVerificationEmail);
      const statusEl = document.getElementById('verify-resend-status');
      if (statusEl) {
        statusEl.style.color = 'var(--leaf)';
        statusEl.textContent = 'Confirmation email resent!';
      }
    }
  });

  /* ── SIGNUP (PART 1) ─────────────────────────────────────── */
  formSignup?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    const name  = document.getElementById('signup-name');
    const email = document.getElementById('signup-email');
    const pw    = document.getElementById('signup-password');
    const nErr    = document.getElementById('signup-name-error');
    const eErr    = document.getElementById('signup-email-error');
    const pErr    = document.getElementById('signup-password-error');
    const consent = document.getElementById('signup-consent');
    const cErr    = document.getElementById('signup-consent-error');
    let ok = true;

    [name, email, pw].forEach((f, i) => clearErr(f, [nErr, eErr, pErr][i]));
    if (cErr) cErr.textContent = '';

    if (!name.value.trim())            { showErr(name, nErr, 'Your name is required.'); ok = false; }
    if (!email.value.trim())           { showErr(email, eErr, 'Email is required.'); ok = false; }
    else if (!validEmail(email.value)) { showErr(email, eErr, 'Enter a valid email.'); ok = false; }
    if (!pw.value)                     { showErr(pw, pErr, 'Password is required.'); ok = false; }
    else if (pw.value.length < 8)      { showErr(pw, pErr, 'At least 8 characters.'); ok = false; }
    if (consent && !consent.checked)   { if (cErr) cErr.textContent = 'Please agree to the Privacy Policy to continue.'; ok = false; }
    if (!ok) return;

    const signupEmail = email.value.trim().toLowerCase();
    const signupName = name.value.trim();

    setLoading(btnSignup, true);
    const res = await window.SupabaseService.signUp(signupName, signupEmail, pw.value);
    setLoading(btnSignup, false);

    if (!res.ok) {
      showErr(email, eErr, res.error);
      shake(formSignup);
      return;
    }

    if (res.needsConfirmation) {
      _pendingVerificationEmail = signupEmail;
      showAuthView('verify-email', { email: signupEmail, startCooldown: true });
      return;
    }

    // Direct login if confirmation is not required by project
    await State.initFromSupabase(res.user, res.session);
    window.App.showDashboard();
  });

  // Resend email verification button
  btnResendVerify?.addEventListener('click', async () => {
    if (!_pendingVerificationEmail) return;
    const statusEl = document.getElementById('verify-resend-status');
    setLoading(btnResendVerify, true);
    if (statusEl) statusEl.textContent = '';

    const res = await window.SupabaseService.resendSignupEmail(_pendingVerificationEmail);
    setLoading(btnResendVerify, false);

    if (res.ok) {
      if (statusEl) {
        statusEl.style.color = 'var(--leaf)';
        statusEl.textContent = 'A new confirmation link has been sent!';
      }
      startCooldown('btn-resend-verify', 'btn-resend-verify-label', 'Resend email', 30);
    } else {
      if (statusEl) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = res.error || 'Failed to resend. Please try again later.';
      }
      startCooldown('btn-resend-verify', 'btn-resend-verify-label', 'Resend email', 30);
    }
  });

  /* ── FORGOT PASSWORD (PART 2) ────────────────────────────── */
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

    const resetEmail = email.value.trim().toLowerCase();
    setLoading(btnForgotSubmit, true);
    const res = await window.SupabaseService.resetPasswordForEmail(resetEmail);
    setLoading(btnForgotSubmit, false);

    if (!res.ok) {
      showErr(email, eErr, res.error);
      shake(formForgot);
      return;
    }

    _pendingResetEmail = resetEmail;
    showAuthView('reset-sent', { email: resetEmail, startCooldown: true });
  });

  // Resend reset link button
  btnResendReset?.addEventListener('click', async () => {
    if (!_pendingResetEmail) return;
    const statusEl = document.getElementById('reset-resend-status');
    setLoading(btnResendReset, true);
    if (statusEl) statusEl.textContent = '';

    const res = await window.SupabaseService.resetPasswordForEmail(_pendingResetEmail);
    setLoading(btnResendReset, false);

    if (res.ok) {
      if (statusEl) {
        statusEl.style.color = 'var(--leaf)';
        statusEl.textContent = 'A new password reset link has been sent!';
      }
      startCooldown('btn-resend-reset', 'btn-resend-reset-label', 'Resend reset link', 30);
    } else {
      if (statusEl) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = res.error || 'Failed to resend. Please try again later.';
      }
      startCooldown('btn-resend-reset', 'btn-resend-reset-label', 'Resend reset link', 30);
    }
  });

  /* ── CREATE NEW PASSWORD (PART 2) ────────────────────────── */
  formNewPassword?.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert();
    const pw = document.getElementById('new-password');
    const confirmPw = document.getElementById('confirm-new-password');
    const pErr = document.getElementById('new-password-error');
    const cErr = document.getElementById('confirm-new-password-error');
    let ok = true;

    clearErr(pw, pErr);
    clearErr(confirmPw, cErr);

    if (!pw.value) {
      showErr(pw, pErr, 'Password is required.');
      ok = false;
    } else if (pw.value.length < 8) {
      showErr(pw, pErr, 'At least 8 characters.');
      ok = false;
    }

    if (!confirmPw.value) {
      showErr(confirmPw, cErr, 'Please confirm your new password.');
      ok = false;
    } else if (pw.value && confirmPw.value && pw.value !== confirmPw.value) {
      // Passwords do not match — caught purely on frontend before any API call
      showErr(confirmPw, cErr, 'Passwords do not match.');
      ok = false;
    }

    if (!ok) {
      shake(formNewPassword);
      return;
    }

    setLoading(btnNewPwSubmit, true);
    const res = await window.SupabaseService.updateUserPassword(pw.value);
    setLoading(btnNewPwSubmit, false);

    if (!res.ok) {
      showErr(pw, pErr, res.error || 'Failed to update password.');
      shake(formNewPassword);
      return;
    }

    // Success: sign out of recovery session, switch to login, show confirmation
    window._isPasswordRecovery = false;
    await window.SupabaseService.signOut();

    showAuthView('login');
    showAlert('Password updated successfully! Please sign in with your new password.', 'success');
  });

  /* ── Expose auth controller globally ─────────────────────── */
  window.Auth = {
    showView: showAuthView,
    showAlert,
    hideAlert,
  };

})();
