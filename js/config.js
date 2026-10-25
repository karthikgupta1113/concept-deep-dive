/**
 * js/config.js
 * Local configuration for Concept Deep-Dive.
 * Gitignored to prevent leaking credentials.
 */

window.CDD_CONFIG = {
  SUPABASE_URL: "https://tbbfhxygrljeqpxwgfsa.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_SjW1_lUHNclOTNcwgiKmKQ_5OxBk8w6",
  USE_MOCK: false
};
// Backward compatibility for legacy globals
var SUPABASE_URL = window.CDD_CONFIG.SUPABASE_URL;
var SUPABASE_ANON_KEY = window.CDD_CONFIG.SUPABASE_ANON_KEY;