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
