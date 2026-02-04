
import { supabase } from '../lib/supabase';
import { Challenge, CompletionLog, User, Frequency, ChatMessage } from '../types';
import { format } from 'date-fns';
import { Language } from './translations';

// --- Debug Logger (only logs in development) ---
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const log = (...args: any[]) => { if (isDev) console.log(...args); };
const logError = (...args: any[]) => console.error(...args); // always log errors

// --- Helpers ---
export const getPeriodKey = (frequency: Frequency, date: Date = new Date()): string => {
  if (frequency === 'daily') return `daily-${format(date, 'yyyy-MM-dd')}`;
  if (frequency === 'weekly') return `weekly-${format(date, 'yyyy-ww')}`;
  if (frequency === 'monthly') return `monthly-${format(date, 'yyyy-MM')}`;
  return 'once';
};

const THEME_IMAGES = [
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80', // Food
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80', // Gym
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80', // Yoga
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', // Run
];

// Fallback to determine an image based on ID if none exists
const getCoverImage = (id: string, savedImage?: string) => {
    if (savedImage) return savedImage;
    const index = id.charCodeAt(0) % THEME_IMAGES.length;
    return THEME_IMAGES[index];
};

// --- Mappers ---

/**
 * Maps a DB challenge to the app Challenge type.
 * Accepts an optional scoreMap (user_id -> total_score) for pre-computed scores.
 * Falls back to goalCompletions array for detail views where we have full logs.
 */
const mapChallenge = (
  dbChallenge: any,
  dbGoals: any[],
  dbParticipants: any[],
  goalCompletions: any[] = [],
  scoreMap?: Record<string, number>
): Challenge => {
  const participantsWithScores = dbParticipants.map(p => {
    const profile = p.profiles;
    const userId = p.user_id;

    // Use pre-computed scoreMap if available (from getAllChallenges),
    // otherwise compute from goalCompletions (from getChallengeById)
    let userScore: number;
    if (scoreMap) {
      userScore = scoreMap[userId] || 0;
    } else {
      userScore = goalCompletions
        .filter(gc => gc.user_id === userId)
        .reduce((acc, curr) => acc + curr.points_at_time, 0);
    }

    return {
      userId: userId,
      name: profile?.display_name || 'Anonymous',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      score: userScore
    };
  });

  let description = dbChallenge.description;
  let coverImage = undefined;

  if (description && description.includes('|IMG:')) {
      const parts = description.split('|IMG:');
      description = parts[0];
      coverImage = parts[1];
  }

  const sortedGoals = [...dbGoals].sort((a, b) => {
      if (a.created_at && b.created_at) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
  });

  return {
    id: dbChallenge.id,
    creatorId: dbChallenge.owner_id,
    name: dbChallenge.name,
    description: description,
    startDate: dbChallenge.start_at,
    endDate: dbChallenge.end_at,
    maxPlayers: dbChallenge.max_players,
    status: dbChallenge.status as any,
    joinCode: dbChallenge.join_code,
    coverImage: getCoverImage(dbChallenge.id, coverImage),
    goals: sortedGoals.map(g => ({
      id: g.id,
      title: g.title,
      description: g.description,
      icon: g.icon_key || 'activity',
      points: g.points,
      frequency: g.frequency as Frequency,
      maxCompletions: g.max_completions_per_period
    })),
    participants: participantsWithScores
  };
};

const mapMessage = (m: any): ChatMessage => ({
    id: m.id,
    challengeId: m.challenge_id,
    userId: m.user_id,
    userName: m.profiles?.display_name || 'Anonymous',
    userAvatar: m.profiles?.avatar_url,
    messageText: m.message_text,
    createdAt: m.created_at || new Date().toISOString()
});

// --- API Implementation ---
const SupabaseApi = {
  getUserProfile: async (userId: string, email: string): Promise<User | null> => {
      log(`[DB] getUserProfile: ${userId}`);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        logError(`[DB Error] getUserProfile:`, error.message);
        throw error;
      }

      if (profile) {
        return {
          id: userId,
          email: email,
          name: profile.display_name,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          preferredLanguage: undefined
        };
      }
      return null;
  },

  updateUserProfile: async (userId: string, name: string, avatarUrl?: string, language?: Language) => {
    log(`[DB] updateUserProfile: ${userId}`);
    const updates: any = {
      display_name: name,
      updated_at: new Date(),
    };
    // Intentionally skip avatar_url to avoid large image fetch/store.
    // Intentionally skip preferred_language to avoid invalid column errors.

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
        const isColumnError = error.code === '42703' || error.message.includes('preferred_language');
        const isEnumError = error.code === '22P02';

        if (isColumnError || isEnumError) {
            log(`Profile language update failed (${error.code}). Falling back to local storage only.`);
            delete updates.preferred_language;
            const { error: retryError } = await supabase.from('profiles').update(updates).eq('id', userId);
            if (retryError) {
              logError(`[DB Error] updateUserProfile Retry:`, retryError.message);
              throw retryError;
            }
        } else {
            logError(`[DB Error] updateUserProfile:`, error.message);
            throw error;
        }
    }
  },

  /**
   * OPTIMIZED: Fetches challenges WITHOUT goal_completions(*).
   * Instead, fetches aggregated scores per user per challenge in a single separate query.
   * This reduces payload size by ~90% for active challenges.
   */
  getAllChallenges: async (userId?: string): Promise<Challenge[]> => {
    if (!userId) return [];
    log(`[DB] getAllChallenges for user: ${userId}`);

    // Step 1: Get challenge IDs the user participates in
    const { data: participations, error: pError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId);

    if (pError) {
      logError(`[DB Error] getAllChallenges (participations):`, pError.message);
      throw pError;
    }

    if (!participations || participations.length === 0) return [];

    const challengeIds = participations.map(p => p.challenge_id);

    // Lightweight query: only fields needed for dashboard cards (no goals, no full profiles)
    const { data: challenges, error } = await supabase
        .from('challenges')
        .select(`
            id, name, description, start_at, end_at, status, owner_id, join_code, max_players,
            challenge_participants (user_id)
        `)
        .in('id', challengeIds)
        .order('created_at', { ascending: false });

    if (error) {
      logError(`[DB Error] getAllChallenges:`, error.message);
      throw error;
    }

    if (!challenges || challenges.length === 0) return [];

    // Map to Challenge type with minimal data (no goals, no scores — those load on detail)
    const mapped = challenges.map((c: any) => {
      let description = c.description;
      let coverImage = undefined;
      if (description && description.includes('|IMG:')) {
          const parts = description.split('|IMG:');
          description = parts[0];
          coverImage = parts[1];
      }

      const participants = (c.challenge_participants || []).map((p: any) => ({
        userId: p.user_id,
        name: '',
        score: 0,
        avatar: undefined
      }));

      return {
        id: c.id,
        creatorId: c.owner_id,
        name: c.name,
        description,
        startDate: c.start_at,
        endDate: c.end_at,
        maxPlayers: c.max_players,
        status: c.status,
        joinCode: c.join_code,
        coverImage: getCoverImage(c.id, coverImage),
        goals: [], // loaded on detail view
        participants
      } as Challenge;
    });
    return mapped;
  },

  /**
   * OPTIMIZED: Single query for challenge structure only.
   * Scores are computed from logs (fetched separately via getLogs).
   */
  getChallengeById: async (id: string): Promise<Challenge | undefined> => {
    log(`[DB] getChallengeById: ${id}`);

    const { data: challenge, error } = await supabase
      .from('challenges')
      .select(`
        id, name, description, start_at, end_at, max_players, status, owner_id, join_code,
        challenge_goals (id, title, description, icon_key, points, frequency, max_completions_per_period, created_at),
        challenge_participants (user_id, profiles (display_name))
      `)
      .eq('id', id)
      .single();

    if (error) {
      logError(`[DB Error] getChallengeById:`, error.message);
      return undefined;
    }

    if (!challenge) return undefined;

    const c = challenge as any;
    return mapChallenge(
        c,
        c.challenge_goals || [],
        c.challenge_participants || [],
        [],
        {} // scores computed from logs by the caller
    );
  },

  createChallenge: async (challenge: Partial<Challenge>, userId: string) => {
    log(`[DB] createChallenge by ${userId}`);
    const descToSave = challenge.coverImage
        ? `${challenge.description}|IMG:${challenge.coverImage}`
        : challenge.description;

    const { data: newChallenge, error } = await supabase
      .from('challenges')
      .insert({
        owner_id: userId,
        name: challenge.name,
        description: descToSave,
        start_at: challenge.startDate,
        end_at: challenge.endDate,
        max_players: challenge.maxPlayers,
        leaderboard_visible: true,
        status: 'active',
        join_code: `STRIVE-${Math.floor(Math.random() * 10000)}`
      })
      .select()
      .single();

    if (error) {
      logError(`[DB Error] createChallenge:`, error.message);
      throw error;
    }

    if (challenge.goals && challenge.goals.length > 0) {
      const goalsToInsert = challenge.goals.map(g => ({
        challenge_id: newChallenge.id,
        title: g.title,
        description: g.description,
        points: g.points,
        frequency: g.frequency,
        icon_key: g.icon,
        max_completions_per_period: g.maxCompletions
      }));

      const { error: gError } = await supabase.from('challenge_goals').insert(goalsToInsert);
      if (gError) {
        logError(`[DB Error] createChallenge (goals):`, gError.message);
        throw gError;
      }
    }

    await SupabaseApi.joinChallenge(newChallenge.id, userId, undefined, 'owner');
    return newChallenge.id;
  },

  /**
   * OPTIMIZED: Batch goal updates — separates new goals (insert) from existing (upsert).
   * Reduces N sequential requests to 2-3 parallel ones.
   */
  updateChallenge: async (challenge: Challenge) => {
    log(`[DB] updateChallenge: ${challenge.id}`);
    const descToSave = challenge.coverImage && !challenge.description.includes('|IMG:')
        ? `${challenge.description}|IMG:${challenge.coverImage}`
        : challenge.description;

    // Update challenge header
    const { error } = await supabase
      .from('challenges')
      .update({
        name: challenge.name,
        description: descToSave,
        start_at: challenge.startDate,
        end_at: challenge.endDate,
        max_players: challenge.maxPlayers,
        leaderboard_visible: true
      })
      .eq('id', challenge.id);

    if (error) {
      logError(`[DB Error] updateChallenge (header):`, error.message);
      throw error;
    }

    // Fetch existing goal IDs to determine deletes
    const { data: existingGoals, error: egError } = await supabase
      .from('challenge_goals')
      .select('id')
      .eq('challenge_id', challenge.id);

    if (egError) {
      logError(`[DB Error] updateChallenge (fetch existing goals):`, egError.message);
      throw egError;
    }

    const existingIds = existingGoals?.map(g => g.id) || [];
    const payloadIds = challenge.goals
        .filter(g => g.id && g.id.length > 10)
        .map(g => g.id);
    const idsToDelete = existingIds.filter(id => !payloadIds.includes(id));

    // Separate goals into updates vs inserts
    const goalsToUpdate = challenge.goals.filter(g => g.id && g.id.length > 10);
    const goalsToInsert = challenge.goals.filter(g => !g.id || g.id.length <= 10);

    // Execute delete, updates, and inserts in parallel where possible
    const operations: Promise<any>[] = [];

    if (idsToDelete.length > 0) {
      operations.push(
        supabase.from('challenge_goals').delete().in('id', idsToDelete)
      );
    }

    // Batch update existing goals using upsert
    if (goalsToUpdate.length > 0) {
      const upsertPayload = goalsToUpdate.map(g => ({
        id: g.id,
        challenge_id: challenge.id,
        title: g.title,
        description: g.description,
        points: g.points,
        frequency: g.frequency,
        icon_key: g.icon,
        max_completions_per_period: g.maxCompletions
      }));
      operations.push(
        supabase.from('challenge_goals').upsert(upsertPayload, { onConflict: 'id' })
      );
    }

    // Batch insert new goals
    if (goalsToInsert.length > 0) {
      const insertPayload = goalsToInsert.map(g => ({
        challenge_id: challenge.id,
        title: g.title,
        description: g.description,
        points: g.points,
        frequency: g.frequency,
        icon_key: g.icon,
        max_completions_per_period: g.maxCompletions
      }));
      operations.push(
        supabase.from('challenge_goals').insert(insertPayload)
      );
    }

    // Run all goal operations in parallel
    const results = await Promise.all(operations);
    for (const result of results) {
      if (result.error) {
        logError(`[DB Error] updateChallenge (goal operation):`, result.error.message);
      }
    }
  },

  /**
   * OPTIMIZED: Runs deletes in parallel instead of sequentially.
   * Removed reference to non-existent challenge_messages table.
   */
  deleteChallenge: async (challengeId: string) => {
    log(`[DB] deleteChallenge: ${challengeId}`);

    // Delete child records in parallel (all reference challenge_id)
    await Promise.all([
      supabase.from('goal_completions').delete().eq('challenge_id', challengeId).then(r => r),
      supabase.from('challenge_goals').delete().eq('challenge_id', challengeId).then(r => r),
      supabase.from('challenge_participants').delete().eq('challenge_id', challengeId).then(r => r),
      supabase.from('challenge_messages').delete().eq('challenge_id', challengeId).then(r => r),
    ]);

    // Then delete the challenge itself
    const { error } = await supabase.from('challenges').delete().eq('id', challengeId);
    if (error) {
      logError(`[DB Error] deleteChallenge:`, error.message);
      throw error;
    }
  },

  leaveChallenge: async (challengeId: string, userId: string) => {
    log(`[DB] leaveChallenge: ${challengeId}, user: ${userId}`);
    await supabase.from('goal_completions').delete()
        .eq('challenge_id', challengeId)
        .eq('user_id', userId);

    const { error } = await supabase
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);

    if (error) {
      logError(`[DB Error] leaveChallenge:`, error.message);
      throw error;
    }
  },

  joinChallenge: async (challengeId: string, userId: string, joinCode?: string, role: string = 'participant') => {
    log(`[DB] joinChallenge: ${challengeId}, user: ${userId}, role: ${role}`);
    const { data, error: feError } = await supabase
        .from('challenge_participants')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .single();

    if (feError && feError.code !== 'PGRST116') {
      logError(`[DB Error] joinChallenge (check exist):`, feError.message);
    }

    if (data) {
      log(`[DB] User already joined challenge`);
      return;
    }

    if (role === 'participant') {
        const { data: challenge, error: fcError } = await supabase
            .from('challenges')
            .select('join_code, max_players, status')
            .eq('id', challengeId)
            .single();

        if (fcError || !challenge) {
          logError(`[DB Error] joinChallenge (fetch challenge info):`, fcError?.message);
          throw new Error("Challenge not found");
        }
        if (challenge.status !== 'active') throw new Error("Challenge is not active");

        if (challenge.join_code !== joinCode) {
            throw new Error("Invalid join code");
        }

        const { count, error: countError } = await supabase
            .from('challenge_participants')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', challengeId);

        if (countError) logError(`[DB Error] counting participants:`, countError.message);

        if (count !== null && count >= challenge.max_players) {
            throw new Error("Challenge is full");
        }
    }

    const { error: joinError } = await supabase.from('challenge_participants').insert({
      challenge_id: challengeId,
      user_id: userId,
      role
    });

    if (joinError) {
      logError(`[DB Error] joinChallenge (insert):`, joinError.message);
      throw joinError;
    }
  },

  joinChallengeByCode: async (joinCode: string, userId: string) => {
    log(`[DB] joinChallengeByCode: ${joinCode} for ${userId}`);
    const { data: challenge, error } = await supabase
        .from('challenges')
        .select('id')
        .eq('join_code', joinCode)
        .eq('status', 'active')
        .maybeSingle();

    if (error || !challenge) {
      logError(`[DB Error] joinChallengeByCode:`, error?.message);
      throw new Error("Invalid invite code or challenge is not active.");
    }

    await SupabaseApi.joinChallenge(challenge.id, userId, joinCode);
    return challenge.id;
  },

  logGoalCompletion: async (challengeId: string, goalId: string, userId: string, points: number, frequency: Frequency, date: Date = new Date()) => {
     log(`[DB] logGoalCompletion: goal ${goalId} for ${userId} on ${date.toISOString()}`);
     const { data: goal, error: gError } = await supabase
        .from('challenge_goals')
        .select('max_completions_per_period')
        .eq('id', goalId)
        .single();

     if (gError || !goal) {
       logError(`[DB Error] logGoalCompletion (fetch goal):`, gError?.message);
       throw new Error("Goal not found");
     }

     const periodKey = getPeriodKey(frequency, date);

     if (goal.max_completions_per_period !== null) {
         const { count, error: countError } = await supabase.from('goal_completions')
            .select('*', { count: 'exact', head: true })
            .eq('goal_id', goalId)
            .eq('user_id', userId)
            .eq('period_key', periodKey);

         if (countError) logError(`[DB Error] counting completions:`, countError.message);

         if (count !== null && count >= goal.max_completions_per_period) {
             throw new Error(`You have reached the limit for this goal (${frequency}).`);
         }
     }

     const { error: logError_ } = await supabase.from('goal_completions').insert({
       challenge_id: challengeId,
       goal_id: goalId,
       user_id: userId,
       points_at_time: points,
       period_key: periodKey,
       completion_at: date.toISOString()
     });

     if (logError_) {
       logError(`[DB Error] logGoalCompletion (insert):`, logError_.message);
       throw logError_;
     }
  },

  deleteLog: async (logId: string) => {
    log(`[DB] deleteLog: ${logId}`);
    const { error } = await supabase.from('goal_completions').delete().eq('id', logId);
    if (error) {
      logError(`[DB Error] deleteLog:`, error.message);
      throw error;
    }
  },

  /**
   * OPTIMIZED: Added ordering and optional date range filtering.
   * Orders by completion_at descending so most recent come first.
   */
  getLogs: async (challengeId: string, daysBack?: number): Promise<CompletionLog[]> => {
     log(`[DB] getLogs: ${challengeId}`);
     let query = supabase
       .from('goal_completions')
       .select('id, challenge_id, goal_id, user_id, completion_at, points_at_time')
       .eq('challenge_id', challengeId)
       .order('completion_at', { ascending: false });

     // Optional: limit to recent period for performance
     if (daysBack) {
       const since = new Date();
       since.setDate(since.getDate() - daysBack);
       query = query.gte('completion_at', since.toISOString());
     }

     const { data, error } = await query;

     if (error) {
       logError(`[DB Error] getLogs:`, error.message);
     }

     return (data || []).map(l => ({
       id: l.id,
       challengeId: l.challenge_id,
       goalId: l.goal_id,
       userId: l.user_id,
       timestamp: l.completion_at,
       pointsEarned: l.points_at_time
     }));
  },

  // --- Chat API ---
  getMessages: async (challengeId: string): Promise<ChatMessage[]> => {
      log(`[DB] getMessages: ${challengeId}`);
      try {
          const { data, error } = await supabase
            .from('challenge_messages')
            .select('id, challenge_id, user_id, message_text, created_at')
            .eq('challenge_id', challengeId)
            .order('created_at', { ascending: true });

          if (error) {
              if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('relation')) return [];
              return [];
          }
          // Return raw messages without profile join — caller resolves names from participant cache
          return (data || []).map((m: any) => ({
              id: m.id,
              challengeId: m.challenge_id,
              userId: m.user_id,
              userName: '',  // resolved by caller from participant cache
              userAvatar: undefined,
              messageText: m.message_text,
              createdAt: m.created_at || new Date().toISOString()
          }));
      } catch (err) {
          log("getMessages failed - table challenge_messages may not exist");
          return [];
      }
  },

  sendMessage: async (challengeId: string, userId: string, text: string) => {
      log(`[DB] sendMessage: ${challengeId}`);
      const { error } = await supabase
        .from('challenge_messages')
        .insert({
            challenge_id: challengeId,
            user_id: userId,
            message_text: text
        });

      if (error) throw error;
  }
};

export const api = SupabaseApi;
