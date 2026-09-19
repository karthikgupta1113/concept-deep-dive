/**
 * state.js — Centralized state with localStorage persistence
 * Single source of truth. All mutations via setState().
 */

const STORAGE_KEY   = 'cdd_v2';
const USERS_KEY     = 'cdd_users_v2';

const DEFAULT_STATE = {
  currentUser: null,
  currentTopic: 'bst',
  stages: [0,1,2,3].map(i => ({
    id: i,
    status: i === 0 ? 'not-started' : 'locked',
    mastered: false,
    assessment: null,
    chat_history: [],
  })),
  flaggedGaps: [],
  summary: null,
};

let _state = _loadState();
let _subs  = [];

function _loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = { ...DEFAULT_STATE, ...parsed };
      state.stages = state.stages.map(st => ({
        chat_history: [],
        mastered: false,
        assessment: null,
        ...st
      }));
      if (!state.flaggedGaps) {
        state.flaggedGaps = [];
      }
      if (!('summary' in parsed)) {
        state.summary = null;
      }
      return state;
    }
  } catch (e) { console.warn('[state] reset', e); }
  return structuredClone(DEFAULT_STATE);
}

function _save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); }
  catch (e) { console.warn('[state] save failed', e); }
}

window.State = {
  get() { return structuredClone(_state); },

  setState(updater) {
    const prev = _state;
    _state = typeof updater === 'function'
      ? updater(structuredClone(_state))
      : { ..._state, ...updater };
    _save();
    _subs.forEach(fn => fn(_state, prev));
  },

  subscribe(fn) {
    _subs.push(fn);
    return () => { _subs = _subs.filter(s => s !== fn); };
  },

  /* ── Auth ─────────────────────────────────────────────── */
  login(user) {
    State.setState(s => ({ ...s, currentUser: user }));
  },

  logout() {
    State.setState(() => ({
      ...structuredClone(DEFAULT_STATE),
    }));
  },

  /* ── Stages ───────────────────────────────────────────── */
  completeStage(index) {
    State.setState(s => {
      const stages = s.stages.map((st, i) => {
        if (i === index) return { ...st, status: 'completed' };
        if (i === index + 1 && st.status === 'locked') return { ...st, status: 'not-started' };
        return st;
      });
      return { ...s, stages };
    });
    return State.get();
  },

  completedCount() { return _state.stages.filter(s => s.status === 'completed').length; },
  masteredCount()  { return _state.stages.filter(s => s.mastered).length; },
  allComplete()    { return _state.stages.every(s => s.status === 'completed'); },

  /* ── Stage Assessments & Mastery ─────────────────────── */
  submitAssessment(stageId, question, answer, result) {
    State.setState(s => {
      const isMastered = result.rating === 'solid' || result.rating === 'partial';
      const stages = s.stages.map(st => {
        if (st.id === stageId) {
          return {
            ...st,
            mastered: isMastered ? true : st.mastered,
            assessment: {
              question,
              answer,
              result,
              timestamp: Date.now()
            }
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

  /* ── Synthesis Summary ────────────────────────────────── */
  saveSummary(text) {
    State.setState(s => ({
      ...s,
      summary: {
        text,
        timestamp: Date.now()
      }
    }));
    return State.get();
  },

  clearSummary() {
    State.setState(s => ({ ...s, summary: null }));
    return State.get();
  },

  /* ── Mock auth ────────────────────────────────────────── */
  _getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
    catch { return {}; }
  },
  _saveUser(email, data) {
    const u = this._getUsers(); u[email] = data;
    localStorage.setItem(USERS_KEY, JSON.stringify(u));
  },
  mockSignup(name, email, password) {
    const users = this._getUsers();
    if (users[email]) return { ok: false, error: 'An account with this email already exists.' };
    this._saveUser(email, { name, email, password });
    return { ok: true, user: { name, email } };
  },
  mockLogin(email, password) {
    const users = this._getUsers();
    const u = users[email];
    if (!u)              return { ok: false, error: 'No account found with this email.' };
    if (u.password !== password) return { ok: false, error: 'Incorrect password.' };
    return { ok: true, user: { name: u.name, email: u.email } };
  },
};
