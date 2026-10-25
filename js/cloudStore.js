/**
 * js/cloudStore.js
 * Concept Deep-Dive — Supabase Cloud Sync Engine (Prompt S2)
 *
 * Implements:
 *   - Local-first persistence (UI reads/writes local cache, never waits for network)
 *   - path_state: Full PathStore snapshot, highest preparation percentage (max_preparation), updated_at
 *   - events: Telemetry events (append-only)
 *   - checkins: Check-in records
 *   - chat_messages: Tutor & student messages with step_id
 *   - assessment_results: Quizzes, assignments, placements, retrieval results with detailed feedback
 *   - summaries: Synthesis summary (one per topic, updated)
 *   - profiles: Level, goal, display name
 *   - Debounced writes (path_state 1.5s debounce)
 *   - Batched queues (events, checkins, chat, results every 10s & on hidden tab)
 *   - Offline resilience via localStorage queue (never loses or duplicates rows)
 *   - Top bar status badge: "Saving…", "Saved ✓", "Offline, will sync"
 *   - Multi-device sync: On login & on tab focus, loads newer cloud copy
 *   - Delete learning data: Purges events, checkins, chat_messages in cloud & local, preserves path_state
 */

(function (global) {
  'use strict';

  const BATCH_INTERVAL_MS = 10000; // 10 seconds
  const DEBOUNCE_PATH_STATE_MS = 1500; // 1.5 seconds

  let _debounceTimer = null;
  let _batchIntervalTimer = null;
  let _isSyncing = false;
  let _pendingPathState = null;
  let _lastSeenCloudUpdatedAt = null;
  let _highestPreparation = 0;
  let _mockOnline = null;

  /* ── Online Status Helper ─────────────────────────────────── */
  function isOnline() {
    if (typeof _mockOnline === 'boolean') return _mockOnline;
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /* ── Status Badge Management ─────────────────────────────── */
  function updateSyncBadge(status) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('topbar-sync-status');
    const textEl = document.getElementById('sync-status-text');
    if (!container || !textEl) return;

    container.dataset.status = status;

    if (status === 'saving') {
      textEl.textContent = 'Saving…';
      container.title = 'Syncing changes to cloud…';
    } else if (status === 'offline') {
      textEl.textContent = 'Offline, will sync';
      container.title = 'Working offline. Changes are saved locally and will sync when reconnected.';
    } else {
      textEl.textContent = 'Saved ✓';
      container.title = 'All progress safely saved to the cloud.';
    }
  }

  /* ── User & Supabase Client Helpers ──────────────────────── */
  function getClient() {
    return global.supabaseClient ||
      (typeof window !== 'undefined' && window.supabaseClient) ||
      (typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null) ||
      (typeof window !== 'undefined' && typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
  }

  function getActiveUserId() {
    const s = (typeof State !== 'undefined') ? State : ((typeof window !== 'undefined' && window.State) || (typeof global !== 'undefined' && global.State) || null);
    if (s && typeof s.get === 'function') {
      const u = s.get()?.currentUser;
      if (u && u.id) return u.id;
    }
    const ps = (typeof PathStore !== 'undefined') ? PathStore : ((typeof window !== 'undefined' && window.PathStore) || (typeof global !== 'undefined' && global.PathStore) || null);
    if (ps && typeof ps.getSessionUser === 'function') {
      const u = ps.getSessionUser();
      if (u && u.id) return u.id;
    }
    return null;
  }

  function getQueueStorageKey(userId) {
    return `cdd_cloud_queue_${userId || 'anon'}`;
  }

  /* ── Queue Management (LocalStorage backed) ───────────────── */
  function getQueue(userId = getActiveUserId()) {
    try {
      if (typeof localStorage === 'undefined') return { events: [], checkins: [], chat_messages: [], assessment_results: [] };
      const raw = localStorage.getItem(getQueueStorageKey(userId));
      const q = raw ? JSON.parse(raw) : null;
      return {
        events: Array.isArray(q?.events) ? q.events : [],
        checkins: Array.isArray(q?.checkins) ? q.checkins : [],
        chat_messages: Array.isArray(q?.chat_messages) ? q.chat_messages : [],
        assessment_results: Array.isArray(q?.assessment_results) ? q.assessment_results : [],
      };
    } catch (e) {
      console.warn('[CloudStore] Error reading queue:', e);
      return { events: [], checkins: [], chat_messages: [], assessment_results: [] };
    }
  }

  function saveQueue(queue, userId = getActiveUserId()) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(getQueueStorageKey(userId), JSON.stringify(queue));
    } catch (e) {
      console.warn('[CloudStore] Error saving queue:', e);
    }
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }

  function enqueue(tableName, item) {
    const userId = getActiveUserId();
    if (!userId) return; // Only enqueue for authenticated users

    const queue = getQueue(userId);
    if (!Array.isArray(queue[tableName])) {
      queue[tableName] = [];
    }

    const record = Object.assign({
      id: item.id || generateUUID(),
      user_id: userId,
      created_at: item.created_at || new Date().toISOString()
    }, item);

    queue[tableName].push(record);
    saveQueue(queue, userId);

    if (isOnline()) {
      updateSyncBadge('saving');
    } else {
      updateSyncBadge('offline');
    }
  }

  /* ── Highest Preparation Helper ──────────────────────────── */
  function computeCurrentPreparation() {
    let pct = 0;
    if (typeof Roadmap !== 'undefined' && Roadmap.getProgress) {
      pct = Roadmap.getProgress()?.weightedPct || 0;
    } else if (typeof State !== 'undefined' && State.computeMasteredPercent) {
      pct = State.computeMasteredPercent();
    }
    _highestPreparation = Math.max(_highestPreparation, pct);
    return _highestPreparation;
  }

  /* ── 1. Path State Sync (Debounced 1.5s) ──────────────────── */
  function onPathStateChanged(payload) {
    const userId = getActiveUserId();
    if (!userId) return;

    _pendingPathState = payload;
    computeCurrentPreparation();

    if (!isOnline()) {
      updateSyncBadge('offline');
      return;
    }

    updateSyncBadge('saving');

    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      savePendingPathState();
    }, DEBOUNCE_PATH_STATE_MS);
  }

  async function savePendingPathState() {
    const userId = getActiveUserId();
    const client = getClient();
    if (!userId || !client || !_pendingPathState) return;

    if (!isOnline()) {
      updateSyncBadge('offline');
      return;
    }

    const payload = _pendingPathState;
    const maxPrep = computeCurrentPreparation();
    const updatedAt = new Date(payload.updatedAt || Date.now()).toISOString();

    try {
      const { error } = await client
        .from('path_state')
        .upsert({
          user_id: userId,
          state: payload,
          max_preparation: maxPrep,
          updated_at: updatedAt
        }, { onConflict: 'user_id' });

      if (error) throw error;

      _lastSeenCloudUpdatedAt = updatedAt;
      _pendingPathState = null;
      updateSyncBadge('saved');
    } catch (err) {
      console.warn('[CloudStore] path_state upsert failed:', err.message);
      if (!navigator.onLine || String(err.message).toLowerCase().includes('fetch')) {
        updateSyncBadge('offline');
      }
    }
  }

  /* ── 2. Batch Queue Flusher (Every 10s & on hidden tab) ───── */
  async function flushQueue() {
    if (_isSyncing) return;
    const userId = getActiveUserId();
    const client = getClient();
    if (!userId || !client) return;

    if (!isOnline()) {
      updateSyncBadge('offline');
      return;
    }

    _isSyncing = true;

    // Flush any pending path_state first
    if (_pendingPathState) {
      await savePendingPathState();
    }

    const queue = getQueue(userId);
    const tables = ['events', 'checkins', 'chat_messages', 'assessment_results'];
    let hasItems = false;
    tables.forEach(t => { if (queue[t]?.length > 0) hasItems = true; });

    if (!hasItems) {
      _isSyncing = false;
      return;
    }

    updateSyncBadge('saving');

    for (const table of tables) {
      const items = queue[table];
      if (!items || items.length === 0) continue;

      const batch = items.slice(0, 50); // Process up to 50 items per batch
      try {
        const { error } = await client
          .from(table)
          .upsert(batch, { onConflict: 'id' });

        if (error) {
          console.warn(`[CloudStore] Batch sync failed for ${table}:`, error.message);
          continue;
        }

        // Successfully written: remove from queue by ID
        const writtenIds = new Set(batch.map(b => b.id));
        queue[table] = queue[table].filter(item => !writtenIds.has(item.id));
        saveQueue(queue, userId);
      } catch (err) {
        console.warn(`[CloudStore] Error syncing batch for ${table}:`, err.message);
        if (!isOnline()) {
          updateSyncBadge('offline');
          _isSyncing = false;
          return;
        }
      }
    }

    _isSyncing = false;

    // Check if remaining items exist
    let remaining = false;
    tables.forEach(t => { if (queue[t]?.length > 0) remaining = true; });
    if (!remaining && !_pendingPathState) {
      updateSyncBadge('saved');
    }
  }

  /* ── 3. Summaries Sync ───────────────────────────────────── */
  async function syncSummary(text, topic = 'bst') {
    const userId = getActiveUserId();
    const client = getClient();
    if (!userId || !client || !text) return;

    updateSyncBadge('saving');
    try {
      // Check if row exists for user & topic
      const { data: existing } = await client
        .from('summaries')
        .select('id')
        .eq('user_id', userId)
        .eq('topic', topic)
        .maybeSingle();

      if (existing) {
        await client
          .from('summaries')
          .update({
            content: text,
            created_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await client
          .from('summaries')
          .insert({
            user_id: userId,
            topic: topic,
            content: text,
            created_at: new Date().toISOString()
          });
      }
      updateSyncBadge('saved');
    } catch (err) {
      console.warn('[CloudStore] syncSummary failed:', err.message);
    }
  }

  /* ── 4. Profile Sync (Level, Goal, Display Name) ──────────── */
  async function syncProfile(profileData = {}) {
    const userId = getActiveUserId();
    const client = getClient();
    if (!userId || !client) return;

    try {
      const user = (typeof State !== 'undefined') ? State.get().currentUser : null;
      const displayName = user?.name || user?.user_metadata?.name || '';
      const level = profileData.level || (typeof State !== 'undefined' && State.getProfile()?.level) || 'beginner';
      const goal = profileData.goal || (typeof PathStore !== 'undefined' && PathStore.getGoal ? PathStore.getGoal() : null);

      const payload = {
        user_id: userId,
        display_name: displayName,
        level: level,
        goal: goal,
      };

      const { data: existing } = await client
        .from('profiles')
        .select('user_id, consent_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await client
          .from('profiles')
          .update(payload)
          .eq('user_id', userId);
      } else {
        payload.consent_at = user?.user_metadata?.consent_at || new Date().toISOString();
        payload.created_at = new Date().toISOString();
        await client
          .from('profiles')
          .insert(payload);
      }
    } catch (err) {
      console.warn('[CloudStore] syncProfile failed:', err.message);
    }
  }

  /* ── 5. On Login / Init Session Cloud Hydration ───────────── */
  async function onLogin(user) {
    if (!user || !user.id) return;
    const client = getClient();
    if (!client) return;

    updateSyncBadge('saving');

    try {
      // 1. Fetch cloud path_state
      const { data: cloudRow, error: cloudErr } = await client
        .from('path_state')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cloudErr) {
        console.warn('[CloudStore] Failed to fetch path_state on login:', cloudErr.message);
      }

      // 2. Fetch local progress
      let localData = null;
      if (typeof PathStore !== 'undefined') {
        localData = PathStore.load();
      }

      // Check legacy pre-login store in case user had progress before signing up/logging in
      let legacyPreLogin = null;
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('cdd_path_v1');
          if (raw) legacyPreLogin = JSON.parse(raw);
        }
      } catch (_) {}

      // Case A: Cloud has no data yet, but user has local progress from before
      if (!cloudRow && (localData?.completedIds?.length > 0 || legacyPreLogin?.completedIds?.length > 0)) {
        console.log('[CloudStore] Initial upload: pushing local progress to cloud for new account.');
        const snapshot = localData || legacyPreLogin;
        _pendingPathState = snapshot;
        await savePendingPathState();
      }
      // Case B: Cloud has data
      else if (cloudRow && cloudRow.state) {
        const cloudTime = new Date(cloudRow.updated_at || 0).getTime();
        const localTime = (localData && localData.updatedAt) ? Number(localData.updatedAt) : 0;

        _highestPreparation = Math.max(_highestPreparation, cloudRow.max_preparation || 0);

        if (cloudTime > localTime || !localData) {
          console.log('[CloudStore] Cloud copy is newer. Hydrating local store from cloud.');
          if (typeof localStorage !== 'undefined') {
            const userStoreKey = `cdd_path_v1_${user.id}`;
            localStorage.setItem(userStoreKey, JSON.stringify(cloudRow.state));
            localStorage.setItem('cdd_path_v1', JSON.stringify(cloudRow.state));
          }
          if (typeof PathStore !== 'undefined' && PathStore.load) {
            PathStore.load(true);
          }
          if (typeof Roadmap !== 'undefined' && Roadmap.init) {
            Roadmap.init(false);
          }
        } else if (localTime > cloudTime) {
          console.log('[CloudStore] Local copy is newer. Pushing local progress to cloud.');
          _pendingPathState = localData;
          await savePendingPathState();
        }
      }

      _lastSeenCloudUpdatedAt = cloudRow ? cloudRow.updated_at : new Date().toISOString();

      // 3. Sync profile
      await syncProfile();

      // 4. Flush any queued offline items
      await flushQueue();

      updateSyncBadge('saved');
    } catch (err) {
      console.warn('[CloudStore] onLogin sync error:', err.message);
      if (!isOnline()) {
        updateSyncBadge('offline');
      } else {
        updateSyncBadge('saved');
      }
    }
  }

  /* ── 6. Two-Device Conflict Check on Focus ────────────────── */
  async function checkForRemoteUpdates() {
    const userId = getActiveUserId();
    const client = getClient();
    if (!userId || !client || !isOnline() || !_lastSeenCloudUpdatedAt) return;

    try {
      const { data, error } = await client
        .from('path_state')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data || !data.updated_at) return;

      const remoteTime = new Date(data.updated_at).getTime();
      const localSeenTime = new Date(_lastSeenCloudUpdatedAt).getTime();

      if (remoteTime > localSeenTime) {
        console.log('[CloudStore] Remote device updated path_state. Reloading newest cloud progress.');
        const { data: fullRow } = await client
          .from('path_state')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (fullRow && fullRow.state) {
          if (typeof localStorage !== 'undefined') {
            const userStoreKey = `cdd_path_v1_${userId}`;
            localStorage.setItem(userStoreKey, JSON.stringify(fullRow.state));
            localStorage.setItem('cdd_path_v1', JSON.stringify(fullRow.state));
          }
          if (typeof PathStore !== 'undefined' && PathStore.load) {
            PathStore.load(true);
          }
          if (typeof Roadmap !== 'undefined' && Roadmap.init) {
            Roadmap.init(false);
          }
          _lastSeenCloudUpdatedAt = fullRow.updated_at;
          updateSyncBadge('saved');
        }
      }
    } catch (e) {
      console.warn('[CloudStore] Focus conflict check failed:', e.message);
    }
  }

  /* ── 7. Delete My Learning Data ──────────────────────────── */
  async function deleteLearningData() {
    const userId = getActiveUserId();
    const client = getClient();

    // 1. Clear local queue for events, checkins, chat_messages
    if (userId) {
      const q = getQueue(userId);
      q.events = [];
      q.checkins = [];
      q.chat_messages = [];
      saveQueue(q, userId);
    }

    // 2. Delete cloud rows in events, checkins, chat_messages (keep path_state and assessment_results)
    if (userId && client && isOnline()) {
      try {
        await Promise.all([
          client.from('events').delete().eq('user_id', userId),
          client.from('checkins').delete().eq('user_id', userId),
          client.from('chat_messages').delete().eq('user_id', userId)
        ]);
        console.log('[CloudStore] Cloud telemetry data (events, checkins, chat_messages) purged.');
      } catch (err) {
        console.warn('[CloudStore] Remote deleteLearningData failed:', err.message);
      }
    }

    return { ok: true };
  }

  /* ── 8. Lifecycle & Window Listeners ─────────────────────── */
  function initListeners() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    // 1. Online / Offline listeners
    window.addEventListener('online', () => {
      console.log('[CloudStore] Network reconnected. Flushing queues.');
      updateSyncBadge('saving');
      flushQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[CloudStore] Network offline.');
      updateSyncBadge('offline');
    });

    // 2. Tab Visibility Change (flush queue when hidden)
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushQueue();
        }
      });
    }

    // 3. Tab Focus (Check for two-device updates)
    window.addEventListener('focus', () => {
      checkForRemoteUpdates();
    });

    // 4. Before Unload (flush pending data)
    window.addEventListener('beforeunload', () => {
      flushQueue();
    });

    // 5. Periodic 10-second batch interval
    if (_batchIntervalTimer) clearInterval(_batchIntervalTimer);
    _batchIntervalTimer = setInterval(flushQueue, BATCH_INTERVAL_MS);
  }

  if (typeof window !== 'undefined') {
    initListeners();
  }

  /* ── Public CloudStore API ───────────────────────────────── */
  const CloudStore = {
    onLogin,
    onPathStateChanged,
    enqueue,
    flushQueue,
    syncSummary,
    syncProfile,
    deleteLearningData,
    updateSyncBadge,
    checkForRemoteUpdates,
    isOnline,
    setMockOnline: (val) => { _mockOnline = val; }
  };

  global.CloudStore = CloudStore;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudStore;
  }

})(typeof window !== 'undefined' ? window : this);
