/**
 * test_prompt6_adaptive.js
 * Comprehensive test suite for PROMPT 6: Adaptive Tutor and UI Responses.
 *
 * Verifies:
 * 1. Tutor & Feedback system prompts (appends support profile, gentle vs challenging rules, goal inclusion).
 * 2. Intervention cards wording, dismissibility, and "Why am I seeing this?" non-diagnostic plain language (no state names, no "detected").
 * 3. Student control: Settings tone override (Auto / Gentle / Direct), break reminders toggle, learning data deletion.
 * 4. Safety note: Distress detection, fixed supportive message with institutional contact placeholder, no invented phone numbers.
 * 5. Humane rules: Never lock content, interventions offer options only, respect dismiss and Prompt 5 limits.
 */

const MindsetEngine = require('./js/mindsetEngine.js');
const PathStore = require('./js/pathStore.js');

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

// ── Test Suite 1: System Prompt Support Profile Block ──
header('Test Suite 1: System Prompt Support Profile Block');
{
  const support = {
    tone: 'gentle',
    chunk: 'small',
    hintPolicy: 'early',
    praise: 'process',
    pacing: 'slow'
  };
  const goal = 'exam';
  const promptBlock = MindsetEngine.buildSupportPromptSuffix(support, goal);

  assert(promptBlock.includes('tone=gentle'), 'Prompt block includes tone=gentle');
  assert(promptBlock.includes('chunk size=small'), 'Prompt block includes chunk size=small');
  assert(promptBlock.includes('hints=early'), 'Prompt block includes hints=early');
  assert(promptBlock.includes('praise style=process'), 'Prompt block includes praise style=process');
  assert(promptBlock.includes('pacing=slow'), 'Prompt block includes pacing=slow');
  assert(promptBlock.includes('goal=exam'), 'Prompt block includes goal=exam');

  // Verify non-diagnostic and distress instructions
  assert(promptBlock.includes('NEVER name or guess the student\'s emotions or personality'), 'Prompt strictly forbids guessing emotions/personality');
  assert(promptBlock.includes('never say you detected anything about them'), 'Prompt strictly forbids saying anything was detected');
  assert(promptBlock.includes('college counsellor'), 'Prompt instructs encouraging college counsellor/trusted person if in distress');
  assert(promptBlock.includes('under 80 words'), 'Prompt instructs short replies under 80 words for gentle tone');
}

// ── Test Suite 2: Interventions Wording & Non-Diagnostic "Why" ──
header('Test Suite 2: Intervention Wording & Non-Diagnostic "Why am I seeing this?"');
{
  const details = MindsetEngine.INTERVENTION_DETAILS;
  const stateNames = [
    'lowenergy', 'frustrated', 'lowconfidence', 'returning',
    'overconfident', 'disengaged', 'perfectionist', 'flow'
  ];

  // 2.1 Verify exact wording examples from Prompt 6
  assert(details.suggest_break.message.includes("You've been at it a while. Want a short break? Your progress is saved."), 'suggest_break matches Prompt 6 wording');
  assert(details.offer_other_format.message.includes("Want to see this one as a short animation instead?"), 'offer_other_format matches Prompt 6 wording');
  assert(details.predict_first.message.includes("Before I show it, what do you think the answer will be?"), 'predict_first matches Prompt 6 wording');
  assert(details.calibration_mirror.message.includes("You felt fairly sure, and the answer was close. One detail was missing:"), 'calibration_mirror matches Prompt 6 wording');
  assert(details.good_enough_nudge.message.includes("That answer already covers what's needed. Ready to move on?"), 'good_enough_nudge matches Prompt 6 wording');
  assert(details.micro_win.message.includes("Here's a quick one to build momentum."), 'micro_win matches Prompt 6 wording');
  assert(details.warm_return_recap.message.includes("Welcome back. Two quick questions to warm up."), 'warm_return_recap matches Prompt 6 wording');
  assert(details.stretch_challenge.message.includes("Want a harder one? It's optional."), 'stretch_challenge matches Prompt 6 wording');

  // 2.2 Verify ALL "Why am I seeing this?" explanations NEVER name an emotion, state, or use "detected"
  Object.entries(details).forEach(([intId, item]) => {
    const whyLower = item.whyExplanation.toLowerCase();
    const msgLower = item.message.toLowerCase();

    // Check for "detected"
    assert(!whyLower.includes('detected') && !msgLower.includes('detected'), `${intId}: Never uses the word "detected"`);

    // Check for state names
    stateNames.forEach(state => {
      assert(!whyLower.includes(state), `${intId}: "Why" explanation never mentions internal state name "${state}"`);
    });
  });
}

// ── Test Suite 3: Student Control in Settings (#/settings) ──
header('Test Suite 3: Student Control & Settings Overrides');
{
  PathStore.clear();

  // 3.1 Default preferences
  const defaultPrefs = PathStore.getPrefs();
  assert(defaultPrefs.checkinsEnabled === true, 'Default: checkinsEnabled is true');
  assert(defaultPrefs.toneOverride === 'Auto', 'Default: toneOverride is Auto');
  assert(defaultPrefs.breakRemindersEnabled === true, 'Default: breakRemindersEnabled is true');

  // 3.2 Tone override: Gentle forces tone='gentle'
  PathStore.setPrefs({ toneOverride: 'Gentle' });
  const gentleSupport = MindsetEngine.getEffectiveSupport();
  assert(gentleSupport.support.tone === 'gentle', 'Tone override "Gentle" forces tone to gentle');

  // 3.3 Tone override: Direct forces tone='challenging'
  PathStore.setPrefs({ toneOverride: 'Direct' });
  const directSupport = MindsetEngine.getEffectiveSupport();
  assert(directSupport.support.tone === 'challenging', 'Tone override "Direct" forces tone to challenging');

  // 3.4 Tone override: Auto delegates to engine assessment
  PathStore.setPrefs({ toneOverride: 'Auto' });
  const autoSupport = MindsetEngine.getEffectiveSupport();
  assert(['neutral', 'gentle', 'challenging'].includes(autoSupport.support.tone), 'Tone override "Auto" dynamically derives from engine');

  // 3.5 Break reminders toggle: when off, suggest_break is suppressed
  PathStore.setPrefs({ breakRemindersEnabled: false });
  // Add events and checkin to trigger lowEnergy (which normally suggests break)
  PathStore.addCheckin({ mood: 'Tired', confidence: 2 });
  PathStore.addEvent({ type: 'step_start', stepId: 's1' });
  PathStore.addEvent({ type: 'step_complete', stepId: 's1' });
  PathStore.addEvent({ type: 'step_complete', stepId: 's2' });

  const effective = MindsetEngine.getEffectiveSupport();
  assert(!effective.interventions.includes('suggest_break'), 'Break reminders OFF suppresses suggest_break');

  // Turn break reminders back on
  PathStore.setPrefs({ breakRemindersEnabled: true });
  const effectiveOn = MindsetEngine.getEffectiveSupport();
  assert(effectiveOn.interventions.includes('suggest_break'), 'Break reminders ON allows suggest_break');

  // 3.6 Delete learning data: clears events, checkins, interventions, and resets prefs
  PathStore.addInterventionRecord({ id: 'suggest_break', action: 'shown' });
  assert(PathStore.getEvents().length > 0, 'Events exist before deletion');
  assert(PathStore.getCheckins().length > 0, 'Checkins exist before deletion');

  PathStore.deleteLearningData();
  assert(PathStore.getEvents().length === 0, 'Events cleared after deleteLearningData()');
  assert(PathStore.getCheckins().length === 0, 'Checkins cleared after deleteLearningData()');
  assert(PathStore.getInterventionsHistory().length === 0, 'Interventions cleared after deleteLearningData()');
  assert(PathStore.getPrefs().toneOverride === 'Auto', 'Prefs reset after deleteLearningData()');
}

// ── Test Suite 4: Safety & Distress Rules ──
header('Test Suite 4: Safety & Distress Rules');
{
  // 4.1 Distress detection
  assert(MindsetEngine.checkDistress("I feel like I want to die from this stress"), 'Detects distress: "want to die"');
  assert(MindsetEngine.checkDistress("I can't take this anymore, feel hopeless"), 'Detects distress: "feel hopeless"');
  assert(MindsetEngine.checkDistress("I want to hurt myself"), 'Detects distress: "hurt myself"');
  assert(!MindsetEngine.checkDistress("How do I delete a node with two children in a BST?"), 'Normal CS question does NOT trigger distress');
  assert(!MindsetEngine.checkDistress("This bug is killing my runtime"), 'Casual coding idiom does NOT trigger false positive distress');

  // 4.2 Supportive distress response: warm message, talk to someone you trust, no phone/email/placeholder, offers continue or pause
  const resp = MindsetEngine.getDistressResponse();
  assert(resp.includes('talk to someone you trust'), 'Distress message encourages student to talk to someone they trust');
  assert(!/\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b/.test(resp), 'Distress message does NOT contain any phone numbers');
  assert(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resp), 'Distress message does NOT contain any email addresses');
  assert(!/\[.*?\]/.test(resp), 'Distress message does NOT contain any placeholder text');
  assert(resp.includes('Would you like to pause studying for today, or continue when you feel ready?'), 'Offers gentle option to continue or pause');
}

// ── Test Suite 5: Humane Interventions & Dismissibility ──
header('Test Suite 5: Humane Interventions & Dismissibility');
{
  PathStore.clear();

  // Test HTML rendering of card
  const cardHtml = MindsetEngine.getInterventionCardHtml('s1');
  assert(typeof cardHtml === 'string', 'getInterventionCardHtml returns HTML string');

  // Test recording an intervention action (dismissed counts towards limits)
  const now = Date.now();
  PathStore.addInterventionRecord({ id: 'suggest_break', action: 'dismissed', timestamp: now });
  const hist = PathStore.getInterventionsHistory();
  assert(hist.length === 1 && hist[0].action === 'dismissed', 'Dismissed intervention is safely recorded');

  // 15-minute global cooldown test
  const tenMinutesLater = now + (10 * 60 * 1000);
  const assess10 = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'step_complete', stepId: 's2' }
  ], [{ mood: 'Tired' }], { now: tenMinutesLater, interventionsHistory: hist });

  assert(assess10.interventions.length === 0, 'Dismissed intervention enforces 15-minute cooldown');
}

// ── Test Suite 6: Multi-Learner Session Simulation ──
header('Test Suite 6: Multi-Learner Sessions (Guess low, Retry 3x, Finish fast)');
{
  const emotionsAndPersonalities = [
    'anxious', 'anxiety', 'sad', 'depressed', 'stupid', 'lazy',
    'impatient', 'arrogant', 'perfectionist', 'frustrated', 'lowconfidence',
    'overconfident', 'disengaged', 'lowenergy', 'detected'
  ];

  // Helper to verify non-diagnostic language
  function verifyHumanCard(intId) {
    const details = MindsetEngine.INTERVENTION_DETAILS[intId];
    assert(!!details, `Intervention ${intId} exists in details dictionary`);
    const whyLower = details.whyExplanation.toLowerCase();
    const msgLower = details.message.toLowerCase();

    assert(!whyLower.includes('detected') && !msgLower.includes('detected'), `${intId}: Never uses the word "detected"`);
    emotionsAndPersonalities.forEach(ep => {
      assert(!whyLower.includes(ep), `${intId}: "Why" explanation never mentions emotion/personality "${ep}"`);
    });
  }

  // 6.1 Learner 1: Guesses low (check-in confidence <= 2 or weak ratings)
  const learnerLow = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'confidence_before', confidenceBefore: 1 },
    { type: 'step_complete', stepId: 's1' }
  ], [{ confidence: 1 }, { confidence: 2 }], {});

  assert(learnerLow.states.some(s => s.id === 'lowConfidence'), 'Learner 1 (Guess low) triggers lowConfidence');
  assert(learnerLow.support.tone === 'gentle', 'Learner 1 receives gentle tone');
  assert(learnerLow.support.pacing === 'slow', 'Learner 1 receives slow pacing');
  assert(learnerLow.support.chunk === 'small', 'Learner 1 receives small chunk size');
  assert(learnerLow.interventions.length > 0, 'Learner 1 receives an intervention');
  learnerLow.interventions.forEach(id => verifyHumanCard(id));

  // 6.2 Learner 2: Retries a quiz 3 times
  const learnerRetry = MindsetEngine.assess([
    { type: 'step_start', stepId: 's1' },
    { type: 'step_complete', stepId: 's1' },
    { type: 'quiz_rated', stepId: 's1', attempts: 3, rating: 'weak' }
  ], [{ confidence: 3 }], {});

  assert(learnerRetry.states.some(s => s.id === 'frustrated'), 'Learner 2 (Retry 3x) triggers frustrated');
  assert(learnerRetry.support.tone === 'gentle', 'Learner 2 receives gentle tone');
  assert(learnerRetry.support.hintPolicy === 'early', 'Learner 2 receives early hints');
  assert(learnerRetry.interventions.length > 0, 'Learner 2 receives an intervention');
  learnerRetry.interventions.forEach(id => verifyHumanCard(id));

  // 6.3 Learner 3: Finishes steps very fast (timeRatio <= 0.3)
  const learnerFast = MindsetEngine.assess([
    { type: 'step_complete', stepId: 's1', timeRatio: 0.2 },
    { type: 'step_complete', stepId: 's2', timeRatio: 0.25 },
    { type: 'step_complete', stepId: 's3', timeRatio: 0.15 },
    { type: 'tutor_message', wordCount: 8 }
  ], [{ confidence: 4 }], {});

  assert(learnerFast.states.some(s => s.id === 'disengaged'), 'Learner 3 (Finish fast) triggers disengaged');
  assert(learnerFast.support.tone === 'neutral', 'Learner 3 receives neutral tone');
  assert(learnerFast.support.pacing === 'fast', 'Learner 3 receives fast pacing');
  assert(learnerFast.interventions.includes('connect_to_goal'), 'Learner 3 receives connect_to_goal intervention');
  learnerFast.interventions.forEach(id => verifyHumanCard(id));
}

// ── Test Summary ──
console.log(`\n======================================================`);
console.log(`  PROMPT 6 ADAPTIVE & HUMANE TESTS SUMMARY:`);
console.log(`  Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log(`======================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL PROMPT 6 TESTS PASSED SUCCESSFULLY! ✓\n');
  process.exit(0);
}
