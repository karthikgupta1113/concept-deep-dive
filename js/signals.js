/**
 * js/signals.js
 * Behavioral telemetry and signal collection layer for Concept Deep-Dive (Prompt 4).
 *
 * COLLECTS AND STORES DATA ONLY.
 * Does not alter tutor behaviour, path algorithms, or tone.
 * All persistence is delegated to PathStore.
 */

(function initSignalsService() {
  'use strict';

  let _currentStepId = null;
  let _currentStepStartTime = null;
  let _currentStepCompleted = false;
  let _idleTimer = null;
  let _idleTriggeredForStep = false;
  const IDLE_THRESHOLD_MS = 90 * 1000; // 90 seconds

  /* ── Direct answer detection heuristics ────────────────────────────── */
  const DIRECT_ANSWER_PATTERNS = [
    /give\s+(?:me\s+)?(?:the\s+)?answer/i,
    /what\s+is\s+(?:the\s+)?answer/i,
    /just\s+tell\s+me/i,
    /tell\s+me\s+(?:the\s+)?answer/i,
    /show\s+(?:me\s+)?(?:the\s+)?answer/i,
    /can\s+you\s+just\s+give\s+(?:the\s+)?answer/i,
    /what'?s\s+the\s+solution/i,
    /give\s+solution/i,
    /tell\s+solution/i,
  ];

  function askedForAnswerDirectly(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    return DIRECT_ANSWER_PATTERNS.some(p => p.test(clean));
  }

  function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function getStepEstimatedMinutes(stepId) {
    if (!stepId || typeof Catalog === 'undefined') return 15;
    const item = Catalog.byId(stepId);
    return (item && typeof item.minutes === 'number') ? item.minutes : 15;
  }

  /**
   * Resolves the reflection rating of the step preceding stepId.
   * Checks PathStore path order, completedIds history, and logged reflection events.
   *
   * @param {string} [stepId]
   * @returns {string|null} 'clear'|'okay'|'confusing'|'skipped'|null
   */
  function getPreviousStepClarity(stepId) {
    try {
      if (typeof PathStore === 'undefined' || typeof PathStore.load !== 'function') return null;
      const store = PathStore.load();
      if (!store) return null;

      // 1. If stepId is in store.path, look backwards for the closest preceding step with reflection
      if (stepId && Array.isArray(store.path)) {
        const idx = store.path.indexOf(stepId);
        if (idx > 0) {
          for (let i = idx - 1; i >= 0; i--) {
            const prevId = store.path[i];
            const ref = store.reflections?.[prevId];
            if (ref && (ref.rating || ref.reflection)) {
              return String(ref.rating || ref.reflection).toLowerCase().trim();
            }
          }
        }
      }

      // 2. Check completedIds sequence preceding stepId
      if (Array.isArray(store.completedIds) && store.completedIds.length > 0) {
        const cIdx = stepId ? store.completedIds.indexOf(stepId) : -1;
        const searchList = cIdx > 0 ? store.completedIds.slice(0, cIdx) : store.completedIds;
        for (let i = searchList.length - 1; i >= 0; i--) {
          const prevId = searchList[i];
          if (prevId !== stepId && store.reflections?.[prevId]) {
            const ref = store.reflections[prevId];
            if (ref && (ref.rating || ref.reflection)) {
              return String(ref.rating || ref.reflection).toLowerCase().trim();
            }
          }
        }
      }

      // 3. Fallback: check recorded events in reverse chronological order
      if (Array.isArray(store.events) && store.events.length > 0) {
        for (let i = store.events.length - 1; i >= 0; i--) {
          const ev = store.events[i];
          if (ev && ev.type === 'reflection' && (!stepId || ev.stepId !== stepId)) {
            if (ev.rating || ev.reflection) {
              return String(ev.rating || ev.reflection).toLowerCase().trim();
            }
          }
        }
      }

      // 4. Fallback: check reflections dictionary for any step other than stepId
      if (store.reflections && typeof store.reflections === 'object') {
        const keys = Object.keys(store.reflections).filter(k => k !== stepId);
        if (keys.length > 0) {
          keys.sort((a, b) => (store.reflections[b]?.timestamp || 0) - (store.reflections[a]?.timestamp || 0));
          const latest = store.reflections[keys[0]];
          if (latest && (latest.rating || latest.reflection)) {
            return String(latest.rating || latest.reflection).toLowerCase().trim();
          }
        }
      }
    } catch (_) {}
    return null;
  }

  /* ── Idle Tracker for Step Pages ───────────────────────────────────── */
  function resetIdleTimer() {
    if (_idleTimer) {
      clearTimeout(_idleTimer);
      _idleTimer = null;
    }

    if (!_currentStepId || _currentStepCompleted || _idleTriggeredForStep) {
      return;
    }

    _idleTimer = setTimeout(() => {
      if (_currentStepId && !_currentStepCompleted && !_idleTriggeredForStep) {
        _idleTriggeredForStep = true;
        Signals.log('idle_gap', {
          stepId: _currentStepId,
          idleDuration: 90
        });
      }
    }, IDLE_THRESHOLD_MS);
  }

  // Setup user interaction listeners to reset the 90-second idle timer
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => {
      window.addEventListener(evt, () => {
        if (_currentStepId && !_currentStepCompleted) {
          resetIdleTimer();
        }
      }, { passive: true });
    });

    // Window session end handler
    window.addEventListener('beforeunload', () => {
      if (_currentStepId && !_currentStepCompleted) {
        Signals.onStepExitEarly(_currentStepId);
      }
      Signals.log('session_end', {
        timestamp: Date.now()
      });
    });
  }

  /* ── Core Signals API ──────────────────────────────────────────────── */
  const Signals = {
    /**
     * Checks if check-ins and signals are enabled in preferences.
     */
    isCheckinsEnabled() {
      if (typeof PathStore === 'undefined' || !PathStore.getPrefs) return true;
      const prefs = PathStore.getPrefs();
      return prefs?.checkinsEnabled !== false;
    },

    /**
     * Sets check-ins toggle preference.
     */
    setCheckinsEnabled(enabled) {
      if (typeof PathStore !== 'undefined' && PathStore.setPrefs) {
        return PathStore.setPrefs({ checkinsEnabled: !!enabled });
      }
      return { checkinsEnabled: !!enabled };
    },

    /**
     * General telemetry log function.
     * Records event with type, timestamp, stepId, and payload.
     *
     * @param {string} type
     * @param {Object} [data]
     * @returns {Object|null}
     */
    log(type, data = {}) {
      if (!type) return null;

      const stepId = data.stepId || _currentStepId;
      const eventRecord = Object.assign({
        type,
        timestamp: Date.now(),
        stepId: stepId || null,
      }, data);

      // Normalise reflection event ratings: clear, okay, confusing, skipped
      if (type === 'reflection') {
        const val = (data.rating || data.reflection || 'skipped').toString().toLowerCase().trim();
        eventRecord.rating = val;
        eventRecord.reflection = val;
      }

      // Auto-populate clarityBefore if not explicitly specified
      if (type === 'quiz_rated' && eventRecord.clarityBefore === undefined) {
        eventRecord.clarityBefore = getPreviousStepClarity(stepId);
      }
      if (type === 'assignment_scored' && eventRecord.clarityBefore === undefined) {
        eventRecord.clarityBefore = getPreviousStepClarity(stepId);
      }

      if (typeof PathStore !== 'undefined' && PathStore.addEvent) {
        PathStore.addEvent(eventRecord);
      }

      return eventRecord;
    },

    /**
     * Called when a learner enters a step page (#/step/:id).
     */
    onStepStart(stepId) {
      if (!stepId) return;

      // If exiting previous step without completion, record step_exit_early
      if (_currentStepId && _currentStepId !== stepId && !_currentStepCompleted) {
        this.onStepExitEarly(_currentStepId);
      }

      _currentStepId = stepId;
      _currentStepStartTime = Date.now();
      _currentStepCompleted = false;
      _idleTriggeredForStep = false;

      resetIdleTimer();

      return this.log('step_start', {
        stepId
      });
    },

    /**
     * Called when a step is marked complete.
     */
    onStepComplete(stepId) {
      const activeId = stepId || _currentStepId;
      if (!activeId) return;

      const startTime = _currentStepStartTime || Date.now();
      const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const estMinutes = getStepEstimatedMinutes(activeId);
      const timeRatio = Math.round((timeSpent / (estMinutes * 60)) * 100) / 100;

      if (_currentStepId === activeId) {
        _currentStepCompleted = true;
      }

      if (_idleTimer) {
        clearTimeout(_idleTimer);
        _idleTimer = null;
      }

      return this.log('step_complete', {
        stepId: activeId,
        timeSpent,
        timeRatio
      });
    },

    /**
     * Called when a learner navigates away from a step before completion.
     */
    onStepExitEarly(stepId) {
      const targetId = stepId || _currentStepId;
      if (!targetId || _currentStepCompleted) return;

      const startTime = _currentStepStartTime || Date.now();
      const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const estMinutes = getStepEstimatedMinutes(targetId);
      const timeRatio = Math.round((timeSpent / (estMinutes * 60)) * 100) / 100;

      if (_idleTimer) {
        clearTimeout(_idleTimer);
        _idleTimer = null;
      }

      const rec = this.log('step_exit_early', {
        stepId: targetId,
        timeSpent,
        timeRatio
      });

      if (_currentStepId === targetId) {
        _currentStepId = null;
        _currentStepStartTime = null;
      }

      return rec;
    },

    /**
     * Telemetry helper: quiz_rated
     * Records rating, attempts, and clarityBefore (reflection value of previous step).
     */
    logQuizRated(stepId, rating, attempts = 1, extra = {}) {
      let attCount = attempts;
      let extraData = extra;
      if (typeof attempts === 'object' && attempts !== null) {
        extraData = Object.assign({}, attempts, extra);
        attCount = attempts.attempts || 1;
      }

      const explicitClarity = extraData.clarityBefore !== undefined ? extraData.clarityBefore : undefined;
      const clarity = explicitClarity !== undefined ? explicitClarity : getPreviousStepClarity(stepId);

      return this.log('quiz_rated', Object.assign({
        stepId,
        rating,
        attempts: typeof attCount === 'number' ? attCount : 1,
        clarityBefore: clarity !== undefined ? clarity : null
      }, extraData));
    },

    /**
     * Telemetry helper: assignment_scored
     * Records band, hintsUsed, calibrationGap, attempts, and clarityBefore (reflection of previous step).
     */
    logAssignmentScored(stepId, { band, hintsUsed = 0, calibrationGap = 0, attempts = 1, clarityBefore } = {}) {
      const clarity = clarityBefore !== undefined ? clarityBefore : getPreviousStepClarity(stepId);

      return this.log('assignment_scored', {
        stepId,
        band,
        hintsUsed,
        calibrationGap,
        attempts,
        clarityBefore: clarity !== undefined ? clarity : null
      });
    },

    /**
     * Telemetry helper: hint_used
     */
    logHintUsed(stepId, level) {
      return this.log('hint_used', {
        stepId,
        level
      });
    },

    /**
     * Telemetry helper: reflection
     * Records reflection event: clear, okay, confusing, skipped
     */
    logReflection(stepId, rating) {
      const cleanRating = (rating ? String(rating).toLowerCase().trim() : 'skipped') || 'skipped';
      return this.log('reflection', {
        stepId,
        rating: cleanRating,
        reflection: cleanRating
      });
    },

    /**
     * Telemetry helper: checkin
     * If mood is Tired or Stressed, stores selfReportedLowEnergy: true
     */
    logCheckin(checkinData = {}) {
      if (!this.isCheckinsEnabled()) return null;
      const m = checkinData.mood ? String(checkinData.mood).toLowerCase().trim() : '';
      const isLowEnergy = m === 'tired' || m === 'stressed';

      const payload = Object.assign({}, checkinData);
      if (isLowEnergy || checkinData.selfReportedLowEnergy === true) {
        payload.selfReportedLowEnergy = true;
      }
      return this.log('checkin', payload);
    },

    /**
     * Telemetry helper: tutor_message
     */
    logTutorMessage(text, isStudent = true) {
      const wordCount = countWords(text);
      const askedDirectly = isStudent ? askedForAnswerDirectly(text) : false;

      return this.log('tutor_message', {
        wordCount,
        askedForAnswerDirectly: askedDirectly,
        sender: isStudent ? 'student' : 'tutor'
      });
    },

    /**
     * Telemetry helper: session_start
     */
    logSessionStart(data = {}) {
      return this.log('session_start', Object.assign({
        startTime: Date.now()
      }, data));
    },

    /**
     * Telemetry helper: session_end
     */
    logSessionEnd(data = {}) {
      return this.log('session_end', Object.assign({
        endTime: Date.now()
      }, data));
    },

    /**
     * Pre-answer confidence helper.
     */
    savePreAnswerConfidence(stepId, confidence) {
      if (!this.isCheckinsEnabled()) return null;
      return this.log('confidence_before', {
        stepId,
        confidenceBefore: confidence
      });
    },

    // Clarity helper
    getClarityBefore: getPreviousStepClarity,
    getPreviousStepClarity: getPreviousStepClarity,

    // Internal helpers for test harness
    _getActiveStepId: () => _currentStepId,
    _getStartTime: () => _currentStepStartTime,
    _setStartTime: (t) => { _currentStepStartTime = t; },
  };

  if (typeof window !== 'undefined') {
    window.Signals = Signals;

    // Log session_start once per session
    try {
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('cdd_session_started')) {
        sessionStorage.setItem('cdd_session_started', 'true');
        Signals.log('session_start', {
          timestamp: Date.now()
        });
      }
    } catch (_) {}
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Signals;
  }
})();
