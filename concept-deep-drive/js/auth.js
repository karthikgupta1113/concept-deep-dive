/**
 * auth.js — Login / Sign-up form logic
 */

(function initAuth() {

  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  const panelLogin = document.getElementById('panel-login');
  const panelSignup= document.getElementById('panel-signup');
  const formLogin  = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const btnLogin   = document.getElementById('btn-login');
  const btnSignup  = document.getElementById('btn-signup');

  /* ── Tab switching ──────────────────────────────────────── */
  function switchTab(tab) {
    const isLogin = tab === 'login';
    tabLogin .classList.toggle('auth-tab--active', isLogin);
    tabSignup.classList.toggle('auth-tab--active', !isLogin);
    tabLogin .setAttribute('aria-selected', String(isLogin));
    tabSignup.setAttribute('aria-selected', String(!isLogin));
    panelLogin .classList.toggle('auth-form-panel--hidden', !isLogin);
    panelSignup.classList.toggle('auth-form-panel--hidden',  isLogin);
  }

  tabLogin .addEventListener('click', () => switchTab('login'));
  tabSignup.addEventListener('click', () => switchTab('signup'));
  document.querySelectorAll('[data-tab]')   .forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.switch)));

  /* ── Field helpers ──────────────────────────────────────── */
  const showErr  = (i, e, m) => { i.classList.add('field-input--error');    e.textContent = m; };
  const clearErr = (i, e)    => { i.classList.remove('field-input--error'); e.textContent = ''; };
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const delay = ms => new Promise(r => setTimeout(r, ms));

  function setLoading(btn, on) {
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
  formLogin.addEventListener('submit', async e => {
    e.preventDefault();
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
    await delay(550);
    setLoading(btnLogin, false);

    const res = State.mockLogin(email.value.trim().toLowerCase(), pw.value);
    if (!res.ok) {
      const isEmailErr = res.error.toLowerCase().includes('email') || res.error.toLowerCase().includes('account');
      showErr(isEmailErr ? email : pw, isEmailErr ? eErr : pErr, res.error);
      shake(formLogin);
      return;
    }
    State.login(res.user);
    window.App.showDashboard();
  });

  /* ── SIGNUP ─────────────────────────────────────────────── */
  formSignup.addEventListener('submit', async e => {
    e.preventDefault();
    const name  = document.getElementById('signup-name');
    const email = document.getElementById('signup-email');
    const pw    = document.getElementById('signup-password');
    const nErr  = document.getElementById('signup-name-error');
    const eErr  = document.getElementById('signup-email-error');
    const pErr  = document.getElementById('signup-password-error');
    let ok = true;

    [name, email, pw].forEach((f, i) => clearErr(f, [nErr, eErr, pErr][i]));

    if (!name.value.trim())            { showErr(name, nErr, 'Your name is required.'); ok = false; }
    if (!email.value.trim())           { showErr(email, eErr, 'Email is required.'); ok = false; }
    else if (!validEmail(email.value)) { showErr(email, eErr, 'Enter a valid email.'); ok = false; }
    if (!pw.value)                     { showErr(pw, pErr, 'Password is required.'); ok = false; }
    else if (pw.value.length < 8)      { showErr(pw, pErr, 'At least 8 characters.'); ok = false; }
    if (!ok) return;

    setLoading(btnSignup, true);
    await delay(650);
    setLoading(btnSignup, false);

    const res = State.mockSignup(name.value.trim(), email.value.trim().toLowerCase(), pw.value);
    if (!res.ok) {
      showErr(email, eErr, res.error);
      shake(formSignup);
      return;
    }
    State.login(res.user);
    window.App.showDashboard();
  });

})();
