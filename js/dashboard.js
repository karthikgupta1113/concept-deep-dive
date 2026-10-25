/**
 * dashboard.js — All dashboard interactivity
 *
 * Handles:
 *  - Stage mark-complete with branch-grow + particle burst
 *  - Progress ring, stats, header chips
 *  - Expand/collapse per stage
 *  - Completion CTA reveal
 *  - Toast notifications
 *  - Sidebar progress label
 */

(function initDashboard() {

  /* ── Toast ──────────────────────────────────────────────── */
  const toastContainer = (() => {
    const el = document.createElement('div');
    el.className = 'toast-container';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.appendChild(el);
    return el;
  })();

  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.setAttribute('role', 'status');
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast--out');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    }, 3400);
  }
  window.showToast = showToast;

  /* ── Particle burst ─────────────────────────────────────── */
  function burst(el) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top  + r.height / 2;
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (i / 10) * Math.PI * 2;
      const dist  = 32 + Math.random() * 24;
      p.style.cssText = `left:${cx}px;top:${cy}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;`;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }

  /* ── Progress ring ──────────────────────────────────────── */
  const ringFill = document.getElementById('progress-ring-fill');
  function setRing(pct) {
    if (!ringFill) return;
    // r=15.9 → circumference≈100
    ringFill.style.strokeDashoffset = String(100 - pct);
  }

  /* ── Header progress chips ──────────────────────────────── */
  function updateChips(stages) {
    stages.forEach((st, i) => {
      const chip = document.getElementById(`chip-${i}`);
      const line = document.getElementById(`chipline-${i}`);
      if (chip) chip.classList.toggle('progress-chip--done', st.status === 'completed');
      if (line) line.classList.toggle('progress-chip-line--filled', st.status === 'completed');
    });
  }

  /* ── Stats ──────────────────────────────────────────────── */
  const elCompleted = document.getElementById('stat-completed');
  const elPercent   = document.getElementById('stat-percent');
  const elSidebarProgress = document.getElementById('sidebar-progress');

  function updateStats(count) {
    const stagePct = Math.round((count / 4) * 100);
    if (elCompleted) elCompleted.textContent = count;
    if (elPercent)   elPercent.textContent   = `${stagePct}%`;
    if (elSidebarProgress) elSidebarProgress.textContent = `${count} of 4 stages`;
    setRing(stagePct);
  }

  /* ── Apply card status to DOM ───────────────────────────── */
  function applyStatus(card, status, stData) {
    card.dataset.status = status;

    const idx       = parseInt(card.dataset.stage, 10);
    const markBtn   = card.querySelector('.stage-mark-btn');
    const expandBtn = card.querySelector('.stage-expand-btn');
    const assessBtn = card.querySelector('.stage-assessment-btn');
    const chatBtn   = card.querySelector('.stage-chat-btn');
    const statusPill = card.querySelector('.stage-status-pill');
    const masteryBadge = document.getElementById(`mastery-badge-${idx}`);

    if (masteryBadge) {
      masteryBadge.hidden = !stData?.mastered;
    }

    if (status === 'locked') {
      if (markBtn)   markBtn.disabled   = true;
      if (expandBtn) expandBtn.disabled = true;
      if (assessBtn) assessBtn.disabled = true;
      if (chatBtn)   chatBtn.disabled   = true;
    }

    if (status === 'not-started') {
      if (markBtn)   markBtn.disabled   = false;
      if (expandBtn) expandBtn.disabled = false;
      if (assessBtn) assessBtn.disabled = false;
      if (chatBtn)   chatBtn.disabled   = false;
      if (statusPill) {
        statusPill.classList.remove('stage-status-pill--locked');
        statusPill.innerHTML = `<span class="status-dot"></span><span class="status-text">Not started</span>`;
      }
    }

    if (status === 'completed') {
      if (markBtn) {
        markBtn.disabled = true;
        markBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M2.5 7.5l3.5 3.5 6.5-6.5"/></svg>
          Completed
        `;
      }
      if (expandBtn) expandBtn.disabled = false;
      if (assessBtn) assessBtn.disabled = false;
      if (chatBtn)   chatBtn.disabled   = false;
      if (statusPill) {
        statusPill.classList.remove('stage-status-pill--locked');
        statusPill.innerHTML = `<span class="status-dot"></span><span class="status-text">Completed</span>`;
      }
    }
  }

  /* ── Completion CTA ─────────────────────────────────────── */
  const completionCta = document.getElementById('completion-cta');
  const topicHeader   = document.querySelector('.topic-header');

  function checkCompletion(count) {
    if (count < 4) return;

    // Show CTA
    if (completionCta) {
      completionCta.hidden = false;
      completionCta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Header glow
    if (topicHeader) topicHeader.classList.add('topic-header--complete');

    // Unlock sidebar nav badge
    const badge = document.getElementById('synthesis-nav-badge');
    if (badge) {
      badge.textContent = 'Ready';
      badge.classList.add('sidebar-link-badge--unlocked');
    }
  }

  /* ── Mark-complete handler ──────────────────────────────── */
  document.querySelectorAll('.stage-mark-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.stage, 10);
      const card = document.querySelector(`.stage-card[data-stage="${idx}"]`);
      if (!card || card.dataset.status !== 'not-started') return;

      // 1. Update state
      const newState = State.completeStage(idx);
      const st = newState.stages[idx];

      // 2. Animate completing card
      applyStatus(card, 'completed', st);
      burst(card.querySelector('.stage-node-ring'));

      // 3. Unlock next card with spring
      const nextCard = document.querySelector(`.stage-card[data-stage="${idx + 1}"]`);
      if (nextCard && newState.stages[idx + 1]?.status === 'not-started') {
        applyStatus(nextCard, 'not-started', newState.stages[idx + 1]);
        nextCard.classList.add('stage-card--just-unlocked');
        setTimeout(() => nextCard.classList.remove('stage-card--just-unlocked'), 900);
      }

      // 4. Update UI stats
      const count = newState.stages.filter(s => s.status === 'completed').length;
      updateStats(count);
      updateChips(newState.stages);
      checkCompletion(count);

      // 5. Toast
      const names = ['Foundations', 'Lectures', 'Books', 'Research'];
      showToast(`${names[idx]} marked complete.`);
    });
  });

  /* ── Expand / collapse ──────────────────────────────────── */
  document.querySelectorAll('.stage-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.stage, 10);
      const card = document.querySelector(`.stage-card[data-stage="${idx}"]`);
      if (!card) return;

      const expanded    = btn.getAttribute('aria-expanded') === 'true';
      const contentEl   = card.querySelector('.stage-expanded-content');
      const contentArea = card.querySelector('.stage-content-area');

      btn.setAttribute('aria-expanded', String(!expanded));

      if (expanded) {
        contentEl?.classList.add('stage-expanded-content--hidden');
      } else {
        contentEl?.classList.remove('stage-expanded-content--hidden');
      }
    });
  });

  /* ── Stage Assessment toggle & submission ─────────────── */
  document.querySelectorAll('.stage-assessment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.stage, 10);
      const panel = document.getElementById(`assessment-panel-${idx}`);
      if (!panel) return;

      const hidden = panel.classList.contains('stage-assessment-panel--hidden');
      if (hidden) {
        panel.classList.remove('stage-assessment-panel--hidden');
        btn.setAttribute('aria-expanded', 'true');
        const textarea = panel.querySelector('textarea');
        if (textarea) textarea.focus();
      } else {
        panel.classList.add('stage-assessment-panel--hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  function renderAssessmentFeedback(containerEl, result) {
    if (!containerEl || !result) return;

    let badgeClass = 'rating-badge--solid';
    let badgeText  = '✨ Solid Understanding';
    let cardClass   = 'feedback-card--solid';

    if (result.rating === 'partial') {
      badgeClass = 'rating-badge--partial';
      badgeText  = '🔍 Partial Understanding';
      cardClass   = 'feedback-card--partial';
    } else if (result.rating === 'misconception') {
      badgeClass = 'rating-badge--misconception';
      badgeText  = '⚠️ Misconception Flagged';
      cardClass   = 'feedback-card--misconception';
    }

    let gapHtml = '';
    if (result.gap) {
      gapHtml = `
        <div class="gap-flagged-pill">
          <span>🚩 Flagged Gap: ${formatTextHtml(result.gap)}</span>
        </div>
      `;
    }

    containerEl.innerHTML = `
      <div class="feedback-card ${cardClass}">
        <div class="feedback-rating-header">
          <span class="rating-badge ${badgeClass}">${badgeText}</span>
        </div>
        
        <div class="feedback-section">
          <span class="feedback-section-title">1) Assessment of Understanding</span>
          <p class="feedback-section-content">${formatTextHtml(result.assessment)}</p>
        </div>

        <div class="feedback-section">
          <span class="feedback-section-title">2) What's Missing or Incorrect</span>
          <p class="feedback-section-content">${formatTextHtml(result.missing)}</p>
        </div>

        <div class="feedback-section">
          <span class="feedback-section-title">3) Suggestion for Improvement</span>
          <p class="feedback-section-content">${formatTextHtml(result.suggestion)}</p>
        </div>

        ${gapHtml}
      </div>
    `;
    containerEl.hidden = false;
  }

  document.querySelectorAll('.assessment-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const stageId = parseInt(form.dataset.stage, 10);
      const textarea = document.getElementById(`assessment-input-${stageId}`);
      const submitBtn = form.querySelector('.btn-submit-assessment');
      const feedbackContainer = document.getElementById(`assessment-feedback-${stageId}`);

      if (!textarea) return;
      const studentAnswer = textarea.value.trim();
      if (!studentAnswer) {
        showToast("Please enter an answer before submitting.", "info");
        return;
      }

      const question = window.TutorChatService.getQuestionForStage(stageId);

      // Set loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Evaluating answer...</span>`;
      }

      try {
        const result = await window.TutorChatService.evaluateAssessment(stageId, question, studentAnswer);

        // Update state
        const newState = State.submitAssessment(stageId, question, studentAnswer, result);
        const updatedStage = newState.stages[stageId];

        // Render feedback output
        renderAssessmentFeedback(feedbackContainer, result);

        // Update DOM status and stats
        const card = document.querySelector(`.stage-card[data-stage="${stageId}"]`);
        if (card) applyStatus(card, updatedStage.status, updatedStage);

        const count = newState.stages.filter(s => s.status === 'completed').length;
        updateStats(count);

        if (result.rating === 'solid' || result.rating === 'partial') {
          showToast(`Stage ${stageId + 1} Assessment Evaluated — Stage Mastered! ✨`, "success");
        } else {
          showToast(`Assessment feedback received. Review the suggestion and refine your answer!`, "info");
        }

      } catch (err) {
        console.error("[assessment] evaluation error:", err);
        const friendly = (typeof AI !== 'undefined')
          ? AI.getFriendlyErrorMessage(err)
          : (err?.friendlyMessage || err?.message || 'Failed to evaluate assessment.');

        if (feedbackContainer) {
          feedbackContainer.innerHTML = `
            <div class="feedback-card feedback-card--warning" style="border: 1px solid var(--accent-amber); background: rgba(224, 108, 117, 0.08); padding: 16px; border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span class="rating-badge rating-badge--review">⚠️ Evaluation Error</span>
              </div>
              <p style="margin: 0 0 12px; color: var(--cream); font-size: 0.95rem;">${friendly}</p>
              <button type="button" class="btn btn--secondary btn--sm btn-retry-stage-eval">Retry Evaluation ↻</button>
            </div>
          `;
          feedbackContainer.hidden = false;
          feedbackContainer.querySelector('.btn-retry-stage-eval')?.addEventListener('click', () => {
            form.dispatchEvent(new Event('submit'));
          });
        }
        showToast(friendly, "danger");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Submit Answer for Evaluation →</span>`;
        }
      }
    });
  });

  /* ── Go to synthesis page ───────────────────────────────── */
  const btnGoSynth  = document.getElementById('btn-go-synthesis');
  const navSynth    = document.getElementById('nav-synthesis');

  function goSynthesis() {
    if (window.App) window.App.showSynthesis();
  }

  if (btnGoSynth)  btnGoSynth.addEventListener('click', goSynthesis);
  if (navSynth)    navSynth.addEventListener('click', () => {
    const isComplete = window.Roadmap ? Roadmap.getProgress().pathComplete : State.allComplete();
    if (isComplete) goSynthesis();
    else showToast('Complete all steps on your path first.', 'info');
  });

  /* ── Sidebar home link (no-op on dashboard itself) ──────── */
  const navHome = document.getElementById('nav-home');
  if (navHome) navHome.addEventListener('click', () => {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Full init from state ───────────────────────────────── */
  function initFromState() {
    const state = State.get() || {};
    const user = state.currentUser || { name: 'Admin', email: 'admin@conceptdeepdive.com' };

    const stages = state.stages || [];

    // Apply each card's status (legacy fallback if present)
    stages.forEach((st, i) => {
      const card = document.querySelector(`.stage-card[data-stage="${i}"]`);
      if (card) applyStatus(card, st.status, st);

      // Restore assessment input and feedback if stored
      if (st.assessment) {
        const textarea = document.getElementById(`assessment-input-${i}`);
        const feedbackContainer = document.getElementById(`assessment-feedback-${i}`);
        if (textarea && st.assessment.answer) {
          textarea.value = st.assessment.answer;
        }
        if (feedbackContainer && st.assessment.result) {
          renderAssessmentFeedback(feedbackContainer, st.assessment.result);
        }
      }
    });

    // Roadmap active: delegate timeline and progress to Roadmap
    if (window.Roadmap && document.getElementById('roadmap-timeline')) {
      if (typeof Roadmap.isInitialized === 'function' && Roadmap.isInitialized()) {
        if (typeof Roadmap.syncStatsUI === 'function') {
          Roadmap.syncStatsUI();
        }
      } else {
        Roadmap.init();
      }
    } else {
      // Legacy stats + chips + ring
      const count = stages.filter(s => s.status === 'completed').length;
      updateStats(count);
      updateChips(stages);

      // Completion CTA visibility
      if (count === 4 && completionCta) {
        completionCta.hidden = false;
        if (topicHeader) topicHeader.classList.add('topic-header--complete');
        const badge = document.getElementById('synthesis-nav-badge');
        if (badge) {
          badge.textContent = 'Ready';
          badge.classList.add('sidebar-link-badge--unlocked');
        }
      } else if (completionCta) {
        completionCta.hidden = true;
      }
    }

    // User identity
    const nameEl   = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('user-avatar-initials');
    if (nameEl)   nameEl.textContent = user.name;
    if (avatarEl) {
      const parts = user.name.trim().split(/\s+/);
      avatarEl.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }

    // Update stage selector dropdown options (enable/disable based on lock status)
    if (!window.Roadmap) {
      const select = document.getElementById('tutor-stage-select');
      if (select) {
        stages.forEach((st, idx) => {
          const opt = select.options[idx];
          if (opt) opt.disabled = (st.status === 'locked');
        });

        // Fallback activeStageId to the highest unlocked stage if it gets locked
        if (stages[activeStageId]?.status === 'locked') {
          const unlocked = stages.filter(s => s.status !== 'locked');
          if (unlocked.length > 0) {
            activeStageId = unlocked[unlocked.length - 1].id;
            select.value = String(activeStageId);
          }
        }
      }
    }
  }

  /* ── Tutor Chat Drawer Integration ──────────────────────── */
  let activeStageId = 0;
  const chatDrawer = document.getElementById('tutor-chat-drawer');
  const chatBackdrop = document.getElementById('chat-drawer-backdrop');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatForm = document.getElementById('chat-form');
  const chatInputText = document.getElementById('chat-input-text');
  const stageSelect = document.getElementById('tutor-stage-select');

  const floatingToggle = document.getElementById('tutor-floating-toggle');

  function openChat(stageId) {
    if (window.Roadmap) {
      const curr = Roadmap.getCurrentStep();
      if (curr && typeof Catalog !== 'undefined') {
        const item = Catalog.byId(curr.id);
        if (item) {
          State.setState({ currentTopic: `${item.title} (${item.topics.join(', ')})` });
        }
      }
    } else {
      const stages = State.get().stages;
      const unlocked = stages.filter(s => s.status !== 'locked');
      const highestUnlockedId = unlocked.length > 0 ? unlocked[unlocked.length - 1].id : 0;

      if (stageId === undefined || stages[stageId]?.status === 'locked') {
        stageId = highestUnlockedId;
      }

      activeStageId = stageId;

      if (stageSelect) {
        stageSelect.value = String(activeStageId);
      }
    }

    if (chatDrawer) {
      chatDrawer.classList.add('tutor-chat-drawer--open');
      chatDrawer.hidden = false;
    }

    updateMockBadge();
    renderChatHistory();

    // Reset textarea height and focus
    if (chatInputText) {
      chatInputText.value = '';
      chatInputText.style.height = 'auto';
      setTimeout(() => chatInputText.focus(), 200);
    }
  }

  function updateMockBadge() {
    const badge = document.getElementById('tutor-mock-badge');
    if (badge) {
      const isMock = typeof AI !== 'undefined' ? AI.isMockEnabled() : true;
      badge.style.display = isMock ? 'inline-block' : 'none';
    }
  }

  function closeChat() {
    if (chatDrawer) {
      chatDrawer.classList.remove('tutor-chat-drawer--open');
      setTimeout(() => {
        if (!chatDrawer.classList.contains('tutor-chat-drawer--open')) {
          chatDrawer.hidden = true;
        }
      }, 300);
    }
  }

  if (chatBackdrop) chatBackdrop.addEventListener('click', closeChat);
  if (btnCloseChat) btnCloseChat.addEventListener('click', closeChat);

  // Floating Toggle Click Handler
  if (floatingToggle) {
    floatingToggle.addEventListener('click', () => {
      if (chatDrawer && !chatDrawer.classList.contains('tutor-chat-drawer--open')) {
        openChat();
      } else {
        closeChat();
      }
    });
  }

  // Dropdown stage selector handler
  if (stageSelect) {
    stageSelect.addEventListener('change', () => {
      const selectedId = parseInt(stageSelect.value, 10);
      activeStageId = selectedId;
      if (window.Roadmap && Roadmap.getSteps) {
        const steps = Roadmap.getSteps();
        const step = steps[selectedId];
        if (step && typeof Catalog !== 'undefined') {
          const it = Catalog.byId(step.id);
          if (it) State.setState({ currentTopic: `${it.title} (${it.topics.join(', ')})` });
        }
      }
      renderChatHistory();
      if (chatInputText) chatInputText.focus();
    });
  }

  // Render stage message history
  function renderChatHistory() {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = '';

    const stages = State.get().stages;
    const stage = stages.find(s => s.id === activeStageId);
    const history = stage?.chat_history || [];

    if (history.length === 0) {
      const topicNames = [
        "Theory & Core Concepts",
        "University Lectures & Talks",
        "Essential Reading & Excerpts",
        "Papers & Deeper Reading"
      ];
      let stageName = topicNames[activeStageId] || "Binary Search Trees";
      if (window.Roadmap && Roadmap.getSteps) {
        const steps = Roadmap.getSteps();
        const step = steps[activeStageId] || Roadmap.getCurrentStep();
        if (step && typeof Catalog !== 'undefined') {
          const it = Catalog.byId(step.id);
          if (it) stageName = it.title;
        }
      }
      const greeting = `Hello! I'm your Socratic Tutor for ${stageName}. Ask me anything about this step, and let's reason through it together!`;
      appendMessageBubble('tutor', greeting, false);
    } else {
      history.forEach(msg => {
        appendMessageBubble(msg.sender, msg.text, false);
      });
    }

    scrollToBottom();
  }

  function appendMessageBubble(sender, text, animate = true) {
    if (!chatMessagesContainer) return;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg chat-msg--${sender}`;
    if (!animate) msgEl.style.animation = 'none';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'chat-bubble';
    bubbleEl.innerHTML = formatTextHtml(text);

    const timeEl = document.createElement('span');
    timeEl.className = 'chat-msg-time';
    const now = new Date();
    timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    msgEl.appendChild(bubbleEl);
    msgEl.appendChild(timeEl);
    chatMessagesContainer.appendChild(msgEl);
    scrollToBottom();
  }

  function formatTextHtml(text) {
    // Simple HTML escape
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Replace backticks with code elements
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function scrollToBottom() {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  }

  // Typing indicator management
  let typingIndicatorEl = null;

  function showTypingIndicator() {
    if (!chatMessagesContainer) return;
    if (typingIndicatorEl) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg chat-msg--tutor';
    msgEl.id = 'typing-indicator-msg';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'chat-bubble chat-bubble--typing';
    bubbleEl.innerHTML = `
      <span class="dot-bounce"></span>
      <span class="dot-bounce"></span>
      <span class="dot-bounce"></span>
    `;

    msgEl.appendChild(bubbleEl);
    chatMessagesContainer.appendChild(msgEl);
    typingIndicatorEl = msgEl;
    scrollToBottom();
  }

  function removeTypingIndicator() {
    if (typingIndicatorEl) {
      typingIndicatorEl.remove();
      typingIndicatorEl = null;
    }
  }

  // Handle message submission
  if (chatForm && chatInputText) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawText = chatInputText.value.trim();
      if (!rawText) return;

      chatInputText.value = '';
      chatInputText.style.height = 'auto';

      // Save user message in state and append to DOM
      State.addChatMessage(activeStageId, 'student', rawText);
      appendMessageBubble('student', rawText);

      // Log tutor_message telemetry event (Prompt 4)
      if (typeof Signals !== 'undefined' && Signals.logTutorMessage) {
        Signals.logTutorMessage(rawText, true);
      }

      // Show typing indicator
      showTypingIndicator();

      // Retrieve full updated message history
      const currentStages = State.get().stages;
      const currentStage = currentStages.find(s => s.id === activeStageId);
      const chatHistory = currentStage?.chat_history || [];

      try {
        const response = await window.TutorChatService.askQuestion(activeStageId, chatHistory);
        
        removeTypingIndicator();

        // Save tutor message in state and append to DOM
        State.addChatMessage(activeStageId, 'tutor', response.text);
        appendMessageBubble('tutor', response.text);

        if (response.gap) {
          State.flagGap(response.gap);
        }
      } catch (err) {
        removeTypingIndicator();
        appendErrorMessage(err, () => {
          // Re-send the question on retry
          chatInputText.value = rawText;
          chatForm.dispatchEvent(new Event('submit'));
        });
      }
    });

    function appendErrorMessage(err, retryFn) {
      if (!chatMessagesContainer) return;

      const msgEl = document.createElement('div');
      msgEl.className = 'chat-msg chat-msg--tutor chat-msg--error';

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'chat-bubble chat-bubble--error';

      const friendly = (typeof AI !== 'undefined')
        ? AI.getFriendlyErrorMessage(err)
        : (err?.friendlyMessage || err?.message || 'An error occurred.');

      bubbleEl.innerHTML = `
        <div class="chat-error-body">
          <span class="chat-error-icon" aria-hidden="true">⚠️</span>
          <span class="chat-error-text">${formatTextHtml(friendly)}</span>
        </div>
        <div class="chat-error-actions" style="margin-top: 8px;">
          <button type="button" class="btn btn--outline btn--xs btn-chat-retry">Retry ↺</button>
        </div>
      `;

      bubbleEl.querySelector('.btn-chat-retry')?.addEventListener('click', () => {
        msgEl.remove();
        if (typeof retryFn === 'function') retryFn();
      });

      const timeEl = document.createElement('span');
      timeEl.className = 'chat-msg-time';
      const now = new Date();
      timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      msgEl.appendChild(bubbleEl);
      msgEl.appendChild(timeEl);
      chatMessagesContainer.appendChild(msgEl);
      scrollToBottom();
    }

    // Expand height dynamically
    chatInputText.addEventListener('input', () => {
      chatInputText.style.height = 'auto';
      chatInputText.style.height = chatInputText.scrollHeight + 'px';
    });

    // Submit on Enter key
    chatInputText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  }

  function openKeySettings() {
    openChat();
  }

  State.subscribe(initFromState);
  window.Dashboard = { initFromState, openChat, openKeySettings };

  // Run on startup
  initFromState();

})();
