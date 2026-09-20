/**
 * state.js — Centralized reactive state with Supabase persistence
 * Single source of truth. Mutations update in-memory state and sync to Supabase.
 */

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

  /* ── Hydrate from Supabase on login or session restore ───── */
  async initFromSupabase(user, session) {
    const prev = _state;
    const baseState = structuredClone(DEFAULT_STATE);
    baseState.currentUser = user ? {
      id: user.id,
      email: user.email,
      name: user.name || user.user_metadata?.name || user.email?.split('@')[0],
    } : null;

    if (!user || !window.SupabaseService) {
      _state = baseState;
      _notify(prev);
      return _state;
    }

    try {
      const data = await window.SupabaseService.fetchUserData(user.id, baseState.currentTopic);
      if (data) {
        // 1. Stage progress
        const stageProgressMap = new Map();
        (data.stages || []).forEach(row => {
          stageProgressMap.set(Number(row.stage_number), {
            status: row.status,
            mastered: row.mastered !== undefined ? Boolean(row.mastered) : false,
          });
        });

        // 2. Chat history mapped by stage_number
        const chatMap = new Map();
        (data.chats || []).forEach(row => {
          const sNum = Number(row.stage_number);
          if (!chatMap.has(sNum)) {
            chatMap.set(sNum, []);
          }
          chatMap.get(sNum).push({
            sender: row.role === 'ai' ? 'tutor' : row.role,
            text: row.message,
            timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
        });

        // 3. Assessments mapped by stage_number
        const assessmentMap = new Map();
        (data.assessments || []).forEach(row => {
          const sNum = Number(row.stage_number);
          let parsedEval = row.ai_evaluation;
          if (typeof parsedEval === 'string') {
            try {
              parsedEval = JSON.parse(parsedEval);
            } catch (e) {
              // keep as string
            }
          }
          assessmentMap.set(sNum, {
            question: row.question,
            answer: row.student_answer,
            result: parsedEval,
            timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
        });

        // Rebuild stages array
        baseState.stages = [0, 1, 2, 3].map(i => {
          const prog = stageProgressMap.get(i);
          let status = prog ? prog.status : (i === 0 ? 'not-started' : 'locked');
          const mastered = prog ? Boolean(prog.mastered) : false;
          const assessment = assessmentMap.get(i) || null;
          const chat_history = chatMap.get(i) || [];

          // If previous stage is completed and this stage has no row yet, unlock to 'not-started'
          if (!prog && i > 0) {
            const prevProg = stageProgressMap.get(i - 1);
            if (prevProg?.status === 'completed') {
              status = 'not-started';
            }
          }

          return {
            id: i,
            status,
            mastered,
            assessment,
            chat_history,
          };
        });

        console.log('[State] Restored stages from Supabase:', baseState.stages.map(s => ({ stage: s.id + 1, status: s.status, mastered: s.mastered })));

        // 4. Flagged gaps
        baseState.flaggedGaps = (data.gaps || []).map(g => g.gap_description);

        // 5. Summary
        if (data.summary && data.summary.summary_text) {
          baseState.summary = {
            text: data.summary.summary_text,
            timestamp: data.summary.updated_at ? new Date(data.summary.updated_at).getTime() : Date.now(),
          };
        }
      }
    } catch (err) {
      console.error('[State] Failed to hydrate from Supabase:', err);
    }

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
    let unlockedNextIndex = -1;
    State.setState(s => {
      const stages = s.stages.map((st, i) => {
        if (i === index) return { ...st, status: 'completed' };
        if (i === index + 1 && st.status === 'locked') {
          unlockedNextIndex = i;
          return { ...st, status: 'not-started' };
        }
        return st;
      });
      return { ...s, stages };
    });

    // Sync to Supabase in background
    const user = _state.currentUser;
    if (user?.id && window.SupabaseService) {
      const currentStage = _state.stages[index];
      window.SupabaseService.upsertStageProgress(
        user.id,
        _state.currentTopic,
        index,
        'completed',
        currentStage?.mastered || false
      );

      if (unlockedNextIndex !== -1) {
        window.SupabaseService.upsertStageProgress(
          user.id,
          _state.currentTopic,
          unlockedNextIndex,
          'not-started',
          false
        );
      }
    }

    return State.get();
  },

  completedCount() { return _state.stages.filter(s => s.status === 'completed').length; },
  masteredCount()  { return _state.stages.filter(s => s.mastered).length; },
  allComplete()    { return _state.stages.every(s => s.status === 'completed'); },

  /**
   * Weighted progress percentage (0–100):
   *   4 content stages  = 60%  (each completed stage worth 15)
   *   Summary generated = 20%
   *   Animations viewed = 20%
   */
  computeMasteredPercent() {
    const stagePts     = _state.stages.filter(s => s.status === 'completed').length * 15;
    const summaryPts   = (_state.summary && _state.summary.text) ? 20 : 0;
    const animationPts = _state.animationsWatched ? 20 : 0;
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

    // Sync to Supabase in background
    const user = _state.currentUser;
    if (user?.id && window.SupabaseService) {
      window.SupabaseService.insertAssessmentResponse(
        user.id,
        stageId,
        question,
        answer,
        result,
        result.rating || 'solid'
      );

      const currentStage = _state.stages[stageId];
      if (currentStage) {
        window.SupabaseService.upsertStageProgress(
          user.id,
          _state.currentTopic,
          stageId,
          currentStage.status,
          currentStage.mastered
        );
      }

      if (result.gap) {
        window.SupabaseService.insertFlaggedGap(
          user.id,
          _state.currentTopic,
          result.gap,
          stageId
        );
      }
    }

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

    // Sync to Supabase in background
    const user = _state.currentUser;
    if (user?.id && window.SupabaseService) {
      window.SupabaseService.insertChatMessage(user.id, stageId, sender, text);
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

    const user = _state.currentUser;
    if (user?.id && window.SupabaseService) {
      window.SupabaseService.insertFlaggedGap(user.id, _state.currentTopic, gap, 0);
    }
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

    // Sync to Supabase in background
    const user = _state.currentUser;
    if (user?.id && window.SupabaseService) {
      window.SupabaseService.upsertSummary(user.id, _state.currentTopic, text);
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
};
