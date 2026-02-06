
import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Challenge, ChallengeStats, CompletionLog } from '../types';
import { api } from '../services/dataService';
import { useAuth } from './AuthContext';

// Cache TTL: don't re-fetch if data was fetched less than this many ms ago
const CACHE_TTL_MS = 30_000; // 30 seconds

const EMPTY_STATS: ChallengeStats = { scores: [], goalScores: [], periodCounts: [], dailyPoints: [] };

interface ChallengeContextType {
  challenges: Challenge[] | null;
  challengeCache: Record<string, Challenge>;
  statsCache: Record<string, ChallengeStats>;
  refreshChallenges: (force?: boolean) => Promise<void>;
  fetchChallengeDetail: (id: string) => Promise<void>;
  fetchStats: (id: string) => Promise<void>;
  getChallenge: (id: string) => Promise<Challenge | undefined>;
  getStats: (id: string) => Promise<ChallengeStats>;
  invalidateChallenge: (id: string) => void;
  addOptimisticLog: (id: string, log: CompletionLog) => void;
  removeOptimisticLog: (challengeId: string, logId: string, log: CompletionLog) => void;
  clearCache: () => void;
  isLoading: boolean;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use state for caching to make the data reactive across the app
  const [challengeCache, setChallengeCache] = useState<Record<string, Challenge>>({});
  const [statsCache, setStatsCache] = useState<Record<string, ChallengeStats>>({});

  const hasLoadedRef = useRef(false);

  // --- TTL tracking: timestamps of last successful fetch ---
  const lastFetchAllRef = useRef<number>(0);
  const lastFetchDetailRef = useRef<Record<string, number>>({});
  const lastFetchStatsRef = useRef<Record<string, number>>({});

  // --- In-flight deduplication: prevent duplicate concurrent requests ---
  const inFlightAllRef = useRef<Promise<void> | null>(null);
  const inFlightDetailRef = useRef<Record<string, Promise<void>>>({});
  const inFlightStatsRef = useRef<Record<string, Promise<void>>>({});

  const refreshChallenges = useCallback(async (force?: boolean) => {
    if (!user) return;

    // Skip if recently fetched (unless forced)
    if (!force && Date.now() - lastFetchAllRef.current < CACHE_TTL_MS) return;

    // Deduplicate: return existing in-flight request
    if (inFlightAllRef.current) return inFlightAllRef.current;

    if (!hasLoadedRef.current) setIsLoading(true);

    const request = (async () => {
      try {
        const data = await api.getAllChallenges(user.id);
        setChallenges(data);
        hasLoadedRef.current = true;
        lastFetchAllRef.current = Date.now();

        // Update cache with fresh list data
        setChallengeCache(prev => {
          const next = { ...prev };
          data.forEach(c => {
            const existing = prev[c.id];
            if (!existing) {
              next[c.id] = c;
              return;
            }

            const existingParticipants = new Map(existing.participants.map(p => [p.userId, p]));
            const mergedParticipants = (c.participants || []).map(p => {
              const prior = existingParticipants.get(p.userId);
              if (!prior) return p;
              return {
                ...prior,
                ...p,
                score: prior.score ?? p.score,
                name: p.name || prior.name,
                avatar: p.avatar || prior.avatar
              };
            });

            next[c.id] = {
              ...existing,
              ...c,
              goals: existing.goals?.length ? existing.goals : c.goals,
              participants: mergedParticipants
            };
          });
          return next;
        });
      } catch (e) {
        console.error("Failed to refresh challenges", e);
      } finally {
        setIsLoading(false);
        inFlightAllRef.current = null;
      }
    })();

    inFlightAllRef.current = request;
    return request;
  }, [user]);

  const fetchChallengeDetail = useCallback(async (id: string) => {
    // Skip if recently fetched
    if (Date.now() - (lastFetchDetailRef.current[id] || 0) < CACHE_TTL_MS) return;

    // Deduplicate
    if (inFlightDetailRef.current[id]) return inFlightDetailRef.current[id];

    const request = (async () => {
      try {
        const latest = await api.getChallengeById(id);
        if (latest) {
          setChallengeCache(prev => {
            const existing = prev[id];
            if (!existing) return { ...prev, [id]: latest };

            const existingScores = new Map(existing.participants.map(p => [p.userId, p]));
            const mergedParticipants = latest.participants.map(p => {
              const prior = existingScores.get(p.userId);
              if (!prior) return p;
              return {
                ...prior,
                ...p,
                score: prior.score ?? p.score,
                name: p.name || prior.name,
                avatar: p.avatar || prior.avatar
              };
            });

            return {
              ...prev,
              [id]: {
                ...latest,
                participants: mergedParticipants
              }
            };
          });
          lastFetchDetailRef.current[id] = Date.now();
        }
      } catch (e) {
        console.error("Failed to fetch challenge detail", e);
      } finally {
        delete inFlightDetailRef.current[id];
      }
    })();

    inFlightDetailRef.current[id] = request;
    return request;
  }, []);

  const fetchStats = useCallback(async (id: string) => {
    // Skip if recently fetched
    if (Date.now() - (lastFetchStatsRef.current[id] || 0) < CACHE_TTL_MS) return;

    // Deduplicate
    if (inFlightStatsRef.current[id]) return inFlightStatsRef.current[id];

    const request = (async () => {
      try {
        const stats = await api.getStats(id);
        setStatsCache(prev => ({ ...prev, [id]: stats }));
        lastFetchStatsRef.current[id] = Date.now();

        // Update participant scores from aggregated stats
        setChallengeCache(prev => {
          const challenge = prev[id];
          if (!challenge) return prev;
          const scoreMap: Record<string, number> = {};
          for (const s of stats.scores) {
            scoreMap[s.user_id] = s.total_score;
          }
          return {
            ...prev,
            [id]: {
              ...challenge,
              participants: challenge.participants.map(p => ({
                ...p,
                score: scoreMap[p.userId] || 0
              }))
            }
          };
        });
      } catch (e) {
        console.error("Failed to fetch stats", e);
      } finally {
        delete inFlightStatsRef.current[id];
      }
    })();

    inFlightStatsRef.current[id] = request;
    return request;
  }, []);

  /**
   * Invalidate TTL for a specific challenge so the next fetch actually runs.
   * Call this after mutations (log goal, delete log, etc.)
   */
  const invalidateChallenge = useCallback((id: string) => {
    lastFetchDetailRef.current[id] = 0;
    lastFetchStatsRef.current[id] = 0;
  }, []);

  /**
   * Optimistically add a completion log to the stats cache.
   * Updates scores, goal_scores, period_counts, and participant scores.
   */
  const addOptimisticLog = useCallback((challengeId: string, log: CompletionLog) => {
    setStatsCache(prev => {
      const stats = prev[challengeId] || EMPTY_STATS;

      // Update scores
      const existingScore = stats.scores.find(s => s.user_id === log.userId);
      const newScores = existingScore
        ? stats.scores.map(s => s.user_id === log.userId ? { ...s, total_score: s.total_score + log.pointsEarned } : s)
        : [...stats.scores, { user_id: log.userId, total_score: log.pointsEarned }];

      // Update goal_scores
      const existingGoalScore = stats.goalScores.find(gs => gs.user_id === log.userId && gs.goal_id === log.goalId);
      const newGoalScores = existingGoalScore
        ? stats.goalScores.map(gs => gs.user_id === log.userId && gs.goal_id === log.goalId ? { ...gs, score: gs.score + log.pointsEarned } : gs)
        : [...stats.goalScores, { user_id: log.userId, goal_id: log.goalId, score: log.pointsEarned }];

      // Update period_counts (we need to derive period_key from the log)
      // The period_key is already set server-side, but for optimistic updates
      // we increment the count for the matching period
      const newPeriodCounts = [...stats.periodCounts];
      // Period key is generated at log time — for optimistic display we just
      // add a placeholder entry. The real data refreshes shortly after.
      const dayStr = log.timestamp.slice(0, 10); // YYYY-MM-DD
      const optimisticPeriodKey = `daily-${dayStr}`;
      const existingPc = newPeriodCounts.findIndex(
        pc => pc.user_id === log.userId && pc.goal_id === log.goalId && pc.period_key === optimisticPeriodKey
      );
      if (existingPc >= 0) {
        newPeriodCounts[existingPc] = { ...newPeriodCounts[existingPc], count: newPeriodCounts[existingPc].count + 1 };
      } else {
        newPeriodCounts.push({ user_id: log.userId, goal_id: log.goalId, period_key: optimisticPeriodKey, count: 1 });
      }

      // Update daily_points
      const newDailyPoints = [...stats.dailyPoints];
      const existingDp = newDailyPoints.findIndex(
        dp => dp.user_id === log.userId && dp.goal_id === log.goalId && dp.day === dayStr
      );
      if (existingDp >= 0) {
        newDailyPoints[existingDp] = { ...newDailyPoints[existingDp], points: newDailyPoints[existingDp].points + log.pointsEarned };
      } else {
        newDailyPoints.push({ user_id: log.userId, goal_id: log.goalId, day: dayStr, points: log.pointsEarned });
      }

      return {
        ...prev,
        [challengeId]: {
          scores: newScores,
          goalScores: newGoalScores,
          periodCounts: newPeriodCounts,
          dailyPoints: newDailyPoints
        }
      };
    });

    // Update participant score in challenge cache
    setChallengeCache(prev => {
      const challenge = prev[challengeId];
      if (!challenge) return prev;
      return {
        ...prev,
        [challengeId]: {
          ...challenge,
          participants: challenge.participants.map(p =>
            p.userId === log.userId
              ? { ...p, score: p.score + log.pointsEarned }
              : p
          )
        }
      };
    });
  }, []);

  /**
   * Optimistically remove a completion log from the stats cache.
   * Now requires the full log to be passed so we can adjust aggregates.
   */
  const removeOptimisticLog = useCallback((challengeId: string, _logId: string, log: CompletionLog) => {
    setStatsCache(prev => {
      const stats = prev[challengeId];
      if (!stats) return prev;

      const newScores = stats.scores.map(s =>
        s.user_id === log.userId ? { ...s, total_score: s.total_score - log.pointsEarned } : s
      );

      const newGoalScores = stats.goalScores.map(gs =>
        gs.user_id === log.userId && gs.goal_id === log.goalId ? { ...gs, score: gs.score - log.pointsEarned } : gs
      );

      const dayStr = log.timestamp.slice(0, 10);
      const optimisticPeriodKey = `daily-${dayStr}`;
      const newPeriodCounts = stats.periodCounts.map(pc =>
        pc.user_id === log.userId && pc.goal_id === log.goalId && pc.period_key === optimisticPeriodKey
          ? { ...pc, count: Math.max(0, pc.count - 1) }
          : pc
      );

      const newDailyPoints = stats.dailyPoints.map(dp =>
        dp.user_id === log.userId && dp.goal_id === log.goalId && dp.day === dayStr
          ? { ...dp, points: dp.points - log.pointsEarned }
          : dp
      );

      return {
        ...prev,
        [challengeId]: {
          scores: newScores,
          goalScores: newGoalScores,
          periodCounts: newPeriodCounts,
          dailyPoints: newDailyPoints
        }
      };
    });

    // Update participant score in challenge cache
    setChallengeCache(prev => {
      const challenge = prev[challengeId];
      if (!challenge) return prev;
      return {
        ...prev,
        [challengeId]: {
          ...challenge,
          participants: challenge.participants.map(p =>
            p.userId === log.userId
              ? { ...p, score: p.score - log.pointsEarned }
              : p
          )
        }
      };
    });
  }, []);

  const getChallenge = useCallback(async (id: string): Promise<Challenge | undefined> => {
    const cached = challengeCache[id];

    if (cached) {
      // Background refresh only if TTL expired (not on every call)
      const lastFetch = lastFetchDetailRef.current[id] || 0;
      if (Date.now() - lastFetch >= CACHE_TTL_MS) {
        fetchChallengeDetail(id); // fire-and-forget, deduplicated
      }
      return cached;
    }

    // If not in cache, fetch and await
    const latest = await api.getChallengeById(id);
    if (latest) {
      setChallengeCache(prev => ({ ...prev, [id]: latest }));
      lastFetchDetailRef.current[id] = Date.now();
    }
    return latest;
  }, [challengeCache, fetchChallengeDetail]);

  const getStats = useCallback(async (id: string): Promise<ChallengeStats> => {
    const cached = statsCache[id];

    if (cached) {
      // Background refresh only if TTL expired
      const lastFetch = lastFetchStatsRef.current[id] || 0;
      if (Date.now() - lastFetch >= CACHE_TTL_MS) {
        fetchStats(id); // fire-and-forget, deduplicated
      }
      return cached;
    }

    const latest = await api.getStats(id);
    setStatsCache(prev => ({ ...prev, [id]: latest }));
    lastFetchStatsRef.current[id] = Date.now();
    return latest;
  }, [statsCache, fetchStats]);

  const clearCache = useCallback(() => {
    setChallenges(null);
    setChallengeCache({});
    setStatsCache({});
    hasLoadedRef.current = false;
    lastFetchAllRef.current = 0;
    lastFetchDetailRef.current = {};
    lastFetchStatsRef.current = {};
  }, []);

  return (
    <ChallengeContext.Provider value={{
      challenges,
      challengeCache,
      statsCache,
      refreshChallenges,
      fetchChallengeDetail,
      fetchStats,
      getChallenge,
      getStats,
      invalidateChallenge,
      addOptimisticLog,
      removeOptimisticLog,
      clearCache,
      isLoading
    }}>
      {children}
    </ChallengeContext.Provider>
  );
};

export const useChallenges = () => {
  const context = useContext(ChallengeContext);
  if (!context) {
    throw new Error('useChallenges must be used within a ChallengeProvider');
  }
  return context;
};
