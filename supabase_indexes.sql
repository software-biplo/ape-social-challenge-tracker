-- ============================================================
-- APE - Performance Indexes for Supabase
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. goal_completions: Most queried table — needs composite indexes
-- Used by: getAllChallenges (score aggregation), getLogs, logGoalCompletion
CREATE INDEX IF NOT EXISTS idx_goal_completions_challenge_user
  ON goal_completions (challenge_id, user_id);

-- Used by: logGoalCompletion (period-based limit check)
CREATE INDEX IF NOT EXISTS idx_goal_completions_goal_user_period
  ON goal_completions (goal_id, user_id, period_key);

-- Used by: getLogs (ordering by completion_at)
CREATE INDEX IF NOT EXISTS idx_goal_completions_challenge_completed
  ON goal_completions (challenge_id, completion_at DESC);

-- 2. challenge_participants: Used to find all challenges for a user
-- Used by: getAllChallenges (first query to get challenge IDs)
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user
  ON challenge_participants (user_id);

-- Used by: joinChallenge (check if already joined)
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_user
  ON challenge_participants (challenge_id, user_id);

-- 3. challenges: Used for invite code lookups
-- Used by: joinChallengeByCode
CREATE INDEX IF NOT EXISTS idx_challenges_join_code
  ON challenges (join_code) WHERE status = 'active';

-- 4. challenges: Filter by status
CREATE INDEX IF NOT EXISTS idx_challenges_status
  ON challenges (status);

-- ============================================================
-- CHAT: Create challenge_messages table
-- ============================================================

CREATE TABLE IF NOT EXISTS challenge_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching messages by challenge (ordered by time)
CREATE INDEX IF NOT EXISTS idx_challenge_messages_challenge
  ON challenge_messages (challenge_id, created_at);

-- Row Level Security
ALTER TABLE challenge_messages ENABLE ROW LEVEL SECURITY;

-- Participants can read messages in challenges they belong to
CREATE POLICY "Participants can read messages"
  ON challenge_messages FOR SELECT
  USING (challenge_id IN (
    SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid()
  ));

-- Participants can send messages in challenges they belong to
CREATE POLICY "Participants can send messages"
  ON challenge_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND challenge_id IN (
      SELECT challenge_id FROM challenge_participants WHERE user_id = auth.uid()
    )
  );

-- Enable real-time for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_messages;

-- ============================================================
-- RPC: get_challenge_stats
-- Returns all aggregated stats for a challenge in one call,
-- eliminating the need to fetch all individual completion rows.
-- ============================================================

CREATE OR REPLACE FUNCTION get_challenge_stats(p_challenge_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    -- 1. Total score per user (for overall leaderboard)
    'scores', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT user_id, SUM(points_at_time)::int AS total_score
        FROM goal_completions
        WHERE challenge_id = p_challenge_id
        GROUP BY user_id
      ) s
    ),
    -- 2. Score per user per goal (for per-goal leaderboard)
    'goal_scores', (
      SELECT COALESCE(json_agg(row_to_json(gs)), '[]'::json)
      FROM (
        SELECT user_id, goal_id, SUM(points_at_time)::int AS score
        FROM goal_completions
        WHERE challenge_id = p_challenge_id
        GROUP BY user_id, goal_id
      ) gs
    ),
    -- 3. Period completion counts per user per goal (for daily/weekly/monthly progress UI)
    'period_counts', (
      SELECT COALESCE(json_agg(row_to_json(pc)), '[]'::json)
      FROM (
        SELECT user_id, goal_id, period_key, COUNT(*)::int AS count
        FROM goal_completions
        WHERE challenge_id = p_challenge_id
        GROUP BY user_id, goal_id, period_key
      ) pc
    ),
    -- 4. Daily points for last 7 days (for progress chart)
    -- For daily goals, extract the date from period_key (e.g. 'daily-2026-02-07')
    -- because completion_at in UTC can land on the wrong date for UTC+N users.
    -- For non-daily goals, fall back to completion_at::date.
    'daily_points', (
      SELECT COALESCE(json_agg(row_to_json(dp)), '[]'::json)
      FROM (
        SELECT user_id, goal_id,
               CASE WHEN period_key LIKE 'daily-%'
                    THEN SUBSTRING(period_key FROM 7)::date
                    ELSE completion_at::date
               END AS day,
               SUM(points_at_time)::int AS points
        FROM goal_completions
        WHERE challenge_id = p_challenge_id
          AND CASE WHEN period_key LIKE 'daily-%'
                   THEN SUBSTRING(period_key FROM 7)::date
                   ELSE completion_at::date
              END >= (NOW() - INTERVAL '7 days')::date
        GROUP BY user_id, goal_id,
                 CASE WHEN period_key LIKE 'daily-%'
                      THEN SUBSTRING(period_key FROM 7)::date
                      ELSE completion_at::date
                 END
        ORDER BY day
      ) dp
    )
  ) INTO result;

  RETURN result;
END;
$$;
