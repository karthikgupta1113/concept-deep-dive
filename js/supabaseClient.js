/**
 * js/supabaseClient.js
 * Concept Deep-Dive — Shared Supabase Client
 *
 * Reads SUPABASE_URL and SUPABASE_ANON_KEY from window.CDD_CONFIG.
 * Exports one shared client instance as `window.supabaseClient`.
 */

(function (global) {
  'use strict';

  function initClient() {
    const config = (typeof window !== 'undefined' && window.CDD_CONFIG) || {};
    const url = config.SUPABASE_URL || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
    const key = config.SUPABASE_ANON_KEY || (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');

    if (!url || !key) {
      console.warn('[supabaseClient] SUPABASE_URL or SUPABASE_ANON_KEY is missing from window.CDD_CONFIG.');
      return null;
    }

    const sbLib = global.supabase || (typeof window !== 'undefined' && window.supabase);
    if (!sbLib || typeof sbLib.createClient !== 'function') {
      console.warn('[supabaseClient] @supabase/supabase-js library is not loaded on window.supabase.');
      return null;
    }

    try {
      const client = sbLib.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'cdd.supabase.auth.token'
        }
      });
      return client;
    } catch (err) {
      console.error('[supabaseClient] Failed to initialize Supabase client:', err);
      return null;
    }
  }

  // Create shared client instance
  let sharedClient = initClient();

  // If config or CDN loaded slightly after, allow re-initialization
  function getClient() {
    if (!sharedClient) {
      sharedClient = initClient();
    }
    return sharedClient;
  }

  global.supabaseClient = sharedClient;
  global.getSupabaseClient = getClient;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { supabaseClient: sharedClient, getSupabaseClient: getClient };
  }
})(typeof window !== 'undefined' ? window : this);
