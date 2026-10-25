/**
 * state.js — Centralized in-memory state (database sync removed)
 * Pure in-memory. No Supabase persistence. Ready for fresh DB integration.
 */

/* ── Storage delegation via PathStore ─────────────────────────
   State does not touch localStorage directly; all persistence
   is mediated exclusively by PathStore.
*/
function _loadProfileFromStore() {
  if (typeof PathStore !== 'undefined' && typeof PathStore.getProfile === 'function') {
    return PathStore.getProfile();
  }
  return null;
}

function _saveProfileToStore(profile) {
  if (typeof PathStore !== 'undefined' && typeof PathStore.setProfile === 'function') {
    return PathStore.setProfile(profile);
  }
}

function _loadVideoFromStore() {
  if (typeof PathStore !== 'undefined' && typeof PathStore.getVideoData === 'function') {
    return PathStore.getVideoData();
  }
  return { videoProgress: {}, videoPositions: {} };
}

function _saveVideoToStore(videoProgress, videoPositions) {
  if (typeof PathStore !== 'undefined' && typeof PathStore.setVideoData === 'function') {
    PathStore.setVideoData(videoProgress, videoPositions);
  }
}

const _savedVideo = _loadVideoFromStore();

const DEFAULT_STATE = {
  currentUser: null,
  currentTopic: 'bst',
  stages: [0, 1, 2, 3].map(i => ({
    id: i,
    status: i === 0 ? 'not-started' : 'locked',
    mastered: false,
    assessment: null,
    chat_history: [],
  })),
  flaggedGaps: [],
  summary: null,
  animationsWatched: false,
  // Per-video watched flags: { 1: false, 2: false, 3: false }
  videoProgress: Object.assign({ 1: false, 2: false, 3: false }, _savedVideo.videoProgress || {}),
  // Per-video last playback position in seconds: { 1: 0, 2: 0, 3: 0 }
  videoPositions: Object.assign({ 1: 0, 2: 0, 3: 0 }, _savedVideo.videoPositions || {}),
};

let _state = structuredClone(DEFAULT_STATE);
let _subs  = [];

function _notify(prev) {
  _subs.forEach(fn => fn(_state, prev));
}

window.State = {
  get() {
    return structuredClone(_state);
  },

  setState(updater) {
    const prev = _state;
    _state = typeof updater === 'function'
      ? updater(structuredClone(_state))
      : { ..._state, ...updater };
    _notify(prev);
  },

  subscribe(fn) {
    _subs.push(fn);
    return () => { _subs = _subs.filter(s => s !== fn); };
  },

  /* ── Set user on login (no DB hydration) ───────────────── */
  async initFromSupabase(user /*, session — reserved for future DB */) {
    const prev = _state;
    const baseState = structuredClone(DEFAULT_STATE);
    const videoData = _loadVideoFromStore();
    baseState.videoPositions = Object.assign({ 1: 0, 2: 0, 3: 0 }, videoData.videoPositions || {});
    baseState.videoProgress = Object.assign({ 1: false, 2: false, 3: false }, videoData.videoProgress || {});
    baseState.currentUser = user ? {
      id: user.id,
      email: user.email,
      name: user.name || user.user_metadata?.name || user.email?.split('@')[0],
    } : null;

    _state = baseState;
    _notify(prev);
    return State.get();
  },

  /* ── Auth ─────────────────────────────────────────────── */
  login(user) {
    State.setState(s => ({ ...s, currentUser: user }));
  },

  logout() {
    const prev = _state;
    _state = structuredClone(DEFAULT_STATE);
    _notify(prev);
  },

  /* ── Stages ───────────────────────────────────────────── */
  completeStage(index) {
    State.setState(s => {
      const stages = s.stages.map((st, i) => {
        if (i === index) return { ...st, status: 'completed' };
        if (i === index + 1 && st.status === 'locked') {
          return { ...st, status: 'not-started' };
        }
        return st;
      });
      return { ...s, stages };
    });
    return State.get();
  },

  completedCount() { return _state.stages.filter(s => s.status === 'completed').length; },
  masteredCount()  { return _state.stages.filter(s => s.mastered).length; },
  allComplete()    { return _state.stages.every(s => s.status === 'completed'); },

  /**
   * Weighted progress percentage (0–100):
   *   4 content stages  = 60%  (each completed stage worth 15)
   *   Summary generated = 20%
   *   Animations viewed = 20%  (all 3 videos must be watched)
   */
  computeMasteredPercent() {
    const stagePts     = _state.stages.filter(s => s.status === 'completed').length * 15;
    const summaryPts   = (_state.summary && _state.summary.text) ? 20 : 0;
    // Derive animationsWatched from all 3 videos being watched
    const vp = _state.videoProgress || {};
    const allVideosWatched = vp[1] && vp[2] && vp[3];
    const animationPts = (_state.animationsWatched || allVideosWatched) ? 20 : 0;
    return stagePts + summaryPts + animationPts;
  },

  /* ── Stage Assessments & Mastery ─────────────────────── */
  submitAssessment(stageId, question, answer, result) {
    const isMastered = result.rating === 'solid' || result.rating === 'partial';

    State.setState(s => {
      const stages = s.stages.map(st => {
        if (st.id === stageId) {
          return {
            ...st,
            mastered: isMastered ? true : st.mastered,
            assessment: {
              question,
              answer,
              result,
              timestamp: Date.now(),
            },
          };
        }
        return st;
      });
      const flaggedGaps = s.flaggedGaps || [];
      const updatedGaps = (result.gap && !flaggedGaps.includes(result.gap))
        ? [...flaggedGaps, result.gap]
        : flaggedGaps;

      return { ...s, stages, flaggedGaps: updatedGaps };
    });

    return State.get();
  },

  /* ── Socratic Chat & Gaps ─────────────────────────────── */
  addChatMessage(stageId, sender, text) {
    State.setState(s => {
      const stages = s.stages.map(st => {
        if (st.id === stageId) {
          const chat_history = [...(st.chat_history || []), { sender, text, timestamp: Date.now() }];
          return { ...st, chat_history };
        }
        return st;
      });
      return { ...s, stages };
    });

    if (typeof CloudStore !== 'undefined' && CloudStore.enqueue) {
      CloudStore.enqueue('chat_messages', {
        step_id: stageId || null,
        role: sender === 'student' ? 'user' : (sender === 'tutor' ? 'assistant' : sender),
        content: text,
        created_at: new Date().toISOString()
      });
    }
  },

  flagGap(gap) {
    State.setState(s => {
      const flaggedGaps = s.flaggedGaps || [];
      if (!flaggedGaps.includes(gap)) {
        return { ...s, flaggedGaps: [...flaggedGaps, gap] };
      }
      return s;
    });
  },

  logAdaptation(entry) {
    State.setState(s => {
      const adaptations = s.adaptations || [];
      return { ...s, adaptations: [...adaptations, entry] };
    });
  },

  getAdaptations() {
    return (_state.adaptations || []).slice();
  },

  /* ── Synthesis Summary ────────────────────────────────── */
  saveSummary(text) {
    State.setState(s => ({
      ...s,
      summary: {
        text,
        timestamp: Date.now(),
      },
    }));

    if (typeof CloudStore !== 'undefined' && CloudStore.syncSummary) {
      CloudStore.syncSummary(text, 'bst');
    }

    return State.get();
  },

  clearSummary() {
    State.setState(s => ({ ...s, summary: null }));
    return State.get();
  },

  setAnimationsWatched(watched) {
    State.setState(s => ({ ...s, animationsWatched: Boolean(watched) }));
    return State.get();
  },

  /* ── Video Progress ──────────────────────────────────────── */

  /**
   * Returns a copy of the videoProgress map { 1: bool, 2: bool, 3: bool }.
   */
  getVideoProgress() {
    return { ...(_state.videoProgress || { 1: false, 2: false, 3: false }) };
  },

  /**
   * Marks a specific video (1, 2, or 3) as watched.
   * Automatically sets animationsWatched when all three are done.
   */
  setVideoWatched(videoIndex) {
    State.setState(s => {
      const vp = { ...(s.videoProgress || { 1: false, 2: false, 3: false }), [videoIndex]: true };
      const allDone = vp[1] && vp[2] && vp[3];
      const updated = { ...s, videoProgress: vp, animationsWatched: allDone || s.animationsWatched };
      _saveVideoToStore(updated.videoProgress, updated.videoPositions);
      return updated;
    });
    return State.get();
  },

  /**
   * Saves current playback position (seconds) for a video so the student
   * can resume where they left off.
   */
  saveVideoPosition(videoIndex, seconds) {
    const curPos = (_state.videoPositions || {})[videoIndex];
    if (typeof curPos === 'number' && Math.abs(curPos - seconds) < 1) {
      return;
    }
    const nextPositions = { ...(_state.videoPositions || { 1: 0, 2: 0, 3: 0 }), [videoIndex]: seconds };
    _saveVideoToStore(_state.videoProgress, nextPositions);
    State.setState(s => ({
      ...s,
      videoPositions: nextPositions,
    }));
  },

  /**
   * Returns the last saved playback position for a video (or 0).
   */
  getVideoPosition(videoIndex) {
    return (_state.videoPositions || {})[videoIndex] || 0;
  },

  /* ── Learner Profile ────────────────────────────────────── */

  /**
   * Returns the stored learner profile, or null if none exists.
   * Shape: { level, selfReportedLevel, placement, createdAt }
   */
  getProfile() {
    return _loadProfileFromStore();
  },

  /**
   * Persists the learner profile via PathStore.
   * Pass null to clear (e.g. on restart).
   */
  setProfile(profile) {
    _saveProfileToStore(profile);
    return profile;
  },

  /**
   * Resets path-specific state while preserving account login.
   */
  resetPathState() {
    State.setState(s => ({
      ...s,
      stages: [0, 1, 2, 3].map(i => ({
        id: i,
        status: i === 0 ? 'not-started' : 'locked',
        mastered: false,
        assessment: null,
        chat_history: [],
      })),
      flaggedGaps: [],
      summary: null,
      animationsWatched: false,
      videoProgress: { 1: false, 2: false, 3: false },
      videoPositions: { 1: 0, 2: 0, 3: 0 },
    }));
  },

  /* ── Reflections & Session (PathStore delegation) ───────── */
  getReflections() {
    return typeof PathStore !== 'undefined' ? PathStore.getReflections() : {};
  },

  getReflection(stepId) {
    return typeof PathStore !== 'undefined' ? PathStore.getReflection(stepId) : null;
  },

  saveReflection(stepId, data) {
    return typeof PathStore !== 'undefined' ? PathStore.saveReflection(stepId, data) : null;
  },

  getSession() {
    return typeof PathStore !== 'undefined' ? PathStore.getSession() : null;
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = window.State;
}
