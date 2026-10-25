/**
 * js/demo.js
 * Demo Mode for Viva & Professor Showcase (Prompt 8)
 *
 * Implements an isolated, scripted learner simulation:
 * - Activates with ?demo=1 or manual toggle
 * - All demo data lives strictly under PathStore's isolated DEMO_STORE_KEY ('cdd_demo_store_v1')
 * - Never touches real learner data; cleared on exit
 * - 8 Persona scripts:
 *     1. Anxious beginner (low confidence taps, slow, retries) -> lowConfidence
 *     2. Overconfident skimmer (high confidence, very fast, partial results) -> overconfident
 *     3. Frustrated and stuck (three weak results, hints maxed) -> frustrated
 *     4. Disengaged (very short times, tiny answers, early exits) -> disengaged
 *     5. Perfectionist (repeated retries after Solid) -> perfectionist
 *     6. Tired late-night learner (Tired check-in, long session >45m) -> lowEnergy
 *     7. Returning after 5 days (inactive gap > 3 days) -> returning
 *     8. In flow (steady, solid results) -> flow
 * - Live "Agent's View" side panel with detected states, plain evidence, support profile, interventions, and CONFIG thresholds
 * - Side-by-side tutor demo comparing persona's profile vs "flow" profile
 * - Visible honesty banner: "Simulation. This panel replays scripted behaviour to show how the agent adapts. It is not real learner data."
 */

const DemoController = (() => {
  'use strict';

  let _activePersona = 'anxious';
  let _panelOpen = false;
  let _lastAssessment = null;

  /* ── 8 Persona Definitions & Synthetic Event Payloads ────────────────── */
  const PERSONAS = {
    anxious: {
      id: 'anxious',
      name: 'Anxious beginner',
      icon: '😰',
      subtitle: 'Low confidence taps, slow, retries',
      expectedState: 'lowConfidence',
      description: 'Learner feels cautious and takes extra time on theory. Retries steps to be sure.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Alex (Anxious)', level: 'beginner' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations'],
          quizAttempts: { 'qz-foundations': 2 },
          checkins: [
            { mood: 'Okay', confidence: 1, timestamp: now - 900000 },
            { mood: 'Okay', confidence: 2, timestamp: now - 600000 },
            { mood: 'Okay', confidence: 2, timestamp: now - 300000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 520, timeRatio: 1.44, timestamp: now - 900000 },
            { type: 'step_complete', stepId: 'th-invariant', timeSpent: 600, timeRatio: 1.42, timestamp: now - 600000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'weak', attempts: 2, timeSpent: 400, timeRatio: 1.33, timestamp: now - 300000 }
          ],
          context: {
            now,
            sessionStartTime: now - 900000,
            interventionsHistory: []
          }
        };
      }
    },

    overconfident: {
      id: 'overconfident',
      name: 'Overconfident skimmer',
      icon: '⚡',
      subtitle: 'High confidence, very fast, partial results',
      expectedState: 'overconfident',
      description: 'Learner taps maximum confidence, races through reading in under 2 minutes, but scores partial on assessments.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Jordan (Skimmer)', level: 'intermediate' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
          quizAttempts: { 'qz-foundations': 1, 'as-deletion-cases': 1 },
          checkins: [
            { mood: 'Energised', confidence: 5, timestamp: now - 1800000 },
            { mood: 'Energised', confidence: 5, timestamp: now - 900000 },
            { mood: 'Energised', confidence: 4, timestamp: now - 300000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 80, timeRatio: 0.22, timestamp: now - 1800000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'partial', calibrationGap: 1, timeSpent: 120, timeRatio: 0.4, timestamp: now - 900000 },
            { type: 'assignment_scored', stepId: 'as-deletion-cases', band: 'developing', calibrationGap: 1, timeSpent: 190, timeRatio: 0.32, timestamp: now - 300000 }
          ],
          assignments: {
            'as-deletion-cases': { confidenceBefore: 5, band: 'developing', calibrationGap: 1, attempts: 1 }
          },
          context: {
            now,
            sessionStartTime: now - 1800000,
            interventionsHistory: []
          }
        };
      }
    },

    frustrated: {
      id: 'frustrated',
      name: 'Frustrated and stuck',
      icon: '😫',
      subtitle: 'Three weak results, hints maxed',
      expectedState: 'frustrated',
      description: 'Repeated struggles on tree deletion questions; uses all 3 hint levels and retries 3 times.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Taylor (Stuck)', level: 'beginner' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations'],
          quizAttempts: { 'qz-foundations': 3, 'as-deletion-cases': 3 },
          checkins: [
            { mood: 'Okay', confidence: 2, timestamp: now - 900000 }
          ],
          events: [
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'weak', attempts: 3, timestamp: now - 800000 },
            { type: 'hint_used', stepId: 'qz-foundations', level: 3, timestamp: now - 700000 },
            { type: 'hint_used', stepId: 'as-deletion-cases', level: 3, timestamp: now - 500000 },
            { type: 'assignment_scored', stepId: 'as-deletion-cases', band: 'needs_support', attempts: 3, hintsUsed: 3, timestamp: now - 300000 },
            { type: 'quiz_rated', stepId: 'qz-deletion', rating: 'weak', attempts: 3, timestamp: now - 100000 }
          ],
          context: {
            now,
            sessionStartTime: now - 900000,
            interventionsHistory: []
          }
        };
      }
    },

    disengaged: {
      id: 'disengaged',
      name: 'Disengaged',
      icon: '💨',
      subtitle: 'Very short times, tiny answers, early exits',
      expectedState: 'disengaged',
      description: 'Learner skips reading in 20 seconds, gives 5-word tutor answers, and exits two steps prematurely.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Casey (Disengaged)', level: 'beginner' },
          path: ['th-nodes', 'th-invariant', 'th-height', 'vid-1'],
          completedIds: ['th-nodes', 'th-invariant'],
          checkins: [
            { mood: 'Okay', confidence: 3, timestamp: now - 1800000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 65, timeRatio: 0.18, timestamp: now - 1800000 },
            { type: 'step_complete', stepId: 'th-invariant', timeSpent: 75, timeRatio: 0.18, timestamp: now - 1200000 },
            { type: 'step_exit_early', stepId: 'th-height', timeSpent: 12, timeRatio: 0.04, timestamp: now - 800000 },
            { type: 'step_exit_early', stepId: 'vid-1', timeSpent: 18, timeRatio: 0.03, timestamp: now - 400000 },
            { type: 'tutor_message', wordCount: 8, studentAskedDirectly: false, timestamp: now - 100000 }
          ],
          context: {
            now,
            sessionStartTime: now - 1800000,
            interventionsHistory: []
          }
        };
      }
    },

    perfectionist: {
      id: 'perfectionist',
      name: 'Perfectionist',
      icon: '🔍',
      subtitle: 'Repeated retries after Solid',
      expectedState: 'perfectionist',
      description: 'Gets a Solid result immediately, but repeats the assessment twice more and spends double the estimated time.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Sam (Perfectionist)', level: 'intermediate' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations'],
          quizAttempts: { 'qz-foundations': 1, 'as-deletion-cases': 1 },
          checkins: [
            { mood: 'Okay', confidence: 4, timestamp: now - 900000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 720, timeRatio: 2.0, timestamp: now - 900000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', attempts: 1, timeSpent: 300, timeRatio: 1.0, timestamp: now - 700000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', retriedAfterSolid: true, attempts: 1, timeSpent: 300, timeRatio: 1.0, timestamp: now - 500000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', retriedAfterSolid: true, attempts: 1, timeSpent: 300, timeRatio: 1.0, timestamp: now - 300000 },
            { type: 'assignment_scored', stepId: 'as-deletion-cases', band: 'strong', attempts: 1, timeSpent: 1150, timeRatio: 1.91, timestamp: now - 100000 }
          ],
          context: {
            now,
            sessionStartTime: now - 900000,
            interventionsHistory: []
          }
        };
      }
    },

    lowEnergy: {
      id: 'lowEnergy',
      name: 'Tired late-night learner',
      icon: '🌙',
      subtitle: 'Tired check-in, long session (>45m)',
      expectedState: 'lowEnergy',
      description: 'Student checked in as Tired and has been studying continuously for 52 minutes.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Morgan (Late Night)', level: 'beginner' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations'],
          checkins: [
            { mood: 'Tired', confidence: 3, timestamp: now - 3120000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 360, timeRatio: 1.0, timestamp: now - 3000000 },
            { type: 'step_complete', stepId: 'th-invariant', timeSpent: 420, timeRatio: 1.0, timestamp: now - 2000000 },
            { type: 'step_complete', stepId: 'qz-foundations', timeSpent: 300, timeRatio: 1.0, timestamp: now - 1000000 }
          ],
          context: {
            now,
            sessionStartTime: now - 52 * 60 * 1000, // 52 minutes ago (>45m threshold)
            interventionsHistory: []
          }
        };
      }
    },

    returning: {
      id: 'returning',
      name: 'Returning after 5 days',
      icon: '📅',
      subtitle: 'Inactive gap > 3 days (5 days away)',
      expectedState: 'returning',
      description: 'Learner was away for 5 days. Returns and needs a warm refresher before advancing.',
      generateData() {
        const now = Date.now();
        const fiveDaysAgo = now - 5 * 24 * 60 * 60 * 1000;
        return {
          profile: { name: 'Riley (Returning)', level: 'beginner' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations'],
          completedIds: ['th-nodes', 'th-invariant'],
          checkins: [
            { mood: 'Energised', confidence: 4, timestamp: now }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 360, timeRatio: 1.0, timestamp: fiveDaysAgo },
            { type: 'step_complete', stepId: 'th-invariant', timeSpent: 420, timeRatio: 1.0, timestamp: fiveDaysAgo },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', timeSpent: 300, timeRatio: 1.0, timestamp: fiveDaysAgo }
          ],
          context: {
            now,
            sessionStartTime: now - 300000,
            daysSinceLastSession: 5, // > 3 days threshold
            interventionsHistory: []
          }
        };
      }
    },

    flow: {
      id: 'flow',
      name: 'In flow',
      icon: '🌊',
      subtitle: 'Steady, solid results',
      expectedState: 'flow',
      description: 'Smooth, consistent pacing (0.9–1.05 timeRatio) with solid results on every quiz and assignment.',
      generateData() {
        const now = Date.now();
        return {
          profile: { name: 'Devon (Flow)', level: 'intermediate' },
          path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases', 'qz-deletion'],
          completedIds: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases', 'qz-deletion'],
          checkins: [
            { mood: 'Energised', confidence: 4, timestamp: now - 2400000 }
          ],
          events: [
            { type: 'step_complete', stepId: 'th-nodes', timeSpent: 360, timeRatio: 1.0, timestamp: now - 2400000 },
            { type: 'step_complete', stepId: 'th-invariant', timeSpent: 420, timeRatio: 1.0, timestamp: now - 1800000 },
            { type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', timeSpent: 280, timeRatio: 0.93, timestamp: now - 1200000 },
            { type: 'assignment_scored', stepId: 'as-deletion-cases', band: 'strong', timeSpent: 620, timeRatio: 1.03, timestamp: now - 600000 },
            { type: 'quiz_rated', stepId: 'qz-deletion', rating: 'solid', timeSpent: 290, timeRatio: 0.97, timestamp: now - 100000 }
          ],
          context: {
            now,
            sessionStartTime: now - 2400000,
            interventionsHistory: []
          }
        };
      }
    }
  };

  /* ── Prescripted Socratic Responses for Side-by-Side Comparison ─────── */
  const TUTOR_REPLIES = {
    // Topic: Deletion / Successor
    deletion: {
      question: "When deleting a node with two children, why do we replace it with its in-order successor instead of just promoting one of the children?",
      flow: {
        text: "Replacing with the in-order successor maintains the fundamental recursive invariant left < root < right by selecting min(right_subtree). Because it is minimal on the right, it is strictly greater than all nodes in the left subtree and less than or equal to all remaining nodes in the right subtree. Furthermore, since the successor has at most one child (it cannot possess a left child by definition), its subsequent removal is guaranteed to reduce to the trivial Case 1 (leaf) or Case 2 (single child) deletion, preserving O(h) complexity.",
        tone: "Neutral / Expansive",
        words: 86,
        chunk: "Large",
        praise: "Minimal"
      },
      anxious: {
        text: "You broke this down thoughtfully! Deleting a node with two children can feel tricky at first, which is completely normal. Think of the in-order successor as the 'next value in line'—the smallest number on the right. Replacing with it keeps everything on the left smaller and everything on the right larger. Does picturing that single replacement make sense?",
        tone: "Gentle",
        words: 59,
        chunk: "Small",
        praise: "Process"
      },
      overconfident: {
        text: "Before looking at the successor, what would happen if you simply promoted the left child to the root? If that left child already had a right child of its own that was larger than the node being deleted, would the BST invariant still hold across the entire subtree? Trace that edge case with keys [50, 30, 70, 40] and tell me what invariant violation occurs.",
        tone: "Challenging",
        words: 64,
        chunk: "Normal",
        praise: "Specific"
      },
      frustrated: {
        text: "Let's take a breath—case 3 deletion is universally considered the hardest part of BSTs, so feeling stuck here is part of the process. Rather than looking at the whole tree, let's look at just one element: in the list 20, 30, 40, 50, 60, what number is immediately after 50? That number is the successor. Could that single number safely sit in 50's spot?",
        tone: "Gentle",
        words: 66,
        chunk: "Small",
        praise: "Process"
      },
      disengaged: {
        text: "Promoting a child directly risks orphaning its subtrees or violating the invariant. The in-order successor is strictly greater than all left descendants and strictly less than all remaining right descendants. Ready to see the 2-step swap?",
        tone: "Neutral",
        words: 37,
        chunk: "Small",
        praise: "Specific"
      },
      perfectionist: {
        text: "Your intuition about preserving BST ordering is already accurate. Replacing with the in-order successor guarantees the root has no invariant violations because it's the minimum of the right subtree. Your mental model here is solid—let's move to AVL balance factors.",
        tone: "Neutral",
        words: 42,
        chunk: "Normal",
        praise: "Minimal"
      },
      lowEnergy: {
        text: "Let's keep this one simple: the in-order successor is just the smallest key on the right side. Swapping it into place keeps the left side smaller and right side larger with minimal effort. You've done deep work tonight—does this quick visual intuition click?",
        tone: "Gentle",
        words: 46,
        chunk: "Small",
        praise: "Minimal"
      },
      returning: {
        text: "Welcome back! Great question to restart with. Remember the BST invariant from our first session: left < node < right. Because the in-order successor is the smallest value in the right subtree, putting it at the root maintains that exact invariant for both sides. Would you like a quick 3-node diagram to refresh the visual?",
        tone: "Gentle",
        words: 56,
        chunk: "Normal",
        praise: "Process"
      }
    },

    // Topic: BST Height
    height: {
      question: "Why is BST search runtime O(h) instead of always O(log n)?",
      flow: {
        text: "BST search complexity is strictly proportional to the maximum root-to-leaf path length traversed, denoted by tree height h. In balanced topologies, height is bounded by ⌈log₂(n+1)⌉. However, insertion of monotonically sorted sequences generates a degenerate linear unbranched chain where h = n. In this pathological configuration, operations degrade to O(n) linear search, motivating the strict balance invariants of AVL and Red-Black trees.",
        tone: "Neutral / Expansive",
        words: 64,
        chunk: "Large",
        praise: "Minimal"
      },
      anxious: {
        text: "Great question to check! You're thinking about the core idea here. The search simply walks down one path from the root. If the tree is shaped like a straight line (like 1, 2, 3), the height equals the number of nodes! So it takes O(h) steps. You've got the foundation right.",
        tone: "Gentle",
        words: 50,
        chunk: "Small",
        praise: "Process"
      },
      overconfident: {
        text: "If a tree has 1,000 nodes, what is the best possible height versus the worst possible height? How could you construct an input sequence that forces worst-case search runtime without sorting the array first?",
        tone: "Challenging",
        words: 34,
        chunk: "Normal",
        praise: "Specific"
      },
      frustrated: {
        text: "Don't worry—the difference between h and log(n) trips up almost everyone at first. Just picture a tree as a family tree. If every parent only has one child, it's just a straight line, right? That straight line is why height matters.",
        tone: "Gentle",
        words: 42,
        chunk: "Small",
        praise: "Process"
      },
      disengaged: {
        text: "Search follows one path. In a balanced tree, h = log₂(n). In a skewed tree (1->2->3), h = n. So runtime is O(h).",
        tone: "Neutral",
        words: 24,
        chunk: "Small",
        praise: "Specific"
      },
      perfectionist: {
        text: "You've got this down: search cost is the path length h. Only balanced trees guarantee h = O(log n). No need to overthink the proof—you already understand the mechanism.",
        tone: "Neutral",
        words: 30,
        chunk: "Normal",
        praise: "Minimal"
      },
      lowEnergy: {
        text: "Quick summary for tonight: search only visits one path from the top to bottom. That path length is the height h. When the tree is balanced, it's short; when it's unbalanced, it's tall. Rest your eyes on that simple visual.",
        tone: "Gentle",
        words: 41,
        chunk: "Small",
        praise: "Minimal"
      },
      returning: {
        text: "Welcome back! Think back to our tree diagram: search only walks down one branch. If the tree is balanced, that path is short (log n). If it's a straight line, it's h = n. Ready to jump into balancing?",
        tone: "Gentle",
        words: 38,
        chunk: "Normal",
        praise: "Process"
      }
    }
  };

  /**
   * Activates Demo Mode and sets up isolated storage.
   */
  function activate() {
    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || null);

    if (store && typeof store.enableDemoMode === 'function') {
      store.enableDemoMode();
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cdd_demo_active', 'true');
      }
    } catch (_) {}

    // Inject initial persona
    injectPersona(_activePersona);
    renderFloatingLauncher();
  }

  /**
   * Deactivates Demo Mode, wipes demo data, and restores real learner data.
   */
  function deactivate() {
    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || null);

    if (store && typeof store.disableDemoMode === 'function') {
      store.disableDemoMode();
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('cdd_demo_active');
      }
      // Remove ?demo=1 from URL without full reload
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (_) {}

    _panelOpen = false;
    if (typeof document !== 'undefined') {
      const panel = document.getElementById('demo-panel-overlay');
      if (panel) panel.remove();
      const launcher = document.getElementById('demo-floating-launcher');
      if (launcher) launcher.remove();
    }

    if (typeof State !== 'undefined' && typeof State.toast === 'function') {
      State.toast('Demo mode exited. Real learner data restored.');
    }

    // Refresh current view
    if (typeof Router !== 'undefined' && typeof Router.current === 'function') {
      const current = Router.current();
      Router.go(current || '/ready');
    }
  }

  /**
   * Injects a scripted persona into the demo store and evaluates MindsetEngine.
   */
  function injectPersona(personaId) {
    const persona = PERSONAS[personaId] || PERSONAS.anxious;
    _activePersona = persona.id;

    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || null);

    const data = persona.generateData();

    if (store) {
      // Isolate in demo store
      store.save({
        profile: data.profile,
        path: data.path,
        completedIds: data.completedIds,
        quizAttempts: data.quizAttempts || {},
        events: data.events || [],
        checkins: data.checkins || [],
        assignments: data.assignments || {},
        interventionsHistory: data.context?.interventionsHistory || []
      });
    }

    // Run MindsetEngine.assess
    const engine = (typeof MindsetEngine !== 'undefined')
      ? MindsetEngine
      : ((typeof window !== 'undefined' && window.MindsetEngine) || (typeof global !== 'undefined' && global.MindsetEngine) || null);

    if (engine && typeof engine.assess === 'function') {
      _lastAssessment = engine.assess(data.events, data.checkins, data.context);
    } else {
      _lastAssessment = {
        states: [{ id: persona.expectedState, strength: 1.0, evidence: ['Scripted test evidence active'] }],
        support: { tone: 'gentle', chunk: 'small', hintPolicy: 'early', praise: 'process', pacing: 'slow' },
        interventions: ['micro_win']
      };
    }

    // Update UI if panel is open
    if (_panelOpen) {
      updatePanelContent();
    }

    // If currently on #/journey, re-render it so live changes reflect!
    if (typeof window !== 'undefined' && window.location.hash === '#/journey' && typeof JourneyView !== 'undefined') {
      const root = document.getElementById('page-root');
      if (root) JourneyView.render(root);
    }

    return _lastAssessment;
  }

  /**
   * Generates a side-by-side tutor response comparison.
   */
  function getTutorComparison(topicKey = 'deletion') {
    const topicData = TUTOR_REPLIES[topicKey] || TUTOR_REPLIES.deletion;
    const personaReply = topicData[_activePersona] || topicData.anxious;
    const flowReply = topicData.flow;

    return {
      question: topicData.question,
      persona: {
        id: _activePersona,
        name: PERSONAS[_activePersona]?.name || _activePersona,
        reply: personaReply
      },
      baseline: {
        name: 'In Flow (Benchmark)',
        reply: flowReply
      }
    };
  }

  /**
   * Renders the floating demo pill launcher.
   */
  function renderFloatingLauncher() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('demo-floating-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'demo-floating-launcher';
    launcher.className = 'demo-floating-launcher';
    launcher.innerHTML = `
      <button type="button" class="btn-demo-launcher" id="btn-toggle-demo-panel" title="Click to open Viva Demo Panel">
        <span class="demo-pulse-dot"></span>
        <span class="demo-launcher-text">DEMO: Simulate a learner ⚙️</span>
      </button>
    `;

    document.body.appendChild(launcher);

    launcher.querySelector('#btn-toggle-demo-panel')?.addEventListener('click', () => {
      togglePanel();
    });
  }

  /**
   * Toggles the Demo Drawer.
   */
  function togglePanel() {
    if (typeof document === 'undefined') return;
    _panelOpen = !_panelOpen;
    let overlay = document.getElementById('demo-panel-overlay');

    if (_panelOpen) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'demo-panel-overlay';
        overlay.className = 'demo-panel-overlay';
        document.body.appendChild(overlay);
      }
      overlay.hidden = false;
      overlay.innerHTML = buildPanelHtml();
      bindPanelEvents(overlay);
    } else {
      if (overlay) overlay.hidden = true;
    }
  }

  /**
   * Updates only the dynamic content inside the open panel.
   */
  function updatePanelContent() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('demo-panel-overlay');
    if (!overlay || overlay.hidden) return;
    overlay.innerHTML = buildPanelHtml();
    bindPanelEvents(overlay);
  }

  /**
   * Builds the complete HTML for the Demo Panel.
   */
  function buildPanelHtml() {
    const persona = PERSONAS[_activePersona] || PERSONAS.anxious;
    const assessment = _lastAssessment || {
      states: [{ id: persona.expectedState, strength: 1.0, evidence: ['Active'] }],
      support: { tone: 'neutral', chunk: 'normal', hintPolicy: 'normal', praise: 'specific', pacing: 'normal' },
      interventions: []
    };

    const comparison = getTutorComparison('deletion');
    const config = (typeof MindsetEngine !== 'undefined' && MindsetEngine.CONFIG) ? MindsetEngine.CONFIG : {};

    // Get relevant threshold for active state
    let thresholdHtml = '';
    if (persona.expectedState === 'lowEnergy' && config.LOW_ENERGY) {
      thresholdHtml = `<code>LOW_ENERGY.SESSION_MINUTES_THRESHOLD = ${config.LOW_ENERGY.SESSION_MINUTES_THRESHOLD}m</code>`;
    } else if (persona.expectedState === 'lowConfidence' && config.LOW_CONFIDENCE) {
      thresholdHtml = `<code>LOW_CONFIDENCE.MAX_AVG_CONFIDENCE = ${config.LOW_CONFIDENCE.MAX_AVG_CONFIDENCE}</code>`;
    } else if (persona.expectedState === 'overconfident' && config.OVERCONFIDENT) {
      thresholdHtml = `<code>OVERCONFIDENT.MIN_AVG_CONFIDENCE = ${config.OVERCONFIDENT.MIN_AVG_CONFIDENCE}, MIN_CALIBRATION_GAP = ${config.OVERCONFIDENT.MIN_CALIBRATION_GAP}</code>`;
    } else if (persona.expectedState === 'frustrated' && config.FRUSTRATED) {
      thresholdHtml = `<code>FRUSTRATED.CONSECUTIVE_WEAK_RESULTS = ${config.FRUSTRATED.CONSECUTIVE_WEAK_RESULTS}, TOP_LEVEL_HINT_STEPS = ${config.FRUSTRATED.TOP_LEVEL_HINT_STEPS}</code>`;
    } else if (persona.expectedState === 'disengaged' && config.DISENGAGED) {
      thresholdHtml = `<code>DISENGAGED.FAST_TIME_RATIO = ${config.DISENGAGED.FAST_TIME_RATIO}, EARLY_EXITS = ${config.DISENGAGED.EARLY_EXITS_SESSION_THRESHOLD}</code>`;
    } else if (persona.expectedState === 'perfectionist' && config.PERFECTIONIST) {
      thresholdHtml = `<code>PERFECTIONIST.RETRIES_AFTER_SOLID = ${config.PERFECTIONIST.RETRIES_AFTER_SOLID}, HIGH_TIME_RATIO = ${config.PERFECTIONIST.HIGH_TIME_RATIO}</code>`;
    } else if (persona.expectedState === 'returning' && config.RETURNING) {
      thresholdHtml = `<code>RETURNING.DAYS_AWAY_THRESHOLD = ${config.RETURNING.DAYS_AWAY_THRESHOLD} days</code>`;
    } else if (persona.expectedState === 'flow' && config.FLOW) {
      thresholdHtml = `<code>FLOW.MIN_TIME_RATIO = ${config.FLOW.MIN_TIME_RATIO}, MAX_TIME_RATIO = ${config.FLOW.MAX_TIME_RATIO}</code>`;
    }

    return `
      <div class="demo-drawer" role="dialog" aria-modal="true" aria-label="Demo: Simulate a Learner">
        <!-- Drawer Header -->
        <div class="demo-drawer-header">
          <div>
            <div class="demo-drawer-kicker">Viva &amp; Evaluation Showcase</div>
            <h2 class="demo-drawer-title">DEMO: Simulate a Learner</h2>
          </div>
          <div class="demo-header-actions">
            <button type="button" class="btn btn--ghost btn--sm text-danger" id="btn-exit-demo" title="Exit Demo Mode and restore real data">
              ✕ Exit Demo
            </button>
            <button type="button" class="btn-demo-close" id="btn-close-demo-drawer" aria-label="Close panel">✕</button>
          </div>
        </div>

        <!-- Honesty Banner -->
        <div class="demo-honesty-banner">
          <span class="honesty-icon" aria-hidden="true">⚠️</span>
          <div class="honesty-text">
            <strong>Simulation.</strong> This panel replays scripted behaviour to show how the agent adapts. It is not real learner data.
          </div>
        </div>

        <div class="demo-drawer-body">
          <!-- 1. Personas Grid -->
          <div class="demo-section">
            <h3 class="demo-sec-heading">1. Select Learner Persona</h3>
            <div class="demo-personas-grid">
              ${Object.values(PERSONAS).map(p => {
                const isSel = p.id === _activePersona;
                return `
                  <button type="button" class="persona-card-btn ${isSel ? 'is-active' : ''}" data-persona-id="${p.id}">
                    <div class="persona-top">
                      <span class="persona-icon">${p.icon}</span>
                      <strong class="persona-name">${p.name}</strong>
                    </div>
                    <span class="persona-sub">${p.subtitle}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. "Agent's View" Live Panel -->
          <div class="demo-section">
            <h3 class="demo-sec-heading">2. Agent's View (Live Adaptation State)</h3>
            
            <div class="agent-view-card">
              <!-- Detected States -->
              <div class="agent-view-row">
                <span class="agent-lbl">Detected Mindset:</span>
                <div class="agent-states-list">
                  ${assessment.states && assessment.states.length > 0 ? assessment.states.map(s => `
                    <div class="state-pill state-${s.id}">
                      <strong>${s.id}</strong>
                      <span class="state-strength">${Math.round(s.strength * 100)}%</span>
                    </div>
                  `).join('') : `<span class="state-none">No active state</span>`}
                </div>
              </div>

              <!-- Evidence -->
              <div class="agent-evidence-block">
                <strong style="font-size: 0.75rem; color: var(--cream-3); text-transform: uppercase;">Plain-Language Evidence:</strong>
                <ul class="agent-evidence-list">
                  ${assessment.states && assessment.states[0]?.evidence ? assessment.states[0].evidence.map(e => `
                    <li>✓ ${e}</li>
                  `).join('') : `<li>Simulated behavior active.</li>`}
                </ul>
              </div>

              <!-- Support Profile Parameters -->
              <div class="agent-support-grid">
                <div class="support-cell">
                  <span class="cell-k">Tone</span>
                  <span class="cell-v tone-${assessment.support?.tone}">${assessment.support?.tone || 'neutral'}</span>
                </div>
                <div class="support-cell">
                  <span class="cell-k">Chunk Size</span>
                  <span class="cell-v">${assessment.support?.chunk || 'normal'}</span>
                </div>
                <div class="support-cell">
                  <span class="cell-k">Hint Policy</span>
                  <span class="cell-v">${assessment.support?.hintPolicy || 'normal'}</span>
                </div>
                <div class="support-cell">
                  <span class="cell-k">Praise Style</span>
                  <span class="cell-v">${assessment.support?.praise || 'specific'}</span>
                </div>
                <div class="support-cell">
                  <span class="cell-k">Pacing</span>
                  <span class="cell-v">${assessment.support?.pacing || 'normal'}</span>
                </div>
              </div>

              <!-- Fired Interventions -->
              <div class="agent-interventions-row">
                <span class="agent-lbl">Interventions Fired:</span>
                <div class="int-badges-wrap">
                  ${assessment.interventions && assessment.interventions.length > 0 ? assessment.interventions.map(id => `
                    <span class="int-badge">⚡ ${id}</span>
                  `).join('') : `<span style="color: var(--cream-3); font-size: 0.8125rem;">None triggered at current step</span>`}
                </div>
              </div>

              <!-- Triggering Thresholds from CONFIG -->
              <div class="agent-threshold-row">
                <span class="agent-lbl">Engine Threshold (CONFIG):</span>
                <div class="threshold-code-wrap">
                  ${thresholdHtml || `<code>CONFIG.${persona.expectedState.toUpperCase()}</code>`}
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Side-by-Side Tutor Demo -->
          <div class="demo-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 class="demo-sec-heading" style="margin: 0;">3. Side-by-Side Tutor Demo</h3>
              <span style="font-size: 0.75rem; color: var(--cream-3);">Live Comparison</span>
            </div>

            <!-- Question Input & Presets -->
            <div class="tutor-demo-question-box">
              <label for="demo-question-input" style="font-size: 0.8125rem; color: var(--cream-2); margin-bottom: 6px; display: block;">
                Student Question:
              </label>
              <textarea id="demo-question-input" class="demo-textarea" rows="2">${comparison.question}</textarea>
              <div class="demo-preset-chips">
                <span style="font-size: 0.75rem; color: var(--cream-3); align-self: center;">Quick presets:</span>
                <button type="button" class="btn-preset-chip" data-preset="deletion">BST Deletion Case 3</button>
                <button type="button" class="btn-preset-chip" data-preset="height">Height vs O(log n)</button>
              </div>
            </div>

            <!-- Side-by-Side Contrast Columns -->
            <div class="tutor-side-by-side">
              <!-- Persona Column -->
              <div class="tutor-compare-col col-persona">
                <div class="compare-col-header">
                  <div>
                    <strong class="col-title">${comparison.persona.name} Profile</strong>
                    <div class="col-meta-badges">
                      <span class="badge-tone">${comparison.persona.reply.tone}</span>
                      <span class="badge-words">${comparison.persona.reply.words} words</span>
                    </div>
                  </div>
                </div>
                <div class="compare-reply-body">
                  ${comparison.persona.reply.text}
                </div>
              </div>

              <!-- Baseline / Flow Column -->
              <div class="tutor-compare-col col-flow">
                <div class="compare-col-header">
                  <div>
                    <strong class="col-title">${comparison.baseline.name}</strong>
                    <div class="col-meta-badges">
                      <span class="badge-tone">${comparison.baseline.reply.tone}</span>
                      <span class="badge-words">${comparison.baseline.reply.words} words</span>
                    </div>
                  </div>
                </div>
                <div class="compare-reply-body">
                  ${comparison.baseline.reply.text}
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Quick Actions (View Journey, Refresh) -->
          <div class="demo-footer-actions">
            <a href="#/journey" class="btn btn--primary" id="btn-demo-view-journey" style="flex: 1; text-align: center;">
              View Simulated #/journey Page →
            </a>
            <button type="button" class="btn btn--outline" id="btn-demo-refresh">
              Re-Assess Persona
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Binds interactive events inside the panel.
   */
  function bindPanelEvents(overlay) {
    // Close button
    overlay.querySelector('#btn-close-demo-drawer')?.addEventListener('click', () => {
      togglePanel();
    });

    // Exit Demo button
    overlay.querySelector('#btn-exit-demo')?.addEventListener('click', () => {
      deactivate();
    });

    // Persona buttons
    overlay.querySelectorAll('.persona-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.personaId;
        if (id) {
          injectPersona(id);
        }
      });
    });

    // Preset question chips
    overlay.querySelectorAll('.btn-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.preset;
        const topic = TUTOR_REPLIES[key];
        if (topic) {
          const input = overlay.querySelector('#demo-question-input');
          if (input) input.value = topic.question;
          // Refresh comparison columns
          updatePanelContent();
        }
      });
    });

    // Re-assess
    overlay.querySelector('#btn-demo-refresh')?.addEventListener('click', () => {
      injectPersona(_activePersona);
    });
  }

  /**
   * Auto-boot check on DOM ready.
   */
  function init() {
    if (typeof window === 'undefined') return;

    const hasDemoParam = window.location.search.includes('demo=1') ||
                         window.location.hash.includes('demo=1') ||
                         (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cdd_demo_active') === 'true');

    if (hasDemoParam) {
      activate();
    }
  }

  return {
    init,
    activate,
    deactivate,
    injectPersona,
    getTutorComparison,
    togglePanel,
    getActivePersona: () => _activePersona,
    getLastAssessment: () => _lastAssessment,
    PERSONAS
  };
})();

if (typeof window !== 'undefined') {
  window.DemoController = DemoController;
  document.addEventListener('DOMContentLoaded', () => {
    DemoController.init();
  });
}
if (typeof global !== 'undefined') {
  global.DemoController = DemoController;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DemoController;
}
