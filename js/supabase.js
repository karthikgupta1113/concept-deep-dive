/**
 * supabase.js — Supabase client initialization & API services
 */

// Supabase project credentials
const SUPABASE_URL = 'https://gignudaucrgyxczwnqfc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B-KtpIMgvq3q7aPROrjQKQ_hILeaGbR';

function notifyToast(msg, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else {
    console.log(`[Toast ${type}] ${msg}`);
  }
}

// Online / offline monitoring
window.addEventListener('offline', () => {
  notifyToast('You are currently offline. Actions will be kept in memory.', 'warning');
});

window.addEventListener('online', () => {
  notifyToast('Connection restored. Syncing with Supabase...', 'success');
  const user = window.State?.get()?.currentUser;
  if (user && window.State?.initFromSupabase) {
    window.State.initFromSupabase(user);
  }
});

// Initialize client
let _client = null;
function getClient() {
  if (!_client && typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.error('[Supabase] Initialization failed:', err);
    }
  }
  return _client;
}

// Attempt initial creation
getClient();

window.SupabaseService = {
  isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  },

  get client() {
    return getClient();
  },

  /* ── Authentication ─────────────────────────────────────── */
  async signUp(name, email, password) {
    const client = getClient();
    if (!client) {
      return { ok: false, error: 'Supabase client could not be initialized.' };
    }
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) return { ok: false, error: error.message };

      // Determine if email confirmation is pending.
      // When "Confirm email" is ON in Supabase:
      //   - data.session is null
      //   - data.user.email_confirmed_at is null/undefined
      // When "Confirm email" is OFF (auto-confirmed):
      //   - data.session is a live session
      //   - data.user.email_confirmed_at is already set
      //
      // NOTE: If the app jumps to the dashboard without showing the
      // "Check your email" screen, it means "Confirm email" is OFF
      // in the Supabase Dashboard → Authentication → Providers → Email.
      // Turn that toggle ON to enable email verification.
      const hasLiveSession = Boolean(data.session);
      const isEmailConfirmed = Boolean(data.user?.email_confirmed_at);

      // needsConfirmation = true if no live session OR email not yet confirmed
      const needsConfirmation = !hasLiveSession || !isEmailConfirmed;

      if (hasLiveSession && isEmailConfirmed) {
        console.warn(
          '[SupabaseService] signUp: Supabase returned an active session immediately — ' +
          'this means "Confirm email" is OFF in your Supabase project settings. ' +
          'Go to: Supabase Dashboard → Authentication → Providers → Email → toggle "Confirm email" ON.'
        );
      }

      return {
        ok: true,
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || name,
        } : null,
        session: data.session,
        needsConfirmation,
      };
    } catch (err) {
      return { ok: false, error: err.message || 'An unexpected sign-up error occurred.' };
    }
  },

  async resendSignupEmail(email) {
    const client = getClient();
    if (!client) {
      return { ok: false, error: 'Supabase client could not be initialized.' };
    }
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to resend confirmation email.' };
    }
  },

  async resetPasswordForEmail(email) {
    const client = getClient();
    if (!client) {
      return { ok: false, error: 'Supabase client could not be initialized.' };
    }
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to send reset link.' };
    }
  },

  async updateUserPassword(newPassword) {
    const client = getClient();
    if (!client) {
      return { ok: false, error: 'Supabase client could not be initialized.' };
    }
    try {
      const { data, error } = await client.auth.updateUser({
        password: newPassword,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: err.message || 'Failed to update password.' };
    }
  },

  async signIn(email, password) {
    const client = getClient();
    if (!client) {
      return { ok: false, error: 'Supabase client could not be initialized.' };
    }
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { ok: false, error: error.message };

      return {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email.split('@')[0],
        },
        session: data.session,
      };
    } catch (err) {
      return { ok: false, error: err.message || 'An unexpected sign-in error occurred.' };
    }
  },

  async signOut() {
    const client = getClient();
    if (!client) return;
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn('[Supabase] Sign out error:', err);
    }
  },

  async getSession() {
    const client = getClient();
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session) return null;
      return data.session;
    } catch (err) {
      console.warn('[Supabase] getSession failed:', err);
      return null;
    }
  },

  onAuthStateChange(callback) {
    const client = getClient();
    if (!client) return () => {};
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  },

  /* ── Database: Hydrate all user data on login/boot ──────── */
  async fetchUserData(userId, topic = 'bst') {
    const client = getClient();
    if (!client || !userId) return null;

    try {
      const [stagesRes, chatsRes, assessmentsRes, gapsRes, summaryRes] = await Promise.all([
        client
          .from('stage_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topic),
        client
          .from('chat_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        client
          .from('assessment_responses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        client
          .from('flagged_gaps')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topic),
        client
          .from('summaries')
          .select('*')
          .eq('user_id', userId)
          .eq('topic', topic)
          .maybeSingle(),
      ]);

      if (stagesRes.error) console.warn('[Supabase] stages query error:', stagesRes.error);
      if (chatsRes.error) console.warn('[Supabase] chats query error:', chatsRes.error);
      if (assessmentsRes.error) console.warn('[Supabase] assessments query error:', assessmentsRes.error);

      console.log('[Supabase] fetchUserData loaded rows:', {
        stagesCount: stagesRes.data?.length || 0,
        stages: stagesRes.data,
        chatsCount: chatsRes.data?.length || 0,
        summary: summaryRes.data ? 'Found' : 'None'
      });

      return {
        stages: stagesRes.data || [],
        chats: chatsRes.data || [],
        assessments: assessmentsRes.data || [],
        gaps: gapsRes.data || [],
        summary: summaryRes.data || null,
      };
    } catch (err) {
      console.error('[Supabase] Error loading user data:', err);
      if (!navigator.onLine) {
        notifyToast('Offline: Loaded local session without cloud sync.', 'warning');
      }
      return null;
    }
  },

  /* ── Database: Stage progress ───────────────────────────── */
  async upsertStageProgress(userId, topic, stageNumber, status, mastered = false) {
    const client = getClient();
    if (!client || !userId) return;

    console.log('[Supabase] upsertStageProgress called:', { userId, topic, stageNumber, status, mastered });

    try {
      const payload = {
        user_id: userId,
        topic: topic || 'bst',
        stage_number: stageNumber,
        status,
        mastered: Boolean(mastered),
        updated_at: new Date().toISOString(),
      };

      let res = await client
        .from('stage_progress')
        .upsert(payload, { onConflict: 'user_id,topic,stage_number' });

      // Fallback 1: If 'mastered' column does not exist on table
      if (res.error && (res.error.code === '42703' || res.error.message?.includes('mastered'))) {
        console.warn('[Supabase] Column "mastered" does not exist in stage_progress table, retrying without it...');
        delete payload.mastered;
        res = await client
          .from('stage_progress')
          .upsert(payload, { onConflict: 'user_id,topic,stage_number' });
      }

      // Fallback 2: If no unique constraint matches onConflict (code 42P10)
      if (res.error && res.error.code === '42P10') {
        console.warn('[Supabase] No unique constraint on (user_id, topic, stage_number), using select-update/insert fallback...');
        delete payload.mastered;
        const { data: existing } = await client
          .from('stage_progress')
          .select('id')
          .eq('user_id', userId)
          .eq('topic', topic || 'bst')
          .eq('stage_number', stageNumber)
          .maybeSingle();

        if (existing?.id) {
          res = await client
            .from('stage_progress')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          res = await client
            .from('stage_progress')
            .insert(payload);
        }
      }

      // Error handling & diagnostics
      if (res.error) {
        if (res.error.code === '42501') {
          console.error('[Supabase RLS Error] Row Level Security blocked stage_progress write. Please apply RLS policies in Supabase SQL editor.');
          notifyToast('Supabase RLS policy required for stage_progress.', 'danger');
        } else {
          console.error('[Supabase] Failed to write stage_progress:', res.error);
        }
      } else {
        console.log(`[Supabase] Stage ${stageNumber + 1} (${status}) saved successfully to database.`);
      }
    } catch (err) {
      console.error('[Supabase] Exception upserting stage progress:', err);
    }
  },

  /* ── Database: Chat history ─────────────────────────────── */
  async insertChatMessage(userId, stageNumber, role, message) {
    const client = getClient();
    if (!client || !userId) return;
    try {
      const { error } = await client
        .from('chat_history')
        .insert({
          user_id: userId,
          stage_number: stageNumber,
          role: role === 'tutor' ? 'ai' : role,
          message,
        });
      if (error) {
        console.error('[Supabase] Failed to insert chat message:', error);
      }
    } catch (err) {
      console.error('[Supabase] Exception inserting chat message:', err);
    }
  },

  /* ── Database: Assessment response ──────────────────────── */
  async insertAssessmentResponse(userId, stageNumber, question, studentAnswer, aiEvaluation, rating) {
    const client = getClient();
    if (!client || !userId) return;
    try {
      const evalString = typeof aiEvaluation === 'object' ? JSON.stringify(aiEvaluation) : String(aiEvaluation);
      const { error } = await client
        .from('assessment_responses')
        .insert({
          user_id: userId,
          stage_number: stageNumber,
          question,
          student_answer: studentAnswer,
          ai_evaluation: evalString,
          rating,
        });
      if (error) {
        console.error('[Supabase] Failed to insert assessment response:', error);
      }
    } catch (err) {
      console.error('[Supabase] Exception inserting assessment response:', err);
    }
  },

  /* ── Database: Flagged gaps ─────────────────────────────── */
  async insertFlaggedGap(userId, topic, gapDescription, stageNumber) {
    const client = getClient();
    if (!client || !userId) return;
    try {
      const { error } = await client
        .from('flagged_gaps')
        .insert({
          user_id: userId,
          topic: topic || 'bst',
          gap_description: gapDescription,
          stage_number: stageNumber,
        });
      if (error) {
        console.error('[Supabase] Failed to insert flagged gap:', error);
      }
    } catch (err) {
      console.error('[Supabase] Exception inserting flagged gap:', err);
    }
  },

  /* ── Database: Summary ──────────────────────────────────── */
  async upsertSummary(userId, topic, summaryText) {
    const client = getClient();
    if (!client || !userId) return;
    try {
      const { error } = await client
        .from('summaries')
        .upsert(
          {
            user_id: userId,
            topic: topic || 'bst',
            summary_text: summaryText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,topic' }
        );
      if (error) {
        console.error('[Supabase] Failed to upsert summary:', error);
      }
    } catch (err) {
      console.error('[Supabase] Exception upserting summary:', err);
    }
  },
};
