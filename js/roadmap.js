/**
 * js/roadmap.js
 * One-by-One Roadmap Controller for Concept Deep-Dive.
 *
 * Responsibilities:
 *  - Generates personalized path via PathEngine.generate(level, placement)
 *  - Renders vertical timeline of step cards
 *  - Manages card statuses: locked, current, done, skipped
 *  - Renders type-specific interactive components for the current card:
 *      * theory: foundations section reader with bottom-scroll detection
 *      * video: HTML5 player completing on ended or >=90% watched
 *      * lecture/book/paper: resource link with 20-second countdown to finish
 *      * quiz: assessment panel evaluated via Gemini API / Socratic evaluator
 *  - Calculates weighted progress: (completed+skipped)/total*60 + 20 (summary) + 20 (animations)
 *  - Syncs AI Tutor context to current step
 *  - Restores progress across refreshes via localStorage ('cdd_roadmap_progress')
 */

const Roadmap = (() => {
  'use strict';

  let _path = [];           // Array<{ id, reason }>
  let _stepStates = [];     // Array<{ id, status: 'locked'|'current'|'done'|'skipped', reason, tag?: string }>
  let _currentIndex = 0;
  let _resourceTimers = {}; // { [stepId]: { interval, remaining } }
  let _reviewExpanded = {}; // { [stepId]: boolean }
  let _remediationCounts = {}; // { [quizItemId]: number }
  let _activeQuizFeedback = {}; // { [quizItemId]: string (rendered HTML) }
  let _activeQuizConfidence = {}; // { [quizItemId]: number|null }
  let _quizAttempts = {}; // { [quizItemId]: number }

  /* ── Icons by type ───────────────────────────────────────────────────── */
  const TYPE_ICONS = {
    theory: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    lecture: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    book: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    paper: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    quiz: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  /* ── Theory section id map ───────────────────────────────────────────── */
  const THEORY_SECTION_IDS = {
    'th-nodes': 'found-sec-th-nodes',
    'th-invariant': 'found-sec-th-invariant',
    'th-height': 'found-sec-th-height',
    'th-balance': 'found-sec-th-balance',
    'th-traversal': 'found-sec-th-traversal',
  };

  /* ── Load / Save progress via PathStore ──────────────────────────────── */
  function _saveProgress(level) {
    if (typeof PathStore !== 'undefined') {
      const profile = (typeof State !== 'undefined' && State.getProfile) ? State.getProfile() : { level };
      const completedIds = _stepStates.filter(s => s.status === 'done').map(s => s.id);
      const skippedIds = _stepStates.filter(s => s.status === 'skipped').map(s => s.id);
      const insertedIds = _stepStates.filter(s => s.tag === 'Added for you' || s.remediationFor).map(s => s.id);

      const stepDetails = {};
      _stepStates.forEach(s => {
        if (s.reason || s.tag || s.remediationFor) {
          stepDetails[s.id] = {
            reason: s.reason,
            tag: s.tag,
            remediationFor: s.remediationFor,
          };
        }
      });

      const videoPositions = (typeof State !== 'undefined' && State.get) ? (State.get().videoPositions || {}) : {};
      const summaryGenerated = Boolean(typeof State !== 'undefined' && State.get && State.get().summary);

      PathStore.save({
        profile: {
          level: (profile && profile.level) || level || 'beginner',
          selfReportedLevel: profile?.selfReportedLevel || null,
          placement: profile?.placement || null,
        },
        path: _stepStates.map(s => s.id),
        completedIds,
        skippedIds,
        insertedIds,
        quizAttempts: _remediationCounts,
        videoPositions,
        summaryGenerated,
        currentIndex: _currentIndex,
        stepDetails,
      });
    }
  }

  function _loadProgress() {
    if (typeof PathStore !== 'undefined') {
      return PathStore.load();
    }
    return null;
  }

  /* ── Weighted progress calculation ───────────────────────────────────── */
  function getProgress() {
    const total = _stepStates.length;
    if (total === 0) return { weightedPct: 0, completedCount: 0, total: 0, pathComplete: false };

    const finished = _stepStates.filter(s => s.status === 'done' || s.status === 'skipped').length;
    const completedCount = _stepStates.filter(s => s.status === 'done').length;

    // 1. Path steps = 60%
    const pathWeight = (finished / total) * 60;

    // 2. Summary = 20%
    const hasSummary = Boolean(typeof State !== 'undefined' && State.get().summary);
    const summaryWeight = hasSummary ? 20 : 0;

    // 3. Animations = 20%
    let animWeight = 0;
    if (typeof State !== 'undefined') {
      const vp = State.getVideoProgress();
      const watchedCount = [1, 2, 3].filter(idx => vp[idx]).length;
      animWeight = (watchedCount / 3) * 20;
    }

    const weightedPct = Math.min(100, Math.round(pathWeight + summaryWeight + animWeight));
    const pathComplete = finished === total;

    return {
      weightedPct,
      finished,
      completedCount,
      total,
      pathComplete,
    };
  }

  /* ── Sync Header & Sidebar UI ────────────────────────────────────────── */
  function syncStatsUI() {
    const { weightedPct, finished, completedCount, total, pathComplete } = getProgress();

    // Header numbers
    const elCompleted = document.getElementById('stat-completed');
    const elUnit      = document.getElementById('stat-total');
    const elPercent   = document.getElementById('stat-percent');
    const ringFill    = document.getElementById('progress-ring-fill');
    const elSidebar   = document.getElementById('sidebar-progress');

    if (elCompleted) elCompleted.textContent = String(completedCount);
    if (elUnit)      elUnit.textContent = `/ ${total}`;
    if (elPercent)   elPercent.textContent = `${weightedPct}%`;
    if (elSidebar)   elSidebar.textContent = `${completedCount} of ${total} steps`;

    if (ringFill) {
      ringFill.style.strokeDashoffset = String(100 - weightedPct);
    }

    // Mini milestone chips in header (4 milestone segments)
    [0, 1, 2, 3].forEach(i => {
      const threshold = (i + 1) * 0.25;
      const isDone = (finished / total) >= threshold || pathComplete;
      const chip = document.getElementById(`chip-${i}`);
      const line = document.getElementById(`chipline-${i}`);
      if (chip) chip.classList.toggle('progress-chip--done', isDone);
      if (line) line.classList.toggle('progress-chip-line--filled', isDone);
    });

    // Summary & Animations sidebar link unlock state
    const synthBadge = document.getElementById('synthesis-nav-badge');
    const synthNav = document.getElementById('nav-synthesis');
    if (synthBadge) {
      if (pathComplete) {
        synthBadge.textContent = 'Ready';
        synthBadge.classList.add('sidebar-link-badge--unlocked');
      } else {
        synthBadge.textContent = 'Locked';
        synthBadge.classList.remove('sidebar-link-badge--unlocked');
      }
    }

    // Completion CTA banner
    const cta = document.getElementById('completion-cta');
    if (cta) {
      cta.hidden = !pathComplete;
    }
  }

  /* ── Sync AI Tutor dropdown & context ────────────────────────────────── */
  function syncTutorContext() {
    const select = document.getElementById('tutor-stage-select');
    if (!select || _stepStates.length === 0) return;

    select.innerHTML = '';
    _stepStates.forEach((st, idx) => {
      // HIDE FUTURE STEPS: only show current and completed steps
      if (st.status === 'locked') return;
      const item = typeof Catalog !== 'undefined' ? Catalog.byId(st.id) : null;
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `Concept: ${item ? item.title : st.id}`;
      select.appendChild(opt);
    });

    select.value = String(_currentIndex);

    // Update active topic in state for AI tutor prompt
    const currStep = _stepStates[_currentIndex];
    if (currStep && typeof Catalog !== 'undefined') {
      const item = Catalog.byId(currStep.id);
      if (item && typeof State !== 'undefined') {
        State.setState({ currentTopic: `${item.title} (${item.topics.join(', ')})` });
      }
    }
  }

  /* ── Particle Burst Animation ────────────────────────────────────────── */
  function particleBurst(el) {
    if (!el || typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (i / 12) * Math.PI * 2;
      const dist = 32 + Math.random() * 26;
      p.style.cssText = `left:${cx}px;top:${cy}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;`;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }

  /* ── Step Card Rendering ─────────────────────────────────────────────── */

  function renderCard(stepState, index, isCurrent, isDone, isSkipped, isLocked) {
    const item = typeof Catalog !== 'undefined' ? Catalog.byId(stepState.id) : null;
    if (!item) return '';

    const stepNum = String(index + 1).padStart(2, '0');
    const typeIcon = TYPE_ICONS[item.type] || '';
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    const durationText = item.minutes ? `${item.minutes} min` : '';
    const isExpanded = isCurrent || (_reviewExpanded[item.id] && isDone);

    // Status pill HTML
    let statusPillHtml = '';
    if (isCurrent) {
      statusPillHtml = `<span class="roadmap-status-pill roadmap-status-pill--current">● Current Step</span>`;
    } else if (isDone) {
      const isRemediating = _stepStates.some(s => s.remediationFor === item.id && s.status !== 'done' && s.status !== 'skipped');
      const pillLabel = isRemediating ? '⏳ Review in progress' : '✓ Done';
      const pillStyle = isRemediating ? 'style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);"' : '';
      statusPillHtml = `
        <span class="roadmap-status-pill roadmap-status-pill--done" ${pillStyle}>${pillLabel}</span>
        <button type="button" class="roadmap-review-btn" data-action="toggle-review" data-id="${item.id}">
          ${_reviewExpanded[item.id] ? '▲ Hide' : '▼ Review'}
        </button>
      `;
    } else if (isSkipped) {
      const skipLabel = stepState.tag === 'Skipped (mastered)' ? '↷ Skipped (mastered)' : '↷ Skipped';
      statusPillHtml = `<span class="roadmap-status-pill roadmap-status-pill--skipped">${skipLabel}</span>`;
    } else {
      statusPillHtml = `<span class="roadmap-status-pill roadmap-status-pill--locked"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V3.5a2 2 0 014 0v2"/></svg> Locked</span>`;
    }

    // Node Ring HTML
    let nodeRingHtml = `<div class="roadmap-node-dot"></div>`;
    if (isDone) {
      nodeRingHtml = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>`;
    } else if (isLocked) {
      nodeRingHtml = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V3.5a2 2 0 014 0v2"/></svg>`;
    }

    // Adaptation tag badge HTML
    let tagBadgeHtml = '';
    if (stepState.tag) {
      const isAdded = stepState.tag.includes('Added');
      const tagCls = isAdded ? 'roadmap-adaptation-tag--added' : 'roadmap-adaptation-tag--skipped';
      tagBadgeHtml = `<span class="roadmap-adaptation-tag ${tagCls}">${stepState.tag}</span>`;
    }

    return `
      <article class="roadmap-card" data-step-id="${item.id}" data-index="${index}" data-status="${stepState.status}">
        <!-- Rail -->
        <div class="roadmap-rail" aria-hidden="true">
          <div class="roadmap-node-ring" id="node-ring-${item.id}">
            ${nodeRingHtml}
          </div>
          ${index < _stepStates.length - 1 ? `<div class="roadmap-branch ${isDone ? 'roadmap-branch--filled' : ''}"></div>` : ''}
        </div>

        <!-- Card Body -->
        <div class="roadmap-card-body">
          <header class="roadmap-card-header">
            <div class="roadmap-header-left">
              <span class="roadmap-step-num">${stepNum}</span>
              <span class="roadmap-type-badge roadmap-type-badge--${item.type}">
                ${typeIcon}
                <span>${typeLabel}</span>
              </span>
              ${tagBadgeHtml}
              <h3 class="roadmap-card-title" title="${item.title}">${item.title}</h3>
              ${durationText ? `<span class="roadmap-card-time">⏱ ${durationText}</span>` : ''}
            </div>
            <div class="roadmap-header-right">
              ${statusPillHtml}
            </div>
          </header>

          <p class="roadmap-card-reason">💡 ${stepState.reason || 'Curated step for your learning goals'}</p>

          <!-- Interactive Content (shown when expanded) -->
          ${isExpanded ? renderInteractiveContent(item, isCurrent) : ''}
        </div>
      </article>
    `;
  }

  function renderInteractiveContent(item, isCurrent, isDone = false, isSkipped = false) {
    let innerHtml = '';

    if (item.type === 'theory') {
      innerHtml = renderTheoryContent(item, isDone);
    } else if (item.type === 'video') {
      innerHtml = renderVideoContent(item, isDone);
    } else if (item.type === 'lecture' || item.type === 'book' || item.type === 'paper') {
      innerHtml = renderResourceContent(item, isDone);
    } else if (item.type === 'quiz') {
      innerHtml = renderQuizContent(item, isDone);
    } else if (item.type === 'assignment') {
      innerHtml = renderAssignmentContent(item, isDone);
    }

    return `
      <div class="roadmap-interactive-content" id="interactive-${item.id}">
        ${innerHtml}
        ${(isCurrent && !isDone && !isSkipped) ? `
          <div class="roadmap-card-actions">
            <div class="roadmap-actions-left">
              <button type="button" class="btn btn--ghost roadmap-skip-btn" data-action="skip-step" data-id="${item.id}">
                Skip this step →
              </button>
            </div>
            <div class="roadmap-actions-right">
              <button type="button" class="btn btn--ghost roadmap-ask-tutor-btn" data-action="open-tutor" data-title="${item.title}">
                <span>💬 Ask AI Tutor</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ── Type 1: Theory Reader ───────────────────────────────────────────── */
  function renderTheoryContent(item, isDone = false) {
    const secId = THEORY_SECTION_IDS[item.id];
    let sourceHtml = '';

    if (secId) {
      const template = document.getElementById('foundations-sections-template');
      if (template && template.content) {
        const found = template.content.querySelector('#' + secId);
        if (found) {
          sourceHtml = found.innerHTML;
        }
      }
      if (!sourceHtml) {
        const templateEl = document.getElementById(secId);
        if (templateEl) {
          sourceHtml = templateEl.innerHTML;
        }
      }
    }

    // Fallback if template section is missing
    if (!sourceHtml) {
      sourceHtml = `
        <div class="found-body">
          <p><strong>${item.title}</strong></p>
          <p>${item.note || 'Review the core theoretical foundation for this tree concept.'}</p>
        </div>
      `;
    }

    return `
      <div class="roadmap-theory-wrap">
        <div class="roadmap-scroll-indicator">
          <span>📖 Foundations Reading</span>
          <span class="scroll-hint-pill ${isDone ? 'scroll-hint-pill--ready' : ''}" id="scroll-pill-${item.id}">
            ${isDone ? '✓ Reading completed' : 'Scroll to bottom to mark complete'}
          </span>
        </div>
        <div class="roadmap-theory-reader" id="reader-${item.id}" data-id="${item.id}">
          ${sourceHtml}
        </div>
        <div class="roadmap-reader-footer" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          ${isDone ? `
            <button type="button" class="btn btn--primary" disabled style="opacity: 0.9; cursor: default; background: var(--surface-3); border-color: var(--leaf); color: var(--leaf);">
              Completed ✓
            </button>
            <span style="font-size: 0.8125rem; color: var(--leaf); font-weight: 500;">✓ You have completed this reading</span>
          ` : `
            <button type="button" class="btn btn--primary btn--complete-step" id="btn-theory-${item.id}" data-action="complete-theory" data-id="${item.id}" disabled>
              Mark as read ✓
            </button>
          `}
        </div>
      </div>
    `;
  }

  /* ── Type 2: Video Player ────────────────────────────────────────────── */
  function renderVideoContent(item, isDone = false) {
    const catalogItem = typeof Catalog !== 'undefined' ? Catalog.byId(item.id) : null;
    const vidUrl = (catalogItem && catalogItem.url) || item.url || (
      item.id === 'vid-1' ? 'assets/videos/video1_foundations.mp4' :
      item.id === 'vid-2' ? 'assets/videos/video2_core_operations.mp4' :
      item.id === 'vid-3' ? 'assets/videos/video3_self_balancing.mp4' :
      'assets/videos/video1_foundations.mp4'
    );
    const vidNum = item.id === 'vid-1' ? 1 : item.id === 'vid-2' ? 2 : item.id === 'vid-3' ? 3 : 1;

    return `
      <div class="roadmap-video-container">
        <video
          id="video-player-${item.id}"
          class="roadmap-video-el"
          controls
          preload="metadata"
          src="${vidUrl}"
          data-id="${item.id}"
          data-video-num="${vidNum}"
        ></video>
        <div class="roadmap-video-status-bar">
          ${isDone ? `
            <span style="color: var(--leaf); font-weight: 500;">✓ You have completed this video</span>
            <button type="button" class="btn btn--primary" disabled style="opacity: 0.9; cursor: default; background: var(--surface-3); border-color: var(--leaf); color: var(--leaf);">
              Completed ✓
            </button>
          ` : `
            <span id="video-hint-${item.id}">Watch to 90% or finish to complete this step</span>
            <button type="button" class="btn btn--primary btn--complete-step" id="btn-video-${item.id}" data-action="complete-video" data-id="${item.id}" disabled>
              Mark video complete ✓
            </button>
          `}
        </div>
      </div>
    `;
  }

  /* ── Type 3: Resource Link (Lecture / Book / Paper) ───────────────────── */
  function renderResourceContent(item, isDone = false) {
    let targetUrl = item.url;
    if (!targetUrl) {
      if (item.type === 'lecture') {
        targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.searchQuery || item.title)}`;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(item.searchQuery || item.title)}`;
      }
    }

    return `
      <div class="roadmap-resource-box">
        <div class="roadmap-resource-meta">
          <span class="roadmap-resource-source">Source: ${item.source || 'Curated Reference'}</span>
          <span>·</span>
          <span>Estimated study time: ${item.minutes || 30} minutes</span>
        </div>
        <p class="roadmap-resource-note">${item.note || 'Study the linked resource to deepen your understanding.'}</p>
        <div class="roadmap-resource-actions">
          <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--outline btn-open-resource" id="open-link-${item.id}" data-id="${item.id}">
            <span>Open resource ↗</span>
          </a>
          ${isDone ? `
            <button type="button" class="btn btn--primary" disabled style="opacity: 0.9; cursor: default; background: var(--surface-3); border-color: var(--leaf); color: var(--leaf);">
              Completed ✓
            </button>
          ` : `
            <button type="button" class="btn btn--primary btn--complete-step btn-finish-resource" id="btn-finish-${item.id}" data-action="complete-resource" data-id="${item.id}" disabled>
              <span class="finish-resource-label">I've finished this</span>
              <span class="finish-countdown" id="countdown-${item.id}" hidden>(20s)</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  /* ── Type 4: Quiz Assessment Panel ───────────────────────────────────── */
  function renderQuizContent(item, isDone = false) {
    const questionText = item.note || 'Explain how this tree structure maintains its core invariant and efficiency.';
    const feedbackHtml = _activeQuizFeedback[item.id] || '';

    if (isDone) {
      return `
        <div class="roadmap-quiz-box">
          <div class="assessment-question-box">
            <span class="question-icon">🎯</span>
            <p class="assessment-question-text">${questionText}</p>
          </div>
          <div class="assessment-feedback-container" id="quiz-feedback-${item.id}" style="margin-top: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(95, 171, 122, 0.12); border: 1px solid rgba(95, 171, 122, 0.3); border-radius: 8px;">
              <span style="font-size: 1.25rem;">✓</span>
              <div>
                <strong style="color: var(--leaf); font-size: 0.9375rem; display: block;">Checkpoint Completed</strong>
                <span style="color: var(--cream-2); font-size: 0.8125rem;">You have already submitted and passed this conceptual checkpoint.</span>
              </div>
            </div>
            ${feedbackHtml ? `<div style="margin-top: 12px;">${feedbackHtml}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Prompt 4: Pre-answer confidence tap (skippable, 1-5)
    const checkinsOn = typeof Signals === 'undefined' || Signals.isCheckinsEnabled();
    const needsConfidenceTap = checkinsOn && _activeQuizConfidence[item.id] === undefined;

    if (needsConfidenceTap) {
      return `
        <div class="roadmap-quiz-box">
          <div class="assessment-question-box">
            <span class="question-icon">🎯</span>
            <p class="assessment-question-text">${questionText}</p>
          </div>
          <div class="assessment-confidence-tap" style="margin-top: 18px; padding: 18px 20px; background: var(--surface-2); border: 1px solid var(--border-mid); border-radius: 12px;">
            <p style="font-weight: 600; font-size: 0.9375rem; color: var(--cream); margin: 0 0 4px 0;">How sure are you that you can answer this?</p>
            <p style="font-size: 0.8125rem; color: var(--cream-3); margin: 0 0 14px 0;">Rate your pre-answer confidence from 1 to 5, or skip anytime.</p>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn btn--outline btn-quiz-confidence" data-id="${item.id}" data-val="1">1 · Not sure</button>
              <button type="button" class="btn btn--outline btn-quiz-confidence" data-id="${item.id}" data-val="2">2</button>
              <button type="button" class="btn btn--outline btn-quiz-confidence" data-id="${item.id}" data-val="3">3 · Fairly sure</button>
              <button type="button" class="btn btn--outline btn-quiz-confidence" data-id="${item.id}" data-val="4">4</button>
              <button type="button" class="btn btn--outline btn-quiz-confidence" data-id="${item.id}" data-val="5">5 · Very sure</button>
              <button type="button" class="btn btn--ghost btn-quiz-confidence-skip" data-id="${item.id}" style="color: var(--cream-3); margin-left: 8px;">Skip</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="roadmap-quiz-box">
        <div class="assessment-question-box">
          <span class="question-icon">🎯</span>
          <p class="assessment-question-text">${questionText}</p>
        </div>
        <form class="assessment-form roadmap-quiz-form" id="quiz-form-${item.id}" data-id="${item.id}" novalidate ${feedbackHtml ? 'hidden' : ''}>
          <label class="field-label" for="quiz-input-${item.id}">Your Open-Ended Answer</label>
          <textarea
            class="field-input assessment-textarea"
            id="quiz-input-${item.id}"
            placeholder="Type your conceptual explanation in your own words..."
            rows="4"
            required
          ></textarea>
          <div class="assessment-actions" style="margin-top: 12px; display: flex; gap: 12px; align-items: center;">
            <button type="submit" class="btn btn--primary btn-submit-quiz" id="btn-quiz-submit-${item.id}">
              <span>Submit Answer for Evaluation →</span>
            </button>
            <span class="quiz-submitting-hint" id="quiz-hint-${item.id}" style="font-size: 13px; color: var(--cream-3);" hidden>Evaluating with Gemini AI...</span>
          </div>
        </form>
        <div class="assessment-feedback-container" id="quiz-feedback-${item.id}" ${feedbackHtml ? '' : 'hidden'}>
          ${feedbackHtml}
        </div>
      </div>
    `;
  }

  /* ── Type 5: Structured Assignment Launch Card ────────────────────────── */
  function renderAssignmentContent(item, isDone = false) {
    let asData = null;
    if (typeof PathStore !== 'undefined') {
      asData = PathStore.getAssignment(item.id);
    }

    if (isDone || (asData && asData.status === 'completed')) {
      const score = asData?.aiEvaluation?.totalScore ?? '✓';
      const max = asData?.aiEvaluation?.maxScore ?? '✓';
      const band = asData?.aiEvaluation?.band || 'Completed';
      const rating = asData?.aiEvaluation?.rating || 'solid';
      return `
        <div class="roadmap-assignment-box" style="padding: 20px; background: var(--surface-2); border-radius: 12px; border: 1px solid var(--border);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span class="step-type-pill step-type-pill--assignment" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Assignment</span>
                <span class="assignment-band-badge" style="font-size: 0.8125rem; font-weight: 600; color: ${rating === 'solid' ? 'var(--leaf)' : (rating === 'partial' ? '#f59e0b' : '#ef4444')};">${band} (${score}/${max})</span>
              </div>
              <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0 0 4px 0;">${item.title}</h3>
              <p style="color: var(--cream-2); font-size: 0.875rem; margin: 0;">Completed structured assignment with rubric & feedback.</p>
            </div>
            <div style="display: flex; gap: 10px;">
              <a href="#/assignment/${item.id}/feedback" class="btn btn--outline btn--sm">
                View Feedback →
              </a>
              <a href="#/assignment/${item.id}/brief" class="btn btn--outline btn--sm">
                Review Workspace ↗
              </a>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="roadmap-assignment-box" style="padding: 24px; background: var(--surface-2); border-radius: 12px; border: 1px solid var(--border);">
        <div class="assignment-launch-card">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="step-type-pill step-type-pill--assignment" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">Structured Assignment</span>
            <span style="font-size: 0.8125rem; color: var(--cream-3);">7 Stages · Rubric Graded</span>
          </div>
          <h3 style="font-size: 1.1875rem; font-weight: 600; margin: 0 0 8px 0;">${item.title}</h3>
          <p style="color: var(--cream-2); font-size: 0.9375rem; line-height: 1.5; margin: 0 0 16px 0;">
            ${item.brief || item.note || 'Work through a structured, multi-stage hands-on assignment.'}
          </p>
          <div class="assignment-launch-features" style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; font-size: 0.8125rem; color: var(--cream-3);">
            <span>⏱ ~${item.minutes || 15} min</span>
            <span>📋 Rubric: ${item.rubric ? item.rubric.length : 4} criteria</span>
            <span>💡 3-level hint ladder</span>
          </div>
          <div>
            <a href="#/assignment/${item.id}/brief" class="btn btn--primary" id="btn-launch-assignment-${item.id}">
              Open Assignment Workspace (Stage 1 of 7) →
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /* ── DOM Event Binding for Interactive Elements ──────────────────────── */
  function bindInteractiveEvents(customContainer) {
    const container = customContainer || document.getElementById('page-root') || document.getElementById('roadmap-timeline');
    if (!container) return;

    // 1. Theory readers: bottom scroll listener
    container.querySelectorAll('.roadmap-theory-reader').forEach(reader => {
      const stepId = reader.dataset.id;
      const btn = document.getElementById(`btn-theory-${stepId}`);
      const pill = document.getElementById(`scroll-pill-${stepId}`);

      function checkScroll() {
        if (!reader || !btn) return;
        const atBottom = reader.scrollTop + reader.clientHeight >= reader.scrollHeight - 35;
        const noScrollNeeded = reader.scrollHeight <= reader.clientHeight + 10;
        if (atBottom || noScrollNeeded) {
          btn.disabled = false;
          if (pill) {
            pill.textContent = '✓ Scrolled to end — ready to mark complete';
            pill.classList.add('scroll-hint-pill--ready');
          }
        }
      }

      reader.addEventListener('scroll', checkScroll, { passive: true });
      // Initial check in case it fits without scroll
      setTimeout(checkScroll, 150);
    });

    // 2. Videos: timeupdate & ended listener
    container.querySelectorAll('.roadmap-video-el').forEach(videoEl => {
      const stepId = videoEl.dataset.id;
      const vidNum = parseInt(videoEl.dataset.videoNum, 10);
      const btn = document.getElementById(`btn-video-${stepId}`);
      const hint = document.getElementById(`video-hint-${stepId}`);

      // Ensure src comes from catalog url field
      const catItem = typeof Catalog !== 'undefined' ? Catalog.byId(stepId) : null;
      if (catItem && catItem.url) {
        if (!videoEl.getAttribute('src') || videoEl.getAttribute('src') !== catItem.url) {
          videoEl.setAttribute('src', catItem.url);
          videoEl.src = catItem.url;
        }
      }

      // Restore saved playback position
      if (typeof State !== 'undefined') {
        const savedPos = State.getVideoPosition(vidNum);
        if (savedPos > 0) {
          videoEl.currentTime = savedPos;
        }
      }

      function handleProgress() {
        if (!videoEl.duration) return;
        const pct = videoEl.currentTime / videoEl.duration;

        // Save progress to state
        if (typeof State !== 'undefined') {
          State.saveVideoPosition(vidNum, videoEl.currentTime);
        }

        if (pct >= 0.90 || videoEl.ended) {
          if (typeof State !== 'undefined') {
            State.setVideoWatched(vidNum);
          }
          if (btn) btn.disabled = false;
          if (hint) {
            hint.textContent = '✓ 90% watched — ready to complete';
            hint.style.color = 'var(--leaf)';
          }
        }
      }

      videoEl.addEventListener('timeupdate', handleProgress);
      videoEl.addEventListener('ended', () => {
        if (typeof State !== 'undefined') {
          State.setVideoWatched(vidNum);
        }
        if (btn) btn.disabled = false;
        handleProgress();
      });
    });

    // 3. Resources: Open resource button starts 20-second countdown
    container.querySelectorAll('.btn-open-resource').forEach(linkBtn => {
      linkBtn.addEventListener('click', () => {
        const stepId = linkBtn.dataset.id;
        const finishBtn = document.getElementById(`btn-finish-${stepId}`);
        const countdownEl = document.getElementById(`countdown-${stepId}`);
        if (!finishBtn) return;

        // Start countdown if not already completed
        if (_resourceTimers[stepId]) return;

        let secondsLeft = 20;
        if (countdownEl) {
          countdownEl.hidden = false;
          countdownEl.textContent = `(${secondsLeft}s)`;
        }

        _resourceTimers[stepId] = setInterval(() => {
          secondsLeft--;
          if (countdownEl) {
            countdownEl.textContent = `(${secondsLeft}s)`;
          }
          if (secondsLeft <= 0) {
            clearInterval(_resourceTimers[stepId]);
            delete _resourceTimers[stepId];
            finishBtn.disabled = false;
            if (countdownEl) countdownEl.hidden = true;
            finishBtn.querySelector('.finish-resource-label').textContent = "I've finished this ✓";
          }
        }, 1000);
      });
    });

    // 3b. Quiz Pre-Answer Confidence Tap (Prompt 4)
    container.querySelectorAll('.btn-quiz-confidence').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const val = parseInt(btn.dataset.val, 10);
        _activeQuizConfidence[id] = val;
        if (typeof Signals !== 'undefined' && Signals.savePreAnswerConfidence) {
          Signals.savePreAnswerConfidence(id, val);
        }
        render();
        setTimeout(() => {
          const ta = document.getElementById(`quiz-input-${id}`);
          if (ta) ta.focus();
        }, 60);
      });
    });

    container.querySelectorAll('.btn-quiz-confidence-skip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        _activeQuizConfidence[id] = null;
        render();
        setTimeout(() => {
          const ta = document.getElementById(`quiz-input-${id}`);
          if (ta) ta.focus();
        }, 60);
      });
    });

    // 4. Quiz Forms submission
    container.querySelectorAll('.roadmap-quiz-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const stepId = form.dataset.id;
        const textarea = document.getElementById(`quiz-input-${stepId}`);
        const submitBtn = document.getElementById(`btn-quiz-submit-${stepId}`);
        const hintEl = document.getElementById(`quiz-hint-${stepId}`);
        const feedbackContainer = document.getElementById(`quiz-feedback-${stepId}`);
        if (!textarea || !textarea.value.trim()) return;

        const answerText = textarea.value.trim();
        const item = typeof Catalog !== 'undefined' ? Catalog.byId(stepId) : null;
        const questionText = item?.note || 'Explain the conceptual mechanism.';

        // UI loading state
        if (submitBtn) submitBtn.disabled = true;
        if (hintEl) hintEl.hidden = false;

        try {
          const evalResult = await TutorChatService.evaluateAssessment(stepId, questionText, answerText);
          if (hintEl) hintEl.hidden = true;

          _quizAttempts[stepId] = (_quizAttempts[stepId] || 0) + 1;
          const attempts = _quizAttempts[stepId];
          if (typeof Signals !== 'undefined' && Signals.logQuizRated) {
            Signals.logQuizRated(stepId, evalResult.rating, attempts);
          }

          if (typeof CloudStore !== 'undefined' && CloudStore.enqueue) {
            CloudStore.enqueue('assessment_results', {
              item_id: stepId,
              rating: evalResult.rating || null,
              score: evalResult.score ?? (evalResult.rating === 'solid' ? 100 : (evalResult.rating === 'partial' ? 65 : 35)),
              band: evalResult.band || evalResult.rating || null,
              attempt: attempts,
              detail: evalResult,
              created_at: new Date().toISOString()
            });
          }

          const profile = typeof State !== 'undefined' ? State.getProfile() : null;
          const level = (profile && profile.level) || 'beginner';

          // Call PathEngine.adapt
          const adaptResult = PathEngine.adapt(_stepStates, stepId, evalResult.rating, {
            level,
            remediationCounts: _remediationCounts,
          });

          if (adaptResult && Array.isArray(adaptResult.path)) {
            _stepStates = adaptResult.path;
          }

          // Show Toast or Banner
          if (adaptResult.message && window.showToast) {
            const toastType = evalResult.rating === 'solid' ? 'success' : (evalResult.rating === 'partial' ? 'info' : 'warning');
            showToast(adaptResult.message, toastType);
          }

          // Log adaptation to State
          if (typeof State !== 'undefined') {
            if (typeof State.logAdaptation === 'function') {
              State.logAdaptation({
                quizId: stepId,
                rating: evalResult.rating,
                added: (adaptResult.added || []).map(a => a.id),
                skipped: adaptResult.skipped || [],
                timestamp: Date.now(),
              });
            }
            if (evalResult.gap && typeof State.flagGap === 'function') {
              State.flagGap(evalResult.gap);
            }
          }

          _saveProgress(level);

          // Build Feedback UI
          let feedbackCardHtml = '';

          if (adaptResult.moveOn) {
            // Remediation limit reached (2 rounds max)
            feedbackCardHtml = `
              <div class="assessment-feedback-card assessment-feedback-card--needs_review">
                <div class="feedback-badge-row">
                  <span class="feedback-badge feedback-badge--needs_review">⚠️ Needs Review</span>
                </div>
                <p class="feedback-body">${evalResult.assessment || evalResult.fullText}</p>
                <div class="assessment-move-on-box">
                  <p class="move-on-text">Let's move on and come back to this later</p>
                  <p class="feedback-subtext" style="margin-bottom: 12px;">You've completed 2 remediation cycles here. We'll proceed with the roadmap and revisit this topic in the final summary.</p>
                  <button type="button" class="btn btn--primary" data-action="continue-after-moveon" data-id="${stepId}">
                    Continue to Next Step →
                  </button>
                </div>
              </div>
            `;
          } else if (evalResult.rating === 'solid') {
            const skippedMsg = adaptResult.skipped && adaptResult.skipped.length > 0
              ? `<div class="assessment-adaptation-notice assessment-adaptation-notice--success">✓ Your path adapted: ${adaptResult.skipped.length} ${adaptResult.skipped.length === 1 ? 'foundational resource' : 'foundational resources'} skipped because you showed mastery here.</div>`
              : '';

            feedbackCardHtml = `
              <div class="assessment-feedback-card assessment-feedback-card--solid">
                <div class="feedback-badge-row">
                  <span class="feedback-badge feedback-badge--solid">✨ Solid Understanding</span>
                </div>
                <p class="feedback-body">${evalResult.assessment || evalResult.fullText}</p>
                ${skippedMsg}
                <div style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: var(--leaf); font-weight: 600;">✓ Checkpoint mastered!</span>
                  <button type="button" class="btn btn--primary" data-action="continue-after-quiz" data-id="${stepId}">
                    Continue →
                  </button>
                </div>
              </div>
            `;

            // Auto-advance after 1.8s
            setTimeout(() => {
              if (_stepStates[_currentIndex] && _stepStates[_currentIndex].id === stepId) {
                delete _activeQuizFeedback[stepId];
                completeStep(stepId);
              }
            }, 1800);
          } else if (evalResult.rating === 'partial') {
            const addedMsg = adaptResult.added && adaptResult.added.length > 0
              ? `<div class="assessment-adaptation-notice">⚡ Your path adapted: 1 resource added below to help with ${adaptResult.clusterName}</div>`
              : '';

            feedbackCardHtml = `
              <div class="assessment-feedback-card assessment-feedback-card--partial">
                <div class="feedback-badge-row">
                  <span class="feedback-badge feedback-badge--partial">⚡ Partial Understanding</span>
                </div>
                <p class="feedback-body">${evalResult.assessment || evalResult.fullText}</p>
                ${evalResult.missing ? `<p class="feedback-subtext"><strong>Focus area:</strong> ${evalResult.missing}</p>` : ''}
                ${evalResult.suggestion ? `<p class="feedback-subtext"><strong>Tip:</strong> ${evalResult.suggestion}</p>` : ''}
                ${addedMsg}
                <div style="margin-top: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="btn btn--primary" data-action="continue-after-quiz" data-id="${stepId}">
                    Continue to Added Resource →
                  </button>
                  <button type="button" class="btn btn--outline" data-action="retry-quiz-active" data-id="${stepId}">
                    Try Again ↺
                  </button>
                </div>
              </div>
            `;
          } else {
            // Needs Review (< 2 rounds)
            const count = (adaptResult.added && adaptResult.added.length) || 0;
            const addedMsg = count > 0
              ? `<div class="assessment-adaptation-notice">⚠️ Your path adapted: ${count} ${count === 1 ? 'resource' : 'resources'} added right below to help with ${adaptResult.clusterName}</div>`
              : '';

            feedbackCardHtml = `
              <div class="assessment-feedback-card assessment-feedback-card--needs_review">
                <div class="feedback-badge-row">
                  <span class="feedback-badge feedback-badge--needs_review">⚠️ Needs Review</span>
                </div>
                <p class="feedback-body">${evalResult.assessment || evalResult.fullText}</p>
                ${evalResult.missing ? `<p class="feedback-subtext"><strong>Focus area:</strong> ${evalResult.missing}</p>` : ''}
                ${evalResult.suggestion ? `<p class="feedback-subtext"><strong>Tip:</strong> ${evalResult.suggestion}</p>` : ''}
                ${addedMsg}
                <div style="margin-top: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="btn btn--primary" data-action="retry-quiz-active" data-id="${stepId}">
                    Try Again ↺
                  </button>
                  <button type="button" class="btn btn--outline" data-action="continue-after-quiz" data-id="${stepId}">
                    Study Added Resources →
                  </button>
                </div>
              </div>
            `;
          }

          _activeQuizFeedback[stepId] = feedbackCardHtml;
          render();

        } catch (err) {
          console.error('[Roadmap] Assessment submission error:', err);
          if (hintEl) hintEl.hidden = true;
          if (submitBtn) submitBtn.disabled = false;

          const friendly = (typeof AI !== 'undefined')
            ? AI.getFriendlyErrorMessage(err)
            : (err?.friendlyMessage || err?.message || 'An error occurred during evaluation.');

          const feedbackCardHtml = `
            <div class="assessment-feedback-card assessment-feedback-card--error">
              <div class="feedback-badge-row">
                <span class="feedback-badge feedback-badge--needs_review">⚠️ Evaluation Error</span>
              </div>
              <p class="feedback-body">${friendly}</p>
              <div style="margin-top: 14px; display: flex; gap: 10px; align-items: center;">
                <button type="button" class="btn btn--primary" data-action="retry-quiz-submit" data-id="${stepId}">
                  Retry Evaluation ↺
                </button>
              </div>
            </div>
          `;
          _activeQuizFeedback[stepId] = feedbackCardHtml;
          render();
        }
      });
    });

    // 5. Global Action Delegation
    container.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const stepId = btn.dataset.id;

      if (action === 'complete-theory' || action === 'complete-video' || action === 'complete-resource' || action === 'continue-after-quiz' || action === 'continue-after-moveon') {
        delete _activeQuizFeedback[stepId];
        completeStep(stepId);
      } else if (action === 'retry-quiz-submit') {
        delete _activeQuizFeedback[stepId];
        render();
        const form = document.getElementById(`quiz-form-${stepId}`) || document.querySelector(`.roadmap-quiz-form[data-id="${stepId}"]`);
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      } else if (action === 'retry-quiz-active') {
        delete _activeQuizFeedback[stepId];
        render();
        setTimeout(() => {
          const ta = document.getElementById(`quiz-input-${stepId}`);
          if (ta) ta.focus();
        }, 80);
      } else if (action === 'skip-step') {
        skipStep(stepId);
      } else if (action === 'toggle-review') {
        toggleReview(stepId);
      } else if (action === 'open-tutor') {
        if (window.Dashboard?.openChat) {
          window.Dashboard.openChat();
        }
      }
    };
  }

  /* ── Step Completion & Progression ───────────────────────────────────── */

  function completeStep(stepId) {
    const idx = _stepStates.findIndex(s => s.id === stepId);
    if (idx === -1) return;
    if (_stepStates[idx].status === 'done') return; // Anti-replay guard

    // Node particle burst
    const ringEl = document.getElementById(`node-ring-${stepId}`);
    if (ringEl) particleBurst(ringEl);

    // Update state to done
    _stepStates[idx].status = 'done';

    // Telemetry: step_complete (Prompt 4)
    if (typeof Signals !== 'undefined' && Signals.onStepComplete) {
      Signals.onStepComplete(stepId);
    }

    // Record session step completed in PathStore
    if (typeof PathStore !== 'undefined' && PathStore.recordSessionStepCompleted) {
      PathStore.recordSessionStepCompleted(stepId);
    }

    // If this step was a supporting remediation resource, check if all remediation for that quiz is now finished
    const remTargetQuizId = _stepStates[idx].remediationFor;
    let shouldRetryQuiz = false;
    let targetQuizIdx = -1;

    if (remTargetQuizId) {
      const remainingRemediation = _stepStates.some((s, i) => i !== idx && s.remediationFor === remTargetQuizId && s.status !== 'done' && s.status !== 'skipped');
      if (!remainingRemediation) {
        targetQuizIdx = _stepStates.findIndex(s => s.id === remTargetQuizId);
        if (targetQuizIdx !== -1) {
          shouldRetryQuiz = true;
        }
      }
    }

    if (shouldRetryQuiz && targetQuizIdx !== -1) {
      _currentIndex = targetQuizIdx;
      _stepStates[targetQuizIdx].status = 'current';
      delete _activeQuizFeedback[remTargetQuizId];
      if (window.showToast) {
        const qItem = typeof Catalog !== 'undefined' ? Catalog.byId(remTargetQuizId) : null;
        showToast(`Supporting material finished! Retrying ${qItem ? qItem.title : 'checkpoint'} ↺`, 'info');
      }
    } else {
      // Advance current step to next locked step, skipping over any 'skipped' or 'done' items
      let nextIdx = idx + 1;
      while (nextIdx < _stepStates.length && (_stepStates[nextIdx].status === 'skipped' || _stepStates[nextIdx].status === 'done')) {
        nextIdx++;
      }

      if (nextIdx < _stepStates.length) {
        _currentIndex = nextIdx;
        _stepStates[_currentIndex].status = 'current';
      } else {
        _currentIndex = _stepStates.length; // all done
      }
    }

    const profile = typeof State !== 'undefined' ? State.getProfile() : null;
    const level = (profile && profile.level) || 'beginner';
    _saveProgress(level);

    if (window.showToast) {
      const item = Catalog.byId(stepId);
      showToast(`Completed: ${item ? item.title : 'Step'} ✓`, 'success');
    }

    render();

    if (window.Router && typeof Router.go === 'function') {
      Router.go('/reflect/' + stepId);
    } else {
      setTimeout(() => {
        const nextCard = document.querySelector(`.roadmap-card[data-status="current"]`);
        if (nextCard) {
          nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
    }
  }

  function skipStep(stepId) {
    const idx = _stepStates.findIndex(s => s.id === stepId);
    if (idx === -1) return;
    if (_stepStates[idx].status === 'done' || _stepStates[idx].status === 'skipped') return; // Anti-replay

    _stepStates[idx].status = 'skipped';

    // Telemetry: step_exit_early (Prompt 4)
    if (typeof Signals !== 'undefined' && Signals.onStepExitEarly) {
      Signals.onStepExitEarly(stepId);
    }

    let nextIdx = idx + 1;
    while (nextIdx < _stepStates.length && (_stepStates[nextIdx].status === 'skipped' || _stepStates[nextIdx].status === 'done')) {
      nextIdx++;
    }

    if (nextIdx < _stepStates.length) {
      _currentIndex = nextIdx;
      _stepStates[_currentIndex].status = 'current';
    } else {
      _currentIndex = _stepStates.length;
    }

    const profile = typeof State !== 'undefined' ? State.getProfile() : null;
    const level = (profile && profile.level) || 'beginner';
    _saveProgress(level);

    render();

    if (window.Router && typeof Router.go === 'function') {
      Router.go('/reflect/' + stepId);
    } else {
      setTimeout(() => {
        const nextCard = document.querySelector(`.roadmap-card[data-status="current"]`);
        if (nextCard) {
          nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
    }
  }

  function toggleReview(stepId) {
    _reviewExpanded[stepId] = !_reviewExpanded[stepId];
    render();
  }

  /* ── Full-Screen Single Step Page (Multi-page view) ──────────────────── */
  function renderSingleStepPage(stepId) {
    const item = typeof Catalog !== 'undefined' ? Catalog.byId(stepId) : null;
    const stepState = _stepStates.find(s => s.id === stepId);
    if (!item || !stepState) {
      return '<div class="page-container"><p style="color: var(--cream-2);">Concept not found.</p></div>';
    }

    const typeIcon = TYPE_ICONS[item.type] || '';
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);
    const durationText = item.minutes ? `${item.minutes} min` : '';
    const isCurrent = stepState.status === 'current';
    const isDone = stepState.status === 'done';
    const isSkipped = stepState.status === 'skipped';

    let tagBadgeHtml = '';
    if (stepState.tag) {
      const isAdded = stepState.tag.includes('Added');
      const tagCls = isAdded ? 'roadmap-adaptation-tag--added' : 'roadmap-adaptation-tag--skipped';
      tagBadgeHtml = `<span class="roadmap-adaptation-tag ${tagCls}">${stepState.tag}</span>`;
    }

    return `
      <div class="page-container">
        <div class="step-nav-bar" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <a href="#/progress" class="step-back-link" style="display: inline-flex; align-items: center; gap: 8px; color: var(--cream-2); text-decoration: none; font-size: 0.875rem; font-weight: 500;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>Back to preparation</span>
          </a>
          ${!isCurrent ? `
            <div class="step-review-nav" style="display: flex; align-items: center; gap: 12px;">
              <span class="step-review-badge">Reviewing completed concept</span>
              <a href="#/step/${_stepStates[_currentIndex]?.id || ''}" class="btn btn--ghost btn--sm">
                Return to current concept →
              </a>
            </div>
          ` : ''}
        </div>

        ${typeof MindsetEngine !== 'undefined' && MindsetEngine.getInterventionCardHtml ? MindsetEngine.getInterventionCardHtml(stepId) : ''}

        <article class="page-card step-card-view" data-step-id="${item.id}" data-type="${item.type}">
          <header class="step-page-header">
            <div class="step-page-topline">
              <span class="step-type-badge">${typeIcon} <span>${typeLabel}</span></span>
              ${tagBadgeHtml}
              ${durationText ? `<span class="step-duration-pill">⏱ ${durationText}</span>` : ''}
            </div>
            <h1 class="step-page-title" data-page-heading>${item.title}</h1>
            <p class="step-page-reason">💡 ${stepState.reason || 'Curated concept for your learning goals'}</p>
          </header>

          <div class="step-page-body">
            ${renderInteractiveContent(item, isCurrent, isDone, isSkipped)}
          </div>
        </article>
      </div>
    `;
  }

  function renderStepTo(stepId, container) {
    if (!container) return;
    if (typeof Signals !== 'undefined' && Signals.onStepStart) {
      Signals.onStepStart(stepId);
    }
    container.innerHTML = renderSingleStepPage(stepId);
    bindInteractiveEvents(container);
    if (typeof MindsetEngine !== 'undefined' && MindsetEngine.bindInterventionCard) {
      MindsetEngine.bindInterventionCard(container, stepId);
    }
    syncTutorContext();
    if (window.Router && Router.syncTopbar) Router.syncTopbar();
  }

  /* ── Main Render Function ────────────────────────────────────────────── */

  function render() {
    const timeline = document.getElementById('roadmap-timeline');
    if (timeline) {
      if (_stepStates.length === 0) {
        timeline.innerHTML = `<p style="color: var(--cream-3); padding: var(--sp-6);">No path generated yet. Complete onboarding to generate your roadmap.</p>`;
      } else {
        const cardsHtml = _stepStates.map((stepState, idx) => {
          const isCurrent = stepState.status === 'current';
          const isDone = stepState.status === 'done';
          const isSkipped = stepState.status === 'skipped';
          const isLocked = stepState.status === 'locked';
          return renderCard(stepState, idx, isCurrent, isDone, isSkipped, isLocked);
        }).join('');
        timeline.innerHTML = cardsHtml;
        bindInteractiveEvents(timeline);
      }
    }

    const pageRoot = document.getElementById('page-root');
    if (pageRoot && window.Router && Router.current().startsWith('/step/')) {
      const stepId = Router.current().replace('/step/', '').split('?')[0];
      if (stepId) {
        renderStepTo(stepId, pageRoot);
      }
    }

    syncStatsUI();
    syncTutorContext();
    if (window.Router && Router.syncTopbar) Router.syncTopbar();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  function init(forceFresh = false) {
    if (typeof PathEngine === 'undefined') {
      console.error('[Roadmap] PathEngine is not loaded');
      return;
    }

    // Attempt restoring saved learner journey via PathStore
    const savedData = forceFresh ? null : (typeof PathStore !== 'undefined' ? PathStore.load() : null);

    const profile = (typeof State !== 'undefined' && State.getProfile)
      ? State.getProfile()
      : (savedData && savedData.profile ? savedData.profile : null);

    const level = (profile && profile.level) || (savedData?.profile?.level) || 'beginner';
    const placement = (profile && profile.placement) || (savedData?.profile?.placement);

    // Sync sidebar level badge
    const labelMap = { beginner: 'Beginner', intermediate: 'Intermediate', revision: 'Revision' };
    document.querySelectorAll('.ob-sidebar-level-badge').forEach(el => {
      el.textContent = labelMap[level] || (level.charAt(0).toUpperCase() + level.slice(1));
    });

    if (savedData && Array.isArray(savedData.path) && savedData.path.length > 0) {
      // Rebuild roadmap from saved path — DO NOT regenerate, or adaptations would be lost!
      _path = savedData.path.map(id => {
        const it = typeof Catalog !== 'undefined' ? Catalog.byId(id) : null;
        return {
          id,
          reason: savedData.stepDetails?.[id]?.reason || it?.note || 'Curated step for your path',
        };
      });

      _stepStates = savedData.path.map((id, idx) => {
        const isDone = Array.isArray(savedData.completedIds) && savedData.completedIds.includes(id);
        const isSkipped = Array.isArray(savedData.skippedIds) && savedData.skippedIds.includes(id);
        const isInserted = Array.isArray(savedData.insertedIds) && savedData.insertedIds.includes(id);
        const details = savedData.stepDetails?.[id] || {};
        const it = typeof Catalog !== 'undefined' ? Catalog.byId(id) : null;

        let status = 'locked';
        if (isDone) status = 'done';
        else if (isSkipped) status = 'skipped';
        else if (idx === (savedData.currentIndex ?? 0)) status = 'current';

        return {
          id,
          status,
          reason: details.reason || (isInserted ? 'Added for you' : (it?.note || 'Curated step for your path')),
          tag: details.tag || (isInserted ? 'Added for you' : (isSkipped ? 'Skipped (mastered)' : undefined)),
          remediationFor: details.remediationFor,
        };
      });

      _currentIndex = savedData.currentIndex ?? 0;
      // Ensure current index is valid and not pointing to an already finished step
      if (_currentIndex >= _stepStates.length || _stepStates[_currentIndex].status === 'done' || _stepStates[_currentIndex].status === 'skipped') {
        const nextActive = _stepStates.findIndex(s => s.status !== 'done' && s.status !== 'skipped');
        _currentIndex = nextActive !== -1 ? nextActive : _stepStates.length;
      }
      if (_currentIndex < _stepStates.length) {
        _stepStates[_currentIndex].status = 'current';
      }

      _remediationCounts = savedData.quizAttempts || {};
      _activeQuizFeedback = {};
    } else {
      // Generate fresh path steps via PathEngine
      _path = PathEngine.generate(level, placement);
      _currentIndex = 0;
      _remediationCounts = {};
      _activeQuizFeedback = {};
      _stepStates = _path.map((item, idx) => ({
        id: item.id,
        reason: item.reason,
        status: idx === 0 ? 'current' : 'locked',
      }));
      _saveProgress(level);
    }

    render();
  }

  function getCurrentStep() {
    return _stepStates[_currentIndex] || null;
  }

  function reset() {
    _path = [];
    _stepStates = [];
    _currentIndex = 0;
    _remediationCounts = {};
    _activeQuizFeedback = {};
  }

  return {
    init,
    reset,
    isInitialized: () => Array.isArray(_path) && _path.length > 0,
    syncStatsUI,
    render,
    completeStep,
    skipStep,
    toggleReview,
    getProgress,
    getCurrentStep,
    getSteps: () => _stepStates,
    renderSingleStepPage,
    renderStepTo,
    bindInteractiveEvents,
  };
})();
window.Roadmap = Roadmap;
if (typeof module !== "undefined" && module.exports) {
  module.exports = Roadmap;
}
