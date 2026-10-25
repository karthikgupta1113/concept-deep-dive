/**
 * js/router.js
 * Hash-based SPA Router for Concept Deep-Dive (#/route)
 *
 * Implements:
 *   - Hash routing with browser Back/Forward & refresh support
 *   - Route guards:
 *       * unauthenticated users redirected to #/login (except public routes: login, signup, forgot, reset, privacy)
 *       * authenticated users visiting login/signup redirected to saved step or #/welcome
 *       * #/step/<id> restricted to current step or completed steps (locked redirects to current)
 *       * #/summary locked until path is complete
 *   - Smooth page transitions (fade/slide ~250ms)
 *   - Accessible heading focus management on route change
 *   - Top bar synchronization (Preparation meter ring & percentage, user dropdown, pause/save)
 *   - Sign out handling with complete clearing of user cached data from localStorage
 */

const Router = (() => {
  'use strict';

  let _currentPath = '';
  const _routes = [];
  const PUBLIC_ROUTES = ['/login', '/signup', '/forgot', '/reset', '/privacy'];

  /* ── Register a route pattern ────────────────────────────── */
  function add(pattern, handler, guard) {
    const keys = [];
    const regexPattern = pattern
      .replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      });
    const regex = new RegExp(`^${regexPattern}$`);
    _routes.push({ pattern, regex, keys, handler, guard });
  }

  /* ── Get current normalized path string without hash ─────── */
  function current() {
    const hash = window.location.hash || '';
    if (!hash || hash === '#') return '/';
    return hash.replace(/^#/, '');
  }

  /* ── Navigate programmatically ───────────────────────────── */
  function go(path) {
    const target = path.startsWith('/') ? path : '/' + path;
    const newHash = '#' + target;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
    _dispatch();
  }

  /* ── Match current path against route table ───────────────── */
  function _match(path) {
    const cleanPath = path.split('?')[0];
    for (const route of _routes) {
      const match = cleanPath.match(route.regex);
      if (match) {
        const params = {};
        route.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1]);
        });
        return { route, params };
      }
    }
    return null;
  }

  /* ── Helper: Check active session ────────────────────────── */
  function _hasSession() {
    const user = (typeof State !== 'undefined') ? State.get().currentUser : null;
    if (user && user.id) return true;
    if (typeof PathStore !== 'undefined' && PathStore.getSessionUser && PathStore.getSessionUser()) {
      return true;
    }
    return false;
  }

  /* ── Helper: Resolve saved step or #/welcome ─────────────── */
  function getSavedStepOrWelcome() {
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

  /* ── Sync Top Bar (Meter, User, Avatar) ───────────────────── */
  function syncTopbar() {
    const topbar = document.getElementById('app-topbar');
    if (!topbar) return;

    const user = (typeof State !== 'undefined') ? State.get().currentUser : null;
    const cleanPath = _currentPath.split('?')[0];
    const isPublic = PUBLIC_ROUTES.includes(cleanPath);
    const isWelcome = cleanPath === '/welcome' || cleanPath === '/' || cleanPath === '';

    if (!user || isPublic || isWelcome) {
      topbar.hidden = true;
      document.body.dataset.route = cleanPath.replace(/^\//, '').split('/')[0] || 'app';
      return;
    }

    topbar.hidden = false;
    document.body.dataset.route = cleanPath.replace(/^\//, '').split('/')[0] || 'app';

    // Preparation Meter
    let weightedPct = 0;
    if (typeof Roadmap !== 'undefined' && Roadmap.getProgress) {
      weightedPct = Roadmap.getProgress().weightedPct || 0;
    }

    const pctEl = document.getElementById('topbar-prep-pct');
    const ringFill = document.getElementById('topbar-ring-fill');
    if (pctEl) pctEl.textContent = `${weightedPct}%`;
    if (ringFill) {
      ringFill.style.strokeDashoffset = String(Math.max(0, 100 - weightedPct));
    }

    // User details & avatar
    const name = user.name || 'Learner';
    const parts = name.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();

    const avatarEl = document.getElementById('topbar-user-avatar');
    const nameEl = document.getElementById('dropdown-user-name');
    const levelEl = document.getElementById('dropdown-user-level');

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = name;
    if (levelEl) {
      const profile = State.getProfile ? State.getProfile() : null;
      levelEl.textContent = (profile && profile.level) ? profile.level : 'Beginner';
    }
  }

  /* ── Smooth Page Transition & Focus Management ───────────── */
  function _applyTransitionAndFocus(container) {
    container.classList.remove('page-enter');
    void container.offsetWidth; // Force CSS reflow
    container.classList.add('page-enter');

    // Move focus to first heading on page for accessibility
    setTimeout(() => {
      const heading = container.querySelector('h1, h2, [data-page-heading]') || container;
      if (heading) {
        if (typeof heading.setAttribute === 'function') heading.setAttribute('tabindex', '-1');
        if (typeof heading.focus === 'function') heading.focus({ preventScroll: true });
      }
    }, 40);

    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  /* ── Sign Out ────────────────────────────────────────────── */
  async function signOut() {
    const dropdown = document.getElementById('topbar-user-dropdown');
    if (dropdown) dropdown.hidden = true;

    // 1. Supabase sign out
    const client = window.supabaseClient || (typeof getSupabaseClient === 'function' ? getSupabaseClient() : null);
    if (client && client.auth) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('[Router] Supabase signOut error:', err);
      }
    }

    // 2. Clear that user's cached data from localStorage
    if (typeof PathStore !== 'undefined' && typeof PathStore.clearAll === 'function') {
      PathStore.clearAll();
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('cdd') || k.startsWith('sb-') || k.includes('supabase'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    } catch (_) {}

    // 3. Clear in-memory State
    if (typeof State !== 'undefined' && typeof State.logout === 'function') {
      State.logout();
    }

    // 4. Hide Topbar
    const topbar = document.getElementById('app-topbar');
    if (topbar) topbar.hidden = true;

    // 5. Navigate to /login
    go('/login');
  }

  /* ── Route Dispatcher ────────────────────────────────────── */
  function _dispatch() {
    let path = current();

    // Check for Supabase tokens or error in hash (e.g. from password recovery email or verification)
    const fullHash = window.location.hash || '';
    if (fullHash.includes('type=recovery')) {
      _currentPath = '/reset';
      go('/reset');
      return;
    }
    if (fullHash.includes('error=')) {
      const match = fullHash.match(/error_description=([^&]+)/);
      const errMsg = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Authentication notice';
      _currentPath = '/login';
      go('/login');
      setTimeout(() => {
        if (window.Auth && window.Auth.showAlert) window.Auth.showAlert(errMsg, 'danger');
      }, 80);
      return;
    }

    const hasSession = _hasSession();
    const cleanPath = path.split('?')[0];

    // Handle root / empty hash
    if (cleanPath === '/' || cleanPath === '') {
      if (!hasSession) {
        go('/login');
        return;
      }
      go(getSavedStepOrWelcome());
      return;
    }

    // ROUTE GUARD: If no session, every route except login, signup, forgot, reset, and privacy page redirects to #/login
    const isPublic = PUBLIC_ROUTES.some(p => cleanPath === p || cleanPath.startsWith(p + '/'));
    if (!hasSession && !isPublic) {
      go('/login');
      return;
    }

    // If authenticated user visits login, signup, or forgot, redirect to saved step or welcome
    if (hasSession && (cleanPath === '/login' || cleanPath === '/signup' || cleanPath === '/forgot')) {
      go(getSavedStepOrWelcome());
      return;
    }

    _currentPath = path;

    const matched = _match(path);
    const pageRoot = document.getElementById('page-root');
    if (!pageRoot) return;

    if (!matched) {
      console.warn(`[Router] No route match for: ${path}`);
      if (!hasSession) {
        go('/login');
      } else {
        go(getSavedStepOrWelcome());
      }
      return;
    }

    const { route, params } = matched;

    // Run route-specific guard if present
    if (typeof route.guard === 'function') {
      const redirectPath = route.guard(params);
      if (redirectPath) {
        if (redirectPath !== path) {
          go(redirectPath);
          return;
        }
      }
    }

    // Move back and hide any persistent views currently in pageRoot
    ['view-auth', 'view-onboarding', 'view-dashboard', 'view-synthesis'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.parentElement === pageRoot) {
          document.body.appendChild(el);
        }
        el.hidden = true;
      }
    });

    // Execute route handler into #page-root
    route.handler(params, pageRoot);

    // Sync shell UI
    syncTopbar();
    _applyTransitionAndFocus(pageRoot);
  }

  /* ── Initialize listeners ────────────────────────────────── */
  function init() {
    window.addEventListener('hashchange', _dispatch);

    // Close user dropdown on outside clicks
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('topbar-user-dropdown');
      const userBtn = document.getElementById('btn-topbar-user');
      if (dropdown && !dropdown.hidden && userBtn && !userBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Wire Topbar interactive triggers
    const userBtn = document.getElementById('btn-topbar-user');
    const dropdown = document.getElementById('topbar-user-dropdown');
    if (userBtn && dropdown) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        userBtn.setAttribute('aria-expanded', String(!isOpen));
      });
    }

    // Topbar Pause & Save button
    const btnPause = document.getElementById('btn-pause-save');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (typeof Roadmap !== 'undefined' && Roadmap.syncStatsUI) {
          Roadmap.syncStatsUI();
        }
        if (typeof showToast === 'function') {
          showToast('Progress paused and safely saved. Return anytime!', 'success');
        } else {
          alert('Progress paused and safely saved. You can close your browser or return anytime.');
        }
      });
    }

    // Topbar AI Tutor button
    const btnTutor = document.getElementById('btn-topbar-tutor');
    if (btnTutor) {
      btnTutor.addEventListener('click', () => {
        if (window.Dashboard && typeof window.Dashboard.openChat === 'function') {
          window.Dashboard.openChat();
        } else {
          const drawer = document.getElementById('tutor-chat-drawer');
          if (drawer) {
            drawer.hidden = false;
            drawer.classList.add('tutor-chat-drawer--open');
          }
        }
      });
    }

    // Wire Sign Out buttons across the application
    document.getElementById('menu-item-signout')?.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
    document.getElementById('btn-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
    document.getElementById('btn-logout-synth')?.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });

    // Initial dispatch
    _dispatch();
  }

  return {
    add,
    go,
    current,
    init,
    syncTopbar,
    signOut,
    getSavedStepOrWelcome,
  };
})();

window.Router = Router;
