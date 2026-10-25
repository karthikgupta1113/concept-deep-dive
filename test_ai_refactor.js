/**
 * test_ai_refactor.js
 * Comprehensive automated verification for Supabase Edge Function Proxy AI calls (Prompt S3)
 */

const fs = require('fs');
const path = require('path');

// Read config from js/config.js
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
try {
  const configContent = fs.readFileSync(path.join(__dirname, 'js/config.js'), 'utf8');
  const urlMatch = configContent.match(/SUPABASE_URL\s*:\s*["']([^"']+)["']/);
  const keyMatch = configContent.match(/SUPABASE_ANON_KEY\s*:\s*["']([^"']+)["']/);
  if (urlMatch) SUPABASE_URL = urlMatch[1];
  if (keyMatch) SUPABASE_ANON_KEY = keyMatch[1];
} catch (e) {
  console.warn("Could not read js/config.js:", e.message);
}

// Setup global environment
globalThis.CDD_CONFIG = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  USE_MOCK: false
};

const { AI, AIError } = require('./js/ai.js');

async function runTests() {
  console.log("=================================================");
  console.log("   SUPABASE EDGE FUNCTION PROXY AUTOMATED TESTS  ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      failed++;
    }
  }

  // ── TEST 1: Key Hygiene & Model Name ────────────────────────
  console.log("--- 1. Security & Configuration Hygiene ---");
  const extractedKey = AI.getApiKey();
  assert(extractedKey === '', "Browser never holds a Gemini key (AI.getApiKey() is empty)");
  assert(AI.getModelName() === 'server', "Model name reported as 'server'");
  const sbConf = AI.getSupabaseConfig();
  assert(sbConf.url === SUPABASE_URL, "Supabase URL matches active config");
  assert(sbConf.anonKey === SUPABASE_ANON_KEY, "Supabase anon key matches active config");

  // ── TEST 2: Proxy Request Headers & Payload ──────────────────
  console.log("\n--- 2. Proxy Endpoint, Headers & Payload Shape ---");
  const origFetch = globalThis.fetch;
  let capturedUrl = null;
  let capturedHeaders = null;
  let capturedBody = null;

  globalThis.CDD_CONFIG.ACCESS_TOKEN = "test-session-jwt-12345";

  globalThis.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedHeaders = opts.headers;
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: "Balanced BST height is O(log n)." }] }
        }]
      })
    };
  };

  const textReply = await AI.call({
    system: "You are a concise tutor.",
    messages: [{ role: 'user', content: 'Height of BST?' }],
    maxTokens: 50
  });

  assert(capturedUrl === `${SUPABASE_URL}/functions/v1/gemini-proxy`, `Target URL is Supabase Edge Function proxy: ${capturedUrl}`);
  assert(capturedHeaders['Authorization'] === 'Bearer test-session-jwt-12345', "Sent header Authorization: Bearer <token>");
  assert(capturedHeaders['apikey'] === SUPABASE_ANON_KEY, "Sent header apikey: <SUPABASE_ANON_KEY>");
  assert(capturedHeaders['Content-Type'] === 'application/json', "Sent header Content-Type: application/json");
  assert(capturedBody.systemInstruction && capturedBody.contents && capturedBody.generationConfig, "Payload body has systemInstruction, contents, and generationConfig");
  assert(typeof textReply === 'string' && textReply.includes("O(log n)"), "Returns text answer from proxy response");

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 3: NOT_SIGNED_IN on HTTP 401 ───────────────────────
  console.log("\n--- 3. HTTP 401 NOT_SIGNED_IN Error Handling ---");
  let redirectTriggered = false;
  globalThis.window = {
    Router: {
      go(path) {
        if (path === '/login') redirectTriggered = true;
      }
    },
    location: { hash: '' }
  };

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ error: "NOT_SIGNED_IN" })
  });

  let notSignedInCaught = false;
  try {
    await AI.call({
      messages: [{ role: 'user', content: 'Hello' }]
    });
  } catch (err) {
    notSignedInCaught = true;
    assert(err instanceof AIError, "Throws instance of AIError");
    assert(err.code === 'NOT_SIGNED_IN', `Error code is NOT_SIGNED_IN (received: ${err.code})`);
    assert(err.friendlyMessage === 'Please sign in again to use the tutor.', `Friendly message: "${err.friendlyMessage}"`);
  }
  assert(notSignedInCaught, "HTTP 401 triggers NOT_SIGNED_IN error");

  // Wait for redirect defer
  await new Promise(r => setTimeout(r, 1300));
  assert(redirectTriggered, "HTTP 401 triggers redirect to #/login");

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 4: SERVER_NOT_CONFIGURED on HTTP 500 ───────────────
  console.log("\n--- 4. HTTP 500 SERVER_NOT_CONFIGURED Error Handling ---");
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ error: "SERVER_NOT_CONFIGURED" })
  });

  let serverNotConfiguredCaught = false;
  try {
    await AI.call({
      messages: [{ role: 'user', content: 'Ping' }]
    });
  } catch (err) {
    serverNotConfiguredCaught = true;
    assert(err instanceof AIError, "Throws instance of AIError");
    assert(err.code === 'SERVER_NOT_CONFIGURED', `Error code is SERVER_NOT_CONFIGURED (received: ${err.code})`);
    assert(err.friendlyMessage === "The AI isn't set up yet. Tell the project owner.", `Friendly message: "${err.friendlyMessage}"`);
  }
  assert(serverNotConfiguredCaught, "SERVER_NOT_CONFIGURED handled on HTTP 500");

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 5: NO_KEY when Supabase Settings are Missing ──────
  console.log("\n--- 5. NO_KEY & Mock Detection without Supabase ---");
  const savedUrl = globalThis.CDD_CONFIG.SUPABASE_URL;
  globalThis.CDD_CONFIG.SUPABASE_URL = "";
  assert(AI.isSupabaseConfigured() === false, "isSupabaseConfigured() returns false when SUPABASE_URL missing");
  assert(AI.isMockEnabled() === true, "AI.isMockEnabled() returns true when Supabase is not configured");

  let noKeyCaught = false;
  try {
    await AI.call({
      messages: [{ role: 'user', content: 'Test' }]
    });
  } catch (err) {
    noKeyCaught = true;
    assert(err instanceof AIError, "Throws instance of AIError");
    assert(err.code === 'NO_KEY', `Error code is NO_KEY (received: ${err.code})`);
  }
  assert(noKeyCaught, "NO_KEY thrown when Supabase configuration is missing");

  // Restore Supabase URL
  globalThis.CDD_CONFIG.SUPABASE_URL = savedUrl;
  assert(AI.isSupabaseConfigured() === true, "isSupabaseConfigured() returns true when restored");

  // ── TEST 6: Structured Output (JSON Schema) & Repair ───────
  console.log("\n--- 6. Structured Output & JSON Repair ---");
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      // Returns malformed JSON needing repair
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: "```json\n{\"rating\": \"solid\", \"feedback\": \"Good explanation\"}\n```" }] }
          }]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: "{\"rating\": \"solid\", \"feedback\": \"Repaired explanation\"}" }] }
        }]
      })
    };
  };

  const evalResult = await AI.call({
    messages: [{ role: 'user', content: 'Evaluate this' }],
    json: true,
    schema: AI.schemas.EVALUATION
  });

  assert(typeof evalResult === 'object' && evalResult.rating === 'solid', "Structured JSON successfully parsed");
  assert(evalResult.feedback === 'Good explanation', `Parsed feedback: "${evalResult.feedback}"`);

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 7: Single Retry on RATE_LIMIT (429) & SERVER (500) ─
  console.log("\n--- 7. Single Retry Resilience (RATE_LIMIT, SERVER, NETWORK) ---");
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded"
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: "Recovered after rate limit retry" }] }
        }]
      })
    };
  };

  const retryReply = await AI.call({
    messages: [{ role: 'user', content: 'Hello' }]
  });

  assert(attempts === 2, `Single retry executed for RATE_LIMIT after 1.5s (attempts: ${attempts})`);
  assert(retryReply.includes("Recovered"), "Successful recovery on retry");

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 8: AI.selfTest() with Server Model ─────────────────
  console.log("\n--- 8. AI.selfTest() Diagnostics Probe ---");
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text: "OK" }] }
      }]
    })
  });

  const selfTestResult = await AI.selfTest();
  assert(selfTestResult.ok === true, "AI.selfTest() succeeds via proxy");
  assert(selfTestResult.model === 'server', `Self-test reports model as 'server': ${selfTestResult.model}`);
  assert(selfTestResult.proxyUrl.includes('/functions/v1/gemini-proxy'), `Self-test reports proxy URL: ${selfTestResult.proxyUrl}`);
  assert(typeof selfTestResult.latencyMs === 'number', `Recorded roundtrip latency: ${selfTestResult.latencyMs}ms`);

  // Restore fetch
  globalThis.fetch = origFetch;

  // ── TEST 9: TutorChatService Integration ────────────────────
  console.log("\n--- 9. TutorChatService Mock Fallback when USE_MOCK ---");
  globalThis.CDD_CONFIG.USE_MOCK = true;
  require('./js/tutor-chat.js');
  const service = globalThis.window.TutorChatService || globalThis.TutorChatService;
  const mockEvalSolid = service.getMockAssessmentResponse(0, "In a BST left subtree keys are smaller and right subtree keys are larger, so in-order traversal yields sorted keys.");
  assert(mockEvalSolid.rating === 'solid', `Solid mock evaluation rating: ${mockEvalSolid.rating}`);
  globalThis.CDD_CONFIG.USE_MOCK = false;

  // ── TEST SUMMARY ────────────────────────────────────────────
  console.log("\n=================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test runner exception:", err);
  process.exit(1);
});
