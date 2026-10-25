/**
 * js/ai.js
 * Centralized Gemini AI Integration via Supabase Edge Function Proxy
 *
 * Requirements:
 * 1. Single entry point: AI.call({ system, messages, json, schema, profile, maxTokens })
 *    - Calls Gemini strictly through Supabase Edge Function: SUPABASE_URL + "/functions/v1/gemini-proxy"
 *    - Never holds or sends a Gemini API key in the browser
 *    - Headers: Authorization: Bearer <access token>, apikey: <SUPABASE_ANON_KEY>, Content-Type: application/json
 *    - Body: { systemInstruction, contents, generationConfig }
 * 2. Model configuration:
 *    - Model name is configured and enforced by the server proxy
 *    - Browser reports "server" as the model in AI.selfTest() and #/debug
 * 3. Typed errors: AIError
 *    - NOT_SIGNED_IN (HTTP 401): "Please sign in again to use the tutor." + redirects to #/login
 *    - SERVER_NOT_CONFIGURED (HTTP 500 with SERVER_NOT_CONFIGURED): "The AI isn't set up yet. Tell the project owner."
 *    - NO_KEY: Supabase settings (SUPABASE_URL / SUPABASE_ANON_KEY) are missing from config.js
 *    - RATE_LIMIT (HTTP 429), SERVER (HTTP 500+), NETWORK, TIMEOUT (20s), BAD_RESPONSE
 *    - Retry ONCE after 1.5s for RATE_LIMIT, SERVER, and NETWORK
 * 4. Structured evaluation output:
 *    - JSON mode + schema validation
 *    - 1 repair attempt if JSON parsing fails
 * 5. Self-test & diagnostics: AI.selfTest() probing the server proxy
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    root.AI = exports.AI;
    root.AIError = exports.AIError;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ── 1. Configuration Constants ──────────────────────────────────────── */
  const TIMEOUT_MS = 20000; // 20-second timeout

  /* ── 2. Error Class & User-Facing Messages ─────────────────────────── */
  const ERROR_MESSAGES = {
    NOT_SIGNED_IN: 'Please sign in again to use the tutor.',
    SERVER_NOT_CONFIGURED: "The AI isn't set up yet. Tell the project owner.",
    NO_KEY: 'Supabase configuration is missing from config.js. Running in mock mode.',
    BAD_KEY: "The API credentials are not valid. Ask the project owner to check them.",
    MODEL_NOT_FOUND: 'The AI model or proxy endpoint could not be found.',
    RATE_LIMIT: 'The AI service is busy. Try again in a moment.',
    SERVER: 'The AI service encountered an error. Please try again.',
    NETWORK: "The tutor can't reach the AI right now. Check your connection and retry.",
    TIMEOUT: 'The AI request timed out. Please try again.',
    BAD_RESPONSE: "I couldn't evaluate that. Please try again."
  };

  class AIError extends Error {
    constructor(code, message, originalError = null, status = null) {
      const friendly = ERROR_MESSAGES[code] || message || 'AI service error.';
      super(message || friendly);
      this.name = 'AIError';
      this.code = code;
      this.friendlyMessage = friendly;
      this.originalError = originalError;
      this.status = status;
      this.timestamp = Date.now();
    }
  }

  /* ── 3. Diagnostic State Tracking ──────────────────────────────────── */
  const _recentErrors = [];
  function _recordError(err) {
    if (!(err instanceof AIError)) {
      err = new AIError(err.code || 'BAD_RESPONSE', err.message, err);
    }
    _recentErrors.unshift({
      code: err.code,
      message: err.message,
      friendlyMessage: err.friendlyMessage,
      status: err.status,
      timestamp: err.timestamp || Date.now()
    });
    if (_recentErrors.length > 10) {
      _recentErrors.pop();
    }
  }

  /* ── 4. Supabase Configuration & Session Helpers ───────────────────── */
  function getSupabaseConfig() {
    let url = '';
    let anonKey = '';

    if (typeof window !== 'undefined' && window.CDD_CONFIG) {
      url = window.CDD_CONFIG.SUPABASE_URL || '';
      anonKey = window.CDD_CONFIG.SUPABASE_ANON_KEY || '';
    } else if (typeof globalThis !== 'undefined' && globalThis.CDD_CONFIG) {
      url = globalThis.CDD_CONFIG.SUPABASE_URL || '';
      anonKey = globalThis.CDD_CONFIG.SUPABASE_ANON_KEY || '';
    }

    if (!url && typeof SUPABASE_URL !== 'undefined') url = SUPABASE_URL;
    if (!anonKey && typeof SUPABASE_ANON_KEY !== 'undefined') anonKey = SUPABASE_ANON_KEY;

    if (typeof process !== 'undefined' && process.env) {
      if (!url && process.env.SUPABASE_URL) url = process.env.SUPABASE_URL;
      if (!anonKey && process.env.SUPABASE_ANON_KEY) anonKey = process.env.SUPABASE_ANON_KEY;
    }

    url = (typeof url === 'string') ? url.trim() : '';
    anonKey = (typeof anonKey === 'string') ? anonKey.trim() : '';

    if (url === 'YOUR_SUPABASE_URL_HERE') url = '';
    if (anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') anonKey = '';

    return { url, anonKey };
  }

  function isSupabaseConfigured() {
    const { url, anonKey } = getSupabaseConfig();
    return Boolean(url && anonKey);
  }

  function isMockEnabled() {
    if (typeof window !== 'undefined' && window.CDD_CONFIG && window.CDD_CONFIG.USE_MOCK === true) {
      return true;
    }
    if (typeof globalThis !== 'undefined' && globalThis.CDD_CONFIG && globalThis.CDD_CONFIG.USE_MOCK === true) {
      return true;
    }
    return !isSupabaseConfigured();
  }

  async function getAccessToken() {
    // 1. Explicit override for testing environments
    if (typeof window !== 'undefined' && window.CDD_CONFIG && window.CDD_CONFIG.ACCESS_TOKEN) {
      return window.CDD_CONFIG.ACCESS_TOKEN;
    }
    if (typeof globalThis !== 'undefined' && globalThis.CDD_CONFIG && globalThis.CDD_CONFIG.ACCESS_TOKEN) {
      return globalThis.CDD_CONFIG.ACCESS_TOKEN;
    }

    // 2. Query active Supabase client session
    try {
      const client = (typeof window !== 'undefined' && window.supabaseClient) ||
        (typeof globalThis !== 'undefined' && globalThis.supabaseClient) ||
        (typeof getSupabaseClient === 'function' ? getSupabaseClient() : null);
      if (client && client.auth && typeof client.auth.getSession === 'function') {
        const { data } = await client.auth.getSession();
        if (data?.session?.access_token) {
          return data.session.access_token;
        }
      }
    } catch (_) {}

    // 3. Fallback: inspect persisted session token in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('cdd.supabase.auth.token');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) return parsed.access_token;
          if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
        }
      }
    } catch (_) {}

    return '';
  }

  function triggerRedirectToLogin() {
    if (typeof window === 'undefined') return;
    // Slight defer so in-flight UI can render the error message first
    setTimeout(() => {
      try {
        if (window.Router && typeof window.Router.go === 'function') {
          window.Router.go('/login');
        } else if (typeof window.location !== 'undefined') {
          window.location.hash = '#/login';
        }
        if (window.Auth && typeof window.Auth.showAlert === 'function') {
          window.Auth.showAlert('Please sign in again to use the tutor.', 'warning');
        }
      } catch (_) {}
    }, 1200);
  }

  /* ── 5. Standard Evaluation Schemas ────────────────────────────────── */
  const EVALUATION_SCHEMA = {
    type: 'OBJECT',
    properties: {
      rating: {
        type: 'STRING',
        enum: ['solid', 'partial', 'needs_review']
      },
      feedback: { type: 'STRING' },
      missing: { type: 'STRING' },
      suggestion: { type: 'STRING' },
      gap: { type: 'STRING' }
    },
    required: ['rating', 'feedback']
  };

  const ASSIGNMENT_SCHEMA = {
    type: 'OBJECT',
    properties: {
      criteria: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            title: { type: 'STRING' },
            score: { type: 'INTEGER' },
            feedback: { type: 'STRING' }
          },
          required: ['id', 'score', 'feedback']
        }
      },
      nextStep: { type: 'STRING' }
    },
    required: ['criteria', 'nextStep']
  };

  /* ── 6. Raw Network Call to Supabase Edge Function Proxy ────────────── */
  async function _executeFetch(payload) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

    const { url: supabaseUrl, anonKey } = getSupabaseConfig();
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const proxyUrl = `${cleanUrl}/functions/v1/gemini-proxy`;
    const accessToken = await getAccessToken();

    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${accessToken || ''}`
    };

    let response;
    try {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new AIError('TIMEOUT', 'Request exceeded 20 seconds timeout.', err);
      }
      // Network disconnect / offline / CORS / DNS failure
      throw new AIError('NETWORK', "The tutor can't reach the AI right now. Check your connection and retry.", err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch (_) {}

      const status = response.status;

      // HTTP 401 -> NOT_SIGNED_IN and redirect to #/login
      if (status === 401) {
        triggerRedirectToLogin();
        throw new AIError('NOT_SIGNED_IN', 'Please sign in again to use the tutor.', null, 401);
      }

      // HTTP 500 with SERVER_NOT_CONFIGURED -> friendly message
      if (status === 500 && (errBody.includes('SERVER_NOT_CONFIGURED') || errBody.includes('server_not_configured'))) {
        throw new AIError('SERVER_NOT_CONFIGURED', "The AI isn't set up yet. Tell the project owner.", null, 500);
      }

      if (status === 429) {
        throw new AIError('RATE_LIMIT', `AI service rate limit exceeded (HTTP 429): ${errBody}`, null, status);
      }

      if (status >= 500 && status < 600) {
        throw new AIError('SERVER', `AI server error (HTTP ${status}): ${errBody}`, null, status);
      }

      if (status === 400 || status === 403) {
        throw new AIError('BAD_KEY', `Request rejected (HTTP ${status}): ${errBody}`, null, status);
      }

      if (status === 404) {
        throw new AIError('MODEL_NOT_FOUND', `Proxy endpoint or model not found (HTTP 404): ${errBody}`, null, status);
      }

      throw new AIError('BAD_RESPONSE', `HTTP error ${status}: ${errBody}`, null, status);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new AIError('BAD_RESPONSE', 'Invalid JSON returned from AI endpoint.', err);
    }

    return data;
  }

  /* ── 7. Single Entry Point: AI.call ─────────────────────────────────── */
  /**
   * AI.call({ system, messages, json, schema, profile, maxTokens, temperature })
   *
   * @param {Object} opts
   * @param {string} [opts.system] - System instruction prompt
   * @param {Array<Object>} [opts.messages] - Message history (only last 10 turns sent)
   * @param {boolean} [opts.json=false] - When true, enforces JSON mode & parses response
   * @param {Object} [opts.schema] - JSON schema for structured output
   * @param {Object} [opts.profile] - Optional student support profile
   * @param {number} [opts.maxTokens] - Output token ceiling
   * @param {number} [opts.temperature] - Generation temperature
   * @returns {Promise<string|Object>} Text response or parsed JSON object
   */
  async function call(opts = {}) {
    const {
      system = '',
      messages = [],
      json = false,
      schema = null,
      profile = null,
      maxTokens = null,
      temperature = null
    } = opts;

    if (!isSupabaseConfigured()) {
      const err = new AIError('NO_KEY', 'Supabase configuration is missing from config.js.');
      _recordError(err);
      throw err;
    }

    // Append support profile block to system prompt if not already present
    let fullSystem = typeof system === 'string' ? system : '';
    if (!fullSystem.includes('Student support profile:')) {
      let prof = profile;
      if (!prof && typeof MindsetEngine !== 'undefined' && MindsetEngine.getEffectiveSupport) {
        const eff = MindsetEngine.getEffectiveSupport();
        prof = Object.assign({}, eff.support, { goal: eff.goal });
      }
      if (prof && typeof prof === 'object') {
        const pTone = prof.tone || 'neutral';
        const pChunk = prof.chunk || 'normal';
        const pHints = prof.hintPolicy || 'normal';
        const pPraise = prof.praise || 'process';
        const pPacing = prof.pacing || 'normal';
        const pGoal = prof.goal || 'deep-dive';
        const opening = prof.tutorOpeningPrompt ? `Open your response with: "${prof.tutorOpeningPrompt}". ` : '';
        fullSystem += `\n\n${opening}Student support profile: tone=${pTone}; chunk size=${pChunk}; hints=${pHints}; praise style=${pPraise}; pacing=${pPacing}; goal=${pGoal}. Rules: Follow the profile. With gentle tone, keep replies short (under 80 words), one idea at a time, and normalise mistakes. With challenging tone, ask for predictions and edge cases. Use process praise ("you broke it down well") rather than ability praise ("you're smart"). Ask at most one question per reply. NEVER name or guess the student's emotions or personality, and never say you detected anything about them. If the student writes something that suggests serious distress beyond studying, respond with warmth, say you are glad they said it, and encourage them to talk to someone they trust or the college counsellor, without trying to give therapy. Then offer to continue or pause.`;
      }
    }

    // Format messages: only last 10 turns are sent
    const rawHistory = Array.isArray(messages) ? messages.slice(-10) : [];
    const contents = rawHistory.map(m => {
      const isUser = (m.sender === 'student' || m.role === 'user');
      const text = typeof m.text === 'string' ? m.text : (typeof m.content === 'string' ? m.content : '');
      return {
        role: isUser ? 'user' : 'model',
        parts: [{ text }]
      };
    });

    // Build payload: body has systemInstruction, contents, and generationConfig, exactly the shape used before
    const payload = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : (json ? 0.2 : 0.7),
        maxOutputTokens: typeof maxTokens === 'number' ? maxTokens : (json ? 600 : 800)
      }
    };

    if (fullSystem.trim()) {
      payload.systemInstruction = {
        parts: [{ text: fullSystem.trim() }]
      };
    }

    if (json) {
      payload.generationConfig.responseMimeType = 'application/json';
      if (schema) {
        payload.generationConfig.responseSchema = schema;
      }
    }

    // Execute with 1-time retry for RATE_LIMIT, SERVER, and NETWORK
    let data;
    try {
      data = await _executeFetch(payload);
    } catch (err) {
      if (err instanceof AIError && (err.code === 'RATE_LIMIT' || err.code === 'SERVER' || err.code === 'NETWORK')) {
        // Wait 1.5 seconds and retry ONCE
        await new Promise(res => setTimeout(res, 1500));
        try {
          data = await _executeFetch(payload);
        } catch (retryErr) {
          _recordError(retryErr);
          throw retryErr;
        }
      } else {
        _recordError(err);
        throw err;
      }
    }

    // Gemini answer comes back in the same format as before
    const candidate = data.candidates?.[0];
    const candidateText = candidate?.content?.parts?.[0]?.text ?? (typeof data.text === 'string' ? data.text : null);

    if (!candidateText || typeof candidateText !== 'string') {
      const err = new AIError('BAD_RESPONSE', 'Empty candidate payload received from AI endpoint.');
      _recordError(err);
      throw err;
    }

    // Handle plain text response
    if (!json) {
      return candidateText;
    }

    // Handle structured JSON response
    let parsed;
    try {
      parsed = JSON.parse(candidateText);
    } catch (firstErr) {
      // Clean possible markdown code fences (```json ... ```)
      const cleaned = candidateText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (secondErr) {
        // One repair retry asking Gemini for valid JSON only
        try {
          const repairPayload = {
            contents: [{
              role: 'user',
              parts: [{ text: `The following text failed JSON parsing:\n\n${candidateText}\n\nRepair it and return ONLY valid, well-formed JSON matching the required schema. No markdown formatting, no explanations.` }]
            }],
            systemInstruction: { parts: [{ text: 'Respond with valid raw JSON only.' }] },
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 600
            }
          };
          if (schema) repairPayload.generationConfig.responseSchema = schema;

          const repairData = await _executeFetch(repairPayload);
          const repairCandidate = repairData.candidates?.[0]?.content?.parts?.[0]?.text ?? (typeof repairData.text === 'string' ? repairData.text : '');
          const cleanedRepair = repairCandidate.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          parsed = JSON.parse(cleanedRepair);
        } catch (repairErr) {
          const err = new AIError('BAD_RESPONSE', "I couldn't evaluate that. Please try again.", repairErr);
          _recordError(err);
          throw err;
        }
      }
    }

    return parsed;
  }

  /* ── 8. Diagnostics & Self-Test ─────────────────────────────────────── */
  /**
   * AI.selfTest()
   * Probes the Supabase Edge Function proxy.
   * Prints: proxy status, model name ("server"), result and latency.
   * Returns: { ok, model: 'server', proxyUrl, latencyMs, result, error }
   */
  async function selfTest() {
    const isConfigured = isSupabaseConfigured();
    const { url: supabaseUrl } = getSupabaseConfig();
    const proxyUrl = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/gemini-proxy` : '[NONE]';
    const token = await getAccessToken();
    const hasSession = !!token;

    console.log('%c[AI.selfTest] Starting Edge Function Proxy Diagnostics...', 'color: #5FAB7A; font-weight: bold;');
    console.log(`[AI.selfTest] Supabase Configured: ${isConfigured ? 'Yes' : 'No'}`);
    console.log(`[AI.selfTest] Proxy URL: ${proxyUrl}`);
    console.log(`[AI.selfTest] Auth Session: ${hasSession ? 'Active' : 'No active session'}`);
    console.log(`[AI.selfTest] Model: server`);

    if (!isConfigured) {
      console.warn('[AI.selfTest] Result: FAILED (NO_KEY) — Supabase settings missing from config.js, running in mock mode.');
      return {
        ok: false,
        model: 'server',
        proxyUrl,
        latencyMs: 0,
        error: 'NO_KEY',
        message: 'Supabase configuration is missing from config.js.'
      };
    }

    const start = Date.now();
    try {
      const res = await call({
        system: 'You are a test ping bot. Respond with the exact word "OK" only.',
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 10,
        temperature: 0.1
      });
      const latencyMs = Date.now() - start;
      const cleanRes = String(res).trim();

      console.log(`%c[AI.selfTest] Status: SUCCESS (${latencyMs}ms)`, 'color: #5FAB7A;');
      console.log(`[AI.selfTest] Model Output: "${cleanRes}"`);

      return {
        ok: true,
        model: 'server',
        proxyUrl,
        latencyMs,
        result: cleanRes
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      console.error(`%c[AI.selfTest] Status: FAILED [${err.code || 'UNKNOWN'}] (${latencyMs}ms)`, 'color: #e06c75;');
      console.error(`[AI.selfTest] Error details:`, err.friendlyMessage || err.message);

      return {
        ok: false,
        model: 'server',
        proxyUrl,
        latencyMs,
        error: err.code || 'ERROR',
        message: err.friendlyMessage || err.message
      };
    }
  }

  /* ── Public API ─────────────────────────────────────────────────────── */
  const AI = {
    call,
    selfTest,
    getApiKey() {
      // Kept for legacy callers; browser never holds a Gemini key
      return '';
    },
    getSupabaseConfig,
    isSupabaseConfigured,
    isConfigured: isSupabaseConfigured,
    getAccessToken,
    isMockEnabled,
    getRecentErrors() {
      return [..._recentErrors];
    },
    getFriendlyErrorMessage(err) {
      if (err instanceof AIError && err.friendlyMessage) return err.friendlyMessage;
      if (err && err.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
      return err?.message || 'An error occurred while communicating with the AI.';
    },
    getModelName() {
      return 'server';
    },
    setModelName(_name) {
      // Model name is managed on the server
    },
    schemas: {
      EVALUATION: EVALUATION_SCHEMA,
      ASSIGNMENT: ASSIGNMENT_SCHEMA
    }
  };

  return { AI, AIError };
});
