/**
 * test_prompt7_journey.js
 * Verification test suite for PROMPT 7: "Your Journey" Page (explainability + report)
 */

const assert = require('assert');
const PathStore = require('./js/pathStore.js');
const MindsetEngine = require('./js/mindsetEngine.js');
const JourneyView = require('./js/journey.js');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n======================================================');
console.log('  PROMPT 7: "Your Journey" Page Test Suite');
console.log('======================================================\n');

// Mock DOM elements and document for Node environment
function createMockRoot() {
  const root = {
    innerHTML: '',
    querySelector(sel) {
      if (!this.innerHTML) return null;
      // Simple mock for id lookups
      if (sel.startsWith('#')) {
        const id = sel.slice(1);
        if (this.innerHTML.includes(`id="${id}"`)) {
          return {
            id,
            addEventListener: () => {},
            click: () => {}
          };
        }
      }
      return null;
    },
    querySelectorAll(sel) {
      return [];
    }
  };
  return root;
}

// Global mocks
global.State = {
  getProfile: () => ({ name: 'Karthik', level: 'beginner' }),
  get: () => ({ currentUser: { email: 'test@example.com', name: 'Karthik' } }),
  toast: () => {}
};

global.Catalog = {
  byId(id) {
    const mockDb = {
      'th-nodes': { id: 'th-nodes', title: 'Anatomy of a Tree', minutes: 6, topics: ['nodes'], type: 'theory' },
      'th-invariant': { id: 'th-invariant', title: 'The BST Invariant', minutes: 7, topics: ['invariant'], type: 'theory' },
      'qz-foundations': { id: 'qz-foundations', title: 'Foundations Checkpoint', minutes: 5, topics: ['nodes', 'invariant'], type: 'quiz' },
      'as-deletion-cases': { id: 'as-deletion-cases', title: 'Deletion Cases Rubric', minutes: 10, topics: ['deletion'], type: 'assignment' },
      'th-future-avl': { id: 'th-future-avl', title: 'AVL Rotations', minutes: 8, topics: ['balancing'], type: 'theory' },
    };
    return mockDb[id] || null;
  }
};

global.Roadmap = {
  getSteps() {
    return [
      { id: 'th-nodes', title: 'Anatomy of a Tree', status: 'done', minutes: 6 },
      { id: 'th-invariant', title: 'The BST Invariant', status: 'done', minutes: 7 },
      { id: 'qz-foundations', title: 'Foundations Checkpoint', status: 'done', minutes: 5 },
      { id: 'as-deletion-cases', title: 'Deletion Cases Rubric', status: 'done', minutes: 10, tag: 'Added for you' },
      { id: 'th-future-avl', title: 'AVL Rotations', status: 'locked', minutes: 8 } // Future step!
    ];
  },
  getProgress() {
    return { weightedPct: 65 };
  },
  getCurrentStep() {
    return { id: 'th-future-avl' };
  }
};

// ── Test Suite 1: Empty State Guard ──────────────────────────────────────────
console.log('--- Test Suite 1: Empty State Guard (< 2 completed steps) ---');

it('Renders friendly empty state when insufficient data', () => {
  PathStore.clear();
  const originalGetSteps = Roadmap.getSteps;
  Roadmap.getSteps = () => [{ id: 'th-nodes', status: 'locked' }]; // 0 completed

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('Keep going and this page will fill up'));
  assert.ok(mockRoot.innerHTML.includes('Continue learning'));
  // Ensure no diagnostic words
  assert.ok(!mockRoot.innerHTML.includes('diagnostic'));
  assert.ok(!mockRoot.innerHTML.includes('clinical'));
  assert.ok(!mockRoot.innerHTML.includes('disorder'));

  Roadmap.getSteps = originalGetSteps;
});

// ── Test Suite 2: Section 1 — Preparation & Stamps ──────────────────────────
console.log('\n--- Test Suite 2: Preparation & Stamps (Completed Only) ---');

it('Section 1 renders preparation percentage and stamps for completed topics only', () => {
  PathStore.clear();
  PathStore.save({
    completedIds: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
    path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases', 'th-future-avl']
  });

  const data = JourneyView.collectJourneyData();
  assert.strictEqual(data.weightedPct, 65);
  
  // Completed topics should include nodes, invariant, deletion
  assert.ok(data.earnedTopics.has('nodes'));
  assert.ok(data.earnedTopics.has('invariant'));
  assert.ok(data.earnedTopics.has('deletion'));

  // STRICT RULE: Future steps topics (balancing) MUST NOT be present
  assert.ok(!data.earnedTopics.has('balancing'), 'Future topic "balancing" must NOT be in earned topics!');

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('Your Preparation'));
  assert.ok(mockRoot.innerHTML.includes('65% Ready'));
  assert.ok(mockRoot.innerHTML.includes('Node Structure & Hierarchy'));
  assert.ok(mockRoot.innerHTML.includes('BST Search Invariant'));
  assert.ok(!mockRoot.innerHTML.includes('Self-Balancing Trees & Rotations'), 'Future step label must NOT be rendered in stamps');
});

// ── Test Suite 3: Section 2 — How You Worked ─────────────────────────────────
console.log('\n--- Test Suite 3: How You Worked (Time, Hints, Retries) ---');

it('Section 2 computes time per step vs estimate, hints, and retries', () => {
  PathStore.clear();
  PathStore.save({
    completedIds: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases'],
    path: ['th-nodes', 'th-invariant', 'qz-foundations', 'as-deletion-cases']
  });

  // Log events
  PathStore.addEvent({ type: 'step_complete', stepId: 'th-nodes', timeSpent: 280, timeRatio: 0.78 });
  PathStore.addEvent({ type: 'hint_used', stepId: 'as-deletion-cases', level: 1 });
  PathStore.addEvent({ type: 'hint_used', stepId: 'as-deletion-cases', level: 2 });
  PathStore.addEvent({ type: 'quiz_rated', stepId: 'qz-foundations', rating: 'solid', timeSpent: 240, timeRatio: 0.8 });

  // Assignment record
  PathStore.saveAssignment('as-deletion-cases', {
    band: 'developing',
    hintsUsed: 2,
    attempts: 2,
    confidenceBefore: 4
  });

  const data = JourneyView.collectJourneyData();
  assert.strictEqual(data.workItems.length, 4);

  const nodeItem = data.workItems.find(w => w.id === 'th-nodes');
  assert.strictEqual(nodeItem.actualSec, 280);
  assert.strictEqual(nodeItem.estimatedSec, 360);
  assert.strictEqual(nodeItem.hintsUsed, 0);

  const asgItem = data.workItems.find(w => w.id === 'as-deletion-cases');
  assert.strictEqual(asgItem.hintsUsed, 2);
  assert.strictEqual(asgItem.retries, 1); // 2 attempts = 1 retry

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('How You Worked'));
  assert.ok(mockRoot.innerHTML.includes('work-bar-track'));
  assert.ok(mockRoot.innerHTML.includes('2 hints'));
  assert.ok(mockRoot.innerHTML.includes('2 attempts'));
});

// ── Test Suite 4: Section 3 — Confidence vs Result & Takeaway ────────────────
console.log('\n--- Test Suite 4: Confidence vs Result & Plain Takeaway ---');

it('Section 3 plots confidence taps against actual rubric bands with an encouraging takeaway', () => {
  const data = JourneyView.collectJourneyData();
  assert.ok(data.confidenceItems.length > 0);

  const asgConf = data.confidenceItems.find(c => c.stepId === 'as-deletion-cases');
  assert.strictEqual(asgConf.confidence, 4);
  assert.strictEqual(asgConf.resultBand, 'developing');

  // Verify takeaway exists and is non-empty plain language
  assert.ok(typeof data.confidenceTakeaway === 'string' && data.confidenceTakeaway.length > 10);
  assert.ok(!data.confidenceTakeaway.toLowerCase().includes('overconfident'));
  assert.ok(!data.confidenceTakeaway.toLowerCase().includes('pathology'));
  assert.ok(!data.confidenceTakeaway.toLowerCase().includes('deficit'));

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('Confidence vs. Result'));
  assert.ok(mockRoot.innerHTML.includes('Key Takeaway:'));
  assert.ok(mockRoot.innerHTML.includes(data.confidenceTakeaway));
});

// ── Test Suite 5: Section 4 — How We Adapted (Strictly NO State Names) ───────
console.log('\n--- Test Suite 5: Adaptation Timeline (Plain Language & NO State Names) ---');

it('Section 4 renders adaptation timeline without exposing internal state names', () => {
  PathStore.clearInterventionsHistory();
  PathStore.addInterventionRecord({ id: 'suggest_break', timestamp: Date.now() - 300000 });
  PathStore.addInterventionRecord({ id: 'offer_other_format', timestamp: Date.now() - 600000 });
  PathStore.addInterventionRecord({ id: 'predict_first', timestamp: Date.now() - 900000 });

  const data = JourneyView.collectJourneyData();
  assert.ok(data.adaptations.length >= 3);

  // Check headlines
  assert.ok(data.adaptations.some(a => a.headline.includes('offered a short break after 50 minutes')));
  assert.ok(data.adaptations.some(a => a.headline.includes('added a video after two tough attempts on deletion') || a.headline.includes('animation or video')));

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  const html = mockRoot.innerHTML;
  assert.ok(html.includes('How We Adapted to You'));
  assert.ok(html.includes('timeline-entry'));

  // STRICT RULES: Verify no internal state names exist in the HTML output
  const forbiddenStateNames = [
    'lowenergy', 'frustrated', 'overconfident', 'lowconfidence', 
    'disengaged', 'perfectionist', 'returning', 'flow'
  ];

  forbiddenStateNames.forEach(name => {
    const reg = new RegExp(`\\b${name}\\b`, 'i');
    assert.ok(!reg.test(html), `Rendered HTML MUST NOT contain internal state name: "${name}"`);
  });
});

// ── Test Suite 6: Section 5 — Strongest Topics & Worth Another Look ───────────
console.log('\n--- Test Suite 6: Topic Mastery & Next Steps ---');

it('Section 5 categorizes topics into Strongest and Worth Another Look', () => {
  const data = JourneyView.collectJourneyData();
  assert.ok(data.strongestTopics.length > 0 || data.reviewTopics.length > 0);

  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('Topic Mastery &amp; Next Steps'));
  assert.ok(mockRoot.innerHTML.includes('Strongest Topics'));
  assert.ok(mockRoot.innerHTML.includes('Worth Another Look'));
});

// ── Test Suite 7: Section 6 — Your Data & Print Layout ────────────────────────
console.log('\n--- Test Suite 7: Your Data & Print Layout ---');

it('Section 6 contains Download report and Delete learning data actions', () => {
  const mockRoot = createMockRoot();
  JourneyView.render(mockRoot);

  assert.ok(mockRoot.innerHTML.includes('id="btn-journey-download"'));
  assert.ok(mockRoot.innerHTML.includes('id="btn-journey-delete"'));
  assert.ok(mockRoot.innerHTML.includes('Your Data &amp; Privacy'));
  assert.ok(mockRoot.innerHTML.includes('journey-print-header'));
});

it('deleteLearningData clears learning signals and preserves completed roadmap progress', () => {
  assert.ok(PathStore.getEvents().length > 0);
  PathStore.deleteLearningData();
  assert.strictEqual(PathStore.getEvents().length, 0);
  assert.strictEqual(PathStore.getCheckins().length, 0);
  assert.strictEqual(PathStore.getInterventionsHistory().length, 0);

  // Completed steps are still preserved in Roadmap progress
  const completed = PathStore.load()?.completedIds || [];
  assert.ok(completed.length > 0);
});

console.log('\n======================================================');
console.log(`  PROMPT 7 TESTS SUMMARY:`);
console.log(`  Total: ${totalTests} | Passed: ${passedTests} | Failed: 0`);
console.log('======================================================\n');
console.log('ALL PROMPT 7 TESTS PASSED SUCCESSFULLY! ✓\n');
