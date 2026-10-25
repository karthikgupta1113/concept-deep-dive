/**
 * synthesis.js — Synthesis page controller
 * Manages personalized AI summary generation, display states, and Gemini API integration.
 */

(function initSynthesisModule() {

  let _isGenerating = false;
  let _synthesisError = null;

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
      let assessmentSummaries = '';
      if (window.Roadmap && Roadmap.getSteps) {
        const steps = Roadmap.getSteps();
        assessmentSummaries = steps
          .filter(s => s.status === 'done' || s.status === 'skipped')
          .map(s => {
            const it = typeof Catalog !== 'undefined' ? Catalog.byId(s.id) : null;
            return `${it?.title || s.id} (${it?.type || 'step'}): ${s.status === 'done' ? 'Completed' : 'Skipped'}`;
          })
          .join("\n");
      } else {
        assessmentSummaries = state.stages.map((st, i) => {
          const title = STAGE_TITLES[i] || `Stage ${i+1}`;
          if (st.assessment && st.assessment.question && st.assessment.answer) {
            return `${title}: Question: "${st.assessment.question}" | Answer: "${st.assessment.answer}" | Rating: ${st.assessment.result?.rating || 'solid'}`;
          }
          return `${title}: Mastered`;
        }).join("\n");
      }

      // Build flagged gaps and adaptations string
      const gapEntries = [...(state.flaggedGaps || [])];
      if (typeof State.getAdaptations === 'function') {
        const adaptations = State.getAdaptations();
        adaptations.forEach(ad => {
          if (ad.added && ad.added.length > 0) {
            gapEntries.push(`Adaptation on ${ad.quizId} (${ad.rating}): added ${ad.added.join(', ')}`);
          }
          if (ad.skipped && ad.skipped.length > 0) {
            gapEntries.push(`Mastery on ${ad.quizId} (${ad.rating}): skipped ${ad.skipped.join(', ')}`);
          }
        });
      }
      const flaggedGapsStr = gapEntries.length > 0
        ? gapEntries.join("; ")
        : "None logged during deep-dive.";

      const topic = "Trees & Binary Search Trees (BSTs)";

      try {
        const summaryText = await TutorChatService.generateSynthesisSummary(
          assessmentSummaries,
          flaggedGapsStr,
          topic
        );
        State.saveSummary(summaryText);
        _synthesisError = null;
      } catch (err) {
        console.error("[synthesis] Failed to generate summary:", err);
        const isMockAllowed = (typeof AI !== 'undefined' && AI.isMockEnabled && AI.isMockEnabled()) || (err && err.code === 'NO_KEY');
        if (isMockAllowed) {
          const fallback = TutorChatService.getMockSummaryResponse(assessmentSummaries, flaggedGapsStr, topic);
          State.saveSummary(fallback);
          _synthesisError = null;
        } else {
          _synthesisError = (typeof AI !== 'undefined') ? AI.getFriendlyErrorMessage(err) : (err?.message || 'Failed to generate summary.');
        }
      } finally {
        _isGenerating = false;
        this.render();
      }
    },

    render() {
      const container = document.getElementById('synth-summary-body');
      if (!container) return;

      const state = State.get();
      const isRoadmap = Boolean(window.Roadmap && Roadmap.getProgress);
      const isRoadmapComplete = isRoadmap ? Roadmap.getProgress().pathComplete : false;
      const allComplete = isRoadmapComplete || State.allComplete();
      const completedCount = State.completedCount();
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
      let lockHeaderHtml = '';
      if (window.Roadmap && Roadmap.getProgress) {
        const prog = Roadmap.getProgress();
        lockHeaderHtml = `
          <div class="synth-lock-card">
            <div class="synth-lock-header">
              <div class="synth-lock-badge">
                <span class="synth-lock-icon">🔒</span>
                <div>
                  <strong>Roadmap Completion Required</strong>
                  <p>Complete all ${prog.total} steps on your path to unlock your synthesis summary and visual animations.</p>
                </div>
              </div>
              <div class="synth-lock-progress">
                <div class="synth-progress-meta">
                  <span>Progress: ${prog.completedCount} of ${prog.total} Steps Complete</span>
                  <span>${prog.weightedPct}%</span>
                </div>
                <div class="synth-progress-track">
                  <div class="synth-progress-fill" style="width: ${prog.weightedPct}%;"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        const percent = Math.round((completedCount / 4) * 100);
        lockHeaderHtml = `
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
        `;
      }

      return `
        ${lockHeaderHtml}

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
      const modelName = (typeof AI !== 'undefined' && AI.getModelName) ? AI.getModelName() : 'Gemini';
      const isMock = (typeof AI !== 'undefined' && AI.isMockEnabled) ? AI.isMockEnabled() : false;
      const apiBadgeText = isMock
        ? `<span class="synth-api-badge">🌱 Running in Mock Mode</span>`
        : `<span class="synth-api-badge synth-api-badge--active">⚡ ${modelName} Connected</span>`;

      return `
        ${_synthesisError ? `
          <div class="synth-error-card" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; color: var(--cream);">
            <strong style="color: #ef4444; display: block; margin-bottom: 4px;">⚠️ Synthesis Generation Error</strong>
            <p style="margin: 0 0 10px; font-size: 0.95rem;">${_synthesisError}</p>
            <button type="button" class="btn btn--primary btn--sm" id="btn-generate-summary">Retry generating summary ↺</button>
          </div>
        ` : ''}
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
              ${_synthesisError ? 'Retry Generating Summary' : 'Generate My Summary'}
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
        ${_synthesisError ? `
          <div class="synth-error-card" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; color: var(--cream);">
            <strong style="color: #ef4444; display: block; margin-bottom: 4px;">⚠️ Regeneration Error</strong>
            <p style="margin: 0 0 10px; font-size: 0.95rem;">${_synthesisError}</p>
            <button type="button" class="btn btn--primary btn--sm" id="btn-regenerate-summary">Retry regenerating summary ↺</button>
          </div>
        ` : ''}
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

  /* ── VideoPlayer — Sequential unlock module ─────────────────
   *
   * Three videos unlock one after another:
   *   Video 1 — unlocked when the Synthesis page is reached
   *   Video 2 — unlocked after Video 1 is watched (≥90% or ended)
   *   Video 3 — unlocked after Video 2 is watched
   *
   * Persistence: State.setVideoWatched / State.saveVideoPosition
   *              (backed by localStorage in state.js)
   * ─────────────────────────────────────────────────────────── */
  (function initVideoPlayer() {
    // Wait until the DOM node exists (Synthesis view might not be in the
    // active viewport on first parse, but the element is always in the DOM)
    const seq = document.getElementById('video-sequence');
    if (!seq) return;

    const VIDEOS = [
      { id: 'vid-1', index: 1, videoId: 'video-el-1', cardId: 'video-card-1', wrapId: 'video-wrap-1', lockId: 'video-lock-1', statusId: 'video-status-1' },
      { id: 'vid-2', index: 2, videoId: 'video-el-2', cardId: 'video-card-2', wrapId: 'video-wrap-2', lockId: 'video-lock-2', statusId: 'video-status-2' },
      { id: 'vid-3', index: 3, videoId: 'video-el-3', cardId: 'video-card-3', wrapId: 'video-wrap-3', lockId: 'video-lock-3', statusId: 'video-status-3' },
    ];

    /**
     * Reads the current watch state for all videos and sets the DOM to match.
     * Called once on init and then implicitly after each state change.
     */
    function syncUI() {
      const vp = State.getVideoProgress();

      VIDEOS.forEach(({ id, index, videoId, cardId, lockId, statusId }) => {
        const card    = document.getElementById(cardId);
        const videoEl = document.getElementById(videoId);
        const lockEl  = document.getElementById(lockId);
        const pillEl  = document.getElementById(statusId);
        if (!card || !videoEl) return;

        // Ensure video src matches catalog url field exactly
        const catalogItem = typeof Catalog !== 'undefined' ? Catalog.byId(id) : null;
        const catalogUrl = (catalogItem && catalogItem.url) || (
          index === 1 ? 'assets/videos/video1_foundations.mp4' :
          index === 2 ? 'assets/videos/video2_core_operations.mp4' :
          'assets/videos/video3_self_balancing.mp4'
        );
        if (!videoEl.getAttribute('src') || videoEl.getAttribute('src') !== catalogUrl) {
          videoEl.setAttribute('src', catalogUrl);
          videoEl.src = catalogUrl;
        }

        const isWatched  = Boolean(vp[index]);
        // Synthesis page videos are replay-only (no locking); unlock logic lives in the roadmap
        const isUnlocked = true;

        // Card locked class
        card.classList.remove('video-card--locked');

        // Lock overlay
        if (lockEl) {
          lockEl.style.display = 'none';
        }

        // Enable controls for replay
        videoEl.removeAttribute('disabled');
        videoEl.removeAttribute('aria-hidden');
        videoEl.controls = true;
        videoEl.tabIndex = 0;

        // Status pill
        if (pillEl) {
          pillEl.className = 'video-status-pill';
          if (isWatched) {
            pillEl.classList.add('video-status-pill--watched');
            pillEl.textContent = 'Watched';
          } else if (isUnlocked) {
            pillEl.textContent = 'Ready';
          } else {
            pillEl.classList.add('video-status-pill--locked');
            pillEl.textContent = 'Locked';
          }
        }
      });

      // All-complete banner
      const banner = document.getElementById('video-complete-banner');
      if (banner) {
        const allDone = vp[1] && vp[2] && vp[3];
        if (allDone && banner.hidden) {
          banner.hidden = false; // triggers CSS animation because it was hidden
        } else if (!allDone) {
          banner.hidden = true;
        }
      }
    }

    /**
     * Plays the unlock transition on a card:
     *  - Fade the lock overlay out
     *  - Brighten the card via the videoCardUnlock animation
     *  - Scroll the newly-unlocked card into view
     */
    function playUnlockTransition(videoMeta) {
      const card   = document.getElementById(videoMeta.cardId);
      const lockEl = document.getElementById(videoMeta.lockId);

      if (lockEl) {
        lockEl.classList.add('is-unlocking');
        // Remove overlay from DOM after transition ends
        lockEl.addEventListener('transitionend', () => lockEl.remove(), { once: true });
      }

      if (card) {
        card.classList.add('video-card--unlocking');
        card.addEventListener('animationend', () => {
          card.classList.remove('video-card--unlocking');
        }, { once: true });

        // Scroll into view after a short delay (let animation start)
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    }

    /**
     * Called when a video is considered "watched" (ended or ≥90% progress).
     * Marks it in state, runs the unlock animation on the next card if needed,
     * and triggers a dashboard refresh for the progress ring.
     */
    function onVideoWatched(index) {
      const wasWatched = State.getVideoProgress()[index];
      if (wasWatched) return; // already done — idempotent

      State.setVideoWatched(index);

      // Update UI immediately
      syncUI();

      // Play unlock transition on the NEXT card if it exists
      const nextMeta = VIDEOS.find(v => v.index === index + 1);
      if (nextMeta) {
        // Small delay so the "Watched" pill change settles first
        setTimeout(() => playUnlockTransition(nextMeta), 200);
      }

      // Refresh dashboard progress ring / stats if open
      if (window.Dashboard) window.Dashboard.initFromState();
    }

    /**
     * Restore saved playback position and wire all event listeners
     * for a single video element.
     */
    function attachVideoListeners({ index, videoId }) {
      const videoEl = document.getElementById(videoId);
      if (!videoEl) return;

      // Restore saved position once metadata is available
      const savedPos = State.getVideoPosition(index);
      if (savedPos > 0) {
        const restorePos = () => {
          // Only restore if video is not watched (don't reset to start)
          if (!State.getVideoProgress()[index] && videoEl.duration > 0) {
            videoEl.currentTime = Math.min(savedPos, videoEl.duration - 1);
          }
        };
        if (videoEl.readyState >= 1) {
          restorePos();
        } else {
          videoEl.addEventListener('loadedmetadata', restorePos, { once: true });
        }
      }

      // Watched trigger: video ended naturally
      videoEl.addEventListener('ended', () => {
        onVideoWatched(index);
      });

      // Watched trigger: user scrubbed to ≥90% of duration
      videoEl.addEventListener('timeupdate', () => {
        if (!videoEl.duration || State.getVideoProgress()[index]) return;
        if (videoEl.currentTime / videoEl.duration >= 0.9) {
          onVideoWatched(index);
        }
      });

      // Save playback position on pause / before unload
      const savePos = () => {
        if (videoEl.currentTime > 0) {
          State.saveVideoPosition(index, videoEl.currentTime);
        }
      };
      videoEl.addEventListener('pause', savePos);
      window.addEventListener('beforeunload', savePos, { passive: true });

      // Hard guard: intercept any attempt to play a locked video
      videoEl.addEventListener('play', () => {
        const vp = State.getVideoProgress();
        const isUnlocked = index === 1 || Boolean(vp[index - 1]);
        if (!isUnlocked) {
          videoEl.pause();
        }
      });
    }

    // ── Bootstrap ───────────────────────────────────────────
    syncUI();
    VIDEOS.forEach(attachVideoListeners);

    // Stay reactive to external state changes (e.g. logout / reset)
    State.subscribe(() => syncUI());
  })();

})();

