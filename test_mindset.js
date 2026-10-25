/**
 * test_mindset.js
 * Comprehensive console test suite for MindsetEngine (Prompt 5).
 * Tests all rules, threshold edge cases, priority ordering, support profile merging,
 * state stability locks, and intervention cooldowns.
 */

const MindsetEngine = require('./js/mindsetEngine.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function header(title) {
  console.log(`\n======================================================`);
  console.log(`  ${title}`);
  console.log(`======================================================`);
}

// ── Test Suite 1: Event Count Threshold (< 3 events) ──
header('Test Suite 1: Event Count Guard (< 3 events)');
{
  const emptyRes = MindsetEngine.assess([], [], {});
  assert(emptyRes.states.length === 0, '0 events returns 0 states');
  assert(emptyRes.interventions.length === 0, '0 events returns 0 interventions');

  const oneEventRes = MindsetEngine.assess([
    { type: 'quiz_rated', rating: 'weak' }
  ], [{ mood: 'Okay', confidence: 1 }], { sessionMinutes: 10 });
  assert(oneEventRes.states.length === 0, '1 event returns 0 states with neutral mood');

  const twoEventsRes = MindsetEngine.assess([
    { type: 'quiz_rated', rating: 'weak' },
    { type: 'quiz_rated', rating: 'weak' }
  ], [{ mood: 'Okay', confidence: 1 }], {});
  assert(twoEventsRes.states.length === 0, '2 events returns 0 states despite 2 weak in a row (guard requires >= 3 events)');
}

// ── Test Suite 2: State Detection Rules (Each of the 8 states) ──
header('Test Suite 2: Triggering Each of the 8 States');

// 2.1 lowConfidence
{
  // Variant A: avg confidence <= 2 across last 3 check-ins/taps
  const resConf = MindsetEngine.assess([
    { type: 'step_complete', stepId: 's1' },
    { type: 'confidence_before', confidenceBefore: 2 },
    { type: 'confidence_before', confidenceBefore: 1 },
  ], [{ confidence: 2 }], {});
  assert(resConf.states.some(s => s.id === 'lowConfidence'), 'lowConfidence triggers on avg confidence <= 2');

  // Variant B: at least 2 weak ratings in last 4 with timeRatio >= 0.8
  const resWeakTime = MindsetEngine.assess([
    { type: 'quiz_rated', rating: 'weak', timeRatio: 0.9 },
    { type: 'quiz_rated', rating: 'solid', timeRatio: 1.0 },
    { type: 'assignment_scored', band: 'Needs support', timeRatio: 0.85 }
  ], [], {});
  assert(resWeakTime.states.some(s => s.id === 'lowConfidence'), 'lowConfidence triggers on 2 weak ratings in last 4 with timeRatio >= 0.8');
}

// 2.2 overconfident
{
  // Variant A: avg confidence >= 4 AND 2 of last 3 results partial/weak
  const resOverA = MindsetEngine.assess([
    { type: 'quiz_rated', rating: 'weak', calibrationGap: 3 },
    { type: 'assignment_scored', band: 'Developing', calibrationGap: 2 },
    { type: 'quiz_rated', rating: 'solid' }
  ], [{ confidence: 5 }, { confidence: 4 }], {});
  assert(resOverA.states.some(s => s.id === 'overconfident'), 'overconfident triggers on avg confidence >= 4 and 2 partial/weak results');

  // Variant B: timeRatio <= 0.4 with partial or weak results
  const resOverB = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'quiz_rated', rating: 'weak', timeRatio: 0.3 }
  ], [], {});
  assert(resOverB.states.some(s => s.id === 'overconfident'), 'overconfident triggers on timeRatio <= 0.4 with weak result');
}

// 2.3 frustrated
{
  // Variant A: 2 weak in a row
  const resFrustA = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', rating: 'weak' },
    { type: 'quiz_rated', stepId: 's2', rating: 'weak' }
  ], [], {});
  assert(resFrustA.states.some(s => s.id === 'frustrated'), 'frustrated triggers on 2 weak results in a row');

  // Variant B: top-level hints used on 2 steps
  const resFrustB = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'hint_used', stepId: 's1', level: 3 },
    { type: 'hint_used', stepId: 's2', level: 3 }
  ], [], {});
  assert(resFrustB.states.some(s => s.id === 'frustrated'), 'frustrated triggers on top-level hints used on 2 steps');

  // Variant C: 3 or more attempts on one quiz
  const resFrustC = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', attempts: 3, rating: 'solid' }
  ], [], {});
  assert(resFrustC.states.some(s => s.id === 'frustrated'), 'frustrated triggers on 3 or more attempts on one quiz');
}

// 2.4 disengaged
{
  // Variant A: timeRatio <= 0.3 on 3 reading/video steps in a row AND tutor message under 15 words
  const resDisA = MindsetEngine.assess([
    { type: 'step_complete', stepId: 'v1', timeRatio: 0.2 },
    { type: 'step_complete', stepId: 'v2', timeRatio: 0.25 },
    { type: 'step_complete', stepId: 'v3', timeRatio: 0.15 },
    { type: 'tutor_message', wordCount: 8 }
  ], [], {});
  assert(resDisA.states.some(s => s.id === 'disengaged'), 'disengaged triggers on 3 fast steps + tutor msg under 15 words');

  // Variant B: 2 early exits in session
  const resDisB = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_exit_early', stepId: 's1' },
    { type: 'step_exit_early', stepId: 's2' }
  ], [], {});
  assert(resDisB.states.some(s => s.id === 'disengaged'), 'disengaged triggers on 2 early exits in one session');
}

// 2.5 perfectionist
{
  // Variant A: retries after a Solid result 2 or more times
  const resPerfA = MindsetEngine.assess([
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid' },
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid' },
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid' }
  ], [], {});
  assert(resPerfA.states.some(s => s.id === 'perfectionist'), 'perfectionist triggers on retrying 2+ times after solid result');

  // Variant B: timeRatio >= 1.8 with Solid results
  const resPerfB = MindsetEngine.assess([
    { type: 'step_start', stepId: 'q1' },
    { type: 'step_complete', stepId: 'q1' },
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid', timeRatio: 2.1 }
  ], [], {});
  assert(resPerfB.states.some(s => s.id === 'perfectionist'), 'perfectionist triggers on timeRatio >= 1.8 with Solid result');
}

// 2.6 lowEnergy
{
  // Variant A: latest check-in mood is Tired or Stressed
  const resEnergyA = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'step_complete', stepId: 's2' }
  ], [{ mood: 'Tired' }], {});
  assert(resEnergyA.states.some(s => s.id === 'lowEnergy'), 'lowEnergy triggers when latest check-in mood is Tired');

  // Variant B: session is over 45 minutes
  const resEnergyB = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'step_complete', stepId: 's2' }
  ], [], { sessionMinutes: 50 });
  assert(resEnergyB.states.some(s => s.id === 'lowEnergy'), 'lowEnergy triggers when session duration > 45 minutes');
}

// 2.7 returning
{
  // More than 3 days since last session
  const resRet = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'step_complete', stepId: 's2' }
  ], [], { daysSinceLastSession: 4 });
  assert(resRet.states.some(s => s.id === 'returning'), 'returning triggers when days since last session > 3');
}

// 2.8 flow
{
  // 3 recent solid/partial results, timeRatio between 0.6 and 1.4, NO other state active
  const resFlow = MindsetEngine.assess([
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid', timeRatio: 1.0 },
    { type: 'quiz_rated', stepId: 'q2', rating: 'partial', timeRatio: 0.9 },
    { type: 'quiz_rated', stepId: 'q3', rating: 'solid', timeRatio: 1.1 }
  ], [], {});
  assert(resFlow.states.length === 1 && resFlow.states[0].id === 'flow', 'flow triggers with 3 solid/partial results, timeRatio 0.6-1.4, no other state active');
}

// ── Test Suite 3: Priority Hierarchy ──
header('Test Suite 3: Priority Ordering');
{
  // Priority: lowEnergy > frustrated > lowConfidence > returning > overconfident > disengaged > perfectionist > flow

  // Trigger lowEnergy + frustrated + lowConfidence together
  const multiRes = MindsetEngine.assess([
    { type: 'quiz_rated', stepId: 'q1', rating: 'weak', attempts: 3, timeRatio: 0.9 },
    { type: 'quiz_rated', stepId: 'q2', rating: 'weak', attempts: 1, timeRatio: 0.9 },
    { type: 'step_complete', stepId: 'q2' }
  ], [{ mood: 'Stressed', confidence: 1 }], {});

  assert(multiRes.states[0].id === 'lowEnergy', 'lowEnergy has top priority when lowEnergy, frustrated, and lowConfidence are active');
  assert(multiRes.states[1].id === 'frustrated', 'frustrated takes second priority over lowConfidence');
  assert(multiRes.states[2].id === 'lowConfidence', 'lowConfidence takes third priority');

  // Verify flow is suppressed if any other state triggers
  const flowPlusLowEnergy = MindsetEngine.assess([
    { type: 'quiz_rated', stepId: 'q1', rating: 'solid', timeRatio: 1.0 },
    { type: 'quiz_rated', stepId: 'q2', rating: 'solid', timeRatio: 1.0 },
    { type: 'quiz_rated', stepId: 'q3', rating: 'solid', timeRatio: 1.0 }
  ], [{ mood: 'Tired' }], {});
  assert(!flowPlusLowEnergy.states.some(s => s.id === 'flow'), 'flow is strictly suppressed when lowEnergy is active');
  assert(flowPlusLowEnergy.states[0].id === 'lowEnergy', 'lowEnergy is the active state instead of flow');
}

// ── Test Suite 4: Support Profiles and Safe Merging ──
header('Test Suite 4: Support Profiles & Safe Merging');
{
  // Individual State Support Profiles:
  // lowConfidence: tone gentle, chunk small, hints early, praise process, pacing slow
  const confEvents = [
    { type: 'step_start', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', rating: 'weak', timeRatio: 0.9 },
    { type: 'quiz_rated', stepId: 's2', rating: 'weak', timeRatio: 0.9 }
  ];
  const confRes = MindsetEngine.assess(confEvents, [{ confidence: 1 }], {});
  assert(
    confRes.support.tone === 'gentle' &&
    confRes.support.chunk === 'small' &&
    confRes.support.hintPolicy === 'early' &&
    confRes.support.praise === 'process' &&
    confRes.support.pacing === 'slow',
    'lowConfidence matches support profile: gentle, small, early, process, slow'
  );

  // overconfident: tone challenging, chunk normal, hints late, praise specific, pacing normal
  const overEvents = [
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', rating: 'weak', timeRatio: 0.3 }
  ];
  const overRes = MindsetEngine.assess(overEvents, [], {});
  assert(
    overRes.support.tone === 'challenging' &&
    overRes.support.chunk === 'normal' &&
    overRes.support.hintPolicy === 'late' &&
    overRes.support.praise === 'specific' &&
    overRes.support.pacing === 'normal',
    'overconfident matches support profile: challenging, normal, late, specific, normal'
  );

  // Merging: overconfident (challenging/normal/late/specific/normal) + lowEnergy (gentle/small/early/minimal/slow)
  // lowEnergy is higher priority -> tone: gentle, pacing: slow
  // Merged chunk: small > normal -> small
  // Merged hintPolicy: early > late -> early
  // Merged praise: specific > minimal -> specific (or process)
  const mergedRes = MindsetEngine.assess(overEvents, [{ mood: 'Tired' }], {});
  assert(mergedRes.support.tone === 'gentle', 'Merged tone takes highest-priority (lowEnergy -> gentle)');
  assert(mergedRes.support.pacing === 'slow', 'Merged pacing takes highest-priority (lowEnergy -> slow)');
  assert(mergedRes.support.chunk === 'small', 'Merged chunk chooses safer option (small)');
  assert(mergedRes.support.hintPolicy === 'early', 'Merged hintPolicy chooses safer/earlier option (early)');
}

// ── Test Suite 5: State Stability (Holds >= 3 events) ──
header('Test Suite 5: State Stability (Held >= 3 events)');
{
  // Event 1-3 triggers frustrated
  const step1Events = [
    { type: 'step_start', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', rating: 'weak' },
    { type: 'quiz_rated', stepId: 's2', rating: 'weak' }
  ];
  const step1 = MindsetEngine.assess(step1Events, [], {});
  assert(step1.states.some(s => s.id === 'frustrated'), 'Step 1: frustrated triggers initially');
  const locks = step1._stateLocks;

  // Next event is neutral (e.g. solid quiz)
  const step2Events = [
    ...step1Events,
    { type: 'quiz_rated', stepId: 's3', rating: 'solid' }
  ];
  const step2 = MindsetEngine.assess(step2Events, [], { stateLocks: locks });
  assert(step2.states.some(s => s.id === 'frustrated'), 'Step 2: frustrated remains locked active for stability (1 event after)');

  // Another neutral event
  const step3Events = [
    ...step2Events,
    { type: 'quiz_rated', stepId: 's4', rating: 'solid' }
  ];
  const step3 = MindsetEngine.assess(step3Events, [], { stateLocks: step2._stateLocks });
  assert(step3.states.some(s => s.id === 'frustrated'), 'Step 3: frustrated remains locked active for stability (2 events after)');

  // Third neutral event - lock completes
  const step4Events = [
    ...step3Events,
    { type: 'quiz_rated', stepId: 's5', rating: 'solid' }
  ];
  const step4 = MindsetEngine.assess(step4Events, [], { stateLocks: step3._stateLocks });
  assert(!step4.states.some(s => s.id === 'frustrated'), 'Step 4: frustrated lock expires after 3 events');
}

// ── Test Suite 6: Interventions Limits & Cooldowns ──
header('Test Suite 6: Intervention Limits and Cooldowns');
{
  const now = 1000000000;
  const lowEnergyEvents = [
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'step_complete', stepId: 's2' }
  ];

  // 6.1 Triggering appropriate intervention: suggest_break for lowEnergy
  const intRes1 = MindsetEngine.assess(lowEnergyEvents, [{ mood: 'Tired' }], { now });
  assert(intRes1.interventions.includes('suggest_break'), 'suggest_break is offered for lowEnergy state');

  // 6.2 Global 15-minute cooldown
  const tenMinutesLater = now + (10 * 60 * 1000);
  const intRes2 = MindsetEngine.assess(lowEnergyEvents, [{ mood: 'Tired' }], {
    now: tenMinutesLater,
    interventionsHistory: [
      { id: 'suggest_break', timestamp: now }
    ]
  });
  assert(intRes2.interventions.length === 0, 'No intervention offered 10 min after previous (15-min cooldown)');

  // 6.3 30-minute repeat cooldown for the SAME intervention
  const twentyMinutesLater = now + (20 * 60 * 1000);
  const intRes3 = MindsetEngine.assess(lowEnergyEvents, [{ mood: 'Tired' }], {
    now: twentyMinutesLater,
    interventionsHistory: [
      { id: 'suggest_break', timestamp: now }
    ]
  });
  // 20 min passed (> 15 min global), but suggest_break was issued 20 min ago (< 30 min repeat cooldown)
  assert(!intRes3.interventions.includes('suggest_break'), 'suggest_break cannot be repeated within 30 minutes');
  // It can offer micro_win (alternative for lowEnergy)
  assert(intRes3.interventions.includes('micro_win'), 'Alternative eligible intervention (micro_win) offered instead');

  // 6.4 Max 3 interventions per session
  const fortyMinutesLater = now + (40 * 60 * 1000);
  const intRes4 = MindsetEngine.assess(lowEnergyEvents, [{ mood: 'Tired' }], {
    now: fortyMinutesLater,
    interventionsHistory: [
      { id: 'suggest_break', timestamp: now - 3600000 },
      { id: 'micro_win', timestamp: now - 2400000 },
      { id: 'offer_other_format', timestamp: now - 1200000 }
    ]
  });
  assert(intRes4.interventions.length === 0, 'No intervention offered when session limit of 3 is reached');
}

// ── Test Suite 7: Prompt 5 Extra Requirements ──
header('Test Suite 7: Extra Reflection & Immediate Check-in Rules');
{
  // 7.1 One Tired check-in alone triggers lowEnergy (bypasses 3-event minimum)
  const tiredAloneRes = MindsetEngine.assess([], [{ mood: 'Tired' }], {});
  assert(tiredAloneRes.states.some(s => s.id === 'lowEnergy'), 'One Tired check-in alone triggers lowEnergy immediately');
  assert(tiredAloneRes.interventions.includes('suggest_break'), 'One Tired check-in alone offers suggest_break');
  assert(tiredAloneRes.support.tone === 'gentle', 'One Tired check-in alone sets gentle tone');

  // 7.2 Two confusing reflections in the last four steps add offer_other_format and tutorOpeningPrompt
  const confusingRes = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'reflection', stepId: 's1', rating: 'confusing' },
    { type: 'step_start', stepId: 's2' },
    { type: 'reflection', stepId: 's2', rating: 'confusing' }
  ], [], {});
  assert(confusingRes.interventions.includes('offer_other_format'), 'Two confusing reflections in last 4 steps add offer_other_format');
  assert(confusingRes.support.tutorOpeningPrompt === 'What part felt unclear?', 'Two confusing reflections set tutor opening prompt: "What part felt unclear?"');
  const tutorPrompt = MindsetEngine.buildSupportPromptSuffix(confusingRes.support);
  assert(tutorPrompt.includes('Open your response with: "What part felt unclear?".'), 'Tutor prompt suffix instructs opening with "What part felt unclear?"');

  // 7.3 clear followed by a weak quiz result adds overconfidence evidence
  const clearThenWeakRes = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'reflection', stepId: 's1', rating: 'clear' },
    { type: 'quiz_rated', stepId: 's2', rating: 'weak' }
  ], [], {});
  assert(clearThenWeakRes.states.some(s => s.id === 'overconfident'), 'clear followed by a weak quiz result triggers overconfident state');
  const overState = clearThenWeakRes.states.find(s => s.id === 'overconfident');
  assert(overState && overState.evidence.some(e => e.toLowerCase().includes('clear')), 'clear followed by a weak quiz result adds overconfidence evidence');

  // 7.4 Five skipped reflections change nothing (skips are never penalised)
  const fiveSkipsRes = MindsetEngine.assess([
    { type: 'reflection', stepId: 's1', rating: 'skipped' },
    { type: 'reflection', stepId: 's2', rating: 'skipped' },
    { type: 'reflection', stepId: 's3', rating: 'skipped' },
    { type: 'reflection', stepId: 's4', rating: 'skipped' },
    { type: 'reflection', stepId: 's5', rating: 'skipped' }
  ], [], {});
  assert(fiveSkipsRes.states.length === 0, 'Five skipped reflections trigger 0 states (skips never penalised)');
  assert(fiveSkipsRes.interventions.length === 0, 'Five skipped reflections offer 0 interventions');
  assert(fiveSkipsRes.support.tone === 'neutral', 'Five skipped reflections leave default neutral support profile');

  // 7.5 Warm return recap topics lookup
  const recapTopics = MindsetEngine.getWarmReturnRecapTopics();
  assert(Array.isArray(recapTopics) && recapTopics.length > 0, 'getWarmReturnRecapTopics returns retrieval topics');
}

// ── Test Suite Summary ──
console.log(`\n======================================================`);
console.log(`  MINDSET ENGINE TESTS SUMMARY:`);
console.log(`  Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`======================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL PROMPT 5 TESTS PASSED SUCCESSFULLY! ✓\n');
  process.exit(0);
}
