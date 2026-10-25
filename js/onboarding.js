/**
 * js/onboarding.js
 * Level picker + placement check onboarding flow.
 *
 * Requires (loaded before this file):
 *   State           (state.js)
 *   TutorChatService (tutor-chat.js)
 *
 * Exposes: window.Onboarding { show, hide }
 */

(function initOnboarding() {
  'use strict';

  /* ── Placement questions (one per cluster) ─────────────────── */
  const PLACEMENT_QUESTIONS = [
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

  /* ── Default skipped placement by level ───────────────────── */
  const SKIP_DEFAULTS = {
    beginner:     { foundations: 'weak',    operations: 'weak',    balancing: 'weak'    },
    intermediate: { foundations: 'solid',   operations: 'partial', balancing: 'partial' },
    revision:     { foundations: 'solid',   operations: 'solid',   balancing: 'solid'   },
  };

  /* ── Rating → placement value ─────────────────────────────── */
  function toPlacement(rating) {
    if (rating === 'solid')       return 'solid';
    if (rating === 'partial')     return 'partial';
    // 'misconception' or anything else
    return 'weak';
  }

  /* ── Level reconciliation recommendation ─────────────────── */
  function reconcileLevel(selfReported, placement) {
    const values = Object.values(placement);
    const solidCount   = values.filter(v => v === 'solid').length;
    const weakCount    = values.filter(v => v === 'weak').length;

    let recommended = selfReported;
    let changed = false;

    if (selfReported === 'revision' && solidCount < 2) {
      recommended = 'intermediate';
      changed = true;
    } else if (selfReported === 'intermediate' && weakCount === 3) {
      recommended = 'beginner';
      changed = true;
    }

    return { recommended, changed };
  }

  /* ────────────────────────────────────────────────────────────
     DOM refs (resolved once on first show())
  ─────────────────────────────────────────────────────────────*/
  let _el = null;

  function _dom() {
    if (_el) return _el;
    _el = {
      view:            document.getElementById('view-onboarding'),
      stepLevel:       document.getElementById('ob-step-level'),
      stepQuiz:        document.getElementById('ob-step-quiz'),
      stepDone:        document.getElementById('ob-step-done'),

      // Level cards
      cardBeginner:    document.getElementById('ob-card-beginner'),
      cardIntermediate:document.getElementById('ob-card-intermediate'),
      cardRevision:    document.getElementById('ob-card-revision'),
      btnContinue:     document.getElementById('ob-btn-continue'),

      // Quiz step
      qCounter:        document.getElementById('ob-q-counter'),
      dots:            document.querySelectorAll('.ob-dot'),
      qText:           document.getElementById('ob-q-text'),
      qAnswer:         document.getElementById('ob-q-answer'),
      btnSubmitQ:      document.getElementById('ob-btn-submit-q'),
      btnSkip:         document.getElementById('ob-btn-skip'),
      feedback:        document.getElementById('ob-feedback'),
      feedbackBadge:   document.getElementById('ob-feedback-badge'),
      feedbackText:    document.getElementById('ob-feedback-text'),

      // Done step
      reconcileBox:    document.getElementById('ob-reconcile-notice'),
      reconcileMsg:    document.getElementById('ob-reconcile-msg'),
      btnEnter:        document.getElementById('ob-btn-enter'),

      // Navigation helpers
      btnSkipStep1:       document.getElementById('ob-btn-skip-step1'),
      btnBackLevel:       document.getElementById('ob-btn-back-level'),
      btnChangeLevelDone: document.getElementById('ob-btn-change-level-done'),
    };
    return _el;
  }

  /* ────────────────────────────────────────────────────────────
     Internal state
  ─────────────────────────────────────────────────────────────*/
  let _selfReported = null;       // 'beginner' | 'intermediate' | 'revision'
  let _qIndex = 0;                // 0..2
  let _placement = {};            // { foundations, operations, balancing }
  let _evaluating = false;
  let _feedbackShown = false;     // did we show feedback for this question?

  /* ────────────────────────────────────────────────────────────
     Helpers
  ─────────────────────────────────────────────────────────────*/
  function _showStep(name) {
    const el = _dom();
    ['stepLevel', 'stepQuiz', 'stepDone'].forEach(k => {
      el[k].classList.remove('ob-step--active');
    });
    el['step' + name[0].toUpperCase() + name.slice(1)].classList.add('ob-step--active');
  }

  function _setLoading(on) {
    const btn = _dom().btnSubmitQ;
    btn.classList.toggle('ob-btn--loading', on);
    btn.disabled = on;
    _evaluating = on;
  }

  function _renderDots() {
    const el = _dom();
    el.dots.forEach((dot, i) => {
      dot.classList.remove('ob-dot--done', 'ob-dot--active');
      if (i < _qIndex)       dot.classList.add('ob-dot--done');
      else if (i === _qIndex) dot.classList.add('ob-dot--active');
    });
  }

  function _renderQuestion() {
    const el = _dom();
    const q  = PLACEMENT_QUESTIONS[_qIndex];
    el.qCounter.querySelector('.ob-counter-text').textContent =
      `Question ${_qIndex + 1} of ${PLACEMENT_QUESTIONS.length}`;
    el.qText.textContent = q.text;
    el.qAnswer.value = '';
    el.feedback.classList.remove('ob-feedback--visible', 'ob-feedback--solid', 'ob-feedback--partial', 'ob-feedback--weak');
    el.feedbackBadge.textContent = '';
    el.feedbackText.textContent  = '';
    el.btnSubmitQ.textContent    = 'Submit answer';
    el.btnSubmitQ.disabled       = true;
    _feedbackShown = false;
    _renderDots();
  }

  function _showFeedback(result) {
    const el       = _dom();
    const placement = toPlacement(result.rating);
    const labelMap  = { solid: 'Solid ✓', partial: 'Partial', weak: 'Needs review' };

    el.feedback.classList.add('ob-feedback--visible', `ob-feedback--${placement}`);
    el.feedbackBadge.className = `ob-feedback-badge ob-feedback-badge--${placement}`;
    el.feedbackBadge.textContent = labelMap[placement];
    el.feedbackText.textContent  = result.assessment || '';
    _feedbackShown = true;

    // Change button to "Next" (or "Finish" on last)
    const isLast = _qIndex === PLACEMENT_QUESTIONS.length - 1;
    el.btnSubmitQ.textContent = isLast ? 'See my results →' : 'Next question →';
    el.btnSubmitQ.disabled    = false;
  }

  function _showErrorFeedback(msg) {
    const el = _dom();
    el.feedback.className = 'ob-feedback ob-feedback--visible ob-feedback--weak';
    el.feedbackBadge.className = 'ob-feedback-badge ob-feedback-badge--weak';
    el.feedbackBadge.textContent = 'Evaluation Error';
    el.feedbackText.textContent = msg;
    _feedbackShown = false;
    el.btnSubmitQ.textContent = 'Retry Evaluation ↺';
    el.btnSubmitQ.disabled = false;
  }

  /* ────────────────────────────────────────────────────────────
     Level card selection
  ─────────────────────────────────────────────────────────────*/
  function _selectLevel(level) {
    _selfReported = level;
    const el = _dom();
    [el.cardBeginner, el.cardIntermediate, el.cardRevision].forEach(c => {
      if (c) {
        c.classList.remove('ob-level-card--selected');
        c.setAttribute('aria-checked', 'false');
      }
    });
    const map = { beginner: el.cardBeginner, intermediate: el.cardIntermediate, revision: el.cardRevision };
    if (map[level]) {
      map[level].classList.add('ob-level-card--selected');
      map[level].setAttribute('aria-checked', 'true');
    }
    el.btnContinue.disabled = false;
    if (el.btnSkipStep1) {
      el.btnSkipStep1.style.display = 'inline-block';
    }
  }

  /* ────────────────────────────────────────────────────────────
     Quiz navigation
  ─────────────────────────────────────────────────────────────*/
  async function _handleSubmit() {
    if (_evaluating) return;

    if (_feedbackShown) {
      // Advance to next question or finish
      _qIndex++;
      if (_qIndex < PLACEMENT_QUESTIONS.length) {
        _renderQuestion();
      } else {
        _finishQuiz();
      }
      return;
    }

    // First click on this question → evaluate
    const el     = _dom();
    const answer = el.qAnswer.value.trim();
    if (!answer) return;

    _setLoading(true);
    let result;
    try {
      // Re-use TutorChatService.evaluateAssessment (stageId 0 keeps the topic generic)
      result = await TutorChatService.evaluateAssessment(
        0,
        PLACEMENT_QUESTIONS[_qIndex].text,
        answer
      );
    } catch (err) {
      _setLoading(false);
      const isMockAllowed = (typeof AI !== 'undefined' && AI.isMockEnabled && AI.isMockEnabled()) || (err && err.code === 'NO_KEY');
      if (isMockAllowed) {
        console.warn('[onboarding] evaluator running in mock mode:', err);
        result = TutorChatService.getMockAssessmentResponse(0, answer);
      } else {
        console.error('[onboarding] evaluator error:', err);
        const friendly = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(err) : (err?.message || 'Evaluation failed. Please try again.');
        _showErrorFeedback(friendly);
        return;
      }
    }
    _setLoading(false);

    _placement[PLACEMENT_QUESTIONS[_qIndex].cluster] = toPlacement(result.rating);
    _showFeedback(result);
  }

  function _skipQuiz() {
    _placement = Object.assign({}, SKIP_DEFAULTS[_selfReported]);
    _finishQuiz();
  }

  function _finishQuiz() {
    // Fill any unanswered cluster with the skip default
    PLACEMENT_QUESTIONS.forEach(q => {
      if (!_placement[q.cluster]) {
        _placement[q.cluster] = SKIP_DEFAULTS[_selfReported][q.cluster];
      }
    });

    const { recommended, changed } = reconcileLevel(_selfReported, _placement);
    const labelMap = { beginner: 'Beginner', intermediate: 'Intermediate', revision: 'Just Revising' };

    const el = _dom();
    if (changed) {
      el.reconcileBox.classList.add('ob-reconcile-notice--visible');
      el.reconcileMsg.textContent =
        `Based on your placement check, we recommend ${labelMap[recommended]}. We've tuned your ${labelMap[_selfReported]} path accordingly.`;
    } else {
      el.reconcileBox.classList.remove('ob-reconcile-notice--visible');
    }

    // Persist learner profile honoring selected level
    State.setProfile({
      level: _selfReported,
      selfReportedLevel: _selfReported,
      recommendedLevel: recommended,
      placement: _placement,
      createdAt: Date.now(),
    });

    // Clear any previous roadmap progress for this level so the newly chosen path starts clean
    if (typeof PathStore !== 'undefined' && typeof PathStore.clearRoadmapProgress === 'function') {
      PathStore.clearRoadmapProgress(_selfReported);
    }

    // Update any sidebar level badge that might be visible
    _updateSidebarBadges(_selfReported);

    _showStep('done');
  }

  function _updateSidebarBadges(level) {
    const labelMap = { beginner: 'Beginner', intermediate: 'Intermediate', revision: 'Revision' };
    document.querySelectorAll('.ob-sidebar-level-badge').forEach(el => {
      el.textContent = labelMap[level] || (level.charAt(0).toUpperCase() + level.slice(1));
    });
  }

  /* ────────────────────────────────────────────────────────────
     Event wiring (once, on first show)
  ─────────────────────────────────────────────────────────────*/
  let _wired = false;

  function _wire() {
    if (_wired) return;
    _wired = true;
    const el = _dom();

    // Level card clicks
    el.cardBeginner?.addEventListener('click',     () => _selectLevel('beginner'));
    el.cardIntermediate?.addEventListener('click', () => _selectLevel('intermediate'));
    el.cardRevision?.addEventListener('click',     () => _selectLevel('revision'));

    // Step 1: Skip placement check directly
    el.btnSkipStep1?.addEventListener('click', () => {
      if (!_selfReported) return;
      _skipQuiz();
    });

    // Continue → quiz
    el.btnContinue?.addEventListener('click', () => {
      if (!_selfReported) return;
      _qIndex     = 0;
      _placement  = {};
      _renderQuestion();
      _showStep('quiz');
    });

    // Textarea enables submit
    el.qAnswer?.addEventListener('input', () => {
      if (!_feedbackShown) {
        el.btnSubmitQ.disabled = !el.qAnswer.value.trim();
      }
    });

    // Submit / Next
    el.btnSubmitQ?.addEventListener('click', _handleSubmit);

    // Skip from quiz
    el.btnSkip?.addEventListener('click', _skipQuiz);

    // Go back to level selection from quiz
    el.btnBackLevel?.addEventListener('click', () => {
      _showStep('level');
    });

    // Change level from final done step
    el.btnChangeLevelDone?.addEventListener('click', () => {
      _showStep('level');
    });

    // Enter dashboard
    el.btnEnter?.addEventListener('click', () => {
      window.App.showDashboard();
      if (window.Roadmap) {
        Roadmap.init(true);
      }
    });
  }

  /* ────────────────────────────────────────────────────────────
     Public API
  ─────────────────────────────────────────────────────────────*/
  function show() {
    _wire();
    const el = _dom();
    if (!el.view) { console.error('[onboarding] #view-onboarding not found'); return; }

    // Reset state
    _selfReported = null;
    _qIndex       = 0;
    _placement    = {};
    _feedbackShown = false;

    el.btnContinue.disabled = true;
    if (el.btnSkipStep1) {
      el.btnSkipStep1.style.display = 'none';
    }

    [el.cardBeginner, el.cardIntermediate, el.cardRevision].forEach(c => {
      if (c) {
        c.classList.remove('ob-level-card--selected');
        c.setAttribute('aria-checked', 'false');
      }
    });

    _showStep('level');
    el.view.hidden = false;
  }

  function hide() {
    const el = _dom();
    if (el.view) el.view.hidden = true;
  }

  window.Onboarding = { show, hide };
})();
