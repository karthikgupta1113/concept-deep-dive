/**
 * js/config.example.js
 * Concept Deep-Dive — Environment Configuration Template
 *
 * Instructions:
 * 1. Copy this template to js/config.js:
 *    cp js/config.example.js js/config.js
 * 2. Replace the placeholders with your Supabase credentials.
 * 3. js/config.js is gitignored and will never be committed to source control.
 */

window.CDD_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL_HERE",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY_HERE",
  USE_MOCK: false
};

// Backward compatibility for legacy globals
var SUPABASE_URL = window.CDD_CONFIG.SUPABASE_URL;
var SUPABASE_ANON_KEY = window.CDD_CONFIG.SUPABASE_ANON_KEY;