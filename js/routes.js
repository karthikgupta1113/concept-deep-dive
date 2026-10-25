/**
 * js/routes.js
 * Route definitions and page rendering for Concept Deep-Dive
 *
 * All routes render into single #page-root container.
 * Strict future-step hiding enforced everywhere.
 */

(function initRoutes() {
  'use strict';

  /* ── Helper: Topic labels mapping ────────────────────────── */
  const TOPIC_LABELS = {
    'nodes': 'Node Structure & Hierarchy',
    'invariant': 'BST Search Invariant',
    'search-insert': 'Search & Insertion Mechanics',
    'deletion': 'Deletion Cases & Rebalancing',
    'height-balance': 'Height, Depth & Balance Factor',
    'traversals': 'In-Order, Pre-Order & Post-Order',
    'balancing': 'Self-Balancing Trees & Rotations',
    'applications': 'Real-World Systems & Applications',
  };

  function getNextRouteAfterCheckin() {
    const profile = State.getProfile ? State.getProfile() : null;
    if (!profile || !profile.level) return '/level';
    if (typeof Roadmap !== 'undefined' && Roadmap.isInitialized && !Roadmap.isInitialized()) {
      Roadmap.init();
    }
    const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
    return curr ? ('/step/' + curr.id) : '/ready';
  }

  /* ── Auth View Mount Helper ────────────────────────────── */
  function mountAuthView(root, subView) {
    root.innerHTML = '';
    const authView = document.getElementById('view-auth');
    if (authView) {
      authView.hidden = false;
      root.appendChild(authView);
    }
    if (window.Auth && window.Auth.showView) {
      window.Auth.showView(subView);
    }
    if (window._startTreeCanvas) {
      window._startTreeCanvas();
    }
  }

  /* ── Route: #/login ──────────────────────────────────────── */
  Router.add('/login', (params, root) => {
    mountAuthView(root, 'login');
  }, () => {
    const user = typeof State !== 'undefined' ? State.get().currentUser : null;
    if (user && user.id) {
      return (typeof Router !== 'undefined' && Router.getSavedStepOrWelcome) ? Router.getSavedStepOrWelcome() : '/welcome';
    }
    return null;
  });

  /* ── Route: #/signup ─────────────────────────────────────── */
  Router.add('/signup', (params, root) => {
    mountAuthView(root, 'signup');
  }, () => {
    const user = typeof State !== 'undefined' ? State.get().currentUser : null;
    if (user && user.id) {
      return (typeof Router !== 'undefined' && Router.getSavedStepOrWelcome) ? Router.getSavedStepOrWelcome() : '/welcome';
    }
    return null;
  });

  /* ── Route: #/forgot ─────────────────────────────────────── */
  Router.add('/forgot', (params, root) => {
    mountAuthView(root, 'forgot-password');
  }, () => {
    const user = typeof State !== 'undefined' ? State.get().currentUser : null;
    if (user && user.id) {
      return (typeof Router !== 'undefined' && Router.getSavedStepOrWelcome) ? Router.getSavedStepOrWelcome() : '/welcome';
    }
    return null;
  });

  /* ── Route: #/reset ──────────────────────────────────────── */
  Router.add('/reset', (params, root) => {
    mountAuthView(root, 'new-password');
  }, () => {
    return null;
  });

  /* ── Route: #/privacy ────────────────────────────────────── */
  Router.add('/privacy', () => {
    window.location.href = 'privacy.html';
  });

  /* ── Route: #/welcome ────────────────────────────────────── */
  Router.add('/welcome', (params, root) => {
    const user = typeof State !== 'undefined' ? State.get().currentUser : null;
    const userName = (user && user.name) ? user.name : 'Learner';

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card" style="max-width: 680px; margin: 40px auto; padding: 48px 36px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">🌲</div>
          <h1 data-page-heading style="font-size: 2rem; font-family: var(--font-display); color: var(--cream); margin-bottom: 12px;">
            Welcome to Concept Deep‑Dive, ${userName}
          </h1>
          <p style="font-size: 1.0625rem; color: var(--cream-2); line-height: 1.6; margin-bottom: 32px; max-width: 540px; margin-left: auto; margin-right: auto;">
            One topic. Full depth. No shortcuts. Master Trees and Binary Search Trees through first principles, interactive simulations, and adaptive Socratic AI guidance.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 36px; text-align: left;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px;">
              <span style="font-size: 1.5rem; display: block; margin-bottom: 8px;">🎯</span>
              <strong style="color: var(--cream); font-size: 0.9375rem; display: block;">Depth-First Mastery</strong>
              <span style="color: var(--cream-3); font-size: 0.8125rem;">Build rock-solid mental models of pointers, invariants, and heights.</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px;">
              <span style="font-size: 1.5rem; display: block; margin-bottom: 8px;">✨</span>
              <strong style="color: var(--cream); font-size: 0.9375rem; display: block;">Socratic AI Tutor</strong>
              <span style="color: var(--cream-3); font-size: 0.8125rem;">Ask questions anytime. Learn through inquiry, not passive memorization.</span>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px;">
              <span style="font-size: 1.5rem; display: block; margin-bottom: 8px;">🌱</span>
              <strong style="color: var(--cream); font-size: 0.9375rem; display: block;">Tailored Placement</strong>
              <span style="color: var(--cream-3); font-size: 0.8125rem;">Start right where you need: Beginner, Intermediate, or Revision.</span>
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="#/level" class="btn btn--primary" style="padding: 14px 28px; font-size: 1rem; text-decoration: none;">
              Begin Your Placement →
            </a>
          </div>
        </div>
      </div>
    `;
  }, () => {
    const user = typeof State !== 'undefined' ? State.get().currentUser : null;
    if (!user || !user.id) return '/login';
    const savedRoute = (typeof Router !== 'undefined' && Router.getSavedStepOrWelcome) ? Router.getSavedStepOrWelcome() : null;
    if (savedRoute && savedRoute !== '/welcome') {
      return savedRoute;
    }
    return null;
  });

  /* ── Route 2: #/checkin ──────────────────────────────────── */
  Router.add('/checkin', (params, root) => {
    const existingGoal = typeof PathStore !== 'undefined' && PathStore.getGoal ? PathStore.getGoal() : null;

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card checkin-card" style="max-width: 660px; margin: 0 auto; padding: 40px 32px;">
          <header class="checkin-header" style="text-align: center; margin-bottom: 32px;">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🌱</div>
            <h1 class="checkin-title" data-page-heading style="font-size: 1.75rem; font-family: var(--font-display); color: var(--cream); margin-bottom: 8px;">
              Checking in with you
            </h1>
            <p style="color: var(--cream-2); font-size: 0.9375rem; margin: 0; line-height: 1.5;">
              A quick pulse before we explore trees today. Casual and optional — calibrate your mindset, or skip straight to studying.
            </p>
          </header>

          <form id="checkin-form" novalidate>
            <!-- Question 1: Mood (4 large buttons) -->
            <section class="checkin-section" style="margin-bottom: 28px;">
              <label class="checkin-label" style="font-size: 1rem; font-weight: 600; color: var(--cream); display: block; margin-bottom: 12px;">
                How are you feeling about studying right now?
              </label>
              <div class="checkin-mood-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" role="radiogroup" aria-label="How are you feeling about studying right now?">
                <button type="button" class="btn btn--outline checkin-mood-btn" data-mood="Energised" style="padding: 16px 12px; text-align: center; border-radius: 12px;">
                  <span style="font-size: 1.75rem; display: block; margin-bottom: 4px;">⚡</span>
                  <span style="font-weight: 600; font-size: 0.9375rem;">Energised</span>
                </button>
                <button type="button" class="btn btn--outline checkin-mood-btn" data-mood="Okay" style="padding: 16px 12px; text-align: center; border-radius: 12px;">
                  <span style="font-size: 1.75rem; display: block; margin-bottom: 4px;">🌿</span>
                  <span style="font-weight: 600; font-size: 0.9375rem;">Okay</span>
                </button>
                <button type="button" class="btn btn--outline checkin-mood-btn" data-mood="Tired" style="padding: 16px 12px; text-align: center; border-radius: 12px;">
                  <span style="font-size: 1.75rem; display: block; margin-bottom: 4px;">🥱</span>
                  <span style="font-weight: 600; font-size: 0.9375rem;">Tired</span>
                </button>
                <button type="button" class="btn btn--outline checkin-mood-btn" data-mood="Stressed" style="padding: 16px 12px; text-align: center; border-radius: 12px;">
                  <span style="font-size: 1.75rem; display: block; margin-bottom: 4px;">🌧️</span>
                  <span style="font-weight: 600; font-size: 0.9375rem;">Stressed</span>
                </button>
              </div>
            </section>

            <!-- Question 2: Confidence (1-5 buttons) -->
            <section class="checkin-section" style="margin-bottom: 28px;">
              <label class="checkin-label" style="font-size: 1rem; font-weight: 600; color: var(--cream); display: block; margin-bottom: 12px;">
                How confident do you feel about trees and BSTs?
              </label>
              <div class="checkin-conf-grid" style="display: flex; gap: 8px; justify-content: space-between;" role="radiogroup" aria-label="Confidence in trees and BSTs">
                <button type="button" class="btn btn--outline checkin-conf-btn" data-conf="1" style="flex: 1; padding: 12px 6px; text-align: center; border-radius: 10px;">
                  <strong style="display: block; font-size: 1.125rem;">1</strong>
                  <span style="font-size: 0.6875rem; color: var(--cream-3);">Starting fresh</span>
                </button>
                <button type="button" class="btn btn--outline checkin-conf-btn" data-conf="2" style="flex: 1; padding: 12px 6px; text-align: center; border-radius: 10px;">
                  <strong style="display: block; font-size: 1.125rem;">2</strong>
                  <span style="font-size: 0.6875rem; color: var(--cream-3);">A little</span>
                </button>
                <button type="button" class="btn btn--outline checkin-conf-btn" data-conf="3" style="flex: 1; padding: 12px 6px; text-align: center; border-radius: 10px;">
                  <strong style="display: block; font-size: 1.125rem;">3</strong>
                  <span style="font-size: 0.6875rem; color: var(--cream-3);">Moderate</span>
                </button>
                <button type="button" class="btn btn--outline checkin-conf-btn" data-conf="4" style="flex: 1; padding: 12px 6px; text-align: center; border-radius: 10px;">
                  <strong style="display: block; font-size: 1.125rem;">4</strong>
                  <span style="font-size: 0.6875rem; color: var(--cream-3);">Solid</span>
                </button>
                <button type="button" class="btn btn--outline checkin-conf-btn" data-conf="5" style="flex: 1; padding: 12px 6px; text-align: center; border-radius: 10px;">
                  <strong style="display: block; font-size: 1.125rem;">5</strong>
                  <span style="font-size: 0.6875rem; color: var(--cream-3);">Very confident</span>
                </button>
              </div>
            </section>

            <!-- Question 3: Goal (Shown once per account, if not already set) -->
            ${!existingGoal ? `
              <section class="checkin-section" id="checkin-goal-section" style="margin-bottom: 32px;">
                <label class="checkin-label" style="font-size: 1rem; font-weight: 600; color: var(--cream); display: block; margin-bottom: 12px;">
                  What brings you here?
                </label>
                <div class="checkin-goal-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;" role="radiogroup" aria-label="What brings you here?">
                  <button type="button" class="btn btn--outline checkin-goal-btn" data-goal="Exam" style="padding: 12px; text-align: center; border-radius: 10px;">
                    <span style="font-size: 1.25rem; display: block; margin-bottom: 2px;">🎓</span>
                    <span>Exam</span>
                  </button>
                  <button type="button" class="btn btn--outline checkin-goal-btn" data-goal="Interview" style="padding: 12px; text-align: center; border-radius: 10px;">
                    <span style="font-size: 1.25rem; display: block; margin-bottom: 2px;">💼</span>
                    <span>Interview</span>
                  </button>
                  <button type="button" class="btn btn--outline checkin-goal-btn" data-goal="Curiosity" style="padding: 12px; text-align: center; border-radius: 10px;">
                    <span style="font-size: 1.25rem; display: block; margin-bottom: 2px;">🔍</span>
                    <span>Curiosity</span>
                  </button>
                  <button type="button" class="btn btn--outline checkin-goal-btn" data-goal="A project" style="padding: 12px; text-align: center; border-radius: 10px;">
                    <span style="font-size: 1.25rem; display: block; margin-bottom: 2px;">🛠️</span>
                    <span>A project</span>
                  </button>
                </div>
              </section>
            ` : ''}

            <!-- Actions Row: Continue & Prominent Skip -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 24px;">
              <button type="button" class="btn btn--ghost" id="btn-checkin-skip" style="color: var(--cream-3); font-weight: 500;">
                Skip for now →
              </button>
              <button type="submit" class="btn btn--primary btn--lg" id="btn-checkin-submit">
                Continue →
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    let selectedMood = null;
    let selectedConfidence = null;
    let selectedGoal = existingGoal || null;

    // Mood click handlers
    root.querySelectorAll('.checkin-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.checkin-mood-btn').forEach(b => {
          b.classList.remove('btn--primary');
          b.classList.add('btn--outline');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('btn--primary');
        btn.classList.remove('btn--outline');
        btn.setAttribute('aria-checked', 'true');
        selectedMood = btn.dataset.mood;
      });
    });

    // Confidence click handlers
    root.querySelectorAll('.checkin-conf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.checkin-conf-btn').forEach(b => {
          b.classList.remove('btn--primary');
          b.classList.add('btn--outline');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('btn--primary');
        btn.classList.remove('btn--outline');
        btn.setAttribute('aria-checked', 'true');
        selectedConfidence = parseInt(btn.dataset.conf, 10);
      });
    });

    // Goal click handlers
    root.querySelectorAll('.checkin-goal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.checkin-goal-btn').forEach(b => {
          b.classList.remove('btn--primary');
          b.classList.add('btn--outline');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('btn--primary');
        btn.classList.remove('btn--outline');
        btn.setAttribute('aria-checked', 'true');
        selectedGoal = btn.dataset.goal;
      });
    });

    function finishCheckin(isSkip = false) {
      if (typeof PathStore !== 'undefined') {
        if (!isSkip) {
          if (selectedGoal && PathStore.setGoal) {
            PathStore.setGoal(selectedGoal);
          }
          if (PathStore.addCheckin) {
            const isLowEnergy = selectedMood && (
              String(selectedMood).toLowerCase().trim() === 'tired' ||
              String(selectedMood).toLowerCase().trim() === 'stressed'
            );
            const checkinPayload = {
              mood: selectedMood,
              confidence: selectedConfidence,
              goal: selectedGoal
            };
            if (isLowEnergy) {
              checkinPayload.selfReportedLowEnergy = true;
            }
            PathStore.addCheckin(checkinPayload);
            if (typeof Signals !== 'undefined' && Signals.logCheckin) {
              Signals.logCheckin(checkinPayload);
            }
          }
        }
        if (PathStore.setSessionCheckedIn) {
          PathStore.setSessionCheckedIn();
        }
      }
      Router.go(getNextRouteAfterCheckin());
    }

    root.querySelector('#checkin-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      finishCheckin(false);
    });

    root.querySelector('#btn-checkin-skip')?.addEventListener('click', () => {
      finishCheckin(true);
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    // If checkins are turned off in settings, skip checkin page
    if (typeof Signals !== 'undefined' && !Signals.isCheckinsEnabled()) {
      return getNextRouteAfterCheckin();
    }
    // If already checked in this session, skip checkin page
    if (typeof PathStore !== 'undefined' && PathStore.isCheckedInThisSession && PathStore.isCheckedInThisSession()) {
      return getNextRouteAfterCheckin();
    }
    return null;
  });

  /* ── Route 3: #/level ────────────────────────────────────── */
  Router.add('/level', (params, root) => {
    root.innerHTML = `
      <div class="page-container">
        <div class="page-card ob-card">
          <div class="ob-logo" aria-hidden="true" style="margin-bottom: 24px;">
            <div class="ob-logo-mark">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#5FAB7A" stroke-width="1.5"/>
                <path d="M14 6v16M8 10l6-4 6 4M9 16l5-4 5 4M10 22l4-4 4 4" stroke="#5FAB7A" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="ob-logo-word">Concept Deep‑Dive</span>
          </div>

          <h1 class="ob-heading" data-page-heading>Where are you starting from?</h1>
          <p class="ob-subheading" style="margin-bottom: 28px;">We'll tailor the learning path to your current level.</p>

          <div class="ob-level-grid" role="radiogroup" aria-label="Learning level">
            <button class="ob-level-card" id="card-lvl-beginner" role="radio" aria-checked="false" data-level="beginner">
              <span class="ob-level-icon" aria-hidden="true">🌱</span>
              <div class="ob-level-text">
                <span class="ob-level-title">Beginner</span>
                <span class="ob-level-desc">New to trees. Start from the basics.</span>
              </div>
              <span class="ob-level-radio" aria-hidden="true"></span>
            </button>

            <button class="ob-level-card" id="card-lvl-intermediate" role="radio" aria-checked="false" data-level="intermediate">
              <span class="ob-level-icon" aria-hidden="true">🌿</span>
              <div class="ob-level-text">
                <span class="ob-level-title">Intermediate</span>
                <span class="ob-level-desc">I know the basics. Take me deeper.</span>
              </div>
              <span class="ob-level-radio" aria-hidden="true"></span>
            </button>

            <button class="ob-level-card" id="card-lvl-revision" role="radio" aria-checked="false" data-level="revision">
              <span class="ob-level-icon" aria-hidden="true">🌳</span>
              <div class="ob-level-text">
                <span class="ob-level-title">Just revising</span>
                <span class="ob-level-desc">I've learned this before. Quick refresher.</span>
              </div>
              <span class="ob-level-radio" aria-hidden="true"></span>
            </button>
          </div>

          <div class="ob-actions" style="margin-top: 32px; display: flex; justify-content: flex-end;">
            <button class="btn btn--primary btn--lg" id="btn-level-continue" disabled>
              Continue →
            </button>
          </div>
        </div>
      </div>
    `;

    let selectedLevel = null;
    const cards = root.querySelectorAll('.ob-level-card');
    const continueBtn = root.querySelector('#btn-level-continue');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => {
          c.classList.remove('ob-level-card--selected');
          c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('ob-level-card--selected');
        card.setAttribute('aria-checked', 'true');
        selectedLevel = card.dataset.level;
        if (continueBtn) continueBtn.disabled = false;
      });
    });

    continueBtn?.addEventListener('click', () => {
      if (!selectedLevel) return;

      if (typeof State !== 'undefined') {
        State.setProfile({
          level: selectedLevel,
          selfReportedLevel: selectedLevel,
          placement: null,
          createdAt: Date.now(),
        });
      }

      if (selectedLevel === 'beginner') {
        if (typeof PathStore !== 'undefined') {
          PathStore.clearRoadmapProgress('beginner');
        }
        if (typeof Roadmap !== 'undefined') {
          Roadmap.init(true);
        }
        Router.go('/ready');
      } else {
        Router.go('/placement');
      }
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 4: #/placement ────────────────────────────────── */
  Router.add('/placement', (params, root) => {
    const questions = [
      {
        cluster: 'foundations',
        text: 'In your own words, what is the difference between a binary tree and a binary search tree?',
      },
      {
        cluster: 'operations',
        text: 'Why does searching a BST take time proportional to its height, and how does deleting a node with two children work?',
      },
      {
        cluster: 'balancing',
        text: 'What happens to search time if you insert already-sorted values into a plain BST, and how do AVL trees prevent it?',
      },
    ];

    let currentQ = 0;
    const ratings = {};

    function renderQuestion() {
      const q = questions[currentQ];
      root.innerHTML = `
        <div class="page-container">
          <div class="page-card ob-card">
            <h1 class="ob-heading" data-page-heading>Placement Diagnostic</h1>
            <p class="ob-subheading" style="margin-bottom: 24px;">
              Quick check so we can tailor your path (Question ${currentQ + 1} of 3)
            </p>

            <div class="ob-progress-dots" style="display: flex; gap: 8px; margin-bottom: 24px;">
              ${questions.map((_, i) => `<span class="ob-dot ${i <= currentQ ? 'ob-dot--active' : ''}"></span>`).join('')}
            </div>

            <p class="ob-question" style="font-size: 1.125rem; color: var(--cream); margin-bottom: 16px; line-height: 1.5;">
              ${q.text}
            </p>

            <textarea
              class="ob-answer-textarea"
              id="ob-placement-answer"
              rows="5"
              placeholder="Type your explanation here in your own words..."
              style="width: 100%; box-sizing: border-box; margin-bottom: 20px;"
            ></textarea>

            <div class="ob-actions" style="display: flex; align-items: center; justify-content: space-between;">
              <button class="btn btn--ghost" id="btn-skip-diagnostic" type="button">
                Skip the check
              </button>
              <button class="btn btn--primary" id="btn-submit-diagnostic" disabled>
                Submit answer →
              </button>
            </div>
          </div>
        </div>
      `;

      const ta = root.querySelector('#ob-placement-answer');
      const submitBtn = root.querySelector('#btn-submit-diagnostic');
      const skipBtn = root.querySelector('#btn-skip-diagnostic');

      ta?.addEventListener('input', () => {
        if (submitBtn) submitBtn.disabled = !ta.value.trim();
      });

      submitBtn?.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Evaluating...';
        // Evaluate answer
        let rating = 'solid';
        try {
          if (typeof TutorChatService !== 'undefined' && TutorChatService.evaluatePlacement) {
            const res = await TutorChatService.evaluatePlacement(q.cluster, q.text, ta.value.trim());
            rating = res.rating || 'solid';
          }
        } catch (e) {
          console.error('[Placement] Diagnostic error:', e);
          const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(e) : 'Evaluation failed. Please try again.';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Retry Evaluation ↺';
          let errBanner = root.querySelector('#placement-err-banner');
          if (!errBanner) {
            errBanner = document.createElement('div');
            errBanner.id = 'placement-err-banner';
            errBanner.className = 'ob-eval-error-banner';
            errBanner.style.cssText = 'color: #ef4444; margin-top: 10px; font-size: 13px; font-weight: 500;';
            ta.parentNode.insertBefore(errBanner, ta.nextSibling);
          }
          errBanner.textContent = `⚠️ ${friendly}`;
          return;
        }

        ratings[q.cluster] = rating;

        if (typeof CloudStore !== 'undefined' && CloudStore.enqueue) {
          CloudStore.enqueue('assessment_results', {
            item_id: `placement-${q.cluster}`,
            rating: rating,
            score: rating === 'solid' ? 100 : (rating === 'partial' ? 65 : 35),
            band: rating,
            attempt: 1,
            detail: { cluster: q.cluster, question: q.prompt, rating, answer: ansText },
            created_at: new Date().toISOString()
          });
        }

        currentQ++;

        if (currentQ < questions.length) {
          renderQuestion();
        } else {
          finishPlacement(ratings);
        }
      });

      skipBtn?.addEventListener('click', () => {
        finishPlacement({ foundations: 'solid', operations: 'solid', balancing: 'solid' });
      });
    }

    function finishPlacement(resultRatings) {
      const profile = State.getProfile ? State.getProfile() : { level: 'intermediate' };
      const level = profile.level || 'intermediate';

      if (typeof State !== 'undefined') {
        State.setProfile({
          level,
          selfReportedLevel: level,
          placement: resultRatings,
          createdAt: Date.now(),
        });
      }

      if (typeof PathStore !== 'undefined') {
        PathStore.clearRoadmapProgress(level);
      }
      if (typeof Roadmap !== 'undefined') {
        Roadmap.init(true);
      }

      Router.go('/ready');
    }

    renderQuestion();
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 5: #/ready ────────────────────────────────────── */
  Router.add('/ready', (params, root) => {
    const profile = State.getProfile ? State.getProfile() : null;
    const levelName = profile?.level ? (profile.level.charAt(0).toUpperCase() + profile.level.slice(1)) : 'Personalised';

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card ready-card">
          <div class="ready-icon">🎯</div>
          <h1 class="step-page-title" data-page-heading>You're all set!</h1>
          <p class="ob-subheading" style="margin-bottom: 20px;">
            Your path has been personalised for depth and first-principles mastery.
          </p>
          <div class="ready-level-pill">${levelName} Level</div>
          <div class="ready-actions" style="margin-top: 24px;">
            <!-- Unlabelled Continue button opening next page without naming it -->
            <button type="button" class="btn btn--primary btn--lg" id="btn-ready-continue">
              Continue →
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-ready-continue')?.addEventListener('click', () => {
      if (typeof Roadmap !== 'undefined') {
        if (!Roadmap.isInitialized() || Roadmap.getSteps().length === 0) {
          Roadmap.init();
        }
        const curr = Roadmap.getCurrentStep();
        const first = Roadmap.getSteps()[0];
        Router.go('/step/' + ((curr && curr.id) || (first && first.id) || 'th-nodes'));
      } else {
        Router.go('/step/th-nodes');
      }
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 6: #/step/:id ─────────────────────────────────── */
  Router.add('/step/:id', (params, root) => {
    if (typeof Roadmap !== 'undefined' && Roadmap.renderStepTo) {
      Roadmap.renderStepTo(params.id, root);
    }
  }, (params) => {
    // Route guard: learner can only open current or completed steps.
    if (!State.get().currentUser) return '/login';
    if (!State.getProfile()) return '/level';

    if (typeof Roadmap !== 'undefined') {
      if (!Roadmap.isInitialized() || Roadmap.getSteps().length === 0) {
        Roadmap.init();
      }
      const steps = Roadmap.getSteps();
      const curr = Roadmap.getCurrentStep();
      const target = steps.find(s => s.id === params.id);

      if (!target) {
        return curr ? ('/step/' + curr.id) : '/ready';
      }

      // Check locked status
      if (target.status === 'locked') {
        if (typeof showToast === 'function') {
          showToast('This concept is locked. Complete your current concept first.', 'warning');
        }
        return curr ? ('/step/' + curr.id) : '/ready';
      }
    }
    return null;
  });

  /* ── Helper: Check if session wrap-up should trigger (Prompt 2) ── */
  function shouldTriggerWrapUp(stepId) {
    if (typeof PathStore === 'undefined') return false;
    const session = PathStore.getSession();

    // 1. Topic cluster finished check
    if (typeof Catalog !== 'undefined' && typeof CLUSTERS !== 'undefined' && typeof Roadmap !== 'undefined') {
      const item = Catalog.byId(stepId);
      if (item && Array.isArray(item.topics)) {
        let clusterKey = null;
        for (const [cKey, topics] of Object.entries(CLUSTERS)) {
          if (item.topics.some(t => topics.includes(t))) {
            clusterKey = cKey;
            break;
          }
        }

        if (clusterKey && (!session.completedClusterIds || !session.completedClusterIds.includes(clusterKey))) {
          const allSteps = Roadmap.getSteps();
          const clusterSteps = allSteps.filter(s => {
            const it = Catalog.byId(s.id);
            return it && it.topics && it.topics.some(t => CLUSTERS[clusterKey].includes(t));
          });

          if (clusterSteps.length > 0 && clusterSteps.every(s => s.status === 'done' || s.status === 'skipped')) {
            PathStore.markClusterCompleted(clusterKey);
            return true;
          }
        }
      }
    }

    // 2. 3 completed steps in current session block
    if ((session.stepsCompleted || 0) >= 3) {
      return true;
    }

    // 3. 25 minutes of activity elapsed
    const elapsedMs = Date.now() - (session.startTime || Date.now());
    if (elapsedMs >= 25 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /* ── Helper: Spaced retrieval question from earlier completed topics ── */
  function getSpacedRetrievalQuestion() {
    if (typeof Catalog === 'undefined' || typeof Roadmap === 'undefined') return null;

    const allSteps = Roadmap.getSteps();
    const completedStepIds = new Set(allSteps.filter(s => s.status === 'done').map(s => s.id));
    const allQuizzes = (typeof Catalog.byType === 'function' ? Catalog.byType('quiz') : []) || [];

    // Prioritize quizzes whose topic was completed
    const matching = allQuizzes.filter(q => {
      const qTopics = q.topics || [];
      return allSteps.some(s => completedStepIds.has(s.id) && Catalog.byId(s.id)?.topics?.some(t => qTopics.includes(t)));
    });

    if (matching.length > 0) {
      return matching[0];
    }

    return allQuizzes[0] || null;
  }

  /* ── Route 7: #/reflect/:id ──────────────────────────────── */
  Router.add('/reflect/:id', (params, root) => {
    const item = typeof Catalog !== 'undefined' ? Catalog.byId(params.id) : null;
    const title = item ? item.title : 'Concept';

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card reflect-micro-card">
          <div class="micro-progress-track">
            <div class="micro-progress-bar" id="reflect-timer-bar"></div>
          </div>

          <div class="reflect-micro-header">
            <span class="reflect-micro-badge">5-second reflection</span>
            <h1 class="reflect-micro-title" data-page-heading>How did that feel?</h1>
            <p class="reflect-micro-sub">Concept: <strong>${title}</strong></p>
          </div>

          <div class="reflect-micro-options" role="radiogroup" aria-label="How did that feel?">
            <button type="button" class="reflect-micro-btn" data-feeling="Clear" role="radio" aria-checked="false">
              <span class="reflect-micro-emoji">🌿</span>
              <strong class="reflect-micro-name">Clear</strong>
              <span class="reflect-micro-hint">Made total sense</span>
            </button>
            <button type="button" class="reflect-micro-btn" data-feeling="Okay" role="radio" aria-checked="false">
              <span class="reflect-micro-emoji">⚖️</span>
              <strong class="reflect-micro-name">Okay</strong>
              <span class="reflect-micro-hint">Got the main idea</span>
            </button>
            <button type="button" class="reflect-micro-btn" data-feeling="Confusing" role="radio" aria-checked="false">
              <span class="reflect-micro-emoji">🤔</span>
              <strong class="reflect-micro-name">Confusing</strong>
              <span class="reflect-micro-hint">Needs more time</span>
            </button>
          </div>

          <div class="reflect-feedback-banner" id="reflect-feedback" hidden></div>

          <div class="reflect-micro-footer">
            <button type="button" class="btn btn--ghost btn--sm" id="btn-reflect-skip">
              Skip reflection →
            </button>
          </div>
        </div>
      </div>
    `;

    let timer = null;
    let handled = false;

    function advanceNext() {
      if (typeof Roadmap !== 'undefined') {
        const prog = Roadmap.getProgress ? Roadmap.getProgress() : null;
        if (prog && prog.pathComplete) {
          Router.go('/summary');
          return;
        }

        const shouldWrap = shouldTriggerWrapUp(params.id);
        if (shouldWrap) {
          Router.go('/wrapup');
          return;
        }

        const next = Roadmap.getCurrentStep ? Roadmap.getCurrentStep() : null;
        if (next) {
          Router.go('/step/' + next.id);
        } else {
          Router.go('/wrapup');
        }
      } else {
        Router.go('/wrapup');
      }
    }

    function recordAndAdvance(feeling, isSkip = false) {
      if (handled) return;
      handled = true;
      if (timer) clearInterval(timer);

      root.querySelectorAll('.reflect-micro-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.feeling === feeling) {
          b.classList.add('is-selected');
          b.setAttribute('aria-checked', 'true');
        }
      });
      const skipBtn = root.querySelector('#btn-reflect-skip');
      if (skipBtn) skipBtn.disabled = true;

      // Persist in PathStore
      const reflectionVal = (feeling ? String(feeling).toLowerCase().trim() : (isSkip ? 'skipped' : 'skipped')) || 'skipped';
      if (typeof PathStore !== 'undefined' && PathStore.saveReflection) {
        PathStore.saveReflection(params.id, { rating: feeling || reflectionVal, reflection: reflectionVal, timestamp: Date.now() });
      }

      // Prompt 4 Telemetry: reflection (clear, okay, confusing, skipped)
      if (typeof Signals !== 'undefined' && Signals.logReflection) {
        Signals.logReflection(params.id, reflectionVal);
      }

      if (isSkip) {
        advanceNext();
        return;
      }

      // Process-focused encouraging line
      const feedbackEl = root.querySelector('#reflect-feedback');
      let praiseText = 'Good, you finished that one step by step.';
      if (feeling === 'Clear') {
        praiseText = 'Good, you finished that one step by step.';
      } else if (feeling === 'Okay') {
        praiseText = 'Nice work. Steady progress step by step builds solid intuition.';
      } else if (feeling === 'Confusing') {
        praiseText = "That's completely normal — complex ideas take time to settle and click.";
      }

      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.innerHTML = `
          <div class="reflect-praise-box">
            <span class="reflect-praise-icon">🌱</span>
            <span class="reflect-praise-text">${praiseText}</span>
          </div>
        `;
      }

      // Auto-advance after 1.2s delay
      setTimeout(() => {
        advanceNext();
      }, 1200);
    }

    root.querySelectorAll('.reflect-micro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const feeling = btn.dataset.feeling;
        recordAndAdvance(feeling, false);
      });
    });

    root.querySelector('#btn-reflect-skip')?.addEventListener('click', () => {
      recordAndAdvance('skipped', true);
    });

    // 5-second countdown timer animation
    const timerBar = root.querySelector('#reflect-timer-bar');
    let timeLeftMs = 5000;
    const intervalMs = 100;
    timer = setInterval(() => {
      timeLeftMs -= intervalMs;
      if (timerBar) {
        const pct = Math.max(0, (timeLeftMs / 5000) * 100);
        timerBar.style.width = pct + '%';
      }
      if (timeLeftMs <= 0) {
        clearInterval(timer);
        if (!handled) {
          recordAndAdvance('skipped', true);
        }
      }
    }, intervalMs);
  }, (params) => {
    if (!State.get().currentUser) return '/login';
    if (!State.getProfile()) return '/level';
    return null;
  });

  /* ── Route 8: #/wrapup ───────────────────────────────────── */
  Router.add('/wrapup', (params, root) => {
    const session = (typeof PathStore !== 'undefined') ? PathStore.getSession() : { sessionStamps: [] };
    const savedData = (typeof PathStore !== 'undefined') ? PathStore.load() : null;
    let stampIds = (session && Array.isArray(session.sessionStamps) && session.sessionStamps.length > 0)
      ? session.sessionStamps
      : (savedData?.completedIds || []).slice(-3);

    const stampItems = stampIds.map(id => typeof Catalog !== 'undefined' ? Catalog.byId(id) : null).filter(Boolean);

    // Updated preparation percentage
    const progress = (typeof Roadmap !== 'undefined' && Roadmap.getProgress) ? Roadmap.getProgress() : null;
    const prepPct = progress ? progress.percentage : 0;

    // Spaced retrieval question
    const retrievalQ = getSpacedRetrievalQuestion();

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card wrapup-card">
          <div class="wrapup-badge-hero">
            <span class="wrapup-hero-icon">🌱</span>
            <span class="wrapup-hero-badge">Session Checkpoint</span>
          </div>

          <h1 class="step-page-title" data-page-heading>Session Wrap‑Up</h1>

          <!-- One short, warm sentence from the agent (fixed template) -->
          <div class="wrapup-agent-message">
            <p class="agent-message-text">
              "You're building real depth here — steady, deliberate practice makes complex concepts second nature."
            </p>
          </div>

          <!-- Metrics summary -->
          <div class="wrapup-metrics-grid">
            <div class="wrapup-metric-card">
              <span class="wrapup-metric-lbl">Concepts in this session</span>
              <span class="wrapup-metric-val">${stampItems.length}</span>
              <span class="wrapup-metric-desc">Stamps earned</span>
            </div>
            <div class="wrapup-metric-card">
              <span class="wrapup-metric-lbl">Overall Preparation</span>
              <span class="wrapup-metric-val wrapup-metric-val--leaf">${prepPct}%</span>
              <span class="wrapup-metric-desc">Toward mastery</span>
            </div>
          </div>

          <!-- Stamps earned in this session -->
          <div class="wrapup-stamps-section">
            <h3 class="wrapup-section-heading">Stamps Earned in this Session</h3>
            ${stampItems.length > 0 ? `
              <div class="wrapup-stamps-list">
                ${stampItems.map(item => `
                  <div class="wrapup-stamp-item">
                    <span class="wrapup-stamp-badge">✓</span>
                    <div class="wrapup-stamp-info">
                      <strong class="wrapup-stamp-title">${item.title}</strong>
                      <span class="wrapup-stamp-type">${item.type.toUpperCase()} · ${item.minutes || 5} min</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="color: var(--cream-3); font-size: 0.875rem;">Great focus in this learning session!</p>
            `}
          </div>

          <!-- Spaced Retrieval Section -->
          ${retrievalQ ? `
            <div class="wrapup-retrieval-box" id="retrieval-container">
              <div class="retrieval-box-header">
                <span class="retrieval-tag">🧠 Spaced Retrieval</span>
                <span class="retrieval-help">Reinforce an earlier concept before wrapping up</span>
              </div>
              <p class="retrieval-prompt-text">${retrievalQ.note || 'Explain the core invariant and mechanism for this tree structure.'}</p>

              <div id="retrieval-form-wrap">
                <textarea
                  id="retrieval-answer-input"
                  class="field-input retrieval-textarea"
                  rows="3"
                  placeholder="Type your explanation from memory..."
                ></textarea>
                <div class="retrieval-actions">
                  <button type="button" class="btn btn--primary btn--sm" id="btn-retrieval-submit">
                    Evaluate Answer →
                  </button>
                  <button type="button" class="btn btn--ghost btn--sm" id="btn-retrieval-skip">
                    Skip question
                  </button>
                  <span id="retrieval-eval-hint" style="color: var(--cream-3); font-size: 0.8125rem;" hidden>Evaluating with AI...</span>
                </div>
              </div>

              <div id="retrieval-feedback-box" hidden></div>
            </div>
          ` : ''}

          <!-- Actions: Continue & Take a Break -->
          <div class="wrapup-footer-actions">
            <button type="button" class="btn btn--primary btn--lg" id="btn-wrapup-continue">
              Continue Learning →
            </button>
            <button type="button" class="btn btn--outline btn--lg" id="btn-wrapup-break">
              Take a break (progress saved)
            </button>
          </div>
        </div>
      </div>
    `;

    // Handle retrieval question submission
    if (retrievalQ) {
      const submitBtn = root.querySelector('#btn-retrieval-submit');
      const skipBtn = root.querySelector('#btn-retrieval-skip');
      const answerInput = root.querySelector('#retrieval-answer-input');
      const evalHint = root.querySelector('#retrieval-eval-hint');
      const formWrap = root.querySelector('#retrieval-form-wrap');
      const feedbackBox = root.querySelector('#retrieval-feedback-box');

      submitBtn?.addEventListener('click', async () => {
        const text = answerInput?.value.trim();
        if (!text) {
          if (answerInput) answerInput.focus();
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (evalHint) evalHint.hidden = false;

        let res = null;
        try {
          if (typeof TutorChatService !== 'undefined' && TutorChatService.evaluateAssessment) {
            res = await TutorChatService.evaluateAssessment(retrievalQ.id, retrievalQ.note, text);
          }
        } catch (e) {
          console.error('[WrapUp] Evaluation error:', e);
          if (evalHint) evalHint.hidden = true;
          if (submitBtn) submitBtn.disabled = false;
          const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(e) : 'Evaluation failed. Please try again.';
          let errBox = root.querySelector('#retrieval-err-msg');
          if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'retrieval-err-msg';
            errBox.style.cssText = 'color: #ef4444; margin-top: 10px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
            submitBtn.parentNode.insertBefore(errBox, submitBtn.nextSibling);
          }
          errBox.innerHTML = `
            <span>⚠️ ${friendly}</span>
            <button type="button" class="btn btn--outline btn--xs" id="btn-retrieval-retry">Retry ↺</button>
          `;
          errBox.querySelector('#btn-retrieval-retry')?.addEventListener('click', () => {
            errBox.remove();
            submitBtn.click();
          });
          return;
        }

        if (!res) {
          if (evalHint) evalHint.hidden = true;
          if (submitBtn) submitBtn.disabled = false;
          let errBox = root.querySelector('#retrieval-err-msg');
          if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'retrieval-err-msg';
            errBox.style.cssText = 'color: #ef4444; margin-top: 10px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
            submitBtn.parentNode.insertBefore(errBox, submitBtn.nextSibling);
          }
          errBox.innerHTML = `
            <span>⚠️ I couldn't evaluate that. Please try again.</span>
            <button type="button" class="btn btn--outline btn--xs" id="btn-retrieval-retry">Retry ↺</button>
          `;
          errBox.querySelector('#btn-retrieval-retry')?.addEventListener('click', () => {
            errBox.remove();
            submitBtn.click();
          });
          return;
        }

        if (evalHint) evalHint.hidden = true;
        if (formWrap) formWrap.hidden = true;
        if (feedbackBox) {
          feedbackBox.hidden = false;
          const ratingKey = (res.rating === 'solid' || res.rating === 'partial') ? res.rating : 'needs_review';
          const isNeedsReview = ratingKey === 'needs_review' || res.rating === 'weak' || res.rating === 'needs_review' || res.rating === 'needs support';

          // Prompt 5 (Extra Part 3): If retrieval question is rated Needs Review, add topic to worthAnotherLook
          if (isNeedsReview && typeof PathStore !== 'undefined' && PathStore.addWorthAnotherLook && retrievalQ) {
            const topicKey = (Array.isArray(retrievalQ.topics) && retrievalQ.topics[0]) || retrievalQ.topic || retrievalQ.title || retrievalQ.id;
            PathStore.addWorthAnotherLook(topicKey);
          }

          if (typeof CloudStore !== 'undefined' && CloudStore.enqueue) {
            CloudStore.enqueue('assessment_results', {
              item_id: retrievalQ.id || 'spaced-retrieval',
              rating: ratingKey,
              score: ratingKey === 'solid' ? 100 : (ratingKey === 'partial' ? 65 : 35),
              band: ratingKey,
              attempt: 1,
              detail: res,
              created_at: new Date().toISOString()
            });
          }

          const badgeClass = ratingKey === 'solid'
            ? 'badge--solid'
            : (ratingKey === 'partial' ? 'badge--partial' : 'badge--needs_review');
          const badgeText = ratingKey === 'solid'
            ? '✓ Solid Recall'
            : (ratingKey === 'partial' ? '⚡ Partial Recall' : '⚠️ Needs Review');

          feedbackBox.innerHTML = `
            <div class="retrieval-feedback-content">
              <span class="retrieval-result-badge ${badgeClass}">
                ${badgeText}
              </span>
              <p class="retrieval-result-text">${res.feedback || res.assessment || 'Spaced retrieval completed.'}</p>
              ${res.missing && res.missing !== 'None' ? `<p style="font-size: 0.85rem; color: var(--cream-2); margin-top: 6px;"><strong>Focus:</strong> ${res.missing}</p>` : ''}
              ${res.suggestion ? `<p style="font-size: 0.85rem; color: var(--cream-2); margin-top: 4px;"><strong>Tip:</strong> ${res.suggestion}</p>` : ''}
            </div>
          `;
        }
      });

      skipBtn?.addEventListener('click', () => {
        if (formWrap) formWrap.hidden = true;
        if (feedbackBox) {
          feedbackBox.hidden = false;
          feedbackBox.innerHTML = `
            <p style="color: var(--cream-3); font-size: 0.875rem; margin: 0; padding: 8px 0;">
              Retrieval skipped for now. You can revisit this checkpoint anytime!
            </p>
          `;
        }
      });
    }

    function completeWrapUpAndGo(target) {
      if (typeof PathStore !== 'undefined') {
        PathStore.resetSessionAfterWrapUp();
        PathStore.incrementWrapUpCount();
      }

      if (target === 'break') {
        Router.go('/break');
      } else {
        if (typeof Roadmap !== 'undefined') {
          const prog = Roadmap.getProgress ? Roadmap.getProgress() : null;
          if (prog && prog.pathComplete) {
            Router.go('/summary');
            return;
          }
          const curr = Roadmap.getCurrentStep ? Roadmap.getCurrentStep() : null;
          if (curr) {
            Router.go('/step/' + curr.id);
          } else {
            Router.go('/progress');
          }
        } else {
          Router.go('/progress');
        }
      }
    }

    root.querySelector('#btn-wrapup-continue')?.addEventListener('click', () => {
      completeWrapUpAndGo('continue');
    });

    root.querySelector('#btn-wrapup-break')?.addEventListener('click', () => {
      completeWrapUpAndGo('break');
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    if (!State.getProfile()) return '/level';
    return null;
  });

  /* ── Route 8b: #/break ───────────────────────────────────── */
  Router.add('/break', (params, root) => {
    root.innerHTML = `
      <div class="page-container break-container">
        <div class="page-card break-card">
          <div class="break-icon">☕</div>
          <h1 class="break-title" data-page-heading>Your progress is saved</h1>
          <p class="break-subtext">
            Step away, stretch, or rest your eyes. Cognitive rest gives complex concepts space to consolidate.
          </p>
          <div class="break-safe-pill">
            <span>✓ All concepts, notes, and reflections are securely saved</span>
          </div>
          <div class="break-actions">
            <button type="button" class="btn btn--primary btn--lg" id="btn-break-resume">
              Come back when you're ready →
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-break-resume')?.addEventListener('click', () => {
      if (typeof Roadmap !== 'undefined') {
        const prog = Roadmap.getProgress ? Roadmap.getProgress() : null;
        if (prog && prog.pathComplete) {
          Router.go('/summary');
          return;
        }
        const curr = Roadmap.getCurrentStep ? Roadmap.getCurrentStep() : null;
        if (curr) {
          Router.go('/step/' + curr.id);
        } else {
          Router.go('/progress');
        }
      } else {
        Router.go('/progress');
      }
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    if (!State.getProfile()) return '/level';
    return null;
  });

  /* ── Route 9: #/summary ──────────────────────────────────── */
  Router.add('/summary', (params, root) => {
    root.innerHTML = '';
    const synthView = document.getElementById('view-synthesis');
    if (synthView) {
      synthView.hidden = false;
      const sidebar = synthView.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'none';
      root.appendChild(synthView);
    } else {
      root.innerHTML = `
        <div class="page-container page-container--wide">
          <div class="page-card">
            <h1 data-page-heading>Synthesis Summary</h1>
            <p>Trees & Binary Search Trees — Core Cheat Sheet & Synthesis</p>
          </div>
        </div>
      `;
    }

    if (window.Synthesis && typeof window.Synthesis.init === 'function') {
      window.Synthesis.init();
    }
  }, () => {
    if (!State.get().currentUser) return '/login';
    if (!State.getProfile()) return '/level';

    // Route guard: #/summary is locked until path is complete!
    if (typeof Roadmap !== 'undefined') {
      if (!Roadmap.isInitialized()) Roadmap.init();
      const prog = Roadmap.getProgress();
      if (!prog.pathComplete) {
        if (typeof showToast === 'function') {
          showToast('Summary unlocks after finishing all concepts in your path!', 'warning');
        }
        const curr = Roadmap.getCurrentStep();
        return curr ? ('/step/' + curr.id) : '/ready';
      }
    }
    return null;
  });

  /* ── Route 10: #/animations ──────────────────────────────── */
  Router.add('/animations', (params, root) => {
    root.innerHTML = `
      <div class="page-container page-container--wide">
        <div class="page-card">
          <header class="step-page-header">
            <h1 class="step-page-title" data-page-heading>Visualizations &amp; Animations</h1>
            <p class="step-page-reason">Animated walkthroughs of core BST operations — built to make the abstract concrete.</p>
          </header>

          <div class="video-sequence" id="video-sequence">
            <!-- Video 1 -->
            <div class="video-card" id="video-card-1" data-video-index="1" style="margin-bottom: 24px;">
              <div class="video-card-header" style="margin-bottom: 12px;">
                <span class="video-num-badge">01</span>
                <strong class="video-card-title">Part 1: Foundations &amp; Traversals</strong>
              </div>
              <div class="video-player-wrap">
                <video id="video-el-1" class="video-el" controls preload="metadata" src="assets/videos/video1_foundations.mp4" style="width: 100%; border-radius: 8px;"></video>
              </div>
            </div>

            <!-- Video 2 -->
            <div class="video-card" id="video-card-2" data-video-index="2" style="margin-bottom: 24px;">
              <div class="video-card-header" style="margin-bottom: 12px;">
                <span class="video-num-badge">02</span>
                <strong class="video-card-title">Part 2: Search, Insertion &amp; Deletion</strong>
              </div>
              <div class="video-player-wrap">
                <video id="video-el-2" class="video-el" controls preload="metadata" src="assets/videos/video2_core_operations.mp4" style="width: 100%; border-radius: 8px;"></video>
              </div>
            </div>

            <!-- Video 3 -->
            <div class="video-card" id="video-card-3" data-video-index="3" style="margin-bottom: 24px;">
              <div class="video-card-header" style="margin-bottom: 12px;">
                <span class="video-num-badge">03</span>
                <strong class="video-card-title">Part 3: Self-Balancing Trees &amp; Real-World Use</strong>
              </div>
              <div class="video-player-wrap">
                <video id="video-el-3" class="video-el" controls preload="metadata" src="assets/videos/video3_self_balancing.mp4" style="width: 100%; border-radius: 8px;"></video>
              </div>
            </div>
          </div>

          <div style="margin-top: 32px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 24px;">
            <a href="#/progress" class="btn btn--outline">← Back to Progress</a>
            <a href="#/journey" class="btn btn--primary" id="btn-summary-to-journey">
              View Your Learning Journey →
            </a>
          </div>
        </div>
      </div>
    `;

    // Initialize replay listeners if Synthesis module is available
    if (window.Synthesis && typeof window.Synthesis.init === 'function') {
      window.Synthesis.init();
    }
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 11: #/journey ─────────────────────────────────── */
  Router.add('/journey', (params, root) => {
    if (typeof JourneyView !== 'undefined' && typeof JourneyView.render === 'function') {
      JourneyView.render(root);
    } else {
      root.innerHTML = `
        <div class="page-container">
          <div class="page-card">
            <h1 class="step-page-title" data-page-heading>Learning Journey</h1>
            <p style="color: var(--cream-2); margin-bottom: 24px;">Loading your learning journey report...</p>
          </div>
        </div>
      `;
    }
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 12: #/progress ────────────────────────────────── */
  Router.add('/progress', (params, root) => {
    const steps = (typeof Roadmap !== 'undefined' && Roadmap.getSteps) ? Roadmap.getSteps() : [];
    const doneSteps = steps.filter(s => s.status === 'done' || s.status === 'skipped');
    const earnedTopics = new Set();

    doneSteps.forEach(s => {
      const it = (typeof Catalog !== 'undefined' && Catalog.byId) ? Catalog.byId(s.id) : null;
      if (it && Array.isArray(it.topics)) {
        it.topics.forEach(t => earnedTopics.add(t));
      }
    });

    const prog = (typeof Roadmap !== 'undefined' && Roadmap.getProgress) ? Roadmap.getProgress() : { weightedPct: 0 };
    const weightedPct = prog.weightedPct || 0;

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card progress-card">
          <div class="progress-header">
            <h1 class="step-page-title" data-page-heading>Your Progress</h1>
            <p style="color: var(--cream-2); margin-top: 4px;">Earned concept stamps and preparation status.</p>
          </div>

          <!-- Preparation Meter Card -->
          <div class="progress-prep-hero">
            <div class="prep-meter-ring progress-prep-hero-ring">
              <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                <circle cx="18" cy="18" r="15.9" style="fill:none; stroke:var(--surface-3); stroke-width:3.2;"></circle>
                <circle cx="18" cy="18" r="15.9" style="fill:none; stroke:var(--leaf); stroke-width:3.2; stroke-linecap:round; stroke-dasharray:100 100; stroke-dashoffset:${100 - weightedPct}; transition: stroke-dashoffset 0.4s ease;"></circle>
              </svg>
            </div>
            <div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--leaf);">${weightedPct}% Preparation</div>
              <p style="margin: 4px 0 0; color: var(--cream-3); font-size: 0.8125rem;">
                Weighted preparation index across theory foundations, core operations, and assessments.
              </p>
            </div>
          </div>

          <!-- Earned Stamps Section -->
          <div class="progress-stamps-section">
            <h3 style="font-size: 1rem; color: var(--cream); margin: 0 0 12px;">Earned Topic Stamps</h3>
            ${earnedTopics.size > 0 ? `
              <div class="stamps-grid">
                ${Array.from(earnedTopics).map(t => `
                  <div class="stamp-card">
                    <span class="stamp-badge">✓</span>
                    <span class="stamp-name">${TOPIC_LABELS[t] || t}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p class="no-stamps-msg">No concept stamps earned yet. Complete your first concept to earn your first stamp!</p>
            `}
          </div>

          <!-- Exactly as requested: one line at the end, nothing about what is next -->
          <p class="progress-discovery-hint">More to discover as you go.</p>

          <div style="display: flex; justify-content: center; margin-top: 28px;">
            <button type="button" class="btn btn--primary" id="btn-progress-back">
              Return to learning →
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-progress-back')?.addEventListener('click', () => {
      const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
      Router.go(curr ? ('/step/' + curr.id) : '/ready');
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 13: #/settings ────────────────────────────────── */
  Router.add('/settings', (params, root) => {
    const user = State.get().currentUser || { name: 'Learner', email: '' };
    const profile = State.getProfile ? State.getProfile() : null;
    const levelName = profile?.level ? (profile.level.charAt(0).toUpperCase() + profile.level.slice(1)) : 'Beginner';

    const prefs = (typeof PathStore !== 'undefined' && PathStore.getPrefs) ? PathStore.getPrefs() : { checkinsEnabled: true, toneOverride: 'Auto', breakRemindersEnabled: true };
    const checkinsEnabled = prefs.checkinsEnabled !== false;
    const breakRemindersEnabled = prefs.breakRemindersEnabled !== false;
    const currentTone = prefs.toneOverride || 'Auto';

    const eventCount = (typeof PathStore !== 'undefined' && PathStore.getEvents) ? PathStore.getEvents().length : 0;
    const checkinCount = (typeof PathStore !== 'undefined' && PathStore.getCheckins) ? PathStore.getCheckins().length : 0;

    root.innerHTML = `
      <div class="page-container">
        <div class="page-card settings-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h1 class="step-page-title" data-page-heading style="margin: 0 0 4px 0;">Settings &amp; Controls</h1>
              <p style="color: var(--cream-2); margin: 0;">Customize your tutor interaction style, rhythm, and data privacy.</p>
            </div>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-settings-back">
              ← Return to concept
            </button>
          </div>

          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-row-info">
                <h4>Learner Profile</h4>
                <p>${user.name} (${user.email})</p>
              </div>
              <span class="ready-level-pill" style="margin-bottom:0;">${levelName}</span>
            </div>
          </div>

          <!-- Prompt 6: Student Control - Tone (Auto / Gentle / Direct) -->
          <div class="settings-section">
            <div class="settings-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div class="settings-row-info" style="max-width: 440px;">
                <h4>Tutor &amp; Evaluator Tone</h4>
                <p>Choose your preferred communication style. A chosen tone overrides the engine's dynamic assessment.</p>
              </div>
              <div class="tone-selector-group" role="group" aria-label="Tone selection">
                <button type="button" class="tone-selector-btn ${currentTone === 'Auto' ? 'is-selected' : ''}" data-tone="Auto">
                  Auto
                </button>
                <button type="button" class="tone-selector-btn ${currentTone === 'Gentle' ? 'is-selected' : ''}" data-tone="Gentle">
                  Gentle
                </button>
                <button type="button" class="tone-selector-btn ${currentTone === 'Direct' ? 'is-selected' : ''}" data-tone="Direct">
                  Direct
                </button>
              </div>
            </div>
            <div style="font-size: 0.8125rem; color: var(--cream-3); margin-top: 8px;">
              ${currentTone === 'Auto' ? '🤖 <em>Auto</em>: Dynamically adapts pacing and guidance based on your study momentum.' : ''}
              ${currentTone === 'Gentle' ? '🌿 <em>Gentle</em>: Shorter explanations (under 80 words), mistake-normalizing, supportive.' : ''}
              ${currentTone === 'Direct' ? '⚡ <em>Direct</em>: Challenging, fast-paced questions, probing predictions and edge cases.' : ''}
            </div>
          </div>

          <!-- Prompt 4 & 6: Check-ins toggle (on/off) -->
          <div class="settings-section">
            <div class="settings-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div class="settings-row-info">
                <h4>Check-ins &amp; Confidence Taps</h4>
                <p>Casual session check-ins and pre-checkpoint confidence taps that help calibrate your pace.</p>
              </div>
              <button type="button" class="btn ${checkinsEnabled ? 'btn--primary' : 'btn--outline'}" id="toggle-checkins-btn" aria-pressed="${checkinsEnabled}" style="min-width: 80px;">
                ${checkinsEnabled ? 'On ✓' : 'Off'}
              </button>
            </div>
          </div>

          <!-- Prompt 6: Break reminders toggle (on/off) -->
          <div class="settings-section">
            <div class="settings-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div class="settings-row-info">
                <h4>Break Reminders</h4>
                <p>Gentle, non-intrusive suggestions to step away and refresh during long study sessions.</p>
              </div>
              <button type="button" class="btn ${breakRemindersEnabled ? 'btn--primary' : 'btn--outline'}" id="toggle-breaks-btn" aria-pressed="${breakRemindersEnabled}" style="min-width: 80px;">
                ${breakRemindersEnabled ? 'On ✓' : 'Off'}
              </button>
            </div>
          </div>

          <!-- Prompt 4 & 6: Learning Data Privacy & Deletion -->
          <div class="settings-section">
            <div class="settings-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
              <div class="settings-row-info" style="max-width: 480px;">
                <h4>Learning Activity &amp; Signals</h4>
                <p style="margin-bottom: 8px;">
                  We record how you work (time, retries, hints) to adapt your support profile. No free-text mood journaling or personal data is stored. You can clear this anytime.
                </p>
                <span style="font-size: 0.8125rem; color: var(--cream-3); display: block;" id="learning-data-count">
                  ${eventCount} event${eventCount === 1 ? '' : 's'} logged (max 200) · ${checkinCount} check-in${checkinCount === 1 ? '' : 's'}
                </span>
              </div>
              <button type="button" class="btn btn--outline" id="btn-delete-learning-data" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);">
                Delete my learning data
              </button>
            </div>
          </div>

          <!-- Prompt 6: Safety Note Page Link -->
          <div class="settings-section">
            <div class="settings-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div class="settings-row-info">
                <h4>Student Support &amp; Well-Being</h4>
                <p>Institutional contact resources and support guidelines if you feel overwhelmed or distressed.</p>
              </div>
              <a href="#/support" class="btn btn--outline btn--sm">
                View Support Note →
              </a>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-row-info">
                <h4>Learning Level</h4>
                <p>Switch between Beginner, Intermediate, or Revision paths.</p>
              </div>
              <button type="button" class="btn btn--outline btn-change-level" id="btn-settings-change-lvl">
                Change Level
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-row-info">
                <h4>Restart Learning Path</h4>
                <p>Clears current path progress and re-adapts your roadmap while keeping your account.</p>
              </div>
              <button type="button" class="btn btn--outline" id="btn-settings-restart-path" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);">
                Restart Path
              </button>
            </div>
          </div>

          <div style="margin-top: 24px; text-align: center; display: flex; justify-content: center; gap: 16px;">
            <a href="privacy.html" target="_blank" rel="noopener noreferrer" style="color: var(--leaf); font-size: 0.875rem; text-decoration: underline;">
              View full Privacy &amp; Data Policy ↗
            </a>
            <span style="color: var(--border);">·</span>
            <a href="#/support" style="color: var(--cream-2); font-size: 0.875rem; text-decoration: underline;">
              Student Support Services
            </a>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-settings-back')?.addEventListener('click', () => {
      const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
      Router.go(curr ? ('/step/' + curr.id) : '/ready');
    });

    // Tone selector handlers (Prompt 6)
    root.querySelectorAll('.tone-selector-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tone = btn.dataset.tone;
        if (typeof PathStore !== 'undefined') {
          PathStore.setPrefs({ toneOverride: tone });
        }
        if (window.showToast) {
          showToast(`Tutor tone set to ${tone}`, 'info');
        }
        Router.go('/settings');
      });
    });

    // Check-ins toggle handler
    root.querySelector('#toggle-checkins-btn')?.addEventListener('click', () => {
      const current = typeof Signals !== 'undefined' ? Signals.isCheckinsEnabled() : true;
      const next = !current;
      if (typeof Signals !== 'undefined') {
        Signals.setCheckinsEnabled(next);
      } else if (typeof PathStore !== 'undefined') {
        PathStore.setPrefs({ checkinsEnabled: next });
      }
      if (window.showToast) {
        showToast(`Check-ins turned ${next ? 'on' : 'off'}`, 'info');
      }
      Router.go('/settings');
    });

    // Break reminders toggle handler (Prompt 6)
    root.querySelector('#toggle-breaks-btn')?.addEventListener('click', () => {
      const current = prefs.breakRemindersEnabled !== false;
      const next = !current;
      if (typeof PathStore !== 'undefined') {
        PathStore.setPrefs({ breakRemindersEnabled: next });
      }
      if (window.showToast) {
        showToast(`Break reminders turned ${next ? 'on' : 'off'}`, 'info');
      }
      Router.go('/settings');
    });

    // Delete learning data handler
    root.querySelector('#btn-delete-learning-data')?.addEventListener('click', () => {
      if (confirm('This will delete all telemetry signals, check-ins, and intervention history. Your catalog progress remains intact. Proceed?')) {
        if (typeof PathStore !== 'undefined') {
          PathStore.deleteLearningData();
        }
        if (window.showToast) {
          showToast('Learning telemetry data deleted', 'success');
        }
        Router.go('/settings');
      }
    });

    root.querySelector('#btn-settings-change-lvl')?.addEventListener('click', () => {
      Router.go('/level');
    });

    root.querySelector('#btn-settings-restart-path')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to restart your learning path? Your account will be preserved.')) {
        if (typeof PathStore !== 'undefined') PathStore.clear();
        if (typeof State !== 'undefined') {
          if (State.resetPathState) State.resetPathState();
          if (State.setProfile) State.setProfile(null);
        }
        if (typeof Roadmap !== 'undefined') Roadmap.reset();
        Router.go('/level');
      }
    });
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Route 13b: #/support (Prompt 6 Safety Note Page) ──────── */
  Router.add('/support', (params, root) => {
    root.innerHTML = `
      <div class="page-container">
        <div class="page-card safety-note-card">
          <div class="safety-icon-header">
            <span style="font-size: 2.25rem;">🌿</span>
            <h1 class="step-page-title" data-page-heading style="margin: 8px 0;">Student Support &amp; Well-Being</h1>
            <p style="color: var(--cream-2); font-size: 1rem; max-width: 580px; margin: 0 auto;">
              Your mental health and well-being always come first before any code, concept, or curriculum.
            </p>
          </div>

          <div class="safety-message-box" style="margin: 28px 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: left;">
            <p style="font-size: 1.0625rem; line-height: 1.6; color: var(--cream-1); margin-bottom: 16px;">
              Learning complex algorithms and data structures can be challenging, but you never have to carry distress or pressure alone. If you are feeling overwhelmed, hopeless, or in need of support, please reach out to someone you trust, a loved one, or a counsellor.
            </p>
            <p style="font-size: 0.9375rem; line-height: 1.5; color: var(--cream-2); margin: 0;">
              Taking a break or pausing your studies is always okay. Your progress is saved right where you left off.
            </p>
          </div>

          <div class="safety-footer-actions" style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn--outline btn--lg" id="btn-safety-pause">
              Pause studying for today
            </button>
            <button type="button" class="btn btn--primary btn--lg" id="btn-safety-continue">
              Continue learning at my own pace →
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-safety-pause')?.addEventListener('click', () => {
      Router.go('/progress');
    });

    root.querySelector('#btn-safety-continue')?.addEventListener('click', () => {
      const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
      Router.go(curr ? ('/step/' + curr.id) : '/ready');
    });
  });

  Router.add('/safety', () => {
    Router.go('/support');
  });

  /* ── Route 14: #/assignment/:id and #/assignment/:id/:stage ───────── */
  Router.add('/assignment/:id', (params) => {
    Router.go('/assignment/' + params.id + '/brief');
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  Router.add('/assignment/:id/:stage', (params, root) => {
    const id = params.id;
    const stage = (params.stage || 'brief').toLowerCase();
    const assignment = typeof Catalog !== 'undefined' ? Catalog.byId(id) : null;

    if (!assignment) {
      root.innerHTML = `
        <div class="page-container">
          <div class="page-card" style="text-align: center; padding: 48px;">
            <h2 style="color: #ef4444; margin-bottom: 12px;">Assignment Not Found</h2>
            <p style="color: var(--cream-2); margin-bottom: 24px;">Could not find an assignment with ID "${id}".</p>
            <button type="button" class="btn btn--primary" id="btn-as-err-back">Return to Learning Path →</button>
          </div>
        </div>
      `;
      root.querySelector('#btn-as-err-back')?.addEventListener('click', () => {
        const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
        Router.go(curr ? ('/step/' + curr.id) : '/ready');
      });
      return;
    }

    renderAssignmentStage(assignment, stage, root);
  }, () => {
    if (!State.get().currentUser) return '/login';
    return null;
  });

  /* ── Assignment Stage Renderer (Prompt 3) ────────────────────────── */
  function renderAssignmentStage(assignment, stage, root) {
    const id = assignment.id;
    let stored = (typeof PathStore !== 'undefined' ? PathStore.getAssignment(id) : null) || {};

    const STAGES = [
      { key: 'brief', label: '1. Brief' },
      { key: 'attempt', label: '2. Attempt' },
      { key: 'hints', label: '3. Hints' },
      { key: 'self-assess', label: '4. Self-Assess' },
      { key: 'feedback', label: '5. Feedback' },
      { key: 'revise', label: '6. Revise' },
      { key: 'reflect', label: '7. Reflect' }
    ];

    const stageHeaderHtml = `
      <div class="assignment-header-bar" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="step-type-pill step-type-pill--assignment" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
              Structured Assignment · ${assignment.difficulty ? 'Diff ' + assignment.difficulty : 'Core'}
            </span>
            <h1 class="step-page-title" data-page-heading style="margin: 6px 0 0 0; font-size: 1.5rem;">
              ${assignment.title}
            </h1>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 0.8125rem; color: var(--cream-3);">⏱ ${assignment.minutes || 15} min</span>
            <a href="#/step/${id}" class="btn btn--ghost btn--sm" style="font-size: 0.8125rem;">← Back to Step</a>
          </div>
        </div>

        <!-- 7 Stages Progress Indicator -->
        <nav class="assignment-stage-nav" aria-label="Assignment Stages" style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
          ${STAGES.map(s => {
            const isActive = s.key === stage;
            return `
              <a href="#/assignment/${id}/${s.key}" class="assignment-stage-tab ${isActive ? 'assignment-stage-tab--active' : ''}" style="padding: 6px 12px; font-size: 0.75rem; font-weight: 500; text-decoration: none; border-radius: 6px; white-space: nowrap; ${isActive ? 'background: var(--surface-3); color: var(--cream-1); border: 1px solid var(--border-focus);' : 'color: var(--cream-3);'}">
                ${s.label}
              </a>
            `;
          }).join('')}
        </nav>
      </div>
    `;

    // ──────────────── STAGE 1: BRIEF ────────────────
    if (stage === 'brief') {
      const whyItMatters = getWhyItMatters(id);
      const interventionHtml = (typeof MindsetEngine !== 'undefined' && MindsetEngine.getInterventionCardHtml)
        ? MindsetEngine.getInterventionCardHtml(id)
        : '';
      root.innerHTML = `
        <div class="page-container">
          ${interventionHtml}
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <div class="assignment-section" style="margin-bottom: 24px;">
              <h3 style="font-size: 1.0625rem; color: var(--cream-1); margin-bottom: 8px;">🎯 Objective</h3>
              <p style="font-size: 1rem; line-height: 1.6; color: var(--cream-2); background: var(--surface-2); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
                ${assignment.brief || assignment.note}
              </p>
            </div>

            <div class="assignment-section" style="margin-bottom: 24px;">
              <h3 style="font-size: 1.0625rem; color: var(--cream-1); margin-bottom: 8px;">💡 Why It Matters</h3>
              <p style="font-size: 0.9375rem; line-height: 1.6; color: var(--cream-2);">
                ${whyItMatters}
              </p>
            </div>

            <div class="assignment-section" style="margin-bottom: 28px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
                <h3 style="font-size: 1.0625rem; color: var(--cream-1); margin: 0;">📋 Success Criteria (Rubric shown up front)</h3>
                <span style="font-size: 0.8125rem; color: var(--cream-3);">Scored 0–3 per criterion</span>
              </div>
              <div class="rubric-table-wrap" style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-1);">
                ${(assignment.rubric || []).map((crit, idx) => `
                  <div class="rubric-row" style="padding: 12px 16px; ${idx > 0 ? 'border-top: 1px solid var(--border);' : ''}">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                      <strong style="color: var(--cream-1); font-size: 0.9375rem;">${crit.title}</strong>
                      <span style="color: var(--leaf); font-size: 0.75rem; font-weight: 600;">0–3 pts</span>
                    </div>
                    <p style="color: var(--cream-3); font-size: 0.8125rem; margin: 0; line-height: 1.4;">${crit.description}</p>
                  </div>
                `).join('')}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px;">
              <div style="font-size: 0.8125rem; color: var(--cream-3);">
                ⏱ Time estimate: <strong>${assignment.minutes || 15} minutes</strong>
              </div>
              <button type="button" class="btn btn--primary btn--lg" id="btn-as-start-attempt">
                Begin Attempt (Stage 2 of 7) →
              </button>
            </div>
          </div>
        </div>
      `;

      root.querySelector('#btn-as-start-attempt')?.addEventListener('click', () => {
        Router.go('/assignment/' + id + '/attempt');
      });

      if (typeof MindsetEngine !== 'undefined' && MindsetEngine.bindInterventionCard) {
        MindsetEngine.bindInterventionCard(root, id);
      }
      return;
    }

    // ──────────────── STAGE 2: ATTEMPT ────────────────
    if (stage === 'attempt') {
      const savedInputs = stored.inputs || {};
      const hintsUsed = stored.hintsUsed || 0;

      // Prompt 4: Pre-answer confidence tap (skippable, 1-5)
      const checkinsOn = typeof Signals === 'undefined' || Signals.isCheckinsEnabled();
      const needsConfidenceTap = checkinsOn && stored.confidenceBefore === undefined;

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <!-- Brief reminder -->
            <div style="background: var(--surface-2); padding: 14px 18px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px;">
              <strong style="color: var(--cream-1); display: block; font-size: 0.875rem; margin-bottom: 4px;">Challenge:</strong>
              <p style="color: var(--cream-2); font-size: 0.9375rem; margin: 0; line-height: 1.5;">${assignment.brief}</p>
            </div>

            <!-- Pre-answer confidence tap (Prompt 4) -->
            ${needsConfidenceTap ? `
              <div class="assignment-confidence-tap" style="background: var(--surface-2); border: 1px solid var(--border-mid); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <p style="font-weight: 600; font-size: 0.9375rem; color: var(--cream); margin: 0 0 4px 0;">How sure are you that you can answer this?</p>
                <p style="font-size: 0.8125rem; color: var(--cream-3); margin: 0 0 14px 0;">A quick self-calibration tap before you start your workspace attempt. Rate 1 to 5, or skip anytime.</p>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="btn btn--outline btn-as-confidence" data-val="1">1 · Not sure</button>
                  <button type="button" class="btn btn--outline btn-as-confidence" data-val="2">2</button>
                  <button type="button" class="btn btn--outline btn-as-confidence" data-val="3">3 · Fairly sure</button>
                  <button type="button" class="btn btn--outline btn-as-confidence" data-val="4">4</button>
                  <button type="button" class="btn btn--outline btn-as-confidence" data-val="5">5 · Very sure</button>
                  <button type="button" class="btn btn--ghost btn-as-confidence-skip" style="color: var(--cream-3); margin-left: 8px;">Skip</button>
                </div>
              </div>
            ` : ''}

            <!-- Workspace Inputs -->
            <form id="assignment-attempt-form" novalidate style="margin-bottom: 28px;">
              ${(assignment.inputs || []).map(inp => {
                const val = savedInputs[inp.id] !== undefined ? savedInputs[inp.id] : '';
                if (inp.type === 'textarea') {
                  return `
                    <div class="field" style="margin-bottom: 20px;">
                      <label class="field-label" for="as-input-${inp.id}" style="font-weight: 500; font-size: 0.9375rem; margin-bottom: 6px; display: block;">
                        ${inp.label}
                      </label>
                      <textarea id="as-input-${inp.id}" class="field-input" rows="4" placeholder="${inp.placeholder || ''}" style="width: 100%; box-sizing: border-box;">${val}</textarea>
                    </div>
                  `;
                }
                return `
                  <div class="field" style="margin-bottom: 20px;">
                    <label class="field-label" for="as-input-${inp.id}" style="font-weight: 500; font-size: 0.9375rem; margin-bottom: 6px; display: block;">
                      ${inp.label}
                    </label>
                    <input type="${inp.type || 'text'}" id="as-input-${inp.id}" class="field-input" placeholder="${inp.placeholder || ''}" value="${val}" style="width: 100%; box-sizing: border-box;" />
                  </div>
                `;
              }).join('')}

              <!-- Hint Ladder Inline Accordion -->
              <div class="hint-ladder-box" style="margin-top: 24px; padding: 16px; background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.125rem;">💡</span>
                    <strong style="color: var(--cream-1); font-size: 0.9375rem;">3-Level Hint Ladder</strong>
                    <span class="hints-badge" style="background: var(--surface-3); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; color: var(--cream-2);">
                      ${hintsUsed} of 3 used
                    </span>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    ${hintsUsed < 3 ? `
                      <button type="button" class="btn btn--outline btn--sm" id="btn-unlock-next-hint">
                        Unlock Level ${hintsUsed + 1} Hint →
                      </button>
                    ` : `
                      <span style="font-size: 0.75rem; color: var(--leaf); font-weight: 500;">✓ All 3 hints unlocked</span>
                    `}
                    <a href="#/assignment/${id}/hints" class="btn btn--ghost btn--sm" style="font-size: 0.75rem;">
                      Full Hint Stage ↗
                    </a>
                  </div>
                </div>

                <!-- Revealed Hints -->
                <div id="inline-hints-container">
                  ${hintsUsed >= 1 ? `
                    <div style="padding: 10px 14px; background: var(--surface-1); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #818cf8;">
                      <span style="font-size: 0.75rem; font-weight: 600; color: #818cf8; display: block; margin-bottom: 2px;">Level 1 Nudge (Question)</span>
                      <p style="margin: 0; font-size: 0.875rem; color: var(--cream-2);">${assignment.hints?.[0] || 'Consider the definition.'}</p>
                    </div>
                  ` : ''}
                  ${hintsUsed >= 2 ? `
                    <div style="padding: 10px 14px; background: var(--surface-1); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #38bdf8;">
                      <span style="font-size: 0.75rem; font-weight: 600; color: #38bdf8; display: block; margin-bottom: 2px;">Level 2 Guided Step</span>
                      <p style="margin: 0; font-size: 0.875rem; color: var(--cream-2);">${assignment.hints?.[1] || 'Break the step down.'}</p>
                    </div>
                  ` : ''}
                  ${hintsUsed >= 3 ? `
                    <div style="padding: 10px 14px; background: var(--surface-1); border-radius: 6px; border-left: 3px solid #34d399;">
                      <span style="font-size: 0.75rem; font-weight: 600; color: #34d399; display: block; margin-bottom: 2px;">Level 3 Partial Worked Example</span>
                      <p style="margin: 0; font-size: 0.875rem; color: var(--cream-2);">${assignment.hints?.[2] || 'Rule: left < node < right.'}</p>
                    </div>
                  ` : ''}
                  ${hintsUsed === 0 ? `
                    <p style="margin: 0; font-size: 0.8125rem; color: var(--cream-3); font-style: italic;">
                      Try solving the workspace on your own first! Unlock Level 1 if you need a nudge.
                    </p>
                  ` : ''}
                </div>
              </div>

              <!-- Action Bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px; margin-top: 28px;">
                <a href="#/assignment/${id}/brief" class="btn btn--outline">
                  ← Back to Brief
                </a>
                <button type="submit" class="btn btn--primary btn--lg" id="btn-as-submit-attempt">
                  Save & Rate Self-Assessment (Stage 4) →
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Pre-answer confidence handlers
      root.querySelectorAll('.btn-as-confidence').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.val, 10);
          PathStore.saveAssignment(id, { confidenceBefore: val });
          if (typeof Signals !== 'undefined' && Signals.savePreAnswerConfidence) {
            Signals.savePreAnswerConfidence(id, val);
          }
          renderAssignmentStage(assignment, 'attempt', root);
        });
      });

      root.querySelector('.btn-as-confidence-skip')?.addEventListener('click', () => {
        PathStore.saveAssignment(id, { confidenceBefore: null });
        renderAssignmentStage(assignment, 'attempt', root);
      });

      // Unlock hint handler
      root.querySelector('#btn-unlock-next-hint')?.addEventListener('click', () => {
        const nextCount = Math.min(3, (stored.hintsUsed || 0) + 1);
        stored = PathStore.saveAssignment(id, { hintsUsed: nextCount });
        if (typeof Signals !== 'undefined' && Signals.logHintUsed) {
          Signals.logHintUsed(id, nextCount);
        }
        renderAssignmentStage(assignment, 'attempt', root);
      });

      // Submit attempt handler
      root.querySelector('#assignment-attempt-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = {};
        (assignment.inputs || []).forEach(inp => {
          const el = root.querySelector('#as-input-' + inp.id);
          inputs[inp.id] = el ? el.value.trim() : '';
        });

        // Save inputs and advance to self-assess
        PathStore.saveAssignment(id, { inputs });
        Router.go('/assignment/' + id + '/self-assess');
      });
      return;
    }

    // ──────────────── STAGE 3: HINTS ────────────────
    if (stage === 'hints') {
      const hintsUsed = stored.hintsUsed || 0;
      const hints = assignment.hints || [
        "What extra rule does a BST add?",
        "Pick a node and check its children. Which is smaller?",
        "Rule: left < node < right, at every node."
      ];

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <div style="text-align: center; margin-bottom: 28px;">
              <h2 style="font-size: 1.25rem; margin-bottom: 8px;">💡 3-Level Hint Ladder</h2>
              <p style="color: var(--cream-2); font-size: 0.9375rem; max-width: 540px; margin: 0 auto;">
                Unlock hints step-by-step. Try to use as few levels as possible to build deep recall.
              </p>
              <div style="margin-top: 12px;">
                <span class="hints-badge" style="background: var(--surface-3); font-size: 0.8125rem; padding: 4px 12px; border-radius: 12px; color: var(--cream-1); font-weight: 600;">
                  Levels Used: ${hintsUsed} of 3
                </span>
              </div>
            </div>

            <!-- Hint Level 1 -->
            <div class="hint-card" style="padding: 18px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 16px; background: var(--surface-2);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #818cf8; font-size: 0.9375rem;">Level 1 Nudge (A Guiding Question)</strong>
                ${hintsUsed >= 1 ? '<span style="color: var(--leaf); font-size: 0.8125rem;">Unlocked ✓</span>' : ''}
              </div>
              ${hintsUsed >= 1 ? `
                <p style="margin: 0; color: var(--cream-1); font-size: 1rem; line-height: 1.5;">${hints[0]}</p>
              ` : `
                <p style="margin: 0 0 12px 0; color: var(--cream-3); font-size: 0.875rem;">A guiding question to point your thinking in the right direction.</p>
                <button type="button" class="btn btn--outline btn--sm" id="btn-unlock-h1">Unlock Level 1 Nudge</button>
              `}
            </div>

            <!-- Hint Level 2 -->
            <div class="hint-card" style="padding: 18px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 16px; background: var(--surface-2); opacity: ${hintsUsed >= 1 ? '1' : '0.6'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #38bdf8; font-size: 0.9375rem;">Level 2 Guided Step</strong>
                ${hintsUsed >= 2 ? '<span style="color: var(--leaf); font-size: 0.8125rem;">Unlocked ✓</span>' : ''}
              </div>
              ${hintsUsed >= 2 ? `
                <p style="margin: 0; color: var(--cream-1); font-size: 1rem; line-height: 1.5;">${hints[1]}</p>
              ` : `
                <p style="margin: 0 0 12px 0; color: var(--cream-3); font-size: 0.875rem;">A concrete structural step to guide your execution.</p>
                <button type="button" class="btn btn--outline btn--sm" id="btn-unlock-h2" ${hintsUsed < 1 ? 'disabled' : ''}>Unlock Level 2 Step</button>
              `}
            </div>

            <!-- Hint Level 3 -->
            <div class="hint-card" style="padding: 18px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px; background: var(--surface-2); opacity: ${hintsUsed >= 2 ? '1' : '0.6'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #34d399; font-size: 0.9375rem;">Level 3 Partial Worked Example</strong>
                ${hintsUsed >= 3 ? '<span style="color: var(--leaf); font-size: 0.8125rem;">Unlocked ✓</span>' : ''}
              </div>
              ${hintsUsed >= 3 ? `
                <p style="margin: 0; color: var(--cream-1); font-size: 1rem; line-height: 1.5;">${hints[2]}</p>
              ` : `
                <p style="margin: 0 0 12px 0; color: var(--cream-3); font-size: 0.875rem;">A partial worked demonstration showing the rule in practice.</p>
                <button type="button" class="btn btn--outline btn--sm" id="btn-unlock-h3" ${hintsUsed < 2 ? 'disabled' : ''}>Unlock Level 3 Example</button>
              `}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px;">
              <a href="#/assignment/${id}/brief" class="btn btn--ghost">← Brief</a>
              <button type="button" class="btn btn--primary" id="btn-return-to-attempt">
                Return to Workspace →
              </button>
            </div>
          </div>
        </div>
      `;

      root.querySelector('#btn-unlock-h1')?.addEventListener('click', () => {
        const next = Math.max(1, stored.hintsUsed || 0);
        PathStore.saveAssignment(id, { hintsUsed: next });
        if (typeof Signals !== 'undefined' && Signals.logHintUsed) {
          Signals.logHintUsed(id, 1);
        }
        renderAssignmentStage(assignment, 'hints', root);
      });
      root.querySelector('#btn-unlock-h2')?.addEventListener('click', () => {
        const next = Math.max(2, stored.hintsUsed || 0);
        PathStore.saveAssignment(id, { hintsUsed: next });
        if (typeof Signals !== 'undefined' && Signals.logHintUsed) {
          Signals.logHintUsed(id, 2);
        }
        renderAssignmentStage(assignment, 'hints', root);
      });
      root.querySelector('#btn-unlock-h3')?.addEventListener('click', () => {
        PathStore.saveAssignment(id, { hintsUsed: 3 });
        if (typeof Signals !== 'undefined' && Signals.logHintUsed) {
          Signals.logHintUsed(id, 3);
        }
        renderAssignmentStage(assignment, 'hints', root);
      });
      root.querySelector('#btn-return-to-attempt')?.addEventListener('click', () => {
        Router.go('/assignment/' + id + '/attempt');
      });
      return;
    }

    // ──────────────── STAGE 4: SELF-ASSESS ────────────────
    if (stage === 'self-assess') {
      const inputs = stored.inputs || {};
      const selfScores = stored.selfScores || {};

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <!-- Crucial requirement notice -->
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
              <strong style="color: #f59e0b; display: block; font-size: 0.9375rem; margin-bottom: 4px;">
                Stage 4: Self-Assessment (BEFORE Seeing Results)
              </strong>
              <p style="color: var(--cream-2); font-size: 0.875rem; margin: 0; line-height: 1.5;">
                Rate your own attempt against each rubric criterion from 0 to 3. Calibrating your self-assessment against the evaluator builds deep meta-cognitive awareness.
              </p>
            </div>

            <!-- Summary of student's attempt -->
            <div style="background: var(--surface-2); padding: 16px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px;">
              <strong style="color: var(--cream-1); font-size: 0.875rem; display: block; margin-bottom: 8px;">Your Submitted Attempt:</strong>
              ${Object.entries(inputs).map(([k, v]) => `
                <div style="margin-bottom: 6px; font-size: 0.875rem;">
                  <span style="color: var(--cream-3);">${k}:</span>
                  <span style="color: var(--cream-1); font-family: var(--font-mono, monospace); font-weight: 500;">${v || '(blank)'}</span>
                </div>
              `).join('')}
              <div style="margin-top: 10px;">
                <a href="#/assignment/${id}/attempt" style="font-size: 0.8125rem; color: #818cf8; text-decoration: none;">← Edit attempt inputs</a>
              </div>
            </div>

            <!-- Rubric Criteria Self-Rating -->
            <form id="self-assess-form" novalidate style="margin-bottom: 28px;">
              ${(assignment.rubric || []).map((crit, idx) => {
                const currentRating = selfScores[crit.id] !== undefined ? selfScores[crit.id] : null;
                return `
                  <div class="rubric-rating-card" style="padding: 16px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 16px;">
                    <div style="margin-bottom: 8px;">
                      <strong style="color: var(--cream-1); font-size: 0.9375rem;">${crit.title}</strong>
                      <p style="color: var(--cream-3); font-size: 0.8125rem; margin: 4px 0 0 0;">${crit.description}</p>
                    </div>
                    <div class="score-pills-row" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                      ${[0, 1, 2, 3].map(scoreVal => {
                        const labels = ['0: Not yet', '1: Emerging', '2: Competent', '3: Exemplary'];
                        const isChecked = currentRating === scoreVal;
                        return `
                          <label class="score-pill-label" style="flex: 1; min-width: 110px; cursor: pointer; text-align: center; padding: 8px 6px; border-radius: 6px; border: 1px solid ${isChecked ? 'var(--border-focus)' : 'var(--border)'}; background: ${isChecked ? 'var(--surface-3)' : 'var(--surface-2)'}; color: ${isChecked ? 'var(--cream-1)' : 'var(--cream-2)'}; font-size: 0.8125rem; user-select: none;">
                            <input type="radio" name="score-${crit.id}" value="${scoreVal}" ${isChecked ? 'checked' : ''} style="display: none;" required />
                            ${labels[scoreVal]}
                          </label>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}

              <div id="self-assess-error" style="color: #ef4444; font-size: 0.875rem; margin-bottom: 16px;" hidden>
                Please select a self-rating (0–3) for all criteria before proceeding.
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px;">
                <a href="#/assignment/${id}/attempt" class="btn btn--outline">
                  ← Edit Attempt
                </a>
                <button type="submit" class="btn btn--primary btn--lg" id="btn-submit-self-assess">
                  <span>Submit Self-Assessment & View Feedback →</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Visual radio button active toggle
      root.querySelectorAll('.score-pill-label').forEach(label => {
        label.addEventListener('click', () => {
          const radio = label.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            const parentRow = label.closest('.score-pills-row');
            parentRow.querySelectorAll('.score-pill-label').forEach(l => {
              l.style.border = '1px solid var(--border)';
              l.style.background = 'var(--surface-2)';
              l.style.color = 'var(--cream-2)';
            });
            label.style.border = '1px solid var(--border-focus)';
            label.style.background = 'var(--surface-3)';
            label.style.color = 'var(--cream-1)';
          }
        });
      });

      root.querySelector('#self-assess-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = root.querySelector('#self-assess-error');
        const submitBtn = root.querySelector('#btn-submit-self-assess');

        const collectedSelfScores = {};
        let allChecked = true;

        (assignment.rubric || []).forEach(crit => {
          const checked = root.querySelector(`input[name="score-${crit.id}"]:checked`);
          if (checked) {
            collectedSelfScores[crit.id] = parseInt(checked.value, 10);
          } else {
            allChecked = false;
          }
        });

        if (!allChecked) {
          if (errEl) errEl.hidden = false;
          return;
        }
        if (errEl) errEl.hidden = true;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Evaluating with AI & Deterministic Engine...';
        }

        try {
          // Evaluate assignment
          let evalResult = null;
          if (typeof TutorChatService !== 'undefined' && TutorChatService.evaluateAssignment) {
            evalResult = await TutorChatService.evaluateAssignment(assignment, inputs);
          } else {
            // Basic fallback
            evalResult = {
              criteria: (assignment.rubric || []).map(r => ({ id: r.id, title: r.title, score: 2, feedback: 'Completed.' })),
              totalScore: (assignment.rubric || []).length * 2,
              maxScore: (assignment.rubric || []).length * 3,
              percentage: 67,
              band: 'Developing',
              rating: 'partial',
              nextStep: 'Practice traversal ordering and tree construction.',
              deterministicResults: {}
            };
          }

          // Save assignment with selfScores and aiEvaluation (PathStore calculates calibrationGap)
          const updatedAssignment = PathStore.saveAssignment(id, {
            selfScores: collectedSelfScores,
            aiEvaluation: evalResult,
            status: 'evaluated'
          });

          // Prompt 4 Telemetry: assignment_scored (band, hintsUsed, calibrationGap, attempts)
          if (typeof Signals !== 'undefined' && Signals.logAssignmentScored) {
            Signals.logAssignmentScored(id, {
              band: evalResult.band,
              hintsUsed: updatedAssignment.hintsUsed || 0,
              calibrationGap: updatedAssignment.calibrationGap !== undefined ? updatedAssignment.calibrationGap : 0,
              attempts: 1
            });
          }

          Router.go('/assignment/' + id + '/feedback');
        } catch (err) {
          console.error('[Assignment] Evaluation error:', err);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Evaluation ↺';
          }
          let errCard = root.querySelector('#as-eval-error-card');
          if (!errCard) {
            errCard = document.createElement('div');
            errCard.id = 'as-eval-error-card';
            errCard.style.cssText = 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px 18px; margin-top: 16px; color: var(--cream); font-size: 14px;';
            submitBtn.parentNode.insertBefore(errCard, submitBtn.nextSibling);
          }
          const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(err) : 'Evaluation failed. Please try again.';
          errCard.innerHTML = `<span style="color: #ef4444; font-weight: 600;">⚠️ Evaluation Error:</span> ${friendly}`;
        }
      });
      return;
    }

    // ──────────────── STAGE 5: FEEDBACK ────────────────
    if (stage === 'feedback') {
      const evalResult = stored.aiEvaluation;
      const selfScores = stored.selfScores || {};
      const calGap = stored.calibrationGap !== undefined ? stored.calibrationGap : 0;

      if (!evalResult) {
        // If not yet evaluated, send learner to self-assess
        Router.go('/assignment/' + id + '/self-assess');
        return;
      }

      const bandColor = evalResult.band === 'Strong' ? 'var(--leaf)' : (evalResult.band === 'Developing' ? '#f59e0b' : '#ef4444');
      const bandBg = evalResult.band === 'Strong' ? 'rgba(95, 171, 122, 0.12)' : (evalResult.band === 'Developing' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)');
      const bandBorder = evalResult.band === 'Strong' ? 'rgba(95, 171, 122, 0.3)' : (evalResult.band === 'Developing' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)');

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <!-- Overall Score Banner -->
            <div class="assignment-result-banner" style="background: ${bandBg}; border: 1px solid ${bandBorder}; border-radius: 12px; padding: 24px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <span class="band-tag" style="background: ${bandColor}; color: #000; font-weight: 700; font-size: 0.8125rem; padding: 3px 10px; border-radius: 12px;">
                    ${evalResult.band} Band (${evalResult.percentage}%)
                  </span>
                  <span style="font-size: 0.8125rem; color: var(--cream-2);">
                    Mapped path rating: <strong style="color: ${bandColor};">${evalResult.rating}</strong>
                  </span>
                </div>
                <h2 style="font-size: 1.5rem; margin: 0; color: var(--cream-1);">
                  Total Score: ${evalResult.totalScore} / ${evalResult.maxScore}
                </h2>
              </div>

              <!-- Calibration Gap Pill -->
              <div style="background: var(--surface-1); padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); text-align: right;">
                <span style="font-size: 0.75rem; color: var(--cream-3); display: block;">Calibration Gap (Self − AI)</span>
                <strong style="font-size: 1.125rem; color: ${calGap === 0 ? 'var(--leaf)' : (Math.abs(calGap) <= 0.5 ? '#f59e0b' : '#ef4444')};">
                  ${calGap > 0 ? '+' + calGap : calGap}
                </strong>
                <span style="font-size: 0.6875rem; color: var(--cream-3); display: block;">
                  ${calGap === 0 ? 'Perfect calibration' : (calGap > 0 ? 'Self-rated higher' : 'Self-rated lower')}
                </span>
              </div>
            </div>

            <!-- Deterministic Checks Section (if present) -->
            ${evalResult.deterministicResults && Object.keys(evalResult.deterministicResults).length > 0 ? `
              <div style="margin-bottom: 28px;">
                <h3 style="font-size: 1.0625rem; color: var(--cream-1); margin-bottom: 12px;">⚡ Deterministic Verification (Exact Answers)</h3>
                <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-2);">
                  ${Object.entries(evalResult.deterministicResults).map(([key, dRes], idx) => `
                    <div style="padding: 12px 16px; ${idx > 0 ? 'border-top: 1px solid var(--border);' : ''} display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                      <div>
                        <strong style="color: var(--cream-1); font-size: 0.875rem; text-transform: capitalize;">${key}:</strong>
                        <p style="color: var(--cream-2); font-size: 0.8125rem; margin: 2px 0 0 0;">${dRes.explanation}</p>
                      </div>
                      <span style="font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; white-space: nowrap; ${dRes.correct ? 'background: rgba(95, 171, 122, 0.2); color: var(--leaf);' : 'background: rgba(239, 68, 68, 0.2); color: #ef4444;'}">
                        ${dRes.correct ? '✓ Exact Match' : '✗ Incorrect'}
                      </span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- AI Rubric Feedback Section -->
            <div style="margin-bottom: 28px;">
              <h3 style="font-size: 1.0625rem; color: var(--cream-1); margin-bottom: 12px;">📋 Rubric Criterion Breakdown</h3>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${(evalResult.criteria || []).map(c => {
                  const sScore = selfScores[c.id] !== undefined ? selfScores[c.id] : '—';
                  const aiScore = c.score;
                  return `
                    <div style="padding: 16px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                        <strong style="color: var(--cream-1); font-size: 0.9375rem;">${c.title}</strong>
                        <div style="display: flex; gap: 12px; font-size: 0.8125rem;">
                          <span style="color: var(--cream-3);">Self: <strong style="color: var(--cream-1);">${sScore}/3</strong></span>
                          <span style="color: var(--cream-3);">Evaluator: <strong style="color: ${aiScore === 3 ? 'var(--leaf)' : (aiScore >= 2 ? '#f59e0b' : '#ef4444')};">${aiScore}/3</strong></span>
                        </div>
                      </div>
                      <p style="color: var(--cream-2); font-size: 0.875rem; margin: 0; line-height: 1.5;">${c.feedback}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Specific Next Step Recommendation -->
            <div style="padding: 18px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; margin-bottom: 28px;">
              <strong style="color: #818cf8; font-size: 0.9375rem; display: block; margin-bottom: 4px;">
                🎯 Specific Next Step:
              </strong>
              <p style="color: var(--cream-1); font-size: 0.9375rem; margin: 0; line-height: 1.5;">
                ${evalResult.nextStep}
              </p>
            </div>

            <!-- Actions Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px; flex-wrap: wrap; gap: 12px;">
              <div>
                ${evalResult.band !== 'Strong' && !stored.revised ? `
                  <a href="#/assignment/${id}/revise" class="btn btn--outline" id="btn-as-revise">
                    Revise Attempt (1 revision allowed) ↺
                  </a>
                ` : (stored.revised ? `
                  <span style="font-size: 0.8125rem; color: var(--cream-3);">Revision used (score updated) ✓</span>
                ` : `
                  <span style="font-size: 0.8125rem; color: var(--leaf); font-weight: 500;">Strong band achieved — no revision required ✓</span>
                `)}
              </div>
              <button type="button" class="btn btn--primary btn--lg" id="btn-as-continue-reflect">
                Continue to Reflection (Stage 7) →
              </button>
            </div>
          </div>
        </div>
      `;

      root.querySelector('#btn-as-continue-reflect')?.addEventListener('click', () => {
        Router.go('/assignment/' + id + '/reflect');
      });
      return;
    }

    // ──────────────── STAGE 6: REVISE ────────────────
    if (stage === 'revise') {
      const evalResult = stored.aiEvaluation;
      const isStrong = evalResult && evalResult.band === 'Strong';
      const alreadyRevised = stored.revised;

      if (isStrong || alreadyRevised) {
        root.innerHTML = `
          <div class="page-container">
            <div class="page-card assignment-stage-card" style="text-align: center; padding: 48px 24px;">
              ${stageHeaderHtml}
              <div style="font-size: 2.5rem; margin-bottom: 12px;">${isStrong ? '🌟' : '✓'}</div>
              <h2 style="margin-bottom: 8px;">
                ${isStrong ? 'Strong Band Achieved!' : 'Revision Limit Reached'}
              </h2>
              <p style="color: var(--cream-2); max-width: 480px; margin: 0 auto 24px;">
                ${isStrong
                  ? 'Your score is already in the Strong band (75%+). You do not need a revision.'
                  : 'You have already used your one allowed revision for this assignment.'}
              </p>
              <div style="display: flex; justify-content: center; gap: 12px;">
                <a href="#/assignment/${id}/feedback" class="btn btn--outline">View Feedback →</a>
                <a href="#/assignment/${id}/reflect" class="btn btn--primary">Continue to Reflection →</a>
              </div>
            </div>
          </div>
        `;
        return;
      }

      const savedInputs = stored.inputs || {};

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <!-- Revision banner -->
            <div style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
              <strong style="color: #818cf8; display: block; font-size: 0.9375rem; margin-bottom: 4px;">
                Revision Attempt (1 of 1 allowed)
              </strong>
              <p style="color: var(--cream-2); font-size: 0.875rem; margin: 0; line-height: 1.5;">
                Refine your answers below. The new score will completely replace the old one.
              </p>
            </div>

            <!-- Workspace Inputs Pre-Filled -->
            <form id="assignment-revision-form" novalidate style="margin-bottom: 28px;">
              ${(assignment.inputs || []).map(inp => {
                const val = savedInputs[inp.id] !== undefined ? savedInputs[inp.id] : '';
                if (inp.type === 'textarea') {
                  return `
                    <div class="field" style="margin-bottom: 20px;">
                      <label class="field-label" for="as-rev-input-${inp.id}" style="font-weight: 500; font-size: 0.9375rem; margin-bottom: 6px; display: block;">
                        ${inp.label}
                      </label>
                      <textarea id="as-rev-input-${inp.id}" class="field-input" rows="4" style="width: 100%; box-sizing: border-box;">${val}</textarea>
                    </div>
                  `;
                }
                return `
                  <div class="field" style="margin-bottom: 20px;">
                    <label class="field-label" for="as-rev-input-${inp.id}" style="font-weight: 500; font-size: 0.9375rem; margin-bottom: 6px; display: block;">
                      ${inp.label}
                    </label>
                    <input type="${inp.type || 'text'}" id="as-rev-input-${inp.id}" class="field-input" value="${val}" style="width: 100%; box-sizing: border-box;" />
                  </div>
                `;
              }).join('')}

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px; margin-top: 28px;">
                <a href="#/assignment/${id}/feedback" class="btn btn--outline">
                  ← Back to Feedback
                </a>
                <button type="submit" class="btn btn--primary btn--lg" id="btn-submit-revision">
                  Submit Revision (Replace Score) →
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      root.querySelector('#assignment-revision-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = root.querySelector('#btn-submit-revision');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Evaluating Revision...';
        }

        const newInputs = {};
        (assignment.inputs || []).forEach(inp => {
          const el = root.querySelector('#as-rev-input-' + inp.id);
          newInputs[inp.id] = el ? el.value.trim() : '';
        });

        try {
          let newEval = null;
          if (typeof TutorChatService !== 'undefined' && TutorChatService.evaluateAssignment) {
            newEval = await TutorChatService.evaluateAssignment(assignment, newInputs);
          } else {
            newEval = {
              criteria: (assignment.rubric || []).map(r => ({ id: r.id, title: r.title, score: 3, feedback: 'Revised and resolved.' })),
              totalScore: (assignment.rubric || []).length * 3,
              maxScore: (assignment.rubric || []).length * 3,
              percentage: 100,
              band: 'Strong',
              rating: 'solid',
              nextStep: 'Mastery achieved after revision!',
              deterministicResults: {}
            };
          }

          // New score replaces old score
          const updatedAssignment = PathStore.saveAssignment(id, {
            inputs: newInputs,
            aiEvaluation: newEval,
            revised: true
          });

          // Prompt 4 Telemetry: assignment_scored revision
          if (typeof Signals !== 'undefined' && Signals.logAssignmentScored) {
            Signals.logAssignmentScored(id, {
              band: newEval.band,
              hintsUsed: updatedAssignment.hintsUsed || 0,
              calibrationGap: updatedAssignment.calibrationGap !== undefined ? updatedAssignment.calibrationGap : 0,
              attempts: 2
            });
          }

          Router.go('/assignment/' + id + '/feedback');
        } catch (err) {
          console.error('[Assignment] Revision error:', err);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Revision Evaluation ↺';
          }
          let errCard = root.querySelector('#as-rev-eval-error-card');
          if (!errCard) {
            errCard = document.createElement('div');
            errCard.id = 'as-rev-eval-error-card';
            errCard.style.cssText = 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px 18px; margin-top: 16px; color: var(--cream); font-size: 14px;';
            submitBtn.parentNode.insertBefore(errCard, submitBtn.nextSibling);
          }
          const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(err) : 'Revision evaluation failed.';
          errCard.innerHTML = `<span style="color: #ef4444; font-weight: 600;">⚠️ Revision Error:</span> ${friendly}`;
        }
      });
      return;
    }

    // ──────────────── STAGE 7: REFLECT ────────────────
    if (stage === 'reflect') {
      const evalResult = stored.aiEvaluation || {};
      const rating = evalResult.rating || 'solid';

      root.innerHTML = `
        <div class="page-container">
          <div class="page-card assignment-stage-card">
            ${stageHeaderHtml}

            <div style="text-align: center; max-width: 560px; margin: 0 auto 32px;">
              <div style="font-size: 2.5rem; margin-bottom: 12px;">💭</div>
              <h2 style="font-size: 1.375rem; margin-bottom: 8px;">Final Reflection</h2>
              <p style="color: var(--cream-2); font-size: 0.9375rem; line-height: 1.5;">
                One quick prompt to cement your mental model before advancing.
              </p>
            </div>

            <!-- Single question: "What was the hardest part?" -->
            <form id="assignment-reflection-form" novalidate style="max-width: 600px; margin: 0 auto 28px;">
              <div class="field" style="margin-bottom: 24px;">
                <label class="field-label" for="as-reflect-hardest" style="font-size: 1.0625rem; font-weight: 600; color: var(--cream-1); margin-bottom: 8px; display: block;">
                  What was the hardest part?
                </label>
                <textarea
                  id="as-reflect-hardest"
                  class="field-input"
                  rows="4"
                  placeholder="Optional: share what concept felt trickiest or where you had to pause..."
                  style="width: 100%; box-sizing: border-box;"
                >${stored.hardestPart || ''}</textarea>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 20px;">
                <button type="button" class="btn btn--ghost" id="btn-skip-as-reflect">
                  Skip reflection
                </button>
                <button type="submit" class="btn btn--primary btn--lg" id="btn-finish-as-reflect">
                  Complete Assignment ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      function finishAssignment(hardestText) {
        // Save reflection text
        PathStore.saveAssignment(id, {
          hardestPart: hardestText,
          status: 'completed'
        });

        // 1. Mark step as completed in PathStore session
        PathStore.recordSessionStepCompleted(id);

        // 2. Mark step completed in Roadmap
        if (typeof Roadmap !== 'undefined' && Roadmap.completeStep) {
          Roadmap.completeStep(id);
        }

        // 3. Trigger PathEngine.adapt so adaptation reacts to mapped rating (solid, partial, weak)
        if (typeof PathEngine !== 'undefined' && PathEngine.adapt) {
          const profile = typeof State !== 'undefined' ? State.getProfile() : null;
          const level = (profile && profile.level) || 'beginner';
          const steps = typeof Roadmap !== 'undefined' ? Roadmap.getSteps() : [];

          const adaptResult = PathEngine.adapt(steps, id, rating, { level });
          if (adaptResult && adaptResult.message && window.showToast) {
            showToast(adaptResult.message, rating === 'solid' ? 'success' : 'info');
          }
        }

        // 4. Check if session wrap-up should trigger
        if (shouldTriggerWrapUp(id)) {
          Router.go('/wrapup');
        } else {
          // Advance to Prompt 2 step reflection or progress
          Router.go('/reflect/' + id);
        }
      }

      root.querySelector('#assignment-reflection-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = root.querySelector('#as-reflect-hardest')?.value.trim() || '';
        finishAssignment(text);
      });

      root.querySelector('#btn-skip-as-reflect')?.addEventListener('click', () => {
        finishAssignment('');
      });
      return;
    }

    // Default fallback to brief
    Router.go('/assignment/' + id + '/brief');
  }

  function getWhyItMatters(id) {
    const reasons = {
      'as-1': 'Explaining concepts to someone else from first principles strips away rote jargon and forces you to verify your intuition of the recursive BST invariant.',
      'as-2': 'Constructing a tree manually from keys reveals how insertion sequence directly controls tree height and traversal sequences (in-order, pre-order, post-order).',
      'as-3': 'Detecting subtle invariant violations ensures your mental model checks global subtree bounds (every left descendant < node), not just immediate parent-child pairs.',
      'as-4': 'Deleting a node with two children is the trickiest standard BST operation. Finding the in-order successor guarantees that the remaining tree remains fully valid.',
      'as-5': 'Inserting sorted keys demonstrates how an unbalanced BST degenerates into an O(n) linked list, proving why AVL self-balancing rotations are necessary.',
      'as-6': 'Comparing AVL and Red-Black trees bridges data structure theory with production database and operating system architecture.'
    };
    return reasons[id] || 'Structured hands-on practice builds authentic computer science depth.';
  }

  /* ── Route 17: Hidden #/debug (Diagnostics & Self-Test Suite) ── */
  Router.add('/debug', (params, root) => {
    function renderDiagnostics(testResult = null, isTesting = false) {
      const sbConfig = (typeof AI !== 'undefined' && AI.getSupabaseConfig) ? AI.getSupabaseConfig() : { url: '', anonKey: '' };
      const isConfigured = (typeof AI !== 'undefined' && AI.isSupabaseConfigured) ? AI.isSupabaseConfigured() : false;
      const proxyUrl = sbConfig.url ? `${sbConfig.url.replace(/\/+$/, '')}/functions/v1/gemini-proxy` : 'Not configured';
      const modelName = (typeof AI !== 'undefined' && AI.getModelName) ? AI.getModelName() : 'server';
      const isMock = (typeof AI !== 'undefined' && AI.isMockEnabled) ? AI.isMockEnabled() : false;
      const recentErrors = (typeof AI !== 'undefined' && AI.getRecentErrors) ? AI.getRecentErrors() : [];

      root.innerHTML = `
        <div class="page-container debug-page-container">
          <div class="page-card debug-card">
            <!-- Header Bar -->
            <div class="debug-header-bar">
              <div>
                <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 4px;">
                  <span class="debug-badge-tag">Internal Diagnostic Mode</span>
                  <span class="debug-env-tag">?debug=1 Active</span>
                </div>
                <h1 class="step-page-title" data-page-heading style="margin: 0 0 6px 0;">AI Diagnostics &amp; Self-Test</h1>
                <p style="color: var(--cream-2); margin: 0; font-size: 0.95rem;">
                  Inspect Supabase Edge Function proxy status, test network latency, verify JSON evaluation schemas, and view recent error logs.
                </p>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" id="btn-debug-return">
                ← Return to Learning
              </button>
            </div>

            <!-- Diagnostics Metrics Grid -->
            <div class="debug-grid">
              <div class="debug-info-tile">
                <span class="debug-tile-label">Proxy Status</span>
                <div class="debug-tile-val">
                  ${isConfigured ? `<span class="debug-status-pill debug-status-pill--green">Connected (Proxy)</span>` : `<span class="debug-status-pill debug-status-pill--amber">Missing Config (Mock Mode)</span>`}
                </div>
                <span class="debug-tile-sub">Endpoint: <code>functions/v1/gemini-proxy</code></span>
              </div>

              <div class="debug-info-tile">
                <span class="debug-tile-label">Configured Model</span>
                <div class="debug-tile-val">
                  <span class="debug-status-pill debug-status-pill--blue">${modelName}</span>
                </div>
                <span class="debug-tile-sub">Defined on server proxy</span>
              </div>

              <div class="debug-info-tile">
                <span class="debug-tile-label">Runtime Mode</span>
                <div class="debug-tile-val">
                  ${isMock ? `<span class="debug-status-pill debug-status-pill--amber">Mock Mode Active</span>` : `<span class="debug-status-pill debug-status-pill--green">Server Proxy Active</span>`}
                </div>
                <span class="debug-tile-sub">Config: <code>window.CDD_CONFIG</code></span>
              </div>

              <div class="debug-info-tile">
                <span class="debug-tile-label">Recent AI Errors</span>
                <div class="debug-tile-val">
                  <span class="debug-status-pill ${recentErrors.length > 0 ? 'debug-status-pill--red' : 'debug-status-pill--neutral'}">
                    ${recentErrors.length} logged
                  </span>
                </div>
                <span class="debug-tile-sub">Capped at last 10 AIError events</span>
              </div>
            </div>

            <!-- Self-Test Runner Section -->
            <div class="debug-section-card">
              <div class="debug-section-header">
                <div>
                  <h3 style="margin: 0; font-size: 1.05rem; color: var(--cream);">Self-Test Probe (AI.selfTest)</h3>
                  <p style="margin: 4px 0 0 0; color: var(--cream-2); font-size: 0.85rem;">Sends a minimal 1-token test prompt through the Supabase Edge Function proxy to verify authentication, endpoint connectivity, and round-trip latency.</p>
                </div>
                <button type="button" class="btn btn--primary" id="btn-run-selftest" ${isTesting ? 'disabled' : ''}>
                  ${isTesting ? 'Running probe...' : 'Run test ⚡'}
                </button>
              </div>

              <div id="debug-selftest-output" class="debug-output-box">
                ${testResult ? `
                  <div class="debug-result-block ${testResult.ok ? 'debug-result-block--success' : 'debug-result-block--error'}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                      <strong>${testResult.ok ? '✓ Self-Test PASSED (Proxy)' : '✕ Self-Test FAILED'}</strong>
                      <span class="debug-latency-tag">${testResult.latencyMs} ms</span>
                    </div>
                    <div style="font-family: monospace; font-size: 0.85rem; line-height: 1.5; color: var(--cream);">
                      ${testResult.ok ? `
                        <div><strong>Model:</strong> ${testResult.model || 'server'}</div>
                        <div><strong>Proxy:</strong> ${testResult.proxyUrl || proxyUrl}</div>
                        <div><strong>Response:</strong> "${testResult.result}"</div>
                      ` : `
                        <div><strong>Error Code:</strong> ${testResult.error}</div>
                        <div><strong>Model:</strong> ${testResult.model || 'server'}</div>
                        <div><strong>Proxy:</strong> ${testResult.proxyUrl || proxyUrl}</div>
                        <div><strong>Details:</strong> ${testResult.message}</div>
                      `}
                    </div>
                  </div>
                ` : `
                  <div style="color: var(--cream-3); font-size: 0.875rem;">
                    Click "Run test" to execute a live diagnostic round-trip via <code>AI.selfTest()</code> through the Supabase proxy.
                  </div>
                `}
              </div>
            </div>

            <!-- Last 10 AIErrors Section -->
            <div class="debug-section-card" style="margin-top: 24px;">
              <div class="debug-section-header">
                <div>
                  <h3 style="margin: 0; font-size: 1.05rem; color: var(--cream);">Recent AIError Codes (Last 10)</h3>
                  <p style="margin: 4px 0 0 0; color: var(--cream-2); font-size: 0.85rem;">Typed error events captured across chat, quizzes, placement diagnostics, and assignments.</p>
                </div>
                <button type="button" class="btn btn--ghost btn--xs" id="btn-refresh-errors">
                  Refresh Logs ↻
                </button>
              </div>

              ${recentErrors.length > 0 ? `
                <div class="debug-table-wrap">
                  <table class="debug-error-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Error Code</th>
                        <th>HTTP Status</th>
                        <th>Friendly Notice</th>
                        <th>Technical Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recentErrors.map(err => `
                        <tr>
                          <td style="white-space: nowrap; font-size: 0.75rem; color: var(--cream-3);">
                            ${new Date(err.timestamp).toLocaleTimeString()}
                          </td>
                          <td>
                            <span class="debug-error-badge debug-error-badge--${err.code}">
                              ${err.code}
                            </span>
                          </td>
                          <td style="font-family: monospace; font-size: 0.8rem;">
                            ${err.status || 'N/A'}
                          </td>
                          <td style="font-size: 0.85rem; color: var(--cream);">
                            ${err.friendlyMessage || '—'}
                          </td>
                          <td style="font-size: 0.75rem; font-family: monospace; color: var(--cream-3); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${err.message || ''}">
                            ${err.message || '—'}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div class="debug-empty-box">
                  <span style="font-size: 1.25rem;">✨</span>
                  <span>No AIErrors logged. All AI calls have succeeded or system is idle.</span>
                </div>
              `}
            </div>

            <!-- Structured Output Live Sandbox -->
            <div class="debug-section-card" style="margin-top: 24px;">
              <div class="debug-section-header">
                <div>
                  <h3 style="margin: 0; font-size: 1.05rem; color: var(--cream);">Structured Output Sandbox (JSON Schema)</h3>
                  <p style="margin: 4px 0 0 0; color: var(--cream-2); font-size: 0.85rem;">Test live evaluation schema to verify that rating, feedback, missing, suggestion, and gap parse correctly into structured JSON.</p>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">
                <textarea id="debug-eval-input" class="step-quiz-textarea" rows="3" placeholder="Enter a sample answer to test evaluation (e.g. 'In-order traversal visits left, root, then right. In a BST all left keys are smaller, so it prints sorted order.')..."></textarea>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <button type="button" class="btn btn--secondary btn--sm" id="btn-run-eval-test">
                    Test Structured Evaluation 🧪
                  </button>
                  <span id="debug-eval-status" style="font-size: 0.85rem; color: var(--cream-2);"></span>
                </div>
                <div id="debug-eval-output" style="display:none; margin-top: 8px;"></div>
              </div>
            </div>

          </div>
        </div>
      `;

      // Wire events
      root.querySelector('#btn-debug-return')?.addEventListener('click', () => {
        const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
        Router.go(curr ? ('/step/' + curr.id) : '/ready');
      });

      root.querySelector('#btn-run-selftest')?.addEventListener('click', async () => {
        renderDiagnostics(null, true);
        if (typeof AI !== 'undefined' && AI.selfTest) {
          const res = await AI.selfTest();
          renderDiagnostics(res, false);
        } else {
          renderDiagnostics({ ok: false, model: 'unknown', keySuffix: '[NONE]', latencyMs: 0, error: 'AI_NOT_LOADED', message: 'js/ai.js is not loaded.' }, false);
        }
      });

      root.querySelector('#btn-refresh-errors')?.addEventListener('click', () => {
        renderDiagnostics(testResult, false);
      });

      root.querySelector('#btn-run-eval-test')?.addEventListener('click', async () => {
        const inputEl = root.querySelector('#debug-eval-input');
        const statusEl = root.querySelector('#debug-eval-status');
        const outEl = root.querySelector('#debug-eval-output');
        const answer = inputEl ? inputEl.value.trim() : '';

        if (!answer) {
          if (statusEl) statusEl.textContent = 'Please enter sample answer text above.';
          return;
        }

        if (statusEl) statusEl.textContent = 'Calling AI.call({ json: true, schema: EVALUATION })...';
        const start = Date.now();

        try {
          if (typeof AI === 'undefined') throw new Error('AI module not loaded.');
          const evalRes = await AI.call({
            system: "You are an expert DSA assessment evaluator. Evaluate the student's answer. Respond ONLY with valid JSON conforming to the schema.",
            messages: [{ role: 'user', content: `Question: Explain why in-order traversal of a BST yields sorted order.\nStudent Answer: ${answer}` }],
            json: true,
            schema: AI.schemas.EVALUATION,
            maxTokens: 500
          });

          const latency = Date.now() - start;
          if (statusEl) statusEl.textContent = `Completed in ${latency}ms`;
          if (outEl) {
            outEl.style.display = 'block';
            outEl.innerHTML = `
              <div style="background: var(--surface-3); border: 1px solid var(--border); border-radius: 8px; padding: 14px;">
                <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 8px;">
                  <span class="feedback-badge feedback-badge--${evalRes.rating || 'needs_review'}">
                    Rating: ${evalRes.rating || 'needs_review'}
                  </span>
                  <span style="font-size: 0.8rem; color: var(--cream-3);">(Badge derived strictly from rating property)</span>
                </div>
                <pre style="margin: 0; font-family: monospace; font-size: 0.85rem; color: var(--leaf); white-space: pre-wrap;">${JSON.stringify(evalRes, null, 2)}</pre>
              </div>
            `;
          }
        } catch (evalErr) {
          const latency = Date.now() - start;
          if (statusEl) statusEl.textContent = `Failed in ${latency}ms`;
          if (outEl) {
            outEl.style.display = 'block';
            const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(evalErr) : evalErr.message;
            outEl.innerHTML = `
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; color: #ef4444;">
                <strong>Evaluation Failed [${evalErr.code || 'ERROR'}]:</strong> ${friendly}
              </div>
            `;
          }
        }
      });
    }

    renderDiagnostics();
  }, () => {
    const hasDebug = (typeof window !== 'undefined') &&
      (window.location.search.includes('debug=1') || window.location.hash.includes('debug=1'));
    if (!hasDebug) return '/ready';
    return null;
  });

})();
