
import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Challenge, CompletionLog } from '../types';
import { api } from '../services/dataService';
import { useAuth } from './AuthContext';

// Cache TTL: don't re-fetch if data was fetched less than this many ms ago
const CACHE_TTL_MS = 30_000; // 30 seconds

interface ChallengeContextType {
  challenges: Challenge[] | null;
  challengeCache: Record<string, Challenge>;
  logsCache: Record<string, CompletionLog[]>;
  refreshChallenges: (force?: boolean) => Promise<void>;
  fetchChallengeDetail: (id: string) => Promise<void>;
  fetchLogs: (id: string) => Promise<void>;
  getChallenge: (id: string) => Promise<Challenge | undefined>;
  getLogs: (id: string) => Promise<CompletionLog[]>;
  invalidateChallenge: (id: string) => void;
  addOptimisticLog: (id: string, log: CompletionLog) => void;
  removeOptimisticLog: (challengeId: string, logId: string) => void;
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
  const [logsCache, setLogsCache] = useState<Record<string, CompletionLog[]>>({});

  const hasLoadedRef = useRef(false);

  // --- TTL tracking: timestamps of last successful fetch ---
  const lastFetchAllRef = useRef<number>(0);
  const lastFetchDetailRef = useRef<Record<string, number>>({});
  const lastFetchLogsRef = useRef<Record<string, number>>({});

  // --- In-flight deduplication: prevent duplicate concurrent requests ---
  const inFlightAllRef = useRef<Promise<void> | null>(null);
  const inFlightDetailRef = useRef<Record<string, Promise<void>>>({});
  const inFlightLogsRef = useRef<Record<string, Promise<void>>>({});

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
                name: p.name || prior.name
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
                name: p.name || prior.name
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

  const fetchLogs = useCallback(async (id: string) => {
    // Skip if recently fetched
    if (Date.now() - (lastFetchLogsRef.current[id] || 0) < CACHE_TTL_MS) return;

    // Deduplicate
    if (inFlightLogsRef.current[id]) return inFlightLogsRef.current[id];

    const request = (async () => {
      try {
        const latest = await api.getLogs(id);
        setLogsCache(prev => ({ ...prev, [id]: latest }));
        lastFetchLogsRef.current[id] = Date.now();

        // Compute participant scores from logs (avoids separate scores query)
        setChallengeCache(prev => {
          const challenge = prev[id];
          if (!challenge) return prev;
          const scoreMap: Record<string, number> = {};
          for (const log of latest) {
            scoreMap[log.userId] = (scoreMap[log.userId] || 0) + log.pointsEarned;
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
        console.error("Failed to fetch logs", e);
      } finally {
        delete inFlightLogsRef.current[id];
      }
    })();

    inFlightLogsRef.current[id] = request;
    return request;
  }, []);

  /**
   * Invalidate TTL for a specific challenge so the next fetch actually runs.
   * Call this after mutations (log goal, delete log, etc.)
   */
  const invalidateChallenge = useCallback((id: string) => {
    lastFetchDetailRef.current[id] = 0;
    lastFetchLogsRef.current[id] = 0;
  }, []);

  /**
   * Optimistically add a completion log to the cache.
   * Updates both the logs cache and the challenge participant scores.
   * This gives instant UI feedback before the server confirms.
   */
  const addOptimisticLog = useCallback((challengeId: string, log: CompletionLog) => {
    // Add to logs cache
    setLogsCache(prev => ({
      ...prev,
      [challengeId]: [log, ...(prev[challengeId] || [])]
    }));

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
   * Optimistically remove a completion log from the cache.
   * Updates both the logs cache and the challenge participant scores.
   */
  const removeOptimisticLog = useCallback((challengeId: string, logId: string) => {
    setLogsCache(prev => {
      const logs = prev[challengeId] || [];
      const removedLog = logs.find(l => l.id === logId);
      if (!removedLog) return prev;

      // Also update the participant score
      setChallengeCache(prevCache => {
        const challenge = prevCache[challengeId];
        if (!challenge) return prevCache;
        return {
          ...prevCache,
          [challengeId]: {
            ...challenge,
            participants: challenge.participants.map(p =>
              p.userId === removedLog.userId
                ? { ...p, score: p.score - removedLog.pointsEarned }
                : p
            )
          }
        };
      });

      return {
        ...prev,
        [challengeId]: logs.filter(l => l.id !== logId)
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

  const getLogs = useCallback(async (id: string): Promise<CompletionLog[]> => {
    const cached = logsCache[id];

    if (cached) {
      // Background refresh only if TTL expired
      const lastFetch = lastFetchLogsRef.current[id] || 0;
      if (Date.now() - lastFetch >= CACHE_TTL_MS) {
        fetchLogs(id); // fire-and-forget, deduplicated
      }
      return cached;
    }

    const latest = await api.getLogs(id);
    setLogsCache(prev => ({ ...prev, [id]: latest }));
    lastFetchLogsRef.current[id] = Date.now();
    return latest;
  }, [logsCache, fetchLogs]);

  const clearCache = useCallback(() => {
    setChallenges(null);
    setChallengeCache({});
    setLogsCache({});
    hasLoadedRef.current = false;
    lastFetchAllRef.current = 0;
    lastFetchDetailRef.current = {};
    lastFetchLogsRef.current = {};
  }, []);

  return (
    <ChallengeContext.Provider value={{
      challenges,
      challengeCache,
      logsCache,
      refreshChallenges,
      fetchChallengeDetail,
      fetchLogs,
      getChallenge,
      getLogs,
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
