/**
 * app.js — SPA router (auth ↔ dashboard ↔ synthesis)
 * Database / Supabase session logic removed. Ready for fresh DB integration.
 */

(function initApp() {

  const views = {
    auth:       document.getElementById('view-auth'),
    onboarding: document.getElementById('view-onboarding'),
    dashboard:  document.getElementById('view-dashboard'),
    synthesis:  document.getElementById('view-synthesis'),
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

    if (name === 'onboarding' && window.Onboarding) {
      window.Onboarding.show();
    }

    if (name === 'dashboard' && window.Dashboard) {
      window.Dashboard.initFromState();
    }

    if (name === 'synthesis') {
      const synthMain = document.querySelector('.synth-main');
      if (synthMain) synthMain.scrollTop = 0;
      window.scrollTo(0, 0);
      _initSynthesisUser();
    }
  }

  /* ── Reset dashboard DOM on logout ──────────────────────── */
  function _resetDashboardDOM() {
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

      const exp = card.querySelector('.stage-expanded-content');
      if (exp) exp.classList.add('stage-expanded-content--hidden');
      const area = card.querySelector('.stage-content-area');
      if (area) area.style.display = '';
    });

    const cta = document.getElementById('completion-cta');
    if (cta) cta.hidden = true;

    document.querySelector('.topic-header')?.classList.remove('topic-header--complete');

    [0,1,2,3].forEach(i => {
      document.getElementById(`chip-${i}`)?.classList.remove('progress-chip--done');
      document.getElementById(`chipline-${i}`)?.classList.remove('progress-chip-line--filled');
    });

    const sc = document.getElementById('stat-completed');
    const sp = document.getElementById('stat-percent');
    const rf = document.getElementById('progress-ring-fill');
    const sb = document.getElementById('sidebar-progress');
    if (sc) sc.textContent = '0';
    if (sp) sp.textContent = '0%';
    if (sb) sb.textContent = '0 of 4 stages';
    if (rf) rf.style.strokeDashoffset = '100';

    const badge = document.getElementById('synthesis-nav-badge');
    if (badge) {
      badge.textContent = 'Locked';
      badge.classList.remove('sidebar-link-badge--unlocked');
    }

    [0, 1, 2, 3].forEach(idx => {
      const input = document.getElementById(`assessment-input-${idx}`);
      if (input) input.value = '';
      const feedback = document.getElementById(`assessment-feedback-${idx}`);
      if (feedback) {
        feedback.innerHTML = '';
        feedback.hidden = true;
      }
      const b = document.getElementById(`mastery-badge-${idx}`);
      if (b) b.hidden = true;
    });

    const sbName = document.getElementById('sidebar-user-name');
    const sbAvatar = document.getElementById('user-avatar-initials');
    const synthName = document.getElementById('synth-user-name');
    const synthAvatar = document.getElementById('synth-user-avatar');
    if (sbName) sbName.textContent = '';
    if (sbAvatar) sbAvatar.textContent = '';
    if (synthName) synthName.textContent = '';
    if (synthAvatar) synthAvatar.textContent = '';

    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) chatContainer.innerHTML = '';

    ['login-email', 'login-password', 'signup-name', 'signup-email', 'signup-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

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

  /* ── Logout ──────────────────────────────────────────────── */
  async function handleLogout() {
    _resetDashboardDOM();
    if (window.Router && typeof Router.signOut === 'function') {
      await Router.signOut();
    } else {
      if (typeof PathStore !== 'undefined') {
        PathStore.clearAll();
      }
      State.logout();
      window.location.hash = '#/login';
    }
  }

  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-logout-synth')?.addEventListener('click', handleLogout);

  /* ── Synthesis back button ───────────────────────────────── */
  document.getElementById('btn-back-to-dashboard')?.addEventListener('click', () => show('dashboard'));
  document.getElementById('nav-home-synthesis')?.addEventListener('click',    () => show('dashboard'));

  /* ── Change-level Modal & Direct Switcher ────────────────── */
  const modalChangeLevel = document.getElementById('modal-change-level');
  const btnCloseModal = document.getElementById('btn-close-modal-change-level');
  const btnCancelModal = document.getElementById('btn-cancel-modal-change-level');
  const btnRetakeOnboarding = document.getElementById('btn-retake-onboarding');

  function openChangeLevelModal() {
    if (modalChangeLevel) {
      modalChangeLevel.hidden = false;
      modalChangeLevel.setAttribute('aria-hidden', 'false');
    }
  }

  function closeChangeLevelModal() {
    if (modalChangeLevel) {
      modalChangeLevel.hidden = true;
      modalChangeLevel.setAttribute('aria-hidden', 'true');
    }
  }

  // Open modal triggers: buttons and sidebar level badges
  document.querySelectorAll('.btn-change-level').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openChangeLevelModal();
    });
  });

  document.querySelectorAll('.ob-sidebar-level-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      openChangeLevelModal();
    });
  });

  btnCloseModal?.addEventListener('click', closeChangeLevelModal);
  btnCancelModal?.addEventListener('click', closeChangeLevelModal);
  modalChangeLevel?.addEventListener('click', (e) => {
    if (e.target === modalChangeLevel) closeChangeLevelModal();
  });

  function switchLevel(targetLevel) {
    if (!targetLevel) return;
    closeChangeLevelModal();

    // Reset path data and switch profile to targetLevel
    if (typeof PathStore !== 'undefined') {
      PathStore.clearRoadmapProgress(targetLevel);
    }
    if (typeof State !== 'undefined') {
      State.resetPathState();
      State.setProfile({
        level: targetLevel,
        selfReportedLevel: targetLevel,
        placement: null,
        createdAt: Date.now(),
      });
    }

    // Sync level badges
    const labelMap = { beginner: 'Beginner', intermediate: 'Intermediate', revision: 'Revision' };
    const badgeText = labelMap[targetLevel] || targetLevel;
    document.querySelectorAll('.ob-sidebar-level-badge').forEach(el => {
      el.textContent = badgeText;
    });

    // Re-init roadmap with forceFresh=true
    if (window.Roadmap) {
      Roadmap.init(true);
    }

    if (window.Router) {
      Router.go('/ready');
    } else {
      show('dashboard');
    }
    if (typeof showToast === 'function') {
      showToast(`Switched learning path to ${badgeText} level!`, 'success');
    }
  }

  // Action 1: Directly switch level from modal
  document.getElementById('btn-quick-beginner')?.addEventListener('click', () => switchLevel('beginner'));
  document.getElementById('btn-quick-intermediate')?.addEventListener('click', () => switchLevel('intermediate'));
  document.getElementById('btn-quick-revision')?.addEventListener('click', () => switchLevel('revision'));
  document.querySelectorAll('.cdd-level-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetLevel = btn.dataset.level || e.currentTarget?.dataset?.level;
      if (targetLevel) switchLevel(targetLevel);
    });
  });

  // Action 2: Retake full placement onboarding
  btnRetakeOnboarding?.addEventListener('click', () => {
    closeChangeLevelModal();

    if (typeof PathStore !== 'undefined' && typeof PathStore.clear === 'function') {
      PathStore.clear();
    }
    if (typeof State !== 'undefined') {
      if (typeof State.resetPathState === 'function') State.resetPathState();
      if (typeof State.setProfile === 'function') State.setProfile(null);
    }
    if (window.Roadmap && typeof Roadmap.reset === 'function') {
      Roadmap.reset();
    }

    if (window.Router) {
      Router.go('/level');
    } else {
      show('onboarding');
      if (window.Onboarding) {
        window.Onboarding.show();
      }
    }
  });

  /* ── Initial boot — restore session if previously logged in ── */
  async function initSession() {
    let currentUser = null;

    // Check Supabase session across page refreshes
    const client = window.supabaseClient || (typeof getSupabaseClient === 'function' ? getSupabaseClient() : null);
    if (client && client.auth) {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        if (session && session.user) {
          currentUser = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Learner',
            user_metadata: session.user.user_metadata
          };
        }
      } catch (err) {
        console.warn('[App] Error getting Supabase session:', err);
      }
    }

    // Fallback: check PathStore session user if client is mocked or offline
    if (!currentUser && typeof PathStore !== 'undefined') {
      const localUser = PathStore.getSessionUser();
      if (localUser && localUser.id) {
        currentUser = localUser;
      }
    }

    if (currentUser) {
      await State.initFromSupabase(currentUser);
      if (typeof PathStore !== 'undefined') {
        PathStore.setSessionUser(currentUser);
      }
      if (typeof CloudStore !== 'undefined' && CloudStore.onLogin) {
        await CloudStore.onLogin(currentUser);
      }
      if (typeof Roadmap !== 'undefined') {
        Roadmap.init();
      }
    } else {
      State.logout();
      if (typeof PathStore !== 'undefined') {
        PathStore.clearSessionUser();
      }
    }

    // Subscribe to Supabase auth events
    if (client && client.auth && client.auth.onAuthStateChange) {
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const u = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Learner',
            user_metadata: session.user.user_metadata
          };
          await State.initFromSupabase(u);
          if (typeof PathStore !== 'undefined') {
            PathStore.setSessionUser(u);
          }
          if (typeof CloudStore !== 'undefined' && CloudStore.onLogin) {
            await CloudStore.onLogin(u);
          }
        } else if (event === 'SIGNED_OUT') {
          _resetDashboardDOM();
          State.logout();
          if (typeof PathStore !== 'undefined') {
            PathStore.clearAll();
          }
          if (window.Router) {
            Router.go('/login');
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          if (window.Router) {
            Router.go('/reset');
          }
        }
      });
    }

    if (window.Router && typeof Router.init === 'function') {
      Router.init();
    } else {
      if (currentUser) {
        if (State.getProfile()) {
          show('dashboard');
        } else {
          show('onboarding');
          if (window.Onboarding) {
            window.Onboarding.show();
          }
        }
      } else {
        show('auth');
      }
    }
    hideAppLoader();
  }

  initSession();

  /* ── Expose globally ─────────────────────────────────────── */
  window.App = {
    showAuth:       (subView) => {
      const subMap = {
        login: '/login',
        signup: '/signup',
        'forgot-password': '/forgot',
        'new-password': '/reset',
      };
      const target = (subView && subMap[subView]) || '/login';
      if (window.Router) {
        Router.go(target);
      } else {
        show('auth');
      }
      if (subView && window.Auth?.showView) {
        window.Auth.showView(subView);
      }
    },
    showOnboarding: () => {
      if (window.Router) {
        Router.go('/level');
      } else {
        show('onboarding');
        if (window.Onboarding) {
          window.Onboarding.show();
        }
      }
    },
    showDashboard:  () => {
      if (window.Router) {
        const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
        Router.go(curr ? ('/step/' + curr.id) : '/ready');
      } else {
        show('dashboard');
      }
    },
    showSynthesis:  () => {
      if (window.Router) {
        Router.go('/summary');
      } else {
        show('synthesis');
      }
    },
  };

})();
