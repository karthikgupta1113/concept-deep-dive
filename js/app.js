/**
 * app.js — SPA router (auth ↔ dashboard ↔ synthesis)
 */

(function initApp() {

  const views = {
    auth:      document.getElementById('view-auth'),
    dashboard: document.getElementById('view-dashboard'),
    synthesis: document.getElementById('view-synthesis'),
  };

  /* ── Show a view ─────────────────────────────────────────── */
  function show(name) {
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      el.hidden = (key !== name);
    });
    document.body.dataset.view = name;

    if (name === 'auth') {
      if (window._startTreeCanvas) window._startTreeCanvas();
    } else {
      if (window._treeCanvasCleanup) window._treeCanvasCleanup();
    }

    if (name === 'dashboard' && window.Dashboard) {
      window.Dashboard.initFromState();
    }

    if (name === 'synthesis') {
      // Reset scroll to top — .synth-main is the overflow-y:auto container
      const synthMain = document.querySelector('.synth-main');
      if (synthMain) synthMain.scrollTop = 0;
      window.scrollTo(0, 0);
      _initSynthesisUser();
    }
  }

  /* ── Reset dashboard DOM on logout ──────────────────────── */
  function _resetDashboardDOM() {
    // Reset stage cards to default state
    document.querySelectorAll('.stage-card').forEach((card, i) => {
      card.dataset.status = i === 0 ? 'not-started' : 'locked';

      const markBtn = card.querySelector('.stage-mark-btn');
      if (markBtn) {
        markBtn.disabled = i !== 0;
        markBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2.5 7.5l3.5 3.5 6.5-6.5"/></svg>
          Mark complete
        `;
      }
      const expandBtn = card.querySelector('.stage-expand-btn');
      if (expandBtn) {
        expandBtn.disabled = i !== 0;
        expandBtn.setAttribute('aria-expanded', 'false');
      }

      const pill = card.querySelector('.stage-status-pill');
      if (pill && i !== 0) pill.classList.add('stage-status-pill--locked');

      // Re-hide expanded content
      const exp = card.querySelector('.stage-expanded-content');
      if (exp) exp.classList.add('stage-expanded-content--hidden');
      const area = card.querySelector('.stage-content-area');
      if (area) area.style.display = '';
    });

    // Reset CTA
    const cta = document.getElementById('completion-cta');
    if (cta) cta.hidden = true;

    // Reset header glow
    document.querySelector('.topic-header')?.classList.remove('topic-header--complete');

    // Reset progress chips
    [0,1,2,3].forEach(i => {
      document.getElementById(`chip-${i}`)?.classList.remove('progress-chip--done');
      document.getElementById(`chipline-${i}`)?.classList.remove('progress-chip-line--filled');
    });

    // Reset stats
    const sc = document.getElementById('stat-completed');
    const sp = document.getElementById('stat-percent');
    const rf = document.getElementById('progress-ring-fill');
    const sb = document.getElementById('sidebar-progress');
    if (sc) sc.textContent = '0';
    if (sp) sp.textContent = '0%';
    if (sb) sb.textContent = '0 of 4 stages';
    if (rf) rf.style.strokeDashoffset = '100';

    // Reset nav badge
    const badge = document.getElementById('synthesis-nav-badge');
    if (badge) {
      badge.textContent = 'Locked';
      badge.classList.remove('sidebar-link-badge--unlocked');
    }

    // Clear assessment inputs & feedback
    [0, 1, 2, 3].forEach(idx => {
      const input = document.getElementById(`assessment-input-${idx}`);
      if (input) input.value = '';
      const feedback = document.getElementById(`assessment-feedback-${idx}`);
      if (feedback) {
        feedback.innerHTML = '';
        feedback.hidden = true;
      }
      const badge = document.getElementById(`mastery-badge-${idx}`);
      if (badge) badge.hidden = true;
    });

    // Reset user info display
    const sbName = document.getElementById('sidebar-user-name');
    const sbAvatar = document.getElementById('user-avatar-initials');
    const synthName = document.getElementById('synth-user-name');
    const synthAvatar = document.getElementById('synth-user-avatar');
    if (sbName) sbName.textContent = '';
    if (sbAvatar) sbAvatar.textContent = '';
    if (synthName) synthName.textContent = '';
    if (synthAvatar) synthAvatar.textContent = '';

    // Clear chat history in DOM
    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) chatContainer.innerHTML = '';

    // Clear auth form fields
    ['login-email', 'login-password', 'signup-name', 'signup-email', 'signup-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Hide tutor chat drawer on logout
    const chatDrawer = document.getElementById('tutor-chat-drawer');
    if (chatDrawer) {
      chatDrawer.classList.remove('tutor-chat-drawer--open');
      chatDrawer.hidden = true;
    }
  }

  /* ── Populate synthesis page user info ───────────────────── */
  function _initSynthesisUser() {
    const user = State.get().currentUser;
    if (!user) return;
    const parts = user.name.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();

    const nameEl   = document.getElementById('synth-user-name');
    const avatarEl = document.getElementById('synth-user-avatar');
    if (nameEl)   nameEl.textContent   = user.name;
    if (avatarEl) avatarEl.textContent = initials;

    if (window.Synthesis) {
      window.Synthesis.init();
    }
  }

  State.subscribe(() => {
    if (document.body.dataset.view === 'synthesis' && window.Synthesis) {
      window.Synthesis.render();
    }
  });

  /* ── App Loader dismissal helper ────────────────────────── */
  function hideAppLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.add('app-loader--hidden');
      setTimeout(() => loader.remove(), 300);
    }
  }

  /* ── Logout (both sidebars) ──────────────────────────────── */
  async function handleLogout() {
    try {
      if (window.SupabaseService) {
        await window.SupabaseService.signOut();
      }
    } catch (err) {
      console.warn('[App] Sign out error:', err);
    }
    State.logout();
    _resetDashboardDOM();
    // Clean reload to ensure 100% fresh state with zero in-memory variables or cached DOM states
    window.location.replace(window.location.origin + window.location.pathname);
  }

  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-logout-synth')?.addEventListener('click', handleLogout);

  /* ── Synthesis back button ───────────────────────────────── */
  document.getElementById('btn-back-to-dashboard')?.addEventListener('click', () => show('dashboard'));
  document.getElementById('nav-home-synthesis')?.addEventListener('click',    () => show('dashboard'));

  /* ── Initial routing via Supabase session (No race condition) ── */
  let _initialBootDone = false;

  async function initSession() {
    // 1. Check for error params in URL hash or query (e.g. expired magic link)
    const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
    const rawSearch = window.location.search ? window.location.search.substring(1) : '';
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);

    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error');

    if (errorCode || errorDesc) {
      console.warn('[App] Auth redirect error detected:', { errorCode, errorDesc });
      window.history.replaceState(null, '', window.location.pathname);
      show('auth');
      _initialBootDone = true;
      hideAppLoader();

      if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
        window.Auth?.showAlert?.('This link has expired or has already been used. Please request a new one below.', 'warning');
      } else {
        const decoded = errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'Authentication link is invalid or expired.';
        window.Auth?.showAlert?.(decoded, 'danger');
      }
      return;
    }

    // 2. Check for password recovery flow in URL hash or global flag
    const isRecovery = window.location.hash.includes('type=recovery') || window._isPasswordRecovery;
    if (isRecovery) {
      console.log('[App] Password recovery mode detected from redirect');
      window._isPasswordRecovery = true;
      window.history.replaceState(null, '', window.location.pathname);
      show('auth');
      window.Auth?.showView?.('new-password');
      _initialBootDone = true;
      hideAppLoader();
      return;
    }

    // 3. Regular session restoration (e.g. email confirmation redirect or existing login)
    try {
      if (window.SupabaseService) {
        const session = await window.SupabaseService.getSession();
        if (session?.user) {
          // Double check if recovery flag was set during session parsing
          if (window._isPasswordRecovery) {
            show('auth');
            window.Auth?.showView?.('new-password');
            _initialBootDone = true;
            hideAppLoader();
            return;
          }

          console.log('[App] Active session restored for:', session.user.email);
          if (window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          await State.initFromSupabase(session.user, session);
          show('dashboard');
          _initialBootDone = true;
          hideAppLoader();
          return;
        }
      }
    } catch (err) {
      console.error('[App] Error restoring session on boot:', err);
    }

    // No valid session found
    show('auth');
    _initialBootDone = true;
    hideAppLoader();
  }

  initSession();

  // Listen for auth events (cross-tab, password recovery, login/logout)
  if (window.SupabaseService) {
    window.SupabaseService.onAuthStateChange(async (event, session) => {
      console.log('[App] Supabase auth event received:', event);

      // Password recovery must be intercepted immediately, even before initial boot resolves
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[App] PASSWORD_RECOVERY event received -> opening Create New Password screen');
        window._isPasswordRecovery = true;
        show('auth');
        window.Auth?.showView?.('new-password');
        hideAppLoader();
        return;
      }

      // Ignore standard background sync until initial boot has determined current state
      if (!_initialBootDone) return;

      if (event === 'SIGNED_OUT') {
        State.logout();
        _resetDashboardDOM();
        window.location.replace(window.location.origin + window.location.pathname);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Suppress auto-navigation to dashboard if user is currently resetting password
        if (window._isPasswordRecovery) {
          console.log('[App] SIGNED_IN suppressed due to recovery mode in progress.');
          return;
        }

        const currentUser = State.get().currentUser;
        if (!currentUser || currentUser.id !== session.user.id) {
          console.log('[App] Auth state changed to SIGNED_IN for:', session.user.email);
          await State.initFromSupabase(session.user, session);
          show('dashboard');
        }
      }
    });
  }

  /* ── Expose globally ─────────────────────────────────────── */
  window.App = {
    showAuth:      (subView) => {
      show('auth');
      if (subView && window.Auth?.showView) {
        window.Auth.showView(subView);
      }
    },
    showDashboard: () => show('dashboard'),
    showSynthesis: () => show('synthesis'),
  };

})();
