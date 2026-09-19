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
      _resetDashboardDOM();
    } else {
      if (window._treeCanvasCleanup) window._treeCanvasCleanup();
    }

    if (name === 'dashboard' && window.Dashboard) {
      window.Dashboard.initFromState();
    }

    if (name === 'synthesis') {
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

  /* ── Logout (both sidebars) ──────────────────────────────── */
  function handleLogout() {
    State.logout();
    show('auth');
  }

  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-logout-synth')?.addEventListener('click', handleLogout);

  /* ── Synthesis back button ───────────────────────────────── */
  document.getElementById('btn-back-to-dashboard')?.addEventListener('click', () => show('dashboard'));
  document.getElementById('nav-home-synthesis')?.addEventListener('click',    () => show('dashboard'));

  /* ── Initial routing ─────────────────────────────────────── */
  const state = State.get();
  if (state.currentUser) {
    show('dashboard');
  } else {
    show('auth');
  }

  /* ── Expose globally ─────────────────────────────────────── */
  window.App = {
    showAuth:      () => show('auth'),
    showDashboard: () => show('dashboard'),
    showSynthesis: () => show('synthesis'),
  };

})();
