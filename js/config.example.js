/**
 * js/config.example.js
 * Concept Deep-Dive — Environment Configuration Template
 *
 * Instructions:
 * 1. Copy this template to js/config.js:
 *    cp js/config.example.js js/config.js
 * 2. Replace 'YOUR_GEMINI_API_KEY_HERE' with your Google Gemini API key.
 * 3. js/config.js is gitignored and will never be committed to source control.
 */

window.CDD_CONFIG = {
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  USE_MOCK: false
};

// Backward compatibility for legacy globals
var GEMINI_API_KEY = window.CDD_CONFIG.GEMINI_API_KEY;
