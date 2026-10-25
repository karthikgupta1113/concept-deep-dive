/**
 * js/mindsetEngine.js
 * Mindset Engine for Concept Deep-Dive (Prompt 5).
 *
 * Responsibilities:
 *  - Pure function assess(events, checkins, context) with ZERO DOM dependencies.
 *  - Evaluates student learning telemetry across an 8-state mindset model.
 *  - Implements rolling window (last 5 events), state stability (held >= 3 events),
 *    priority arbitration, support profile merging, and intervention cooldowns.
 *  - All thresholds externalized in CONFIG for explainability and tuning.
 */

(function initMindsetEngine() {
  'use strict';

  /* ── Configurable Thresholds & Parameters ────────────────────────────── */
  const CONFIG = {
    // Engine Constraints
    MIN_EVENTS_TO_TRIGGER: 3,
    ROLLING_WINDOW_SIZE: 5,
    STATE_HOLD_EVENTS: 3, // A state stays active for at least 3 events once triggered

    // Priority Order (Highest to Lowest)
    PRIORITY_ORDER: [
      'lowEnergy',
      'frustrated',
      'lowConfidence',
      'returning',
      'overconfident',
      'disengaged',
      'perfectionist',
      'flow'
    ],

    // 1. lowConfidence Thresholds
    LOW_CONFIDENCE: {
      MAX_AVG_CONFIDENCE: 2.0, // average confidence in last 3 checkins/taps <= 2
      CONFIDENCE_LOOKBACK: 3,
      MIN_WEAK_COUNT: 2,       // at least 2 weak ratings
      WEAK_LOOKBACK: 4,        // in the last 4 ratings
      MIN_TIME_RATIO: 0.8      // with timeRatio >= 0.8
    },

    // 2. overconfident Thresholds
    OVERCONFIDENT: {
      MIN_AVG_CONFIDENCE: 4.0, // average confidence >= 4
      CONFIDENCE_LOOKBACK: 3,
      MIN_PARTIAL_OR_WEAK: 2,  // at least 2 of the last 3 results partial or weak
      RESULTS_LOOKBACK: 3,
      MIN_CALIBRATION_GAP: 1.0,// calibrationGap >= 1
      FAST_TIME_RATIO: 0.4     // timeRatio <= 0.4 with partial or weak results
    },

    // 3. frustrated Thresholds
    FRUSTRATED: {
      CONSECUTIVE_WEAK_RESULTS: 2, // 2 weak results in a row
      TOP_LEVEL_HINT_STEPS: 2,     // top-level hints (level 3) used on 2 steps
      TOP_HINT_LEVEL: 3,
      MAX_ATTEMPTS: 3              // 3 or more attempts on one quiz or assignment
    },

    // 4. disengaged Thresholds
    DISENGAGED: {
      FAST_TIME_RATIO: 0.3,            // timeRatio <= 0.3
      CONSECUTIVE_FAST_STEPS: 3,       // on 3 reading/video steps in a row
      MAX_WORD_COUNT: 15,              // tutor or answer messages under 15 words
      EARLY_EXITS_SESSION_THRESHOLD: 2 // 2 early exits in one session
    },

    // 5. perfectionist Thresholds
    PERFECTIONIST: {
      RETRIES_AFTER_SOLID: 2, // retries after a Solid result 2 or more times
      HIGH_TIME_RATIO: 1.8    // timeRatio >= 1.8 with Solid results
    },

    // 6. lowEnergy Thresholds
    LOW_ENERGY: {
      TIRED_STRESSED_MOODS: ['tired', 'stressed'], // case-insensitive
      SESSION_MINUTES_THRESHOLD: 45                // session is over 45 minutes
    },

    // 7. returning Thresholds
    RETURNING: {
      DAYS_AWAY_THRESHOLD: 3, // more than 3 days since last session
      MS_PER_DAY: 24 * 60 * 60 * 1000
    },

    // 8. flow Thresholds
    FLOW: {
      MIN_RECENT_RESULTS: 3, // at least 3 recent solid/partial results
      MIN_TIME_RATIO: 0.6,   // timeRatio between 0.6 and 1.4
      MAX_TIME_RATIO: 1.4
    },

    // Reflection Rules (Prompt 5 Extra Part 1)
    REFLECTIONS: {
      LOOKBACK: 4,                  // in the last 4 reflections
      CONFUSING_THRESHOLD: 2,       // 2 confusing reflections trigger offer_other_format
      CONFUSING_TUTOR_PROMPT: "What part felt unclear?"
    },

    // Intervention Rules & Cooldowns
    INTERVENTIONS: {
      MAX_PER_SESSION: 3,              // max 3 interventions per session
      MIN_INTERVAL_MINUTES: 15,        // at most 1 every 15 minutes
      REPEAT_COOLDOWN_MINUTES: 30,     // skipped/dismissed not repeated for 30 min
    }
  };

  /* ── Support Profiles by State ───────────────────────────────────────── */
  const SUPPORT_PROFILES = {
    lowConfidence: { tone: 'gentle', chunk: 'small', hintPolicy: 'early', praise: 'process', pacing: 'slow' },
    overconfident: { tone: 'challenging', chunk: 'normal', hintPolicy: 'late', praise: 'specific', pacing: 'normal' },
    frustrated: { tone: 'gentle', chunk: 'small', hintPolicy: 'early', praise: 'process', pacing: 'slow' },
    disengaged: { tone: 'neutral', chunk: 'small', hintPolicy: 'normal', praise: 'specific', pacing: 'fast' },
    perfectionist: { tone: 'neutral', chunk: 'normal', hintPolicy: 'late', praise: 'minimal', pacing: 'normal' },
    lowEnergy: { tone: 'gentle', chunk: 'small', hintPolicy: 'early', praise: 'minimal', pacing: 'slow' },
    returning: { tone: 'gentle', chunk: 'normal', hintPolicy: 'normal', praise: 'process', pacing: 'normal' },
    flow: { tone: 'neutral', chunk: 'large', hintPolicy: 'late', praise: 'minimal', pacing: 'fast' }
  };

  const DEFAULT_SUPPORT = {
    tone: 'neutral',
    chunk: 'normal',
    hintPolicy: 'normal',
    praise: 'specific',
    pacing: 'normal'
  };

  /* ── Interventions Definition by State ───────────────────────────────── */
  const STATE_INTERVENTIONS_MAP = {
    suggest_break: ['lowEnergy', 'frustrated'],
    offer_other_format: ['frustrated', 'lowConfidence'],
    predict_first: ['overconfident'],
    calibration_mirror: ['overconfident', 'lowConfidence'],
    good_enough_nudge: ['perfectionist'],
    micro_win: ['lowConfidence', 'lowEnergy'],
    stretch_challenge: ['flow', 'overconfident'],
    warm_return_recap: ['returning'],
    connect_to_goal: ['disengaged']
  };

  /* ── Evaluation Helpers ──────────────────────────────────────────────── */

  function isWeakRating(r) {
    if (!r) return false;
    const s = String(r).toLowerCase().trim();
    return s === 'weak' || s === 'needs_review' || s === 'needs support' || s === 'needs_support' || s === 'confusing';
  }

  function isPartialRating(r) {
    if (!r) return false;
    const s = String(r).toLowerCase().trim();
    return s === 'partial' || s === 'developing' || s === 'okay';
  }

  function isSolidRating(r) {
    if (!r) return false;
    const s = String(r).toLowerCase().trim();
    return s === 'solid' || s === 'strong' || s === 'mastered' || s === 'clear';
  }

  /**
   * Extracts confidence values from checkins and pre-answer confidence taps.
   */
  function extractRecentConfidences(events = [], checkins = [], count = 3) {
    const list = [];

    // Collect from events (e.g. confidence_before or pre-answer taps)
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev) continue;
      const ts = typeof ev.timestamp === 'number' ? ev.timestamp : (i + 1);
      if (typeof ev.confidenceBefore === 'number') {
        list.push({ val: ev.confidenceBefore, ts });
      } else if (typeof ev.confidence === 'number') {
        list.push({ val: ev.confidence, ts });
      } else if (ev.type === 'confidence_tap' && typeof ev.value === 'number') {
        list.push({ val: ev.value, ts });
      }
    }

    // Collect from checkins
    for (let i = checkins.length - 1; i >= 0; i--) {
      const c = checkins[i];
      if (!c) continue;
      const ts = typeof c.timestamp === 'number' ? c.timestamp : (1000000 + i);
      if (typeof c.confidence === 'number' && !isNaN(c.confidence)) {
        list.push({ val: c.confidence, ts });
      }
    }

    // Sort descending by timestamp, take top N
    list.sort((a, b) => b.ts - a.ts);
    return list.slice(0, count).map(x => x.val);
  }

  /**
   * Extracts assessed results from events (quiz_rated, assignment_scored).
   */
  function extractAssessedResults(events = [], maxCount = 10) {
    const results = [];
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev) continue;
      if (ev.type === 'quiz_rated') {
        results.push({
          stepId: ev.stepId,
          rating: ev.rating,
          attempts: ev.attempts || 1,
          timeRatio: typeof ev.timeRatio === 'number' ? ev.timeRatio : null,
          calibrationGap: typeof ev.calibrationGap === 'number' ? ev.calibrationGap : null,
          timestamp: ev.timestamp || i,
        });
      } else if (ev.type === 'assignment_scored') {
        const b = String(ev.band || '').toLowerCase();
        const rating = b === 'strong' ? 'solid' : (b === 'developing' ? 'partial' : (ev.rating || 'weak'));
        results.push({
          stepId: ev.stepId,
          rating: rating,
          band: ev.band,
          hintsUsed: ev.hintsUsed || 0,
          attempts: ev.attempts || 1,
          timeRatio: typeof ev.timeRatio === 'number' ? ev.timeRatio : null,
          calibrationGap: typeof ev.calibrationGap === 'number' ? ev.calibrationGap : null,
          timestamp: ev.timestamp || i,
        });
      }
      if (results.length >= maxCount) break;
    }
    return results;
  }

  /* ── Core Mindset Evaluation Function ────────────────────────────────── */

  /**
   * Assesses student learning mindset from telemetry events and check-ins.
   * Pure function: no DOM, no global side-effects.
   *
   * @param {Array<Object>} [events=[]] - Telemetry log
   * @param {Array<Object>} [checkins=[]] - Check-in records
   * @param {Object} [context={}] - Environment context & state memory
   * @returns {{
   *   states: Array<{ id: string, strength: number, evidence: Array<string> }>,
   *   support: { tone: string, chunk: string, hintPolicy: string, praise: string, pacing: string },
   *   interventions: Array<string>
   * }}
   */
  function assess(events = [], checkins = [], context = {}) {
    const evList = Array.isArray(events) ? events : [];
    const chList = Array.isArray(checkins) ? checkins : [];
    const ctx = context && typeof context === 'object' ? context : {};
    const now = typeof ctx.now === 'number' ? ctx.now : Date.now();

    // Prompt 5 Extra Part 2: Check if student directly self-reported low energy (Tired, Stressed, or selfReportedLowEnergy === true)
    let hasSelfReportedLowEnergy = false;
    let selfReportedMood = null;
    if (chList.length > 0) {
      const latestCheckin = chList[chList.length - 1];
      if (latestCheckin) {
        const m = latestCheckin.mood ? String(latestCheckin.mood).toLowerCase().trim() : '';
        if (latestCheckin.selfReportedLowEnergy === true || CONFIG.LOW_ENERGY.TIRED_STRESSED_MOODS.includes(m)) {
          hasSelfReportedLowEnergy = true;
          selfReportedMood = latestCheckin.mood || (m === 'stressed' ? 'Stressed' : 'Tired');
        }
      }
    }

    // Constraint: Require at least 3 events before any telemetry-based state can trigger.
    // Exception (Prompt 5 Extra Part 2): selfReportedLowEnergy triggers lowEnergy immediately without 3 events.
    if (evList.length < CONFIG.MIN_EVENTS_TO_TRIGGER) {
      if (hasSelfReportedLowEnergy) {
        const lowEnergyProfile = SUPPORT_PROFILES.lowEnergy;
        return {
          states: [{
            id: 'lowEnergy',
            strength: 0.9,
            evidence: [`Student directly self-reported mood as "${selfReportedMood}" in check-in.`]
          }],
          support: Object.assign({}, DEFAULT_SUPPORT, lowEnergyProfile),
          interventions: ['suggest_break'],
          _stateLocks: { lowEnergy: evList.length + CONFIG.STATE_HOLD_EVENTS }
        };
      }
      return {
        states: [],
        support: Object.assign({}, DEFAULT_SUPPORT),
        interventions: []
      };
    }

    // Active rolling window of the last N relevant events
    const rollingWindow = evList.slice(-CONFIG.ROLLING_WINDOW_SIZE);
    const assessedResults = extractAssessedResults(evList, 10);
    const recentConfidences = extractRecentConfidences(evList, chList, CONFIG.LOW_CONFIDENCE.CONFIDENCE_LOOKBACK);

    // Reflection Telemetry Analysis (Prompt 5 Extra Part 1)
    const reflectionEvents = evList.filter(ev => ev && (ev.type === 'reflection' || typeof ev.reflectionRating === 'string'));
    const last4Reflections = reflectionEvents.slice(-CONFIG.REFLECTIONS.LOOKBACK);
    const confusingReflections = last4Reflections.filter(ev => {
      const r = String(ev.rating || ev.reflectionRating || '').toLowerCase().trim();
      return r === 'confusing';
    });
    const confusingCount = confusingReflections.length;
    const hasConfusingTrigger = confusingCount >= CONFIG.REFLECTIONS.CONFUSING_THRESHOLD;

    // Track active state detections: { [stateId]: { id, strength, evidence } }
    const detected = {};

    /* ── 1. lowConfidence ─────────────────────────────────────────────── */
    // Rule: average confidence in the last 3 check-ins or taps is <= 2;
    // OR at least 2 weak ratings in the last 4 with timeRatio 0.8 or more;
    // OR confusing reflection evidence
    let lowConfTriggered = false;
    const lowConfEvidence = [];

    if (recentConfidences.length > 0) {
      const avgConf = recentConfidences.reduce((a, b) => a + b, 0) / recentConfidences.length;
      if (avgConf <= CONFIG.LOW_CONFIDENCE.MAX_AVG_CONFIDENCE) {
        lowConfTriggered = true;
        lowConfEvidence.push(`Average confidence across the last ${recentConfidences.length} ratings is ${avgConf.toFixed(1)}/5 (threshold <= ${CONFIG.LOW_CONFIDENCE.MAX_AVG_CONFIDENCE}).`);
      }
    }

    const last4Assessed = assessedResults.slice(0, CONFIG.LOW_CONFIDENCE.WEAK_LOOKBACK);
    const weakWithHighTime = last4Assessed.filter(r => isWeakRating(r.rating) && (r.timeRatio === null || r.timeRatio >= CONFIG.LOW_CONFIDENCE.MIN_TIME_RATIO));
    if (weakWithHighTime.length >= CONFIG.LOW_CONFIDENCE.MIN_WEAK_COUNT) {
      lowConfTriggered = true;
      lowConfEvidence.push(`Received ${weakWithHighTime.length} weak ratings in the last 4 checkpoints despite steady study time (timeRatio >= ${CONFIG.LOW_CONFIDENCE.MIN_TIME_RATIO}).`);
    }

    // Reflection rule: confusing counts as one evidence point toward lowConfidence
    if (confusingCount > 0) {
      lowConfEvidence.push(`Recorded ${confusingCount} reflection(s) marked as confusing in recent steps.`);
    }
    if (hasConfusingTrigger) {
      lowConfTriggered = true;
    }

    if (lowConfTriggered) {
      detected.lowConfidence = {
        id: 'lowConfidence',
        strength: 0.85,
        evidence: lowConfEvidence
      };
    }

    /* ── 2. overconfident ─────────────────────────────────────────────── */
    // Rule: average confidence 4 or more AND at least 2 of the last 3 results are partial or weak (calibrationGap of 1 or more);
    // OR timeRatio 0.4 or less with partial or weak results;
    // OR clear followed by weak/partial result on next quiz/assignment
    let overconfTriggered = false;
    const overconfEvidence = [];

    if (recentConfidences.length > 0) {
      const avgConf = recentConfidences.reduce((a, b) => a + b, 0) / recentConfidences.length;
      const last3Assessed = assessedResults.slice(0, CONFIG.OVERCONFIDENT.RESULTS_LOOKBACK);
      const partialOrWeak = last3Assessed.filter(r => isPartialRating(r.rating) || isWeakRating(r.rating) || (r.calibrationGap !== null && r.calibrationGap >= CONFIG.OVERCONFIDENT.MIN_CALIBRATION_GAP));

      if (avgConf >= CONFIG.OVERCONFIDENT.MIN_AVG_CONFIDENCE && partialOrWeak.length >= CONFIG.OVERCONFIDENT.MIN_PARTIAL_OR_WEAK) {
        overconfTriggered = true;
        overconfEvidence.push(`Average confidence is ${avgConf.toFixed(1)}/5, but ${partialOrWeak.length} of the last 3 results showed partial/weak understanding (calibration gap >= 1).`);
      }
    }

    // Check timeRatio <= 0.4 with partial or weak results in window
    for (let i = rollingWindow.length - 1; i >= 0; i--) {
      const ev = rollingWindow[i];
      if ((ev.type === 'quiz_rated' || ev.type === 'assignment_scored' || ev.type === 'step_complete') && typeof ev.timeRatio === 'number') {
        if (ev.timeRatio <= CONFIG.OVERCONFIDENT.FAST_TIME_RATIO) {
          if (isPartialRating(ev.rating) || isWeakRating(ev.rating) || isPartialRating(ev.band) || isWeakRating(ev.band)) {
            overconfTriggered = true;
            overconfEvidence.push(`Rushed through step in ${ev.timeRatio}x estimated time (threshold <= ${CONFIG.OVERCONFIDENT.FAST_TIME_RATIO}) and received a partial/weak rating.`);
            break;
          }
        }
      }
    }

    // Reflection rule (Prompt 5 Extra Part 1): clear followed by a weak or partial result on next quiz or assignment
    let clearFollowedByWeakCount = 0;
    const clearFollowedByWeakEvidence = [];

    for (let i = 0; i < evList.length; i++) {
      const ev = evList[i];
      if (!ev) continue;
      if (ev.type === 'quiz_rated' || ev.type === 'assignment_scored') {
        const isWeak = isWeakRating(ev.rating) || isWeakRating(ev.band);
        const isPartial = isPartialRating(ev.rating) || isPartialRating(ev.band);
        if ((isWeak || isPartial) && (ev.clarityBefore === 'clear' || ev.reflectionBefore === 'clear')) {
          clearFollowedByWeakCount++;
          clearFollowedByWeakEvidence.push(`Concept felt clear before checkpoint "${ev.stepId || 'checkpoint'}", but achieved ${isWeak ? 'weak' : 'partial'} result.`);
          continue;
        }
      }

      if (ev.type === 'reflection' && String(ev.rating || ev.reflectionRating || '').toLowerCase().trim() === 'clear') {
        for (let j = i + 1; j < evList.length; j++) {
          const nextEv = evList[j];
          if (!nextEv) continue;
          if (nextEv.type === 'reflection') break; // another reflection intervened
          if (nextEv.type === 'quiz_rated' || nextEv.type === 'assignment_scored') {
            const isWeak = isWeakRating(nextEv.rating) || isWeakRating(nextEv.band);
            const isPartial = isPartialRating(nextEv.rating) || isPartialRating(nextEv.band);
            if (isWeak || isPartial) {
              clearFollowedByWeakCount++;
              clearFollowedByWeakEvidence.push(`Concept marked "clear" in reflection, but subsequent checkpoint "${nextEv.stepId || 'checkpoint'}" received ${isWeak ? 'weak' : 'partial'} rating.`);
            }
            break;
          }
        }
      }
    }

    if (clearFollowedByWeakCount > 0) {
      overconfTriggered = true;
      overconfEvidence.push(...clearFollowedByWeakEvidence);
    }

    if (overconfTriggered) {
      detected.overconfident = {
        id: 'overconfident',
        strength: 0.8,
        evidence: overconfEvidence
      };
    }

    /* ── 3. frustrated ────────────────────────────────────────────────── */
    // Rule: 2 weak results in a row;
    // OR top-level hints used on 2 steps;
    // OR 3 or more attempts on one quiz or assignment;
    // OR confusing reflection evidence
    let frustratedTriggered = false;
    const frustratedEvidence = [];

    // Reflection rule: confusing counts as one evidence point toward frustrated
    if (confusingCount > 0) {
      frustratedEvidence.push(`Recorded ${confusingCount} reflection(s) marked as confusing in recent steps.`);
    }
    if (hasConfusingTrigger) {
      frustratedTriggered = true;
    }

    // 2 weak in a row
    if (assessedResults.length >= CONFIG.FRUSTRATED.CONSECUTIVE_WEAK_RESULTS) {
      if (isWeakRating(assessedResults[0].rating) && isWeakRating(assessedResults[1].rating)) {
        frustratedTriggered = true;
        frustratedEvidence.push('Received 2 weak checkpoint results in a row.');
      }
    }

    // Top-level hints used on 2 steps
    const topHintSteps = new Set();
    rollingWindow.forEach((ev, idx) => {
      if (ev.type === 'hint_used' && ev.level >= CONFIG.FRUSTRATED.TOP_HINT_LEVEL) {
        topHintSteps.add(ev.stepId || ('step_hint_' + idx));
      }
      if (ev.type === 'assignment_scored' && ev.hintsUsed >= CONFIG.FRUSTRATED.TOP_HINT_LEVEL) {
        topHintSteps.add(ev.stepId || ('step_hint_' + idx));
      }
    });
    if (topHintSteps.size >= CONFIG.FRUSTRATED.TOP_LEVEL_HINT_STEPS) {
      frustratedTriggered = true;
      frustratedEvidence.push(`Used top-level worked hints (Level ${CONFIG.FRUSTRATED.TOP_HINT_LEVEL}) across ${topHintSteps.size} different steps.`);
    }

    // 3 or more attempts on one quiz or assignment
    for (let i = rollingWindow.length - 1; i >= 0; i--) {
      const ev = rollingWindow[i];
      if ((ev.type === 'quiz_rated' || ev.type === 'assignment_scored') && (ev.attempts >= CONFIG.FRUSTRATED.MAX_ATTEMPTS)) {
        frustratedTriggered = true;
        frustratedEvidence.push(`Required ${ev.attempts} attempts on checkpoint "${ev.stepId || 'current'}".`);
        break;
      }
    }

    if (frustratedTriggered) {
      detected.frustrated = {
        id: 'frustrated',
        strength: 0.9,
        evidence: frustratedEvidence
      };
    }

    /* ── 4. disengaged ────────────────────────────────────────────────── */
    // Rule: timeRatio 0.3 or less on 3 reading/video steps in a row AND tutor or answer messages under 15 words;
    // OR 2 early exits in one session
    let disengagedTriggered = false;
    const disengagedEvidence = [];

    // Check reading/video fast steps
    let fastReadingCount = 0;
    for (let i = evList.length - 1; i >= 0; i--) {
      const ev = evList[i];
      if ((ev.type === 'step_complete' || ev.type === 'step_exit_early') && typeof ev.timeRatio === 'number') {
        if (ev.timeRatio <= CONFIG.DISENGAGED.FAST_TIME_RATIO) {
          fastReadingCount++;
        } else {
          break; // must be consecutive in a row
        }
      }
    }

    let hasShortMessage = false;
    for (let i = evList.length - 1; i >= 0; i--) {
      const ev = evList[i];
      if (ev.type === 'tutor_message' || ev.type === 'answer_message' || ev.type === 'student_message') {
        let count = ev.wordCount;
        if (typeof count !== 'number' && typeof ev.text === 'string') {
          count = ev.text.trim().split(/\s+/).filter(Boolean).length;
        } else if (typeof count !== 'number' && typeof ev.words === 'number') {
          count = ev.words;
        }
        if (typeof count === 'number' && count < CONFIG.DISENGAGED.MAX_WORD_COUNT) {
          hasShortMessage = true;
          break;
        }
      }
    }

    if (fastReadingCount >= CONFIG.DISENGAGED.CONSECUTIVE_FAST_STEPS && hasShortMessage) {
      disengagedTriggered = true;
      disengagedEvidence.push(`Completed ${fastReadingCount} reading/video steps at rapid speed (timeRatio <= ${CONFIG.DISENGAGED.FAST_TIME_RATIO}) with brief tutor interactions under ${CONFIG.DISENGAGED.MAX_WORD_COUNT} words.`);
    }

    // 2 early exits in session
    const earlyExits = evList.filter(ev => ev.type === 'step_exit_early');
    if (earlyExits.length >= CONFIG.DISENGAGED.EARLY_EXITS_SESSION_THRESHOLD) {
      disengagedTriggered = true;
      disengagedEvidence.push(`Exited ${earlyExits.length} steps early before completing them in this session.`);
    }

    if (disengagedTriggered) {
      detected.disengaged = {
        id: 'disengaged',
        strength: 0.75,
        evidence: disengagedEvidence
      };
    }

    /* ── 5. perfectionist ─────────────────────────────────────────────── */
    // Rule: retries after a Solid result 2 or more times;
    // OR timeRatio 1.8 or more with Solid results
    let perfectionistTriggered = false;
    const perfectionistEvidence = [];

    // Check retries after solid
    let solidRetryCount = 0;
    const solidStepsSeen = new Set();
    evList.forEach(ev => {
      if (ev.type === 'quiz_rated' || ev.type === 'assignment_scored') {
        if (solidStepsSeen.has(ev.stepId)) {
          solidRetryCount++;
        } else if (isSolidRating(ev.rating) || isSolidRating(ev.band)) {
          solidStepsSeen.add(ev.stepId);
        }
      } else if (ev.type === 'retry_after_solid' || ev.retriedAfterSolid) {
        solidRetryCount++;
      }
    });

    if (solidRetryCount >= CONFIG.PERFECTIONIST.RETRIES_AFTER_SOLID) {
      perfectionistTriggered = true;
      perfectionistEvidence.push(`Re-attempted checkpoints ${solidRetryCount} times after already reaching solid mastery.`);
    }

    // Check timeRatio >= 1.8 with solid results
    for (let i = rollingWindow.length - 1; i >= 0; i--) {
      const ev = rollingWindow[i];
      if ((ev.type === 'quiz_rated' || ev.type === 'assignment_scored' || ev.type === 'step_complete') && typeof ev.timeRatio === 'number') {
        if (ev.timeRatio >= CONFIG.PERFECTIONIST.HIGH_TIME_RATIO && (isSolidRating(ev.rating) || isSolidRating(ev.band))) {
          perfectionistTriggered = true;
          perfectionistEvidence.push(`Spent ${ev.timeRatio}x estimated time (threshold >= ${CONFIG.PERFECTIONIST.HIGH_TIME_RATIO}) despite demonstrating solid understanding.`);
          break;
        }
      }
    }

    if (perfectionistTriggered) {
      detected.perfectionist = {
        id: 'perfectionist',
        strength: 0.7,
        evidence: perfectionistEvidence
      };
    }

    /* ── 6. lowEnergy ─────────────────────────────────────────────────── */
    // Rule: latest check-in mood is Tired or Stressed;
    // OR the session is over 45 minutes
    let lowEnergyTriggered = false;
    const lowEnergyEvidence = [];

    if (chList.length > 0) {
      const latestCheckin = chList[chList.length - 1];
      if (latestCheckin && (latestCheckin.mood || latestCheckin.selfReportedLowEnergy !== undefined)) {
        const m = latestCheckin.mood ? String(latestCheckin.mood).toLowerCase().trim() : '';
        if (latestCheckin.selfReportedLowEnergy === true || CONFIG.LOW_ENERGY.TIRED_STRESSED_MOODS.includes(m)) {
          lowEnergyTriggered = true;
          lowEnergyEvidence.push(`Latest check-in recorded mood as "${latestCheckin.mood || 'Tired'}".`);
        }
      }
    }

    // Check session duration
    let durationMin = null;
    if (typeof ctx.sessionMinutes === 'number') {
      durationMin = ctx.sessionMinutes;
    } else if (typeof ctx.durationMinutes === 'number') {
      durationMin = ctx.durationMinutes;
    } else {
      let sessionStart = typeof ctx.sessionStartTime === 'number' ? ctx.sessionStartTime : null;
      if (!sessionStart) {
        const sessEv = evList.find(e => e.type === 'session_start');
        if (sessEv && typeof sessEv.timestamp === 'number') {
          sessionStart = sessEv.timestamp;
        } else if (evList[0] && typeof evList[0].timestamp === 'number') {
          sessionStart = evList[0].timestamp;
        }
      }
      if (sessionStart) {
        durationMin = Math.round((now - sessionStart) / (60 * 1000));
      }
    }

    if (typeof durationMin === 'number' && durationMin > CONFIG.LOW_ENERGY.SESSION_MINUTES_THRESHOLD) {
      lowEnergyTriggered = true;
      lowEnergyEvidence.push(`Current session has run for ${durationMin} minutes (threshold > ${CONFIG.LOW_ENERGY.SESSION_MINUTES_THRESHOLD} min).`);
    }

    if (lowEnergyTriggered) {
      detected.lowEnergy = {
        id: 'lowEnergy',
        strength: 0.9,
        evidence: lowEnergyEvidence
      };
    }

    /* ── 7. returning ─────────────────────────────────────────────────── */
    // Rule: more than 3 days since the last session
    let returningTriggered = false;
    const returningEvidence = [];

    let daysSince = null;
    if (typeof ctx.daysSinceLastSession === 'number') {
      daysSince = ctx.daysSinceLastSession;
    } else if (typeof ctx.daysAway === 'number') {
      daysSince = ctx.daysAway;
    } else if (typeof ctx.lastSessionTime === 'number' && ctx.lastSessionTime > 0) {
      daysSince = (now - ctx.lastSessionTime) / CONFIG.RETURNING.MS_PER_DAY;
    }

    if (typeof daysSince === 'number' && daysSince > CONFIG.RETURNING.DAYS_AWAY_THRESHOLD) {
      returningTriggered = true;
      returningEvidence.push(`${daysSince.toFixed(1)} days elapsed since previous session (threshold > ${CONFIG.RETURNING.DAYS_AWAY_THRESHOLD} days).`);
    }

    if (returningTriggered) {
      detected.returning = {
        id: 'returning',
        strength: 0.8,
        evidence: returningEvidence
      };
    }

    /* ── 8. flow ──────────────────────────────────────────────────────── */
    // Rule: at least 3 recent solid/partial results, timeRatio between 0.6 and 1.4, AND no other state active
    const otherStatesActive = Object.keys(detected).length > 0;
    if (!otherStatesActive) {
      const recentResults = assessedResults.slice(0, CONFIG.FLOW.MIN_RECENT_RESULTS);
      if (recentResults.length >= CONFIG.FLOW.MIN_RECENT_RESULTS) {
        const allMastered = recentResults.every(r => isSolidRating(r.rating) || isPartialRating(r.rating));
        // Check timeRatio on recent step completes or assessments
        const stepRatios = rollingWindow
          .filter(e => typeof e.timeRatio === 'number')
          .map(e => e.timeRatio);

        const ratiosOk = stepRatios.length === 0 || stepRatios.every(tr => tr >= CONFIG.FLOW.MIN_TIME_RATIO && tr <= CONFIG.FLOW.MAX_TIME_RATIO);

        if (allMastered && ratiosOk) {
          detected.flow = {
            id: 'flow',
            strength: 0.95,
            evidence: [`Consistent mastery across ${recentResults.length} checkpoints with optimal pacing (timeRatio between ${CONFIG.FLOW.MIN_TIME_RATIO} and ${CONFIG.FLOW.MAX_TIME_RATIO}).`]
          };
        }
      }
    }

    /* ── Stability: Hold active states for at least 3 events ──────────── */
    // Tracked via context.history / context.previousStateLocks
    const currentEventIndex = evList.length;
    const stateLocks = Object.assign({}, ctx.stateLocks || {});

    if (Array.isArray(ctx.activeStates)) {
      ctx.activeStates.forEach(s => {
        const id = typeof s === 'string' ? s : s?.id;
        if (id && !stateLocks[id]) {
          stateLocks[id] = currentEventIndex + (typeof s?.eventsRemaining === 'number' ? s.eventsRemaining : CONFIG.STATE_HOLD_EVENTS);
        }
      });
    }

    // Update locks for newly triggered states
    Object.keys(detected).forEach(stateId => {
      stateLocks[stateId] = currentEventIndex + CONFIG.STATE_HOLD_EVENTS;
    });

    // Keep previously locked states that haven't expired yet
    Object.keys(stateLocks).forEach(stateId => {
      if (stateLocks[stateId] > currentEventIndex && !detected[stateId]) {
        // State remains held active for stability
        detected[stateId] = {
          id: stateId,
          strength: 0.6,
          evidence: [`State held active for stability (${stateLocks[stateId] - currentEventIndex} events remaining).`]
        };
      } else if (stateLocks[stateId] <= currentEventIndex) {
        delete stateLocks[stateId];
      }
    });

    // If any non-flow state is locked/active, flow must not be active
    const hasNonFlow = Object.keys(detected).some(k => k !== 'flow');
    if (hasNonFlow && detected.flow) {
      delete detected.flow;
      delete stateLocks.flow;
    }

    /* ── Priority Sorting ─────────────────────────────────────────────── */
    // Priority: lowEnergy > frustrated > lowConfidence > returning > overconfident > disengaged > perfectionist > flow
    const sortedStates = CONFIG.PRIORITY_ORDER
      .filter(id => detected[id])
      .map(id => detected[id]);

    /* ── Support Profile Merging ──────────────────────────────────────── */
    // If several states are active, take the highest-priority state for tone and pacing,
    // and merge the rest by choosing the safer (gentler, smaller) option.
    let mergedSupport = Object.assign({}, DEFAULT_SUPPORT);

    if (sortedStates.length > 0) {
      const topState = sortedStates[0].id;
      const topProfile = SUPPORT_PROFILES[topState] || DEFAULT_SUPPORT;

      // 1. Tone and pacing come from highest-priority state
      mergedSupport.tone = topProfile.tone;
      mergedSupport.pacing = topProfile.pacing;

      // 2. Chunk: safer/smaller wins (small > normal > large)
      const allChunks = sortedStates.map(s => SUPPORT_PROFILES[s.id]?.chunk || 'normal');
      if (allChunks.includes('small')) {
        mergedSupport.chunk = 'small';
      } else if (allChunks.includes('normal')) {
        mergedSupport.chunk = 'normal';
      } else {
        mergedSupport.chunk = 'large';
      }

      // 3. Hint Policy: safer/earlier wins (early > normal > late)
      const allHints = sortedStates.map(s => SUPPORT_PROFILES[s.id]?.hintPolicy || 'normal');
      if (allHints.includes('early')) {
        mergedSupport.hintPolicy = 'early';
      } else if (allHints.includes('normal')) {
        mergedSupport.hintPolicy = 'normal';
      } else {
        mergedSupport.hintPolicy = 'late';
      }

      // 4. Praise: process-focused > specific > minimal
      const allPraise = sortedStates.map(s => SUPPORT_PROFILES[s.id]?.praise || 'specific');
      if (allPraise.includes('process')) {
        mergedSupport.praise = 'process';
      } else if (allPraise.includes('specific')) {
        mergedSupport.praise = 'specific';
      } else {
        mergedSupport.praise = 'minimal';
      }
    }

    /* ── Interventions Arbitration & Cooldowns ────────────────────────── */
    // Max 3 per session, at most 1 every 15 min. Dismissed/skipped not repeated for 30 min.
    const selectedInterventions = [];
    const interventionsHistory = Array.isArray(ctx.interventionsHistory) ? ctx.interventionsHistory : [];
    const sessionInterventionsCount = interventionsHistory.length;

    const canIssueIntervention = sessionInterventionsCount < CONFIG.INTERVENTIONS.MAX_PER_SESSION;

    // Check 15-minute global cooldown since last intervention
    let cooledDown = true;
    if (interventionsHistory.length > 0) {
      const lastIntervention = interventionsHistory[interventionsHistory.length - 1];
      const timeSinceLast = (now - (lastIntervention.timestamp || 0)) / (60 * 1000);
      if (timeSinceLast < CONFIG.INTERVENTIONS.MIN_INTERVAL_MINUTES) {
        cooledDown = false;
      }
    }

    if (canIssueIntervention && cooledDown && sortedStates.length > 0) {
      // Find candidate interventions matching any active state
      const candidates = [];
      Object.entries(STATE_INTERVENTIONS_MAP).forEach(([intId, targetStates]) => {
        // Does this intervention match an active state?
        const match = targetStates.some(ts => detected[ts]);
        if (match) {
          // Check 30-minute repeat cooldown for this specific intervention
          const recentInstance = interventionsHistory.find(h => h.id === intId && ((now - (h.timestamp || 0)) / (60 * 1000) < CONFIG.INTERVENTIONS.REPEAT_COOLDOWN_MINUTES));
          if (!recentInstance) {
            // Find highest priority state driving this intervention
            const driverIndex = CONFIG.PRIORITY_ORDER.findIndex(p => targetStates.includes(p) && detected[p]);
            candidates.push({ id: intId, priority: driverIndex === -1 ? 99 : driverIndex });
          }
        }
      });

      // Sort candidate interventions by state priority and pick top 1
      candidates.sort((a, b) => a.priority - b.priority);
      if (candidates.length > 0) {
        selectedInterventions.push(candidates[0].id);
      }
    }

    // Prompt 5 Extra Part 1: If 2 of the last 4 reflections are confusing, add offer_other_format and tell tutor prompt to open with "What part felt unclear?"
    if (hasConfusingTrigger) {
      if (!selectedInterventions.includes('offer_other_format')) {
        selectedInterventions.unshift('offer_other_format');
      }
      mergedSupport.tutorOpeningPrompt = CONFIG.REFLECTIONS.CONFUSING_TUTOR_PROMPT;
    }

    return {
      states: sortedStates,
      support: mergedSupport,
      interventions: selectedInterventions,
      _stateLocks: stateLocks // Expose updated state lock map for stateful callers
    };
  }

  /* ── Prompt 6: Interventions Human-Centered Metadata ───────────────── */
  const INTERVENTION_DETAILS = {
    suggest_break: {
      id: 'suggest_break',
      icon: '🍵',
      message: "You've been at it a while. Want a short break? Your progress is saved.",
      actionLabel: "Take a 5-min break",
      actionRoute: "/wrapup",
      whyExplanation: "You've been studying hard for a sustained session, so we're offering a gentle pause to keep your mind fresh and retention high."
    },
    offer_other_format: {
      id: 'offer_other_format',
      icon: '🎬',
      message: "Want to see this one as a short animation instead?",
      actionLabel: "Watch animation",
      actionRoute: "/animations",
      whyExplanation: "You retried this twice or spent extra time, so we're offering visual animations and a different way in."
    },
    predict_first: {
      id: 'predict_first',
      icon: '🔮',
      message: "Before I show it, what do you think the answer will be?",
      actionLabel: "Make a quick prediction",
      actionRoute: null,
      whyExplanation: "Thinking through your own prediction before seeing the solution builds deeper recall and intuition."
    },
    calibration_mirror: {
      id: 'calibration_mirror',
      icon: '🪞',
      message: "You felt fairly sure, and the answer was close. One detail was missing: …",
      actionLabel: "Review key gap",
      actionRoute: null,
      whyExplanation: "Comparing your pre-test confidence with the rubric helps tune self-assessment accuracy."
    },
    good_enough_nudge: {
      id: 'good_enough_nudge',
      icon: '🌱',
      message: "That answer already covers what's needed. Ready to move on?",
      actionLabel: "Move to next step",
      actionRoute: null,
      whyExplanation: "You've already demonstrated the core understanding needed here, so there is no need to keep repeating it."
    },
    micro_win: {
      id: 'micro_win',
      icon: '⚡',
      message: "Here's a quick one to build momentum.",
      actionLabel: "Try momentum step",
      actionRoute: null,
      whyExplanation: "Tackling a quick, focused step is an effective way to re-energize and build study momentum."
    },
    warm_return_recap: {
      id: 'warm_return_recap',
      icon: '🧭',
      message: "Welcome back. Two quick questions to warm up.",
      actionLabel: "Start warm-up",
      actionRoute: null,
      whyExplanation: "It has been a few days since your last session, so a short refresher reactivates earlier concepts."
    },
    stretch_challenge: {
      id: 'stretch_challenge',
      icon: '🏔️',
      message: "Want a harder one? It's optional.",
      actionLabel: "Try stretch challenge",
      actionRoute: null,
      whyExplanation: "You've been moving smoothly through these steps with strong mastery, so an optional deeper challenge is available."
    },
    connect_to_goal: {
      id: 'connect_to_goal',
      icon: '🎯',
      message: "Here's a real-world hook based on your goal to keep this practical and relevant.",
      actionLabel: "Explore real-world hook",
      actionRoute: null,
      whyExplanation: "Connecting data structure invariants to your goal keeps theory grounded in practical software systems."
    }
  };

  /* ── Distress & Safety Detection (Human & Supportive) ─────────────── */
  const DISTRESS_PATTERNS = [
    /\b(want\s+to\s+die|kill\s+myself|end\s+my\s+life|suicid|self[- ]harm|hurt\s+myself)\b/i,
    /\b(can'?t\s+take\s+this\s+anymore|no\s+reason\s+to\s+live|feel\s+hopeless|hate\s+my\s+life)\b/i,
    /\b(having\s+a\s+breakdown|severe\s+panic|severe\s+depression|can'?t\s+go\s+on)\b/i
  ];

  function checkDistress(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    return DISTRESS_PATTERNS.some(p => p.test(clean));
  }

  function getDistressResponse() {
    return (
      "I'm really glad you reached out and said something. Studying computer science can feel immense, " +
      "but your health and well-being come first before any code or concept. " +
      "Please talk to someone you trust, a loved one, or your college counsellor. " +
      "You don't have to carry this alone. Would you like to pause studying for today, or continue when you feel ready?"
    );
  }

  /* ── System Prompt Suffix Generator (Prompt 6) ──────────────────────── */
  function buildSupportPromptSuffix(support, goal = 'exam') {
    const s = support || DEFAULT_SUPPORT;
    const g = goal || 'exam';
    const tutorOpeningInstruction = s.tutorOpeningPrompt
      ? `Open your response with: "${s.tutorOpeningPrompt}". `
      : '';
    return (
      `\n\n${tutorOpeningInstruction}Student support profile: tone=${s.tone}; chunk size=${s.chunk}; hints=${s.hintPolicy}; praise style=${s.praise}; pacing=${s.pacing}; goal=${g}. ` +
      `Rules: Follow the profile. With gentle tone, keep replies short (under 80 words), one idea at a time, and normalise mistakes. ` +
      `With challenging tone, ask for predictions and edge cases. Use process praise ("you broke it down well") rather than ability praise ("you're smart"). ` +
      `Ask at most one question per reply. NEVER name or guess the student's emotions or personality, and never say you detected anything about them. ` +
      `If the student writes something that suggests serious distress beyond studying, respond with warmth, say you are glad they said it, and encourage them to talk to someone they trust or the college counsellor, without trying to give therapy. Then offer to continue or pause.`
    );
  }

  /**
   * Retrieves current effective support, applying student control preferences (Settings overrides).
   */
  function getEffectiveSupport() {
    let events = [];
    let checkins = [];
    let prefs = { checkinsEnabled: true, toneOverride: 'Auto', breakRemindersEnabled: true };
    let goal = 'exam';
    let interventionsHistory = [];
    let sessionStartTime = null;

    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || (typeof global !== 'undefined' && global.PathStore) || null);

    if (store) {
      if (typeof store.getEvents === 'function') events = store.getEvents();
      if (typeof store.getCheckins === 'function') checkins = store.getCheckins();
      if (typeof store.getPrefs === 'function') prefs = store.getPrefs();
      if (typeof store.getGoal === 'function') goal = store.getGoal() || prefs.goal || goal;
      if (typeof store.getInterventionsHistory === 'function') interventionsHistory = store.getInterventionsHistory();
      if (typeof store.getSessionStartTime === 'function') sessionStartTime = store.getSessionStartTime();
    }

    const context = {
      now: Date.now(),
      sessionStartTime,
      interventionsHistory
    };

    const assessment = assess(events, checkins, context);
    const effectiveSupport = Object.assign({}, assessment.support);

    // Apply Student Control Tone Override from Settings
    if (prefs.toneOverride === 'Gentle') {
      effectiveSupport.tone = 'gentle';
    } else if (prefs.toneOverride === 'Direct') {
      effectiveSupport.tone = 'challenging';
    }

    // Apply Student Control Break Reminders Preference
    let filteredInterventions = [...assessment.interventions];
    if (prefs.breakRemindersEnabled === false) {
      filteredInterventions = filteredInterventions.filter(id => id !== 'suggest_break');
    }

    const promptBlock = buildSupportPromptSuffix(effectiveSupport, goal);

    return {
      support: effectiveSupport,
      goal,
      assessment: Object.assign({}, assessment, { interventions: filteredInterventions }),
      interventions: filteredInterventions,
      promptBlock
    };
  }

  /* ── Calm Dismissible Intervention Card Renderer (Prompt 6) ────────── */
  function getInterventionCardHtml(stepId) {
    const { interventions } = getEffectiveSupport();
    if (!interventions || interventions.length === 0) return '';
    const intId = interventions[0];
    const details = INTERVENTION_DETAILS[intId];
    if (!details) return '';

    return `
      <aside class="cdd-intervention-card" id="cdd-intervention-card" data-intervention-id="${intId}" aria-label="Support suggestion">
        <div class="intervention-main">
          <span class="intervention-icon" aria-hidden="true">${details.icon || '💡'}</span>
          <div class="intervention-text-wrap">
            <div class="intervention-msg">${details.message}</div>
            <div class="intervention-why-wrap">
              <button type="button" class="intervention-why-toggle" id="btn-why-intervention" aria-expanded="false">
                Why am I seeing this?
              </button>
              <div class="intervention-why-explanation" id="intervention-why-text" hidden>
                ${details.whyExplanation}
              </div>
            </div>
          </div>
        </div>
        <div class="intervention-actions">
          ${details.actionLabel ? `
            <button type="button" class="btn btn--primary btn--sm" id="btn-intervention-action">
              ${details.actionLabel}
            </button>
          ` : ''}
          <button type="button" class="btn btn--ghost btn--sm" id="btn-intervention-dismiss" title="Dismiss suggestion">
            Dismiss
          </button>
        </div>
      </aside>
    `;
  }

  function bindInterventionCard(container, stepId) {
    if (!container) return;
    const card = container.querySelector('#cdd-intervention-card');
    if (!card) return;

    const intId = card.dataset.interventionId;
    const details = INTERVENTION_DETAILS[intId];

    // Log shown in interventions history if not already recorded
    if (typeof PathStore !== 'undefined' && PathStore.addInterventionRecord) {
      PathStore.addInterventionRecord({ id: intId, action: 'shown', stepId });
    }
    if (typeof Signals !== 'undefined' && Signals.log) {
      Signals.log('intervention_shown', { interventionId: intId, stepId });
    }

    // "Why am I seeing this?" toggle
    const whyToggle = card.querySelector('#btn-why-intervention');
    const whyText = card.querySelector('#intervention-why-text');
    if (whyToggle && whyText) {
      whyToggle.addEventListener('click', () => {
        const isHidden = whyText.hidden;
        whyText.hidden = !isHidden;
        whyToggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    // Dismiss handler (respects dismiss and records it for cooldowns)
    const dismissBtn = card.querySelector('#btn-intervention-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        card.classList.add('is-dismissing');
        if (typeof PathStore !== 'undefined' && PathStore.addInterventionRecord) {
          PathStore.addInterventionRecord({ id: intId, action: 'dismissed', stepId });
        }
        if (typeof Signals !== 'undefined' && Signals.log) {
          Signals.log('intervention_dismissed', { interventionId: intId, stepId });
        }
        setTimeout(() => {
          card.remove();
        }, 200);
      });
    }

    // Action handler
    const actionBtn = card.querySelector('#btn-intervention-action');
    if (actionBtn && details) {
      actionBtn.addEventListener('click', () => {
        if (typeof PathStore !== 'undefined' && PathStore.addInterventionRecord) {
          PathStore.addInterventionRecord({ id: intId, action: 'accepted', stepId });
        }
        if (typeof Signals !== 'undefined' && Signals.log) {
          Signals.log('intervention_accepted', { interventionId: intId, stepId });
        }

        if (details.actionRoute && typeof Router !== 'undefined' && Router.go) {
          Router.go(details.actionRoute);
          return;
        }

        // Custom action routing per intervention type
        if (intId === 'suggest_break') {
          if (typeof Router !== 'undefined' && Router.go) Router.go('/wrapup');
        } else if (intId === 'offer_other_format') {
          if (typeof Router !== 'undefined' && Router.go) Router.go('/animations');
        } else if (intId === 'good_enough_nudge') {
          const nextBtn = document.querySelector('#btn-step-next') || document.querySelector('.btn-step-complete');
          if (nextBtn) {
            nextBtn.click();
          } else if (typeof Roadmap !== 'undefined' && Roadmap.completeStep) {
            Roadmap.completeStep(stepId);
          }
        } else if (intId === 'warm_return_recap') {
          if (typeof Router !== 'undefined' && Router.go) Router.go('/wrapup');
        } else if (intId === 'predict_first') {
          const confArea = document.querySelector('.quiz-confidence-box') || document.querySelector('.assignment-confidence-banner');
          if (confArea) {
            confArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            confArea.classList.add('pulse-highlight');
          }
        } else if (intId === 'connect_to_goal') {
          if (window.showToast) {
            showToast("Connecting BST invariant to production database indexing & caching.", "info");
          }
        }

        card.remove();
      });
    }
  }

  /**
   * Retrieves warm return recap topics (Prompt 5 Extra Part 3).
   * Prioritizes topics from PathStore.getWorthAnotherLook(), fallback to completed path topics.
   */
  function getWarmReturnRecapTopics() {
    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || (typeof global !== 'undefined' && global.PathStore) || null);

    if (store && typeof store.getWorthAnotherLook === 'function') {
      const list = store.getWorthAnotherLook();
      if (Array.isArray(list) && list.length > 0) {
        return list.slice(0, 2);
      }
    }
    if (store && typeof store.getCompletedStepIds === 'function') {
      const completed = store.getCompletedStepIds();
      if (Array.isArray(completed) && completed.length > 0) {
        return completed.slice(0, 2);
      }
    }
    return ['Binary Search Tree Invariants', 'Recursion & Base Cases'];
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  const MindsetEngine = {
    assess,
    CONFIG,
    SUPPORT_PROFILES,
    STATE_INTERVENTIONS_MAP,
    INTERVENTION_DETAILS,
    checkDistress,
    getDistressResponse,
    buildSupportPromptSuffix,
    getEffectiveSupport,
    getWarmReturnRecapTopics,
    getInterventionCardHtml,
    bindInterventionCard,
  };

  if (typeof window !== 'undefined') {
    window.MindsetEngine = MindsetEngine;
  }
  if (typeof global !== 'undefined') {
    global.MindsetEngine = MindsetEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MindsetEngine;
  }
})();
