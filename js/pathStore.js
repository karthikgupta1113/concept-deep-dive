/**
 * js/pathStore.js
 * Centralized Persistence Store for Concept Deep-Dive.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * BACKEND-READY ARCHITECTURE NOTE:
 * This is the ONLY file in the entire application that interacts with storage.
 * All other modules read and write learner data strictly through PathStore
 * and State, never directly through localStorage.
 *
 * FUTURE SUPABASE INTEGRATION:
 * Replacing local persistence with Supabase requires changing ONLY THIS FILE:
 *   - Table `resources`:   Source of catalog items (replacing/hydrating data/catalog.js)
 *   - Table `user_paths`:  Stores current path sequence, insertedIds, and level/placement
 *   - Table `progress`:    Tracks completedIds, skippedIds, quizAttempts, videoPositions
 *
 * Do NOT add Supabase calls now — this file currently implements fast,
 * atomic, synchronous localStorage under versioned key `cdd_path_v1`.
 * ════════════════════════════════════════════════════════════════════════════
 */

const PathStore = (() => {
  'use strict';

  const REAL_STORE_KEY = 'cdd_path_v1';
  const DEMO_STORE_KEY = 'cdd_demo_store_v1';
  const SESSION_KEY = 'cdd_session_user';
  let _isDemoMode = false;

  function _getCurrentStoreKey() {
    if (_isDemoMode) return DEMO_STORE_KEY;
    const user = getSessionUser();
    if (user && user.id) {
      return `${REAL_STORE_KEY}_${user.id}`;
    }
    return REAL_STORE_KEY;
  }

  const LEGACY_KEYS = {
    PATH_STORE: 'cdd_path_store',
    ROADMAP_PROGRESS: 'cdd_roadmap_progress',
    PROFILE: 'cdd_learner_profile',
    VIDEO: 'cdd_video_progress',
    SESSION: 'cdd_session_user',
  };

  // In-memory cached payload
  let _cache = null;

  /* ── Safe Storage Primitives ─────────────────────────────────────────── */
  const _memoryStore = {};

  function _readRaw(key = _getCurrentStoreKey()) {
    try {
      if (typeof localStorage === 'undefined') {
        return _memoryStore[key] ? JSON.parse(_memoryStore[key]) : null;
      }
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn(`[PathStore] Error reading ${key}:`, e);
      return null;
    }
  }

  function _writeRaw(key, val) {
    try {
      if (typeof localStorage === 'undefined') {
        if (val === null || val === undefined) {
          delete _memoryStore[key];
        } else {
          _memoryStore[key] = JSON.stringify(val);
        }
        return;
      }
      if (val === null || val === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(val));
      }
    } catch (e) {
      console.warn(`[PathStore] Error writing ${key}:`, e);
    }
  }

  function _getCloudStore() {
    return (typeof CloudStore !== 'undefined')
      ? CloudStore
      : ((typeof window !== 'undefined' && window.CloudStore) || (typeof global !== 'undefined' && global.CloudStore) || null);
  }

  /* ── Migration from Legacy Keys ──────────────────────────────────────── */
  function _migrateLegacy() {
    try {
      if (typeof localStorage === 'undefined') return null;

      let migratedProfile = null;
      let migratedPath = [];
      let migratedCompleted = [];
      let migratedSkipped = [];
      let migratedInserted = [];
      let migratedAttempts = {};
      let migratedVideoPos = {};
      let migratedIndex = 0;
      let migratedDetails = {};
      let foundLegacy = false;

      // 1. Check legacy cdd_learner_profile
      const rawProfile = localStorage.getItem(LEGACY_KEYS.PROFILE);
      if (rawProfile) {
        try {
          migratedProfile = JSON.parse(rawProfile);
          foundLegacy = true;
        } catch (_) {}
      }

      // 2. Check legacy cdd_video_progress
      const rawVideo = localStorage.getItem(LEGACY_KEYS.VIDEO);
      if (rawVideo) {
        try {
          const vData = JSON.parse(rawVideo);
          if (vData && vData.videoPositions) {
            migratedVideoPos = vData.videoPositions;
            foundLegacy = true;
          }
        } catch (_) {}
      }

      // 3. Check legacy cdd_path_store or cdd_roadmap_progress
      const rawPathStore = localStorage.getItem(LEGACY_KEYS.PATH_STORE) || localStorage.getItem(LEGACY_KEYS.ROADMAP_PROGRESS);
      if (rawPathStore) {
        try {
          const parsed = JSON.parse(rawPathStore);
          const prog = parsed.roadmapProgress?.beginner ||
                       parsed.roadmapProgress?.intermediate ||
                       parsed.roadmapProgress?.revision ||
                       parsed.roadmapProgress ||
                       parsed;

          if (prog && Array.isArray(prog.steps)) {
            foundLegacy = true;
            migratedPath = prog.steps.map(s => (typeof s === 'string' ? s : s.id));
            migratedIndex = prog.currentIndex ?? 0;
            migratedAttempts = prog.remediationCounts || {};

            prog.steps.forEach(s => {
              if (typeof s === 'object' && s) {
                if (s.status === 'done') migratedCompleted.push(s.id);
                if (s.status === 'skipped') migratedSkipped.push(s.id);
                if (s.tag === 'Added for you' || s.remediationFor) migratedInserted.push(s.id);
                if (s.reason || s.tag || s.remediationFor) {
                  migratedDetails[s.id] = {
                    reason: s.reason,
                    tag: s.tag,
                    remediationFor: s.remediationFor,
                  };
                }
              }
            });
          }
        } catch (_) {}
      }

      if (foundLegacy) {
        const payload = {
          version: 'v1',
          profile: migratedProfile || { level: 'beginner', selfReportedLevel: null, placement: null },
          path: migratedPath,
          completedIds: migratedCompleted,
          skippedIds: migratedSkipped,
          insertedIds: migratedInserted,
          quizAttempts: migratedAttempts,
          videoPositions: migratedVideoPos,
          summaryGenerated: false,
          currentIndex: migratedIndex,
          stepDetails: migratedDetails,
          updatedAt: Date.now(),
        };

        _writeRaw(_getCurrentStoreKey(), payload);
        _cache = payload;

        // Cleanup obsolete legacy keys
        try {
          localStorage.removeItem(LEGACY_KEYS.PATH_STORE);
          localStorage.removeItem(LEGACY_KEYS.ROADMAP_PROGRESS);
          localStorage.removeItem(LEGACY_KEYS.PROFILE);
          localStorage.removeItem(LEGACY_KEYS.VIDEO);
        } catch (_) {}

        console.log('[PathStore] Migrated legacy data into cdd_path_v1 successfully.');
        return payload;
      }
    } catch (e) {
      console.warn('[PathStore] Migration error:', e);
    }
    return null;
  }

  /* ── Core PathStore API ──────────────────────────────────────────────── */

  /**
   * Loads the learner journey state from storage under versioned key `cdd_path_v1`.
   * Automatically drops unknown catalog IDs gracefully instead of crashing.
   *
   * @returns {Object|null}
   */
  function load(forceReload = false) {
    if (forceReload) {
      _cache = null;
    }
    if (_cache) {
      return structuredClone(_cache);
    }

    let data = _readRaw(_getCurrentStoreKey());
    if (!data && !_isDemoMode) {
      // Fallback: check non-user-keyed store if user just logged in with existing local progress
      data = _readRaw(REAL_STORE_KEY);
      if (!data) {
        data = _migrateLegacy();
      }
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    // Gracefully handle older version or missing version tag
    if (!data.version || data.version !== 'v1') {
      data.version = 'v1';
    }

    // Drop unknown catalog IDs gracefully
    if (Array.isArray(data.path)) {
      const validIds = new Set();
      data.path = data.path.filter(id => {
        if (!id || typeof id !== 'string') return false;
        if (typeof Catalog !== 'undefined' && typeof Catalog.byId === 'function') {
          const item = Catalog.byId(id);
          if (!item) {
            console.warn(`[PathStore] Dropping unknown catalog item ID: ${id}`);
            return false;
          }
        }
        validIds.add(id);
        return true;
      });

      if (Array.isArray(data.completedIds)) {
        data.completedIds = data.completedIds.filter(id => validIds.has(id));
      } else {
        data.completedIds = [];
      }

      if (Array.isArray(data.skippedIds)) {
        data.skippedIds = data.skippedIds.filter(id => validIds.has(id));
      } else {
        data.skippedIds = [];
      }

      if (Array.isArray(data.insertedIds)) {
        data.insertedIds = data.insertedIds.filter(id => validIds.has(id));
      } else {
        data.insertedIds = [];
      }
    } else {
      data.path = [];
      data.completedIds = [];
      data.skippedIds = [];
      data.insertedIds = [];
    }

    if (!data.quizAttempts || typeof data.quizAttempts !== 'object') {
      data.quizAttempts = {};
    }
    if (!data.videoPositions || typeof data.videoPositions !== 'object') {
      data.videoPositions = {};
    }
    if (typeof data.summaryGenerated !== 'boolean') {
      data.summaryGenerated = false;
    }
    if (!data.stepDetails || typeof data.stepDetails !== 'object') {
      data.stepDetails = {};
    }
    if (!data.reflections || typeof data.reflections !== 'object') {
      data.reflections = {};
    }
    if (!data.assignments || typeof data.assignments !== 'object') {
      data.assignments = {};
    }
    if (!Array.isArray(data.events)) {
      data.events = [];
    }
    if (!Array.isArray(data.checkins)) {
      data.checkins = [];
    } else {
      data.checkins.forEach(ch => {
        if (ch && typeof ch === 'object' && ch.mood) {
          const m = String(ch.mood).toLowerCase().trim();
          if ((m === 'tired' || m === 'stressed') && ch.selfReportedLowEnergy === undefined) {
            ch.selfReportedLowEnergy = true;
          }
        }
      });
    }
    if (!Array.isArray(data.interventionsHistory)) {
      data.interventionsHistory = [];
    }
    if (!Array.isArray(data.worthAnotherLook)) {
      data.worthAnotherLook = [];
    }
    if (!data.prefs || typeof data.prefs !== 'object') {
      data.prefs = Object.assign({}, DEFAULT_PREFS);
    }
    if (!data.session || typeof data.session !== 'object') {
      data.session = {
        startTime: Date.now(),
        stepsCompleted: 0,
        wrapUpCount: 0,
        sessionStamps: [],
        completedClusterIds: [],
      };
    } else {
      if (typeof data.session.startTime !== 'number') data.session.startTime = Date.now();
      if (typeof data.session.stepsCompleted !== 'number') data.session.stepsCompleted = 0;
      if (typeof data.session.wrapUpCount !== 'number') data.session.wrapUpCount = 0;
      if (!Array.isArray(data.session.sessionStamps)) data.session.sessionStamps = [];
      if (!Array.isArray(data.session.completedClusterIds)) data.session.completedClusterIds = [];
    }

    _cache = data;
    return structuredClone(_cache);
  }

  /**
   * Persists the whole learner journey.
   *
   * @param {Object} data
   * @param {Object} data.profile { level, selfReportedLevel, placement }
   * @param {Array<string>} data.path [ids in current order]
   * @param {Array<string>} [data.completedIds]
   * @param {Array<string>} [data.skippedIds]
   * @param {Array<string>} [data.insertedIds]
   * @param {Object} [data.quizAttempts] { [quizId]: rounds }
   * @param {Object} [data.videoPositions] { [videoId]: seconds }
   * @param {boolean} [data.summaryGenerated]
   */
  function save(data) {
    if (!data || typeof data !== 'object') return;

    const existing = _cache || load() || {};

    const payload = {
      version: 'v1',
      profile: data.profile || existing.profile || { level: 'beginner', selfReportedLevel: null, placement: null },
      path: Array.isArray(data.path) ? data.path.slice() : (existing.path || []),
      completedIds: Array.isArray(data.completedIds) ? data.completedIds.slice() : (existing.completedIds || []),
      skippedIds: Array.isArray(data.skippedIds) ? data.skippedIds.slice() : (existing.skippedIds || []),
      insertedIds: Array.isArray(data.insertedIds) ? data.insertedIds.slice() : (existing.insertedIds || []),
      quizAttempts: data.quizAttempts ? Object.assign({}, data.quizAttempts) : (existing.quizAttempts || {}),
      videoPositions: data.videoPositions ? Object.assign({}, data.videoPositions) : (existing.videoPositions || {}),
      summaryGenerated: typeof data.summaryGenerated === 'boolean' ? data.summaryGenerated : Boolean(existing.summaryGenerated),
      currentIndex: data.currentIndex ?? existing.currentIndex ?? 0,
      stepDetails: data.stepDetails ? Object.assign({}, data.stepDetails) : (existing.stepDetails || {}),
      reflections: data.reflections ? Object.assign({}, data.reflections) : (existing.reflections || {}),
      assignments: data.assignments ? Object.assign({}, data.assignments) : (existing.assignments || {}),
      events: Array.isArray(data.events) ? data.events.slice(-200) : (Array.isArray(existing.events) ? existing.events.slice(-200) : []),
      checkins: Array.isArray(data.checkins) ? data.checkins.map(ch => {
        if (ch && typeof ch === 'object') {
          const isLow = ch.mood && (
            String(ch.mood).toLowerCase().trim() === 'tired' ||
            String(ch.mood).toLowerCase().trim() === 'stressed'
          );
          if ((isLow || ch.selfReportedLowEnergy === true) && ch.selfReportedLowEnergy !== true) {
            return Object.assign({}, ch, { selfReportedLowEnergy: true });
          }
        }
        return ch;
      }) : (Array.isArray(existing.checkins) ? existing.checkins.slice() : []),
      interventionsHistory: Array.isArray(data.interventionsHistory) ? data.interventionsHistory.slice() : (Array.isArray(existing.interventionsHistory) ? existing.interventionsHistory.slice() : []),
      worthAnotherLook: Array.isArray(data.worthAnotherLook) ? data.worthAnotherLook.slice() : (Array.isArray(existing.worthAnotherLook) ? existing.worthAnotherLook.slice() : []),
      prefs: Object.assign({}, DEFAULT_PREFS, existing.prefs || {}, data.prefs || {}),
      goal: data.goal !== undefined ? data.goal : (existing.goal || null),
      session: Object.assign({
        startTime: Date.now(),
        stepsCompleted: 0,
        wrapUpCount: 0,
        sessionStamps: [],
        completedClusterIds: [],
      }, existing.session || {}, data.session || {}),
      updatedAt: Date.now(),
    };

    _cache = payload;
    _writeRaw(_getCurrentStoreKey(), payload);
    if (!_isDemoMode) {
      _writeRaw(REAL_STORE_KEY, payload);
    }
    const cs = _getCloudStore();
    if (cs && cs.onPathStateChanged) {
      cs.onPathStateChanged(payload);
    }
    return payload;
  }

  /**
   * Clears path, progress, and profile data while KEEPING the user account.
   */
  function clear() {
    _cache = null;
    _writeRaw(_getCurrentStoreKey(), null);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(_getCurrentStoreKey());
        if (!_isDemoMode) {
          localStorage.removeItem(LEGACY_KEYS.PATH_STORE);
          localStorage.removeItem(LEGACY_KEYS.ROADMAP_PROGRESS);
          localStorage.removeItem(LEGACY_KEYS.PROFILE);
          localStorage.removeItem(LEGACY_KEYS.VIDEO);
        }
      }
    } catch (_) {}
    console.log('[PathStore] Path data cleared (account preserved).');
  }

  /* ── Profile & Video Helpers (Replaces direct localStorage in State) ── */

  function getProfile() {
    const cur = _cache || load();
    return cur && cur.profile ? structuredClone(cur.profile) : null;
  }

  function setProfile(profile) {
    const cur = _cache || load() || {};
    cur.profile = profile ? structuredClone(profile) : null;
    if (profile) {
      save(cur);
    } else {
      // Clear profile only
      if (_cache) _cache.profile = null;
      _writeRaw(_getCurrentStoreKey(), _cache);
    }
    return profile;
  }

  function getVideoData() {
    const cur = _cache || load();
    const positions = cur?.videoPositions || {};
    // videoProgress is derived from completedIds or watched flag
    const progress = {
      1: Boolean(cur?.completedIds?.includes('vid-1')),
      2: Boolean(cur?.completedIds?.includes('vid-2')),
      3: Boolean(cur?.completedIds?.includes('vid-3')),
    };
    return { videoProgress: progress, videoPositions: positions };
  }

  function setVideoData(videoProgress, videoPositions) {
    const cur = _cache || load() || {};
    cur.videoPositions = Object.assign({}, cur.videoPositions || {}, videoPositions || {});
    if (videoProgress) {
      const completedSet = new Set(cur.completedIds || []);
      [1, 2, 3].forEach(n => {
        const vidId = `vid-${n}`;
        if (videoProgress[n]) completedSet.add(vidId);
      });
      cur.completedIds = Array.from(completedSet);
    }
    save(cur);
  }

  /* ── Session User API (Keeps account persisted) ──────────────────────── */

  function getSessionUser() {
    return _readRaw(SESSION_KEY);
  }

  function setSessionUser(user) {
    _writeRaw(SESSION_KEY, user);
    _cache = null;
  }

  function clearSessionUser() {
    _writeRaw(SESSION_KEY, null);
    _cache = null;
  }

  function clearAll() {
    clear();
    clearSessionUser();
  }

  /* ── Backward-Compatibility Adapters ────────────────────────────────── */

  function getRoadmapProgress(level, path) {
    const data = load();
    if (!data || !Array.isArray(data.path) || data.path.length === 0) return null;

    return {
      level: data.profile?.level || level || 'beginner',
      currentIndex: data.currentIndex ?? 0,
      steps: data.path.map(id => ({
        id,
        status: data.completedIds.includes(id) ? 'done' : (data.skippedIds.includes(id) ? 'skipped' : 'locked'),
        reason: data.stepDetails?.[id]?.reason,
        tag: data.stepDetails?.[id]?.tag,
        remediationFor: data.stepDetails?.[id]?.remediationFor,
      })),
      remediationCounts: data.quizAttempts || {},
      updatedAt: data.updatedAt,
    };
  }

  function saveRoadmapProgress(payload) {
    if (!payload || !Array.isArray(payload.steps)) return;
    save({
      profile: { level: payload.level },
      path: payload.steps.map(s => s.id),
      completedIds: payload.steps.filter(s => s.status === 'done').map(s => s.id),
      skippedIds: payload.steps.filter(s => s.status === 'skipped').map(s => s.id),
      insertedIds: payload.steps.filter(s => s.tag === 'Added for you' || s.remediationFor).map(s => s.id),
      quizAttempts: payload.remediationCounts || {},
      currentIndex: payload.currentIndex ?? 0,
      stepDetails: payload.steps.reduce((acc, s) => {
        if (s.reason || s.tag || s.remediationFor) {
          acc[s.id] = { reason: s.reason, tag: s.tag, remediationFor: s.remediationFor };
        }
        return acc;
      }, {}),
    });
  }

  function clearRoadmapProgress(level) {
    const cur = _cache || load() || {};
    cur.path = [];
    cur.completedIds = [];
    cur.skippedIds = [];
    cur.insertedIds = [];
    cur.quizAttempts = {};
    cur.currentIndex = 0;
    cur.stepDetails = {};
    cur.reflections = {};
    cur.assignments = {};
    cur.session = {
      startTime: Date.now(),
      stepsCompleted: 0,
      wrapUpCount: 0,
      sessionStamps: [],
      completedClusterIds: [],
    };
    if (level) {
      if (!cur.profile) cur.profile = { level, selfReportedLevel: level, placement: null };
      else cur.profile.level = level;
    }
    save(cur);
  }

  /* ── Reflection & Session Tracking API (Prompt 2) ─────────────────── */

  function getReflections() {
    const cur = _cache || load();
    return cur?.reflections ? structuredClone(cur.reflections) : {};
  }

  function getReflection(stepId) {
    const cur = _cache || load();
    return cur?.reflections?.[stepId] ? structuredClone(cur.reflections[stepId]) : null;
  }

  function saveReflection(stepId, data) {
    if (!stepId) return;
    const cur = _cache || load() || {};
    if (!cur.reflections) cur.reflections = {};

    let rec;
    if (typeof data === 'string') {
      const val = data.trim();
      rec = { rating: val, reflection: val.toLowerCase(), timestamp: Date.now() };
    } else if (data && typeof data === 'object') {
      const rawVal = data.rating || data.reflection || 'skipped';
      const normVal = String(rawVal).toLowerCase().trim();
      rec = { ...data, rating: data.rating || normVal, reflection: normVal, timestamp: data.timestamp || Date.now() };
    } else {
      rec = { rating: 'skipped', reflection: 'skipped', timestamp: Date.now() };
    }

    cur.reflections[stepId] = rec;
    save(cur);
    return rec;
  }

  function getSession() {
    const cur = _cache || load();
    return cur?.session ? structuredClone(cur.session) : {
      startTime: Date.now(),
      stepsCompleted: 0,
      wrapUpCount: 0,
      sessionStamps: [],
      completedClusterIds: [],
    };
  }

  function setSession(sessionData) {
    const cur = _cache || load() || {};
    cur.session = Object.assign({}, cur.session || {}, sessionData || {});
    save(cur);
    return cur.session;
  }

  function getSessionStartTime() {
    return getSession().startTime;
  }

  function getWrapUpCount() {
    return getSession().wrapUpCount || 0;
  }

  function incrementWrapUpCount() {
    const cur = _cache || load() || {};
    if (!cur.session) {
      cur.session = {
        startTime: Date.now(),
        stepsCompleted: 0,
        wrapUpCount: 0,
        sessionStamps: [],
        completedClusterIds: [],
      };
    }
    cur.session.wrapUpCount = (cur.session.wrapUpCount || 0) + 1;
    save(cur);
    return cur.session.wrapUpCount;
  }

  function recordSessionStepCompleted(stepId) {
    const cur = _cache || load() || {};
    if (!cur.session) {
      cur.session = {
        startTime: Date.now(),
        stepsCompleted: 0,
        wrapUpCount: 0,
        sessionStamps: [],
        completedClusterIds: [],
      };
    }
    cur.session.stepsCompleted = (cur.session.stepsCompleted || 0) + 1;
    if (stepId) {
      if (!Array.isArray(cur.session.sessionStamps)) cur.session.sessionStamps = [];
      if (!cur.session.sessionStamps.includes(stepId)) {
        cur.session.sessionStamps.push(stepId);
      }
    }
    save(cur);
    return cur.session;
  }

  function resetSessionAfterWrapUp() {
    const cur = _cache || load() || {};
    if (!cur.session) {
      cur.session = {
        startTime: Date.now(),
        stepsCompleted: 0,
        wrapUpCount: 0,
        sessionStamps: [],
        completedClusterIds: [],
      };
    }
    cur.session.stepsCompleted = 0;
    cur.session.sessionStamps = [];
    cur.session.startTime = Date.now();
    save(cur);
    return cur.session;
  }

  function markClusterCompleted(clusterId) {
    if (!clusterId) return;
    const cur = _cache || load() || {};
    if (!cur.session) cur.session = {};
    if (!Array.isArray(cur.session.completedClusterIds)) cur.session.completedClusterIds = [];
    if (!cur.session.completedClusterIds.includes(clusterId)) {
      cur.session.completedClusterIds.push(clusterId);
    }
    save(cur);
  }

  /* ── Structured Assignments API (Prompt 3) ─────────────────────────── */

  function getAssignments() {
    const cur = _cache || load();
    return cur?.assignments ? structuredClone(cur.assignments) : {};
  }

  function getAssignment(id) {
    const cur = _cache || load();
    return cur?.assignments?.[id] ? structuredClone(cur.assignments[id]) : null;
  }

  function saveAssignment(id, data) {
    if (!id) return;
    const cur = _cache || load() || {};
    if (!cur.assignments) cur.assignments = {};

    const prev = cur.assignments[id] || {};
    const updated = Object.assign({}, prev, data || {});

    // Automatically populate aiScores from aiEvaluation if not directly provided
    if (updated.aiEvaluation && !updated.aiScores && Array.isArray(updated.aiEvaluation.criteria)) {
      updated.aiScores = {};
      updated.aiEvaluation.criteria.forEach(c => {
        if (c.id) updated.aiScores[c.id] = c.score;
      });
    }

    // Compute calibrationGap if selfScores and aiScores are present
    if (updated.selfScores && updated.aiScores && typeof updated.selfScores === 'object' && typeof updated.aiScores === 'object') {
      const selfVals = Object.values(updated.selfScores).map(Number).filter(n => !isNaN(n));
      const aiVals = Object.values(updated.aiScores).map(Number).filter(n => !isNaN(n));
      if (selfVals.length > 0 && aiVals.length > 0) {
        const avgSelf = selfVals.reduce((a, b) => a + b, 0) / selfVals.length;
        const avgAi = aiVals.reduce((a, b) => a + b, 0) / aiVals.length;
        updated.calibrationGap = Math.round((avgSelf - avgAi) * 100) / 100;
      }
    }

    updated.updatedAt = Date.now();
    cur.assignments[id] = updated;
    save(cur);

    const cs = _getCloudStore();
    if (cs && cs.enqueue) {
      cs.enqueue('assessment_results', {
        item_id: id,
        rating: updated.rating || updated.result?.rating || (updated.aiEvaluation ? updated.aiEvaluation.rating : null),
        score: updated.score ?? updated.result?.score ?? (updated.aiScores ? Math.round(Object.values(updated.aiScores).reduce((a, b) => a + Number(b), 0) / Math.max(1, Object.keys(updated.aiScores).length)) : null),
        band: updated.band || updated.result?.band || null,
        attempt: updated.attempt || updated.attempts || 1,
        detail: updated,
        created_at: new Date().toISOString()
      });
    }

    return updated;
  }

  /* ── Signals, Check-Ins & Preferences API (Prompt 4) ───────────────── */

  function getEvents() {
    const cur = _cache || load();
    return cur?.events ? structuredClone(cur.events) : [];
  }

  function addEvent(event) {
    if (!event || typeof event !== 'object') return null;
    const cur = _cache || load() || {};
    if (!Array.isArray(cur.events)) cur.events = [];
    const eventRecord = Object.assign({ timestamp: Date.now() }, event);
    cur.events.push(eventRecord);
    // Capped at the last 200 items
    if (cur.events.length > 200) {
      cur.events = cur.events.slice(-200);
    }
    save(cur);

    const cs = _getCloudStore();
    if (cs && cs.enqueue) {
      cs.enqueue('events', {
        type: eventRecord.type || 'event',
        data: eventRecord,
        created_at: new Date(eventRecord.timestamp || Date.now()).toISOString()
      });
    }

    return eventRecord;
  }

  function clearEvents() {
    const cur = _cache || load() || {};
    cur.events = [];
    save(cur);
    return [];
  }

  function getCheckins() {
    const cur = _cache || load();
    return cur?.checkins ? structuredClone(cur.checkins) : [];
  }

  function addCheckin(checkinData) {
    if (!checkinData || typeof checkinData !== 'object') return null;
    const cur = _cache || load() || {};
    if (!Array.isArray(cur.checkins)) cur.checkins = [];

    const isLowEnergy = checkinData.mood && (
      String(checkinData.mood).toLowerCase().trim() === 'tired' ||
      String(checkinData.mood).toLowerCase().trim() === 'stressed'
    );

    const record = Object.assign({ timestamp: Date.now() }, checkinData);
    if (isLowEnergy || checkinData.selfReportedLowEnergy === true) {
      record.selfReportedLowEnergy = true;
    }

    cur.checkins.push(record);
    save(cur);

    const cs = _getCloudStore();
    if (cs && cs.enqueue) {
      cs.enqueue('checkins', {
        mood: record.mood,
        confidence: record.confidence,
        goal: record.goal,
        created_at: new Date(record.timestamp || Date.now()).toISOString()
      });
    }

    return record;
  }

  const DEFAULT_PREFS = {
    checkinsEnabled: true,
    toneOverride: 'Auto',
    breakRemindersEnabled: true,
  };

  function getPrefs() {
    const cur = _cache || load();
    return cur?.prefs ? Object.assign({}, DEFAULT_PREFS, cur.prefs) : Object.assign({}, DEFAULT_PREFS);
  }

  function setPrefs(prefsData) {
    const cur = _cache || load() || {};
    cur.prefs = Object.assign({}, DEFAULT_PREFS, cur.prefs || {}, prefsData || {});
    save(cur);
    return structuredClone(cur.prefs);
  }

  function getInterventionsHistory() {
    const cur = _cache || load();
    return Array.isArray(cur?.interventionsHistory) ? structuredClone(cur.interventionsHistory) : [];
  }

  function addInterventionRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const cur = _cache || load() || {};
    if (!Array.isArray(cur.interventionsHistory)) cur.interventionsHistory = [];
    const item = Object.assign({
      id: record.id,
      timestamp: typeof record.timestamp === 'number' ? record.timestamp : Date.now(),
      action: record.action || 'shown',
      stepId: record.stepId || null
    }, record);
    cur.interventionsHistory.push(item);
    if (cur.interventionsHistory.length > 100) {
      cur.interventionsHistory = cur.interventionsHistory.slice(-100);
    }
    save(cur);
    return item;
  }

  function clearInterventionsHistory() {
    const cur = _cache || load() || {};
    cur.interventionsHistory = [];
    save(cur);
    return true;
  }

  let _sessionCheckedIn = false;

  function isCheckedInThisSession() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem('cdd_checked_in_session') === 'true' || _sessionCheckedIn;
      }
    } catch (_) {}
    return _sessionCheckedIn;
  }

  function setSessionCheckedIn() {
    _sessionCheckedIn = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cdd_checked_in_session', 'true');
      }
    } catch (_) {}
  }

  function getGoal() {
    const cur = _cache || load();
    return cur?.goal || cur?.prefs?.goal || null;
  }

  function setGoal(goal) {
    if (!goal) return null;
    const cur = _cache || load() || {};
    cur.goal = goal;
    if (cur.prefs) cur.prefs.goal = goal;
    save(cur);
    return goal;
  }

  function deleteLearningData() {
    const cur = _cache || load() || {};
    cur.events = [];
    cur.checkins = [];
    cur.interventionsHistory = [];
    cur.worthAnotherLook = [];
    cur.prefs = Object.assign({}, DEFAULT_PREFS);
    cur.goal = null;
    save(cur);

    const cs = _getCloudStore();
    if (cs && cs.deleteLearningData) {
      cs.deleteLearningData();
    }
    return true;
  }

  function getWorthAnotherLook() {
    const cur = _cache || load();
    return Array.isArray(cur?.worthAnotherLook) ? structuredClone(cur.worthAnotherLook) : [];
  }

  function addWorthAnotherLook(topicOrId) {
    if (!topicOrId) return [];
    const cur = _cache || load() || {};
    if (!Array.isArray(cur.worthAnotherLook)) cur.worthAnotherLook = [];
    const val = String(topicOrId).trim();
    if (val && !cur.worthAnotherLook.includes(val)) {
      cur.worthAnotherLook.push(val);
      save(cur);
    }
    return structuredClone(cur.worthAnotherLook);
  }

  function clearWorthAnotherLook() {
    const cur = _cache || load() || {};
    cur.worthAnotherLook = [];
    save(cur);
    return [];
  }

  /* ── Demo Mode Isolation Primitives (Prompt 8) ──────────────────────── */

  function enableDemoMode() {
    _isDemoMode = true;
    _cache = null;
    console.log('[PathStore] Demo mode enabled: storage isolated under ' + DEMO_STORE_KEY);
    return true;
  }

  function disableDemoMode() {
    try {
      _writeRaw(DEMO_STORE_KEY, null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DEMO_STORE_KEY);
      }
      delete _memoryStore[DEMO_STORE_KEY];
    } catch (_) {}
    _isDemoMode = false;
    _cache = null;
    console.log('[PathStore] Demo mode disabled: demo data wiped, real cdd_path_v1 restored.');
    return true;
  }

  function isDemoMode() {
    return _isDemoMode;
  }

  return {
    load,
    save,
    clear,
    clearAll,
    getProfile,
    setProfile,
    getVideoData,
    setVideoData,
    getSessionUser,
    setSessionUser,
    clearSessionUser,
    getRoadmapProgress,
    saveRoadmapProgress,
    clearRoadmapProgress,
    getReflections,
    getReflection,
    saveReflection,
    getSession,
    setSession,
    getSessionStartTime,
    getWrapUpCount,
    incrementWrapUpCount,
    recordSessionStepCompleted,
    resetSessionAfterWrapUp,
    markClusterCompleted,
    getAssignments,
    getAssignment,
    saveAssignment,
    getEvents,
    addEvent,
    clearEvents,
    getCheckins,
    addCheckin,
    getPrefs,
    setPrefs,
    getGoal,
    setGoal,
    isCheckedInThisSession,
    setSessionCheckedIn,
    getInterventionsHistory,
    addInterventionRecord,
    clearInterventionsHistory,
    deleteLearningData,
    getWorthAnotherLook,
    addWorthAnotherLook,
    clearWorthAnotherLook,
    enableDemoMode,
    disableDemoMode,
    isDemoMode,
    REAL_STORE_KEY,
    DEMO_STORE_KEY,
  };
})();

if (typeof window !== 'undefined') {
  window.PathStore = PathStore;
}
if (typeof global !== 'undefined') {
  global.PathStore = PathStore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PathStore;
}
