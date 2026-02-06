
import { Language } from './services/translations';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferredLanguage?: Language;
}

// Updated to match DB check constraint: 'daily', 'weekly', 'monthly', 'once'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'once';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  icon: string;
  points: number;
  frequency: Frequency;
  maxCompletions?: number; // mapped from max_completions_per_period
}

export interface Participant {
  userId: string;
  name: string;
  score: number;
  avatar?: string;
}

export interface Challenge {
  id: string;
  creatorId: string; // mapped from owner_id
  name: string;
  description: string;
  startDate: string; // mapped from start_at
  endDate: string; // mapped from end_at
  maxPlayers: number; // mapped from max_players
  goals: Goal[];
  participants: Participant[];
  status: 'active' | 'completed' | 'draft' | 'cancelled';
  joinCode: string; // added
  coverImage?: string; // added for UI
}

export interface ChatMessage {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  messageText: string;
  createdAt: string;
}

export interface CompletionLog {
  id: string;
  challengeId: string;
  goalId: string;
  userId: string;
  timestamp: string; // mapped from completion_at
  pointsEarned: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
  trend: 'up' | 'down' | 'neutral';
}

// Aggregated stats returned by get_challenge_stats RPC
export interface ChallengeStats {
  // Total score per user
  scores: { user_id: string; total_score: number }[];
  // Score per user per goal
  goalScores: { user_id: string; goal_id: string; score: number }[];
  // Period completion counts (for checking daily/weekly/monthly limits)
  periodCounts: { user_id: string; goal_id: string; period_key: string; count: number }[];
  // Daily points aggregated per user per goal (last 7 days)
  dailyPoints: { user_id: string; goal_id: string; day: string; points: number }[];
}
