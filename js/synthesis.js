/**
 * synthesis.js — Synthesis page controller
 * Manages personalized AI summary generation, display states, and Gemini API integration.
 */

(function initSynthesisModule() {

  let _isGenerating = false;

  const STAGE_TITLES = [
    "Stage 1: Foundations & Theory",
    "Stage 2: Lectures & Talks",
    "Stage 3: Textbooks & Reading",
    "Stage 4: Research Papers"
  ];

  const Synthesis = {
    init() {
      this.render();
      this.bindEvents();
    },

    bindEvents() {
      const container = document.getElementById('synth-summary-body');
      if (!container || container.dataset.boundEvents === 'true') return;

      container.dataset.boundEvents = 'true';

      container.addEventListener('click', async (e) => {
        const btnKey = e.target.closest('#btn-open-key-settings');
        if (btnKey) {
          if (window.Dashboard?.openKeySettings) {
            window.Dashboard.openKeySettings();
          }
          return;
        }

        const btnGen = e.target.closest('#btn-generate-summary');
        const btnRegen = e.target.closest('#btn-regenerate-summary');

        if (btnGen || btnRegen) {
          await this.generateSummary();
        }
      });
    },

    async generateSummary() {
      if (_isGenerating) return;
      _isGenerating = true;
      this.render();

      const state = State.get();
      
      // Build assessment summaries string
      const assessmentSummaries = state.stages.map((st, i) => {
        const title = STAGE_TITLES[i] || `Stage ${i+1}`;
        if (st.assessment && st.assessment.question && st.assessment.answer) {
          return `${title}: Question: "${st.assessment.question}" | Answer: "${st.assessment.answer}" | Rating: ${st.assessment.result?.rating || 'solid'}`;
        }
        return `${title}: Mastered`;
      }).join("\n");

      // Build flagged gaps string
      const flaggedGapsStr = (state.flaggedGaps && state.flaggedGaps.length > 0)
        ? state.flaggedGaps.join("; ")
        : "None logged during deep-dive.";

      const topic = "Trees & Binary Search Trees (BSTs)";

      try {
        const summaryText = await TutorChatService.generateSynthesisSummary(
          assessmentSummaries,
          flaggedGapsStr,
          topic
        );
        State.saveSummary(summaryText);
      } catch (err) {
        console.error("[synthesis] Failed to generate summary:", err);
        // Save fallback mock if unexpected error occurs
        const fallback = TutorChatService.getMockSummaryResponse(assessmentSummaries, flaggedGapsStr, topic);
        State.saveSummary(fallback);
      } finally {
        _isGenerating = false;
        this.render();
      }
    },

    render() {
      const container = document.getElementById('synth-summary-body');
      if (!container) return;

      const state = State.get();
      // Unlock when all 4 stages are marked complete — consistent with
      // dashboard.js CTA, sidebar badge, and nav guard (all use completedCount).
      // masteredCount() only reflects submitted assessments and is optional.
      const completedCount = State.completedCount();
      const allComplete = State.allComplete();
      const summary = state.summary;
      const apiKey = TutorChatService.getApiKey();

      // Ensure event delegation is wired
      this.bindEvents();

      if (_isGenerating) {
        container.innerHTML = this.renderGeneratingState();
        return;
      }

      if (summary && summary.text) {
        container.innerHTML = this.renderSummaryState(summary, apiKey);
        return;
      }

      if (allComplete) {
        container.innerHTML = this.renderUnlockedState(apiKey);
        return;
      }

      container.innerHTML = this.renderLockedState(completedCount);
    },

    renderLockedState(completedCount) {
      const percent = Math.round((completedCount / 4) * 100);
      return `
        <div class="synth-lock-card">
          <div class="synth-lock-header">
            <div class="synth-lock-badge">
              <span class="synth-lock-icon">🔒</span>
              <div>
                <strong>4-Stage Mastery Required</strong>
                <p>Complete and master all 4 stages to unlock your personalized AI synthesis summary.</p>
              </div>
            </div>
            <div class="synth-lock-progress">
              <div class="synth-progress-meta">
                <span>Progress: ${completedCount} of 4 Stages Complete</span>
                <span>${percent}%</span>
              </div>
              <div class="synth-progress-track">
                <div class="synth-progress-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="synth-preview-cards">
          <div class="synth-preview-card synth-preview-card--locked">
            <div class="synth-preview-num">01</div>
            <div class="synth-preview-text">
              <strong>Core Concept</strong>
              <p>Unified definitions and mathematical invariants across all 4 stages.</p>
            </div>
          </div>
          <div class="synth-preview-card synth-preview-card--locked">
            <div class="synth-preview-num">02</div>
            <div class="synth-preview-text">
              <strong>What You Understood Well</strong>
              <p>Highlights of key concepts and mechanisms you demonstrated mastery of.</p>
            </div>
          </div>
          <div class="synth-preview-card synth-preview-card--locked">
            <div class="synth-preview-num">03</div>
            <div class="synth-preview-text">
              <strong>Areas to Reinforce</strong>
              <p>Tailored clarifications addressing specific gaps flagged during chat and assessments.</p>
            </div>
          </div>
          <div class="synth-preview-card synth-preview-card--locked">
            <div class="synth-preview-num">04</div>
            <div class="synth-preview-text">
              <strong>Putting It All Together</strong>
              <p>Integrated mental model connecting theory, lectures, books, and research papers.</p>
            </div>
          </div>
        </div>
      `;
    },

    renderUnlockedState(apiKey) {
      const apiBadgeText = `<span class="synth-api-badge synth-api-badge--active">⚡ Gemini 3.5 Flash Lite Connected</span>`;

      return `
        <div class="synth-cta-card">
          <div class="synth-cta-content">
            <div class="synth-cta-sparkle" aria-hidden="true">🌿</div>
            <div class="synth-cta-text">
              <h2>Your Deep-Dive Synthesis is Ready!</h2>
              <p>You have mastered all 4 stages of Trees &amp; BSTs. Click below to generate your personalized learning summary built from your assessment answers and flagged learning gaps.</p>
              <div class="synth-cta-meta">
                ${apiBadgeText}
              </div>
            </div>
          </div>
          <div class="synth-cta-action">
            <button type="button" class="btn btn--primary btn--lg btn-synth-trigger" id="btn-generate-summary">
              <span class="btn-sparkle-icon">✨</span>
              Generate My Summary
            </button>
          </div>
        </div>

        <div class="synth-preview-cards">
          <div class="synth-preview-card">
            <div class="synth-preview-num">01</div>
            <div class="synth-preview-text">
              <strong>Core Concept</strong>
              <p>Core definitions and logarithmic bounds unified across theory, lectures, books, and papers.</p>
            </div>
          </div>
          <div class="synth-preview-card">
            <div class="synth-preview-num">02</div>
            <div class="synth-preview-text">
              <strong>What You Understood Well</strong>
              <p>Reinforces the concepts you answered correctly during stage assessments.</p>
            </div>
          </div>
          <div class="synth-preview-card">
            <div class="synth-preview-num">03</div>
            <div class="synth-preview-text">
              <strong>Areas to Reinforce</strong>
              <p>Extra clarity on misconceptions logged during chat or open-ended evaluations.</p>
            </div>
          </div>
          <div class="synth-preview-card">
            <div class="synth-preview-num">04</div>
            <div class="synth-preview-text">
              <strong>Putting It All Together</strong>
              <p>Coherent mental model connecting all 4 stages together into visual explainer blocks.</p>
            </div>
          </div>
        </div>
      `;
    },

    renderGeneratingState() {
      return `
        <div class="synth-loading-card">
          <div class="synth-spinner-wrap">
            <div class="synth-spinner"></div>
            <div class="synth-spinner-pulse"></div>
          </div>
          <h3>Building Your Personalized Summary...</h3>
          <p>Synthesizing a detailed summary across all 4 stages — analyzing your assessment responses, flagged learning gaps, and cross-stage patterns to write a comprehensive learning resource just for you.</p>
          <ul class="synth-loading-steps">
            <li>&#10022; Reviewing stage assessments &amp; answers</li>
            <li>&#10022; Identifying concepts to reinforce</li>
            <li>&#10022; Connecting theory &rarr; lectures &rarr; books &rarr; research</li>
            <li>&#10022; Writing detailed section content&hellip;</li>
          </ul>
        </div>
      `;
    },


    renderSummaryState(summary, apiKey) {
      const timeStr = summary.timestamp
        ? new Date(summary.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      const apiBadgeText = `<span class="synth-api-badge synth-api-badge--active">⚡ Generated with Gemini AI</span>`;

      const formattedHTML = this.parseSummaryMarkdown(summary.text);

      return `
        <div class="synth-summary-container">
          <div class="synth-summary-toolbar">
            <div class="synth-toolbar-info">
              ${apiBadgeText}
              <span class="synth-timestamp">Generated ${timeStr}</span>
            </div>
            <button type="button" class="btn btn--secondary btn-sm" id="btn-regenerate-summary">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M14 8A6 6 0 112.5 4.5M2.5 1v4h4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Regenerate Summary
            </button>
          </div>

          <div class="synth-summary-content">
            ${formattedHTML}
          </div>
        </div>
      `;
    },

    parseSummaryMarkdown(text) {
      if (!text) return '';

      const rawSections = text.split(/(?:^|\n)##\s+/);

      if (rawSections.length <= 1) {
        return `<div class="synth-summary-block"><div class="synth-block-body">${this.formatInlineMarkdown(text)}</div></div>`;
      }

      const iconMap = {
        'core concept': '💡',
        'what you understood well': '✅',
        'areas to reinforce': '🎯',
        'putting it all together': '🌐'
      };

      const resultHTML = rawSections.filter(s => s.trim()).map((rawSec, index) => {
        const lines = rawSec.trim().split('\n');
        const title = lines[0].replace(/^#+\s*/, '').trim();
        const contentLines = lines.slice(1).join('\n').trim();

        const lowerTitle = title.toLowerCase();
        let icon = '📌';
        for (const [key, val] of Object.entries(iconMap)) {
          if (lowerTitle.includes(key)) {
            icon = val;
            break;
          }
        }

        const formattedBody = this.formatInlineMarkdown(contentLines);

        return `
          <div class="synth-summary-card synth-summary-card--${index + 1}">
            <div class="synth-card-header">
              <span class="synth-card-icon">${icon}</span>
              <h3 class="synth-card-title">${title}</h3>
            </div>
            <div class="synth-card-body">
              ${formattedBody}
            </div>
          </div>
        `;
      }).join('');

      return resultHTML;
    },

    formatInlineMarkdown(text) {
      if (!text) return '';

      const lines = text.split('\n');
      let inList = false;
      let inOrderedList = false;
      const processedLines = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)/);

        if (bulletMatch) {
          if (!inList) {
            if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
            processedLines.push('<ul class="synth-list">');
            inList = true;
          }
          processedLines.push(`<li>${this.applyTextFormatting(bulletMatch[1])}</li>`);
        } else if (numberMatch) {
          if (!inOrderedList) {
            if (inList) { processedLines.push('</ul>'); inList = false; }
            processedLines.push('<ol class="synth-ordered-list">');
            inOrderedList = true;
          }
          processedLines.push(`<li>${this.applyTextFormatting(numberMatch[2])}</li>`);
        } else {
          if (inList) { processedLines.push('</ul>'); inList = false; }
          if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }

          if (trimmed.length > 0) {
            processedLines.push(`<p>${this.applyTextFormatting(trimmed)}</p>`);
          }
        }
      });

      if (inList) processedLines.push('</ul>');
      if (inOrderedList) processedLines.push('</ol>');

      return processedLines.join('');
    },

    applyTextFormatting(str) {
      return str
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
    }
  };

  window.Synthesis = Synthesis;

  /* ── Animations "Mark as viewed" toggle ─────────────────── */
  (function initAnimWatchedBtn() {
    const btn = document.getElementById('btn-mark-animations-watched');
    if (!btn) return;

    function syncBtn(watched) {
      btn.setAttribute('aria-pressed', String(watched));
      const label = btn.querySelector('.anim-watched-label');
      if (watched) {
        btn.classList.add('anim-watched-btn--done');
        if (label) label.textContent = 'Animations viewed ✓';
      } else {
        btn.classList.remove('anim-watched-btn--done');
        if (label) label.textContent = 'Mark as viewed';
      }
    }

    // Restore persisted state on synthesis page open
    function refreshBtn() {
      syncBtn(State.get().animationsWatched);
    }

    btn.addEventListener('click', () => {
      const current = State.get().animationsWatched;
      State.setAnimationsWatched(!current);
      syncBtn(!current);
      // Refresh dashboard stats if it's rendered (so ring/% update immediately)
      if (window.Dashboard) window.Dashboard.initFromState();
    });

    // Wire into State subscription so button reflects state on every render
    State.subscribe(refreshBtn);
    refreshBtn();
  })();

})();
