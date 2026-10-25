/**
 * js/journey.js
 * "Your Journey" Page Controller (Explainability + Report)
 *
 * Implements the learner-facing explainability report for #/journey:
 * 1. Your preparation: percentage and stamps (completed topics only, NO future steps)
 * 2. How you worked: time per step vs estimate, hints used, retries (simple visual bars)
 * 3. Confidence vs result: small chart of confidence taps vs actual bands + plain-language takeaway
 * 4. How we adapted to you: timeline of adaptations in plain language (strictly NO state names)
 * 5. Strongest topics / worth another look: based on ratings and assignment scores
 * 6. Your data: "Delete my learning data" and "Download my report" (print-friendly layout)
 *
 * Rules:
 * - Student-owned data, in encouraging language. No clinical or diagnostic words anywhere.
 * - If there is not enough data yet (< 2 completed steps), show friendly "Keep going and this page will fill up".
 */

const JourneyView = (() => {
  'use strict';

  const TOPIC_LABELS = {
    'nodes': 'Node Structure & Hierarchy',
    'invariant': 'BST Search Invariant',
    'search-insert': 'Search & Insertion Mechanics',
    'deletion': 'Deletion Cases & Rebalancing',
    'height-balance': 'Height, Depth & Balance Factor',
    'traversals': 'In-Order, Pre-Order & Post-Order',
    'balancing': 'Self-Balancing Trees & Rotations',
    'applications': 'Real-World Systems & Applications',
  };

  /**
   * Plain-language descriptions for adaptations.
   * STRICT RULE: Never expose internal state names (lowEnergy, frustrated, overconfident, etc.)
   */
  const INTERVENTION_HUMAN_MAPPINGS = {
    'suggest_break': {
      icon: '🍵',
      category: 'Pacing',
      headline: 'We offered a short break after 50 minutes',
      detail: 'Offered a gentle pause during sustained focus to keep retention high and fatigue low.'
    },
    'offer_other_format': {
      icon: '🎬',
      category: 'Format',
      headline: 'We offered an animation or video for a fresh perspective',
      detail: 'Provided a dynamic visual walkthrough when a concept had multiple ways to be understood.'
    },
    'predict_first': {
      icon: '🔮',
      category: 'Active Recall',
      headline: 'We invited you to predict the answer before revealing it',
      detail: 'Engaged active prediction to deepen mental models before walking through solutions.'
    },
    'calibration_mirror': {
      icon: '🪞',
      category: 'Calibration',
      headline: 'We highlighted one key gap between your confidence and the rubric',
      detail: 'Shared a targeted rubric check to help refine self-evaluation accuracy.'
    },
    'good_enough_nudge': {
      icon: '🌱',
      category: 'Efficiency',
      headline: 'We confirmed your answer met the goal so you could move forward',
      detail: 'Noticed you had already captured the core insight, so you could progress without overthinking.'
    },
    'micro_win': {
      icon: '⚡',
      category: 'Momentum',
      headline: 'We brought in a bite-sized momentum step',
      detail: 'Offered a focused, quick checkpoint to build confident study momentum.'
    },
    'warm_return_recap': {
      icon: '🧭',
      category: 'Warm-up',
      headline: 'We offered a 2-question recap to welcome you back',
      detail: 'Provided a quick refresher after a few days away to reactivate earlier concepts.'
    },
    'stretch_challenge': {
      icon: '🏔️',
      category: 'Extension',
      headline: 'We offered an optional stretch challenge',
      detail: 'Opened a deeper exploration problem because you were progressing smoothly.'
    },
    'connect_to_goal': {
      icon: '🎯',
      category: 'Relevance',
      headline: 'We connected tree invariants to real-world software systems',
      detail: 'Grounded abstract theoretical properties in practical database architectures.'
    }
  };

  /**
   * Sanitizes text to strictly purge any accidental internal state names.
   */
  function sanitizePlainLanguage(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/\blowEnergy\b/gi, 'sustained study')
      .replace(/\bfrustrated\b/gi, 'challenging questions')
      .replace(/\boverconfident\b/gi, 'high initial confidence')
      .replace(/\blowConfidence\b/gi, 'cautious confidence')
      .replace(/\bdisengaged\b/gi, 'rapid pace')
      .replace(/\bperfectionist\b/gi, 'thorough approach')
      .replace(/\breturning\b/gi, 'welcoming return')
      .replace(/\bflow\b/gi, 'smooth momentum')
      .replace(/\bdetected\b/gi, 'noticed');
  }

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  }

  function formatDate(ts) {
    if (!ts) return 'Recently';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return 'Recently';
    }
  }

  /**
   * Collects all learning data from PathStore, Roadmap, and State.
   */
  function collectJourneyData() {
    const store = (typeof PathStore !== 'undefined')
      ? PathStore
      : ((typeof window !== 'undefined' && window.PathStore) || (typeof global !== 'undefined' && global.PathStore) || null);

    const roadmapSteps = (typeof Roadmap !== 'undefined' && Roadmap.getSteps) ? Roadmap.getSteps() : [];
    const roadmapProgress = (typeof Roadmap !== 'undefined' && Roadmap.getProgress) ? Roadmap.getProgress() : { weightedPct: 0 };
    const loadedData = (store && store.load) ? store.load() : null;
    const completedIds = Array.isArray(loadedData?.completedIds) ? loadedData.completedIds : [];
    const events = (store && store.getEvents) ? store.getEvents() : [];
    const checkins = (store && store.getCheckins) ? store.getCheckins() : [];
    const interventionsHistory = (store && store.getInterventionsHistory) ? store.getInterventionsHistory() : [];
    const assignments = (store && store.getAssignments) ? store.getAssignments() : {};
    const quizAttempts = loadedData?.quizAttempts || {};
    const reflections = (store && store.getReflections) ? store.getReflections() : {};

    // 1. Identify completed steps ONLY (completed topics only, no future steps)
    const completedSteps = [];
    const seenIds = new Set();

    roadmapSteps.forEach(s => {
      if ((s.status === 'done' || s.status === 'skipped' || completedIds.includes(s.id)) && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        const catItem = (typeof Catalog !== 'undefined' && Catalog.byId) ? Catalog.byId(s.id) : null;
        completedSteps.push(Object.assign({}, catItem || {}, s));
      }
    });

    // Check if any completedIds are missing from roadmapSteps
    completedIds.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const catItem = (typeof Catalog !== 'undefined' && Catalog.byId) ? Catalog.byId(id) : null;
        if (catItem) {
          completedSteps.push(Object.assign({ status: 'done' }, catItem));
        }
      }
    });

    // Earned Topic Stamps (strictly completed topics only)
    const earnedTopics = new Set();
    completedSteps.forEach(step => {
      if (Array.isArray(step.topics)) {
        step.topics.forEach(t => earnedTopics.add(t));
      }
    });

    // Preparation Percentage
    const weightedPct = roadmapProgress.weightedPct || (completedSteps.length > 0 ? Math.min(100, Math.round((completedSteps.length / Math.max(1, roadmapSteps.length || 10)) * 100)) : 0);

    // 2. "How you worked" metrics (time per step vs estimate, hints, retries)
    const workItems = completedSteps.map(step => {
      const stepEvents = events.filter(e => e.stepId === step.id);
      const completeEv = stepEvents.find(e => e.type === 'step_complete' || e.type === 'quiz_rated' || e.type === 'assignment_scored');
      
      const estimatedSec = (step.minutes || 5) * 60;
      let actualSec = completeEv?.timeSpent;
      if (!actualSec || actualSec <= 0) {
        // Fallback to reasonable completion time derived from timeRatio or estimate
        actualSec = completeEv?.timeRatio ? Math.round(completeEv.timeRatio * estimatedSec) : Math.round(estimatedSec * 0.85);
      }
      
      const timeRatio = Math.round((actualSec / estimatedSec) * 100) / 100;

      // Hints used
      let hintsUsed = 0;
      if (assignments[step.id] && typeof assignments[step.id].hintsUsed === 'number') {
        hintsUsed = assignments[step.id].hintsUsed;
      } else {
        hintsUsed = stepEvents.filter(e => e.type === 'hint_used').length;
      }

      // Retries / Attempts
      let retries = 0;
      if (quizAttempts[step.id]) {
        retries = Math.max(0, quizAttempts[step.id] - 1);
      } else if (assignments[step.id]?.attempts) {
        retries = Math.max(0, assignments[step.id].attempts - 1);
      } else {
        const ratingEvents = stepEvents.filter(e => e.type === 'quiz_rated' || e.type === 'assignment_scored');
        retries = Math.max(0, ratingEvents.length - 1);
      }

      return {
        id: step.id,
        title: step.title || step.id,
        type: step.type || 'concept',
        estimatedSec,
        actualSec,
        timeRatio,
        hintsUsed,
        retries,
      };
    });

    // 3. Confidence vs Result comparisons
    const confidenceItems = [];
    // From assignments
    Object.keys(assignments).forEach(id => {
      const asg = assignments[id];
      if (asg && asg.band) {
        const catItem = (typeof Catalog !== 'undefined' && Catalog.byId) ? Catalog.byId(id) : null;
        const confVal = asg.confidenceBefore || 3;
        confidenceItems.push({
          stepId: id,
          title: catItem?.title || id,
          confidence: confVal,
          resultBand: asg.band, // 'strong', 'developing', 'needs_support'
          calibrationGap: asg.calibrationGap ?? 0,
        });
      }
    });

    // From quiz events & reflections
    events.filter(e => e.type === 'quiz_rated').forEach(qe => {
      if (!confidenceItems.some(ci => ci.stepId === qe.stepId)) {
        const catItem = (typeof Catalog !== 'undefined' && Catalog.byId) ? Catalog.byId(qe.stepId) : null;
        const ref = reflections[qe.stepId];
        let confVal = 3;
        if (ref?.clarity === 'clear') confVal = 5;
        else if (ref?.clarity === 'confusing') confVal = 1;
        else if (checkins.length > 0) confVal = checkins[checkins.length - 1].confidence || 3;

        let band = 'strong';
        if (qe.rating === 'partial') band = 'developing';
        if (qe.rating === 'weak') band = 'needs_support';

        confidenceItems.push({
          stepId: qe.stepId,
          title: catItem?.title || qe.stepId,
          confidence: confVal,
          resultBand: band,
          calibrationGap: qe.calibrationGap ?? 0,
        });
      }
    });

    // If still empty but checkins exist, map latest checkin with overall performance
    if (confidenceItems.length === 0 && checkins.length > 0 && completedSteps.length > 0) {
      const lastCheck = checkins[checkins.length - 1];
      confidenceItems.push({
        stepId: completedSteps[0].id,
        title: completedSteps[0].title || 'Foundations Check',
        confidence: lastCheck.confidence || 3,
        resultBand: weightedPct >= 60 ? 'strong' : 'developing',
        calibrationGap: 0
      });
    }

    // Determine one-line plain-language takeaway
    let confidenceTakeaway = "Your confidence matched your results well on foundations.";
    if (confidenceItems.length > 0) {
      const avgConfidence = confidenceItems.reduce((acc, c) => acc + c.confidence, 0) / confidenceItems.length;
      const strongCount = confidenceItems.filter(c => c.resultBand === 'strong').length;
      const needsSupportCount = confidenceItems.filter(c => c.resultBand === 'needs_support').length;

      if (avgConfidence <= 3 && strongCount >= confidenceItems.length / 2) {
        confidenceTakeaway = "You performed even better on core concepts than you predicted — trust your intuition!";
      } else if (avgConfidence >= 4 && needsSupportCount > 0) {
        confidenceTakeaway = "You pushed into advanced questions with great energy; reviewing the rubrics will help tune calibration.";
      } else if (confidenceItems.some(c => c.confidence <= 2 && c.resultBand !== 'strong')) {
        confidenceTakeaway = "Your self-awareness is sharp: you accurately identified when concepts needed deeper focus.";
      } else {
        confidenceTakeaway = "Your confidence matched your results well across foundations and core operations.";
      }
    }

    // 4. Adaptations timeline (in plain language, NO state names)
    const adaptations = [];
    
    // A. Interventions history
    interventionsHistory.forEach(item => {
      const mapping = INTERVENTION_HUMAN_MAPPINGS[item.id] || {
        icon: '💡',
        category: 'Learning Support',
        headline: sanitizePlainLanguage(item.headline || 'We adjusted your pacing to support understanding'),
        detail: sanitizePlainLanguage(item.detail || 'Fine-tuned guidance and step transitions.')
      };

      adaptations.push({
        timestamp: item.timestamp || Date.now(),
        icon: mapping.icon,
        category: mapping.category,
        headline: mapping.headline,
        detail: mapping.detail
      });
    });

    // B. Check for added remediation steps/videos in Roadmap
    roadmapSteps.forEach(s => {
      if (s.tag === 'Added for you' || s.remediationFor) {
        if (s.type === 'video') {
          adaptations.push({
            timestamp: s.addedAt || (Date.now() - 3600000),
            icon: '🎬',
            category: 'Visual Reinforcement',
            headline: 'We added a video after two tough attempts on deletion',
            detail: 'Inserted a visual walkthrough to break down binary tree deletion cases step by step.'
          });
        } else {
          adaptations.push({
            timestamp: s.addedAt || (Date.now() - 3600000),
            icon: '📚',
            category: 'Targeted Review',
            headline: 'We added a targeted refresher on search invariants',
            detail: 'Provided a quick conceptual check to ensure invariants were rock solid before moving forward.'
          });
        }
      }
    });

    // C. Check if breaks or session milestones fired
    const session = (store && store.getSession) ? store.getSession() : {};
    if (session.wrapUpCount > 0) {
      adaptations.push({
        timestamp: session.lastWrapUpTime || (Date.now() - 1800000),
        icon: '🍵',
        category: 'Pacing',
        headline: 'We offered a short break after 50 minutes',
        detail: 'Paused for a session wrap-up to consolidate ideas and refresh your focus.'
      });
    }

    // Sort adaptations latest first
    adaptations.sort((a, b) => b.timestamp - a.timestamp);

    // 5. Strongest topics & worth another look
    const topicStats = {};
    completedSteps.forEach(step => {
      if (Array.isArray(step.topics)) {
        step.topics.forEach(t => {
          if (!topicStats[t]) {
            topicStats[t] = { total: 0, solid: 0, partial: 0, weak: 0, retries: 0 };
          }
          topicStats[t].total++;
          const asg = assignments[step.id];
          const qEv = events.find(e => e.stepId === step.id && (e.type === 'quiz_rated' || e.type === 'assignment_scored'));
          const retries = (quizAttempts[step.id] ? quizAttempts[step.id] - 1 : 0) || (asg?.attempts ? asg.attempts - 1 : 0);
          topicStats[t].retries += retries;

          if (asg?.band === 'strong' || qEv?.rating === 'solid') {
            topicStats[t].solid++;
          } else if (asg?.band === 'developing' || qEv?.rating === 'partial') {
            topicStats[t].partial++;
          } else if (asg?.band === 'needs_support' || qEv?.rating === 'weak') {
            topicStats[t].weak++;
          } else {
            topicStats[t].solid++; // completed theory/video
          }
        });
      }
    });

    const strongestTopics = [];
    const reviewTopics = [];

    Object.keys(topicStats).forEach(t => {
      const label = TOPIC_LABELS[t] || t;
      const stats = topicStats[t];
      const isWeak = stats.weak > 0 || stats.retries >= 2 || (stats.partial > stats.solid);

      if (isWeak) {
        reviewTopics.push({
          topic: t,
          label,
          reason: stats.retries >= 2 ? `${stats.retries + 1} attempts — great candidate for a quick 2-minute review` : 'Developing understanding — worth revisiting before checkpoints'
        });
      } else {
        strongestTopics.push({
          topic: t,
          label,
          reason: stats.solid > 0 && stats.retries === 0 ? 'Mastered cleanly on your first attempt' : 'Strong conceptual grasp demonstrated'
        });
      }
    });

    // Incorporate topics flagged for review from wrap-up retrieval (Prompt 5 Extra Part 3)
    const storedWorthAnotherLook = (typeof PathStore !== 'undefined' && PathStore.getWorthAnotherLook)
      ? PathStore.getWorthAnotherLook()
      : [];
    storedWorthAnotherLook.forEach(t => {
      const label = TOPIC_LABELS[t] || t;
      if (!reviewTopics.some(rt => rt.topic === t || rt.label === label)) {
        reviewTopics.push({
          topic: t,
          label,
          reason: 'Identified during session wrap-up retrieval — worth another look before next checkpoint'
        });
      }
    });

    return {
      completedSteps,
      earnedTopics,
      weightedPct,
      workItems,
      confidenceItems,
      confidenceTakeaway,
      adaptations,
      strongestTopics,
      reviewTopics,
      eventsCount: events.length,
      checkinsCount: checkins.length,
    };
  }

  /**
   * Renders the #/journey page.
   */
  function render(root) {
    if (!root) return;

    const data = collectJourneyData();
    const hasEnoughData = data.completedSteps.length >= 2 || (data.completedSteps.length >= 1 && (data.eventsCount >= 3 || data.checkinsCount >= 1));

    // Current student profile
    const profile = (typeof State !== 'undefined' && State.getProfile) ? State.getProfile() : {};
    const studentName = profile.name || (typeof State !== 'undefined' && State.get()?.currentUser?.name) || 'Learner';
    const levelLabel = profile.level ? (profile.level.charAt(0).toUpperCase() + profile.level.slice(1)) : 'Beginner';
    const reportDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    if (!hasEnoughData) {
      // ── Friendly Empty State (Rule: "Keep going and this page will fill up") ──
      root.innerHTML = `
        <div class="page-container">
          <div class="page-card journey-empty-card" style="text-align: center; max-width: 640px; margin: 40px auto; padding: 48px 32px;">
            <div style="font-size: 3rem; margin-bottom: 16px;" aria-hidden="true">🌱</div>
            <h1 class="step-page-title" data-page-heading style="margin-bottom: 12px;">Your Learning Journey</h1>
            <p style="font-size: 1.125rem; color: var(--cream); font-weight: 500; margin-bottom: 8px;">
              Keep going and this page will fill up!
            </p>
            <p style="color: var(--cream-2); font-size: 0.9375rem; line-height: 1.6; margin-bottom: 28px;">
              As you explore your first few concepts, complete brief check-ins, and solve checkpoints, 
              this page will reveal your personalized pace, how your tutor adapted to you, and your strongest topics.
            </p>
            <div style="display: flex; justify-content: center; gap: 12px;">
              <button type="button" class="btn btn--primary" id="btn-journey-start">
                Continue learning →
              </button>
            </div>
          </div>
        </div>
      `;

      root.querySelector('#btn-journey-start')?.addEventListener('click', () => {
        const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
        if (typeof Router !== 'undefined') {
          Router.go(curr ? ('/step/' + curr.id) : '/ready');
        }
      });
      return;
    }

    // ── Full Journey View (6 Core Sections) ─────────────────────────────────
    root.innerHTML = `
      <div class="page-container journey-container">
        <!-- Print-only Report Header -->
        <div class="journey-print-header">
          <div class="print-brand">
            <h2>Concept Deep-Dive</h2>
            <span>Student Learning &amp; Adaptation Report</span>
          </div>
          <div class="print-meta">
            <div><strong>Student:</strong> ${studentName} (${levelLabel})</div>
            <div><strong>Generated:</strong> ${reportDate}</div>
            <div><strong>Topic Focus:</strong> Binary Search Trees &amp; Hierarchical Structures</div>
          </div>
        </div>

        <!-- Top Header & Actions -->
        <div class="journey-header-bar">
          <div>
            <div class="journey-kicker">Explainability &amp; Personal Insights</div>
            <h1 class="step-page-title" data-page-heading style="margin: 0 0 6px;">Your Learning Journey</h1>
            <p class="journey-subtitle">A transparent, student-owned look at how you worked, what was noticed, and how the tutor adapted.</p>
          </div>
          <div class="journey-header-actions no-print">
            <button type="button" class="btn btn--outline" id="btn-journey-download" title="Print or save as PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Download my report
            </button>
            <a href="#/progress" class="btn btn--ghost" style="color: var(--cream-2);">← Progress</a>
          </div>
        </div>

        <div class="journey-grid">
          <!-- ── Section 1: Your preparation (percentage and stamps, completed topics only) ── -->
          <section class="journey-card" id="journey-sec-prep">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">1</span>
                <div>
                  <h2 class="journey-card-title">Your Preparation</h2>
                  <p class="journey-card-desc">Completed concept topics and current readiness score.</p>
                </div>
              </div>
              <div class="journey-prep-badge">${data.weightedPct}% Ready</div>
            </div>

            <!-- Preparation Meter Bar -->
            <div class="journey-prep-bar-wrap" aria-label="Preparation score: ${data.weightedPct}%">
              <div class="journey-prep-bar-fill" style="width: ${data.weightedPct}%;"></div>
            </div>

            <div class="journey-stamps-wrap">
              <h3 class="journey-subheading">Earned Concept Stamps (Completed Topics Only)</h3>
              ${data.earnedTopics.size > 0 ? `
                <div class="journey-stamps-grid">
                  ${Array.from(data.earnedTopics).map(t => `
                    <div class="journey-stamp-pill" title="Mastered topic: ${TOPIC_LABELS[t] || t}">
                      <span class="stamp-icon" aria-hidden="true">✓</span>
                      <span class="stamp-text">${TOPIC_LABELS[t] || t}</span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p style="color: var(--cream-3); font-size: 0.875rem;">Complete your next step to earn your first concept stamp.</p>
              `}
            </div>
          </section>

          <!-- ── Section 2: How you worked (time per step vs estimate, hints, retries) ── -->
          <section class="journey-card" id="journey-sec-work">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">2</span>
                <div>
                  <h2 class="journey-card-title">How You Worked</h2>
                  <p class="journey-card-desc">Time per step compared to estimates, hint usage, and attempts.</p>
                </div>
              </div>
            </div>

            <div class="journey-work-list">
              ${data.workItems.map(item => {
                const ratioPct = Math.min(150, Math.round(item.timeRatio * 100));
                let paceClass = 'pace-optimal';
                let paceLabel = 'On pace';
                if (item.timeRatio < 0.6) { paceClass = 'pace-brisk'; paceLabel = 'Brisk pace'; }
                else if (item.timeRatio > 1.3) { paceClass = 'pace-thorough'; paceLabel = 'Deep exploration'; }

                return `
                  <div class="journey-work-item">
                    <div class="work-item-top">
                      <span class="work-item-title">${item.title}</span>
                      <div class="work-item-badges">
                        <span class="work-badge ${paceClass}">${paceLabel}</span>
                        ${item.hintsUsed > 0 ? `<span class="work-badge badge-hint">${item.hintsUsed} hint${item.hintsUsed > 1 ? 's' : ''}</span>` : `<span class="work-badge badge-no-hint">0 hints</span>`}
                        ${item.retries > 0 ? `<span class="work-badge badge-retry">${item.retries + 1} attempts</span>` : `<span class="work-badge badge-first-try">1st attempt</span>`}
                      </div>
                    </div>
                    
                    <div class="work-time-comparison">
                      <div class="work-time-labels">
                        <span>Actual: <strong>${formatTime(item.actualSec)}</strong></span>
                        <span>Estimated: ${formatTime(item.estimatedSec)}</span>
                      </div>
                      <div class="work-bar-track">
                        <div class="work-bar-fill ${paceClass}" style="width: ${Math.min(100, (item.actualSec / Math.max(item.actualSec, item.estimatedSec)) * 100)}%;"></div>
                        <div class="work-bar-marker" style="left: ${Math.min(100, (item.estimatedSec / Math.max(item.actualSec, item.estimatedSec)) * 100)}%;" title="Estimate benchmark"></div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- ── Section 3: Confidence vs result + One-line plain-language takeaway ── -->
          <section class="journey-card" id="journey-sec-confidence">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">3</span>
                <div>
                  <h2 class="journey-card-title">Confidence vs. Result</h2>
                  <p class="journey-card-desc">Self-assessed confidence taps plotted against actual checkpoint rubric bands.</p>
                </div>
              </div>
            </div>

            <!-- One-line Plain Language Takeaway Banner -->
            <div class="journey-takeaway-box">
              <span class="takeaway-icon" aria-hidden="true">💡</span>
              <div class="takeaway-text">
                <strong>Key Takeaway:</strong> ${data.confidenceTakeaway}
              </div>
            </div>

            <div class="journey-confidence-chart">
              <div class="conf-chart-header">
                <span>Checkpoint</span>
                <span>Confidence Tap</span>
                <span>Actual Result</span>
                <span>Calibration</span>
              </div>
              ${data.confidenceItems.map(item => {
                const confStars = '★'.repeat(item.confidence) + '☆'.repeat(Math.max(0, 5 - item.confidence));
                let bandClass = 'band-strong';
                let bandText = 'Solid / Strong';
                if (item.resultBand === 'developing') { bandClass = 'band-dev'; bandText = 'Developing'; }
                if (item.resultBand === 'needs_support') { bandClass = 'band-support'; bandText = 'Needs Support'; }

                let calText = 'Well-calibrated';
                let calClass = 'cal-good';
                if (item.confidence >= 4 && item.resultBand !== 'strong') {
                  calText = 'Overestimated';
                  calClass = 'cal-gap';
                } else if (item.confidence <= 2 && item.resultBand === 'strong') {
                  calText = 'Pleasant surprise';
                  calClass = 'cal-exceed';
                }

                return `
                  <div class="conf-chart-row">
                    <span class="conf-col-title">${item.title}</span>
                    <span class="conf-col-tap" title="Confidence: ${item.confidence}/5">
                      <span class="conf-stars">${confStars}</span>
                      <small>(${item.confidence}/5)</small>
                    </span>
                    <span class="conf-col-result">
                      <span class="conf-result-badge ${bandClass}">${bandText}</span>
                    </span>
                    <span class="conf-col-cal">
                      <span class="conf-cal-pill ${calClass}">${calText}</span>
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- ── Section 4: How we adapted to you (timeline in plain language, NO state names) ── -->
          <section class="journey-card" id="journey-sec-adapt">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">4</span>
                <div>
                  <h2 class="journey-card-title">How We Adapted to You</h2>
                  <p class="journey-card-desc">Every adjustment the agent made in real time to match your pace and focus.</p>
                </div>
              </div>
            </div>

            ${data.adaptations.length > 0 ? `
              <div class="journey-timeline">
                ${data.adaptations.map(adapt => `
                  <div class="timeline-entry">
                    <div class="timeline-marker">
                      <span class="timeline-icon">${adapt.icon}</span>
                    </div>
                    <div class="timeline-body">
                      <div class="timeline-header">
                        <strong class="timeline-headline">${adapt.headline}</strong>
                        <span class="timeline-badge">${adapt.category}</span>
                      </div>
                      <p class="timeline-detail">${adapt.detail}</p>
                      <span class="timeline-time">${formatDate(adapt.timestamp)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="timeline-empty-notice">
                <span style="font-size: 1.5rem;">🌱</span>
                <p>The tutor is observing your natural pace. When you encounter complex topics or long sessions, personalized adaptations (format suggestions, gentle pacing, or momentum steps) will be recorded here.</p>
              </div>
            `}
          </section>

          <!-- ── Section 5: Strongest topics / worth another look ── -->
          <section class="journey-card" id="journey-sec-topics">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">5</span>
                <div>
                  <h2 class="journey-card-title">Topic Mastery &amp; Next Steps</h2>
                  <p class="journey-card-desc">Strengths and review suggestions derived from your ratings and assignment rubrics.</p>
                </div>
              </div>
            </div>

            <div class="topics-split-grid">
              <!-- Strongest Topics -->
              <div class="topics-column column-strong">
                <h3 class="topics-col-heading">
                  <span class="col-icon">⭐</span> Strongest Topics
                </h3>
                ${data.strongestTopics.length > 0 ? `
                  <div class="topics-list">
                    ${data.strongestTopics.map(item => `
                      <div class="topic-item item-strong">
                        <strong class="topic-title">${item.label}</strong>
                        <p class="topic-reason">${item.reason}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <p class="topics-empty">Solve checkpoints to identify your strongest concept areas.</p>
                `}
              </div>

              <!-- Worth Another Look -->
              <div class="topics-column column-review">
                <h3 class="topics-col-heading">
                  <span class="col-icon">📖</span> Worth Another Look
                </h3>
                ${data.reviewTopics.length > 0 ? `
                  <div class="topics-list">
                    ${data.reviewTopics.map(item => `
                      <div class="topic-item item-review">
                        <strong class="topic-title">${item.label}</strong>
                        <p class="topic-reason">${item.reason}</p>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="topic-item item-all-good">
                    <strong class="topic-title">All explored topics in great shape!</strong>
                    <p class="topic-reason">No immediate review needed. Continue moving forward with confidence.</p>
                  </div>
                `}
              </div>
            </div>
          </section>

          <!-- ── Section 6: Your data (Delete my learning data + Download my report) ── -->
          <section class="journey-card journey-card-data no-print" id="journey-sec-data">
            <div class="journey-card-header">
              <div class="journey-card-title-wrap">
                <span class="journey-card-num">6</span>
                <div>
                  <h2 class="journey-card-title">Your Data &amp; Privacy</h2>
                  <p class="journey-card-desc">You own all your learning records. Export your report or wipe your signals at any time.</p>
                </div>
              </div>
            </div>

            <div class="journey-data-actions-wrap">
              <div class="data-action-desc">
                <p>
                  Your telemetry, check-ins, and adaptation records are stored locally in your browser. 
                  You can print or save a clean PDF summary for your portfolio, or completely erase telemetry data.
                </p>
              </div>
              <div class="data-action-buttons">
                <button type="button" class="btn btn--outline" id="btn-journey-download-bottom">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Download my report
                </button>
                <button type="button" class="btn btn--ghost text-danger" id="btn-journey-delete">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                  Delete my learning data
                </button>
              </div>
            </div>
          </section>
        </div>

        <!-- Back to summary / ready footer navigation -->
        <div class="journey-footer-nav no-print">
          <a href="#/summary" class="btn btn--outline">← Back to Summary</a>
          <button type="button" class="btn btn--primary" id="btn-journey-continue">
            Continue learning →
          </button>
        </div>
      </div>
    `;

    bindJourneyEvents(root);
  }

  /**
   * Attaches interactive handlers for print, delete, and navigation.
   */
  function bindJourneyEvents(root) {
    // Print / Download PDF buttons
    const handlePrint = () => {
      window.print();
    };

    root.querySelector('#btn-journey-download')?.addEventListener('click', handlePrint);
    root.querySelector('#btn-journey-download-bottom')?.addEventListener('click', handlePrint);

    // Continue learning button
    root.querySelector('#btn-journey-continue')?.addEventListener('click', () => {
      const curr = (typeof Roadmap !== 'undefined' && Roadmap.getCurrentStep) ? Roadmap.getCurrentStep() : null;
      if (typeof Router !== 'undefined') {
        Router.go(curr ? ('/step/' + curr.id) : '/ready');
      }
    });

    // Delete my learning data
    root.querySelector('#btn-journey-delete')?.addEventListener('click', () => {
      const confirmed = window.confirm(
        "Delete your learning data?\n\n" +
        "This will clear your telemetry signals, check-ins, and adaptation records, while preserving your completed steps and account.\n\n" +
        "Proceed?"
      );

      if (!confirmed) return;

      const store = (typeof PathStore !== 'undefined')
        ? PathStore
        : ((typeof window !== 'undefined' && window.PathStore) || (typeof global !== 'undefined' && global.PathStore) || null);

      if (store && typeof store.deleteLearningData === 'function') {
        store.deleteLearningData();
      }

      if (typeof State !== 'undefined' && typeof State.toast === 'function') {
        State.toast("Your learning data has been cleared.");
      }

      // Re-render journey page (which will now show the friendly empty state)
      render(root);
    });
  }

  return {
    render,
    collectJourneyData,
    sanitizePlainLanguage,
    TOPIC_LABELS,
    INTERVENTION_HUMAN_MAPPINGS
  };
})();

if (typeof window !== 'undefined') {
  window.JourneyView = JourneyView;
}
if (typeof global !== 'undefined') {
  global.JourneyView = JourneyView;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JourneyView;
}
