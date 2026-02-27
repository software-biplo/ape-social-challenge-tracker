
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Challenge, ChallengeStats, CompletionLog, Goal, ChatMessage } from '../types';
import { api, getPeriodKey } from '../services/dataService';
import { getIcon } from '../services/iconService';
import { useAuth } from '../context/AuthContext';
import { useChallenges } from '../context/ChallengeContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import LoadingScreen from '../components/LoadingScreen';
import WrappedTab from '../components/WrappedTab';
import { Check, Minus, Settings, Loader2, Trash2, ArrowLeft, CheckCircle, LogOut, ShieldCheck, Lock, AlertTriangle, X, ChevronDown, ChevronLeft, ChevronRight, Send, MessageCircle, Info } from 'lucide-react';
import { ResponsiveContainer, CartesianGrid, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
// Fixed date-fns imports to use named imports from the main package to resolve 'not callable' errors
import { format, eachDayOfInterval, isSameDay, isBefore, isAfter, subDays, addDays, startOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

const ChallengeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { challengeCache, statsCache, fetchChallengeDetail, fetchStats, refreshChallenges, invalidateChallenge, addOptimisticLog, removeOptimisticLog } = useChallenges();
  const { t, dateLocale, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  // Deriving data directly from Context Cache for reactivity
  const challenge = id ? challengeCache[id] : undefined;
  const stats: ChallengeStats = id ? (statsCache[id] || { scores: [], goalScores: [], periodCounts: [], userDailyPoints: [], groupDailyPoints: [] }) : { scores: [], goalScores: [], periodCounts: [], userDailyPoints: [], groupDailyPoints: [] };

  const [activeTab, setActiveTab] = useState<'goals' | 'wrapped' | 'leaderboard' | 'progress' | 'chat'>('goals');
  const [loadingInitial, setLoadingInitial] = useState(!challenge);
  const [processingGoalId, setProcessingGoalId] = useState<string | null>(null);
  const pendingCompletionsRef = useRef<Record<string, number>>({});
  const [wrappedPreviewEnabled, setWrappedPreviewEnabled] = useState(false);
  const [wrappedLogs, setWrappedLogs] = useState<CompletionLog[] | null>(null);
  const [isWrappedLogsLoading, setIsWrappedLogsLoading] = useState(false);
  const [showWrappedConfetti, setShowWrappedConfetti] = useState(false);
  const previewConfettiShownRef = useRef(false);

  // Date navigation: allows viewing/logging goals for past days
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const isToday = isSameDay(selectedDate, new Date());
  const isFutureDate = isAfter(selectedDate, startOfDay(new Date()));

  const [selectedLeaderboardGoalId, setSelectedLeaderboardGoalId] = useState<string>('total');
  const [selectedProgressGoalId, setSelectedProgressGoalId] = useState<string>('total');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      // Load challenge structure first for instant render, then logs in background
      const init = async () => {
        try {
          await fetchChallengeDetail(id);
        } finally {
          setLoadingInitial(false);
        }
        // Stats load in background — scores update reactively when they arrive
        fetchStats(id);
      };
      init();
    }
  }, [id, fetchChallengeDetail, fetchStats]);

  useEffect(() => {
    setWrappedPreviewEnabled(false);
    setWrappedLogs(null);
    setIsWrappedLogsLoading(false);
    setShowWrappedConfetti(false);
    previewConfettiShownRef.current = false;
  }, [id]);

  // Real-time Chat Subscription
  // OPTIMIZED: Use payload.new directly + local participant profile cache
  // instead of re-fetching from DB on every incoming message
  useEffect(() => {
      if (!id || activeTab !== 'chat') return;

      // Build a local profile lookup from challenge participants
      const profileMap: Record<string, { name: string; avatar?: string }> = {};
      if (challenge?.participants) {
          challenge.participants.forEach(p => {
              profileMap[p.userId] = { name: p.name, avatar: p.avatar };
          });
      }

      const loadChat = async () => {
          const history = await api.getMessages(id);
          // Resolve names from participant cache (no profiles join needed)
          const resolved = history.map(m => ({
              ...m,
              userName: profileMap[m.userId]?.name || 'Anonymous',
              userAvatar: profileMap[m.userId]?.avatar
          }));
          setMessages(resolved);
      };

      loadChat();

      const channel = supabase.channel(`chat:${id}`)
          .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'challenge_messages',
              filter: `challenge_id=eq.${id}`
          }, (payload) => {
              const msg = payload.new as any;
              const profile = profileMap[msg.user_id];

              setMessages(prev => {
                  if (prev.find(m => m.id === msg.id)) return prev;
                  return [...prev, {
                      id: msg.id,
                      challengeId: msg.challenge_id,
                      userId: msg.user_id,
                      userName: profile?.name || 'Anonymous',
                      userAvatar: profile?.avatar,
                      messageText: msg.message_text,
                      createdAt: msg.created_at || new Date().toISOString()
                  }];
              });
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [id, activeTab, challenge?.participants]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages, activeTab]);

  const isNotStarted = useMemo(() => {
      if (!challenge) return false;
      const start = startOfDay(parseISO(challenge.startDate));
      return isBefore(selectedDate, start);
  }, [challenge, selectedDate]);

  // Can't navigate before challenge start date
  const canGoBack = useMemo(() => {
      if (!challenge) return false;
      const start = startOfDay(parseISO(challenge.startDate));
      return isAfter(subDays(selectedDate, 1), start) || isSameDay(subDays(selectedDate, 1), start);
  }, [challenge, selectedDate]);

  const challengeEnded = useMemo(() => {
      if (!challenge) return false;
      const end = startOfDay(parseISO(challenge.endDate));
      return isAfter(startOfDay(new Date()), end);
  }, [challenge]);

  const wrappedEnabled = challengeEnded || wrappedPreviewEnabled;

  useEffect(() => {
    if (wrappedEnabled && activeTab === 'goals') setActiveTab('wrapped');
    if (!wrappedEnabled && activeTab === 'wrapped') setActiveTab('goals');
  }, [wrappedEnabled, activeTab]);

  useEffect(() => {
    if (!id || !wrappedEnabled || wrappedLogs) return;
    let cancelled = false;

    const loadWrappedLogs = async () => {
      setIsWrappedLogsLoading(true);
      try {
        const logs = await api.getLogs(id);
        if (!cancelled) setWrappedLogs(logs);
      } catch (error) {
        if (!cancelled) toast.error(t('error_generic'));
      } finally {
        if (!cancelled) setIsWrappedLogsLoading(false);
      }
    };

    loadWrappedLogs();

    return () => {
      cancelled = true;
    };
  }, [id, wrappedEnabled, wrappedLogs, t]);

  useEffect(() => {
    if (!challenge || activeTab !== 'wrapped' || !wrappedEnabled) return;

    let shouldShow = false;
    if (challengeEnded) {
      const seenKey = `ape_wrapped_seen_${challenge.id}`;
      if (!localStorage.getItem(seenKey)) {
        shouldShow = true;
        localStorage.setItem(seenKey, '1');
      }
    } else if (!previewConfettiShownRef.current) {
      shouldShow = true;
      previewConfettiShownRef.current = true;
    }

    if (!shouldShow) return;
    setShowWrappedConfetti(true);

    const timer = window.setTimeout(() => {
      setShowWrappedConfetti(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [activeTab, challenge, wrappedEnabled, challengeEnded]);

  const handleLogGoal = async (goal: Goal) => {
    if (!user || !id || processingGoalId) return;
    if (isNotStarted) {
        toast.info(t('error_generic'), {
            description: `${t('starts_on')} ${format(parseISO(challenge!.startDate), 'PPP', { locale: dateLocale })}`
        });
        return;
    }

    const periodKey = getPeriodKey(goal.frequency, selectedDate);
    const currentCompletions = userPeriodCounts.countByGoalId[goal.id] || 0;
    const maxAllowed = goal.maxCompletions || 1;
    const pendingKey = `${goal.id}:${user.id}:${periodKey}`;
    const pendingCount = pendingCompletionsRef.current[pendingKey] || 0;
    if (currentCompletions + pendingCount >= maxAllowed) return;

    setProcessingGoalId(goal.id);

    // Optimistic UI: create a temporary log entry and update cache instantly
    pendingCompletionsRef.current[pendingKey] = pendingCount + 1;
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticLog: CompletionLog = {
      id: optimisticId,
      challengeId: id,
      goalId: goal.id,
      userId: user.id,
      timestamp: selectedDate.toISOString(),
      pointsEarned: goal.points
    };
    addOptimisticLog(id, optimisticLog);
    setProcessingGoalId(null); // Unblock UI immediately

    // Show toast immediately
    if (goal.points < 0) {
        if (navigator.vibrate) navigator.vibrate(10);
        toast.warning(`Penalty logged`, {
            description: `${goal.title}: ${goal.points} points`,
            icon: <AlertTriangle className="text-rose-500" size={18} />
        });
    } else {
        if (navigator.vibrate) navigator.vibrate(10);
        toast.success(t('success_goal'), {
            description: goal.title,
            icon: '🎉'
        });
    }

    try {
        // Fire actual DB write in background with selected date
        await api.logGoalCompletion(id, goal.id, user.id, goal.points, goal.frequency, selectedDate);

        // Invalidate TTL and refresh in background to get real data
        invalidateChallenge(id);
        fetchChallengeDetail(id);
        fetchStats(id);
    } catch (e: any) {
        // Rollback optimistic update on failure
        removeOptimisticLog(id, optimisticId, optimisticLog);
        toast.error(e.message || t('error_generic'));
    } finally {
        pendingCompletionsRef.current[pendingKey] = Math.max(0, (pendingCompletionsRef.current[pendingKey] || 1) - 1);
    }
  };

  const handleReduceGoal = async (goalId: string) => {
    if (!user || !id || processingGoalId) return;
    const currentGoal = challenge?.goals.find(g => g.id === goalId);
    if (!currentGoal) return;

    const currentPeriodKey = getPeriodKey(currentGoal.frequency, selectedDate);
    const currentCount = stats.periodCounts.find(
      pc => pc.goal_id === goalId && pc.user_id === user.id && pc.period_key === currentPeriodKey
    )?.count || 0;
    if (currentCount === 0) return;

    setProcessingGoalId(goalId);

    try {
        // Find the most recent log for this goal/user/period from the server
        const logToRemove = await api.getLastLog(goalId, user.id, currentPeriodKey);
        if (!logToRemove) {
            setProcessingGoalId(null);
            return;
        }

        // Optimistic UI: remove from cache instantly
        removeOptimisticLog(id, logToRemove.id, logToRemove);
        if (navigator.vibrate) navigator.vibrate(10);
        toast.info("Progress adjusted");
        setProcessingGoalId(null);

        // Fire actual DB delete in background
        await api.deleteLog(logToRemove.id);

        // Invalidate TTL and refresh in background
        invalidateChallenge(id);
        fetchChallengeDetail(id);
        fetchStats(id);
    } catch (e: any) {
        setProcessingGoalId(null);
        toast.error(e.message || t('error_generic'));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !user || !newMessage.trim() || isSending) return;

      setIsSending(true);
      try {
          await api.sendMessage(id, user.id, newMessage.trim());
          setNewMessage('');
      } catch (err) {
          toast.error("Failed to send message");
      } finally {
          setIsSending(false);
      }
  };

  const handleConfirmDelete = async () => {
      if (!challenge || isDeleting || !id) return;
      if (deleteConfirmText !== challenge.name) return;
      setIsDeleting(true);
      try {
          await api.deleteChallenge(challenge.id);
          toast.success("Challenge deleted");
          navigate('/');
      } catch (e: any) {
          toast.error(t('error_generic'));
          setIsDeleting(false);
      }
  };

  const handleLeave = async () => {
      if (!challenge || !user || !id) return;
      if (!window.confirm("Leave?")) return;
      try {
          await api.leaveChallenge(challenge.id, user.id);
          toast.info("Left");
          navigate('/');
      } catch (e: any) {
          toast.error(t('error_generic'));
      }
  };

  const currentLeaderboard = useMemo(() => {
    if (!challenge) return [];
    if (selectedLeaderboardGoalId === 'total') {
      return [...(challenge.participants || [])].sort((a, b) => b.score - a.score);
    }
    return challenge.participants.map(p => {
      const goalScore = stats.goalScores
        .filter(gs => gs.goal_id === selectedLeaderboardGoalId && gs.user_id === p.userId)
        .reduce((sum, gs) => sum + gs.score, 0);
      return { ...p, score: goalScore };
    }).sort((a, b) => b.score - a.score);
  }, [challenge, stats.goalScores, selectedLeaderboardGoalId]);

  const goalMeta = useMemo(() => {
    const frequencyByGoalId: Record<string, string> = {};
    const maxByGoalId: Record<string, number> = {};
    const periodKeyByGoalId: Record<string, string> = {};
    if (challenge) {
      for (const goal of challenge.goals) {
        frequencyByGoalId[goal.id] = goal.frequency;
        maxByGoalId[goal.id] = goal.maxCompletions || 1;
        periodKeyByGoalId[goal.id] = getPeriodKey(goal.frequency, selectedDate);
      }
    }
    return { frequencyByGoalId, maxByGoalId, periodKeyByGoalId };
  }, [challenge, selectedDate]);

  const userPeriodCounts = useMemo(() => {
    const countByGoalId: Record<string, number> = {};
    if (!challenge || !user || isNotStarted) {
      return { countByGoalId, totalCurrent: 0, totalMax: 0 };
    }

    // Use pre-aggregated period counts from stats
    for (const pc of stats.periodCounts) {
      if (pc.user_id !== user.id) continue;
      const expectedPeriodKey = goalMeta.periodKeyByGoalId[pc.goal_id];
      if (!expectedPeriodKey || pc.period_key !== expectedPeriodKey) continue;
      countByGoalId[pc.goal_id] = (countByGoalId[pc.goal_id] || 0) + pc.count;
    }

    let totalCurrent = 0;
    let totalMax = 0;
    for (const goal of challenge.goals) {
      const goalMax = goalMeta.maxByGoalId[goal.id] || 1;
      const count = countByGoalId[goal.id] || 0;
      // All goals (including penalties) contribute to current score
      totalCurrent += Math.min(count, goalMax) * goal.points;
      // Only positive goals count toward max achievable
      if (goal.points > 0) {
        totalMax += goalMax * goal.points;
      }
    }

    return { countByGoalId, totalCurrent, totalMax };
  }, [challenge, stats.periodCounts, user, isNotStarted, goalMeta]);

  const dailyProgress = useMemo(() => {
    if (!challenge || !user || isNotStarted) return { current: 0, total: 0 };
    return { current: userPeriodCounts.totalCurrent, total: userPeriodCounts.totalMax };
  }, [challenge, user, isNotStarted, userPeriodCounts]);

  const progressData = useMemo(() => {
    if (!challenge || activeTab !== 'progress') return { chart: [], userTotal: 0, groupAvg: 0 };
    // Derive the 7-day range from both data arrays + today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const allDays = new Set<string>();
    stats.userDailyPoints.forEach(dp => allDays.add(dp.day));
    stats.groupDailyPoints.forEach(dp => allDays.add(dp.day));
    allDays.add(todayStr);
    const uniqueDays = [...allDays].sort();
    const days = uniqueDays.map(d => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); });
    let cumulativeUser = 0;
    let cumulativeGroupSum = 0;
    const participantCount = challenge.participants.length || 1;
    const chart = days.map(day => {
       const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
       const myDayPoints = stats.userDailyPoints
         .filter(dp => dp.day === dayStr && (selectedProgressGoalId === 'total' || dp.goal_id === selectedProgressGoalId))
         .reduce((sum, dp) => sum + dp.points, 0);
       const totalDayPoints = stats.groupDailyPoints
         .filter(dp => dp.day === dayStr && (selectedProgressGoalId === 'total' || dp.goal_id === selectedProgressGoalId))
         .reduce((sum, dp) => sum + dp.total_points, 0);
       const avgDayPoints = totalDayPoints / participantCount;
       cumulativeUser += myDayPoints;
       cumulativeGroupSum += avgDayPoints;
       return {
         name: format(day, 'EEEEEE', { locale: dateLocale }),
         'Jouw Punten': cumulativeUser,
         'Gemiddelde': Math.round(cumulativeGroupSum)
       };
    });
    return { chart, userTotal: cumulativeUser, groupAvg: Math.round(cumulativeGroupSum) };
  }, [stats.userDailyPoints, stats.groupDailyPoints, challenge, dateLocale, selectedProgressGoalId, activeTab]);

  // Recharts theme-aware colors
  const chartGridStroke = resolvedTheme === 'dark' ? '#334155' : '#f1f5f9';
  const chartAxisStroke = resolvedTheme === 'dark' ? '#64748b' : '#94a3b8';
  const chartTooltipStyle = {
    borderRadius: '16px',
    border: 'none',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
    padding: '12px',
    backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#fff',
    borderColor: resolvedTheme === 'dark' ? '#475569' : '#e2e8f0',
    color: resolvedTheme === 'dark' ? '#e2e8f0' : '#0f172a',
  };
  const chartAvgLineStroke = resolvedTheme === 'dark' ? '#475569' : '#cbd5e1';

  if (loadingInitial) return <LoadingScreen />;
  if (!challenge) return <div className="p-8 text-center text-red-500 dark:text-red-400">Challenge not found.</div>;

  const sortedGoals = [...challenge.goals].sort((a, b) => {
    const groupA = a.points < 0 ? 1 : 0;
    const groupB = b.points < 0 ? 1 : 0;
    if (groupA !== groupB) return groupA - groupB;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  const isOwner = user?.id === challenge.creatorId;
  const wrappedTabLabel = language === 'nl' ? 'Wrapped' : language === 'fr' ? 'Wrapped' : 'Wrapped';
  const previewWrappedLabel = language === 'nl' ? 'Preview Wrapped' : language === 'fr' ? 'Apercu Wrapped' : 'Preview Wrapped';
  const stopPreviewLabel = language === 'nl' ? 'Stop Preview' : language === 'fr' ? 'Stop Apercu' : 'Stop Preview';
  const wrappedUnlockInfo = language === 'nl'
    ? 'Wrapped wordt automatisch beschikbaar zodra de challenge eindigt.'
    : language === 'fr'
      ? 'Wrapped sera disponible automatiquement a la fin du challenge.'
      : 'Wrapped unlocks automatically as soon as the challenge ends.';

  const tabs = [
    { id: wrappedEnabled ? 'wrapped' : 'goals', label: wrappedEnabled ? wrappedTabLabel : t('my_goals') },
    { id: 'leaderboard', label: t('leaderboard') },
    { id: 'progress', label: t('progress') },
    { id: 'chat', label: t('chat') },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2 px-4 md:px-0">
         <Link to="/" className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium">
            <ArrowLeft size={20} /> {t('back')}
         </Link>
         <div className="flex gap-2">
            {isOwner && (
                <Link to={`/challenge/${challenge.id}/edit`} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                    <Settings size={20} />
                </Link>
            )}
            {isOwner ? (
                <button onClick={() => { setDeleteConfirmText(''); setIsDeleteModalOpen(true); }} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors" title={t('delete_challenge')}>
                    <Trash2 size={20} />
                </button>
            ) : (
                <button onClick={handleLeave} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-colors" title={t('leave_challenge')}>
                    <LogOut size={20} />
                </button>
            )}
         </div>
      </div>

      <div className="flex flex-col gap-1 px-4 md:px-0">
          <div className="flex items-start gap-3">
             <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">{challenge.name}</h1>
             {isOwner && (
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold border border-brand-200 uppercase tracking-tighter shrink-0">
                   <ShieldCheck size={10} /> {t('host')}
                </span>
             )}
          </div>
          {isNotStarted && (
             <div className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-sm bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-lg w-fit mt-1">
                <Lock size={14} /> {t('starts_on')} {format(parseISO(challenge.startDate), 'd MMMM', { locale: dateLocale })}
             </div>
          )}
          {!challengeEnded && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setWrappedPreviewEnabled(prev => !prev);
                  if (!wrappedEnabled) setActiveTab('wrapped');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-colors ${
                  wrappedPreviewEnabled
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                }`}
              >
                {wrappedPreviewEnabled ? stopPreviewLabel : previewWrappedLabel}
              </button>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{wrappedUnlockInfo}</span>
            </div>
          )}
      </div>

      <div className="px-4 md:px-0 sticky top-0 z-30">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
           <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-tight">
                {isToday ? t('daily_progress') : format(selectedDate, 'd MMM', { locale: dateLocale })}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-black text-brand-600">
                  {dailyProgress.current} {language === 'nl' ? 'van' : 'of'} {dailyProgress.total}
                </span>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">100% max</span>
              </div>
           </div>
           <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {language === 'nl' ? 'Dagscore' : 'Daily score'}
              </span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                {dailyProgress.total ? Math.max(0, Math.min(100, Math.round((dailyProgress.current / dailyProgress.total) * 100))) : 0}%
              </span>
           </div>
           <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
              <div
                  className={`h-full bg-gradient-to-r from-brand-500 via-orange-400 to-rose-400 rounded-full transition-all duration-700 ease-out ${isNotStarted ? 'opacity-30' : ''}`}
                  style={{ width: `${dailyProgress.total ? Math.max(0, Math.min(100, (dailyProgress.current / dailyProgress.total) * 100)) : 0}%` }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.35),transparent_60%)] opacity-60" />
           </div>
        </div>
      </div>

      {/* Adjusted Tab Bar: Font size reduced to text-[10px] for mobile to ensure fitting 4 columns */}
      <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-600 px-4 md:px-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-0 text-[10px] sm:text-sm font-bold transition-all relative text-center min-w-0 truncate ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-500 rounded-t-full" />}
          </button>
        ))}
      </div>

      <div className="min-h-[400px] pt-2 px-4 md:px-0 pb-10">
        {activeTab === 'goals' && (
          <div className="space-y-4">
            {/* Date Navigator */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm px-4 py-3">
              <button
                onClick={() => canGoBack && setSelectedDate(prev => startOfDay(subDays(prev, 1)))}
                disabled={!canGoBack}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setSelectedDate(startOfDay(new Date()))}
                className="flex flex-col items-center gap-0.5 min-w-[140px]"
              >
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {isToday ? (language === 'nl' ? 'Vandaag' : 'Today') : format(selectedDate, 'd MMMM', { locale: dateLocale })}
                </span>
                {!isToday && (
                  <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">
                    {language === 'nl' ? 'Tik voor vandaag' : 'Tap for today'}
                  </span>
                )}
              </button>
              <button
                onClick={() => !isToday && !isFutureDate && setSelectedDate(prev => startOfDay(addDays(prev, 1)))}
                disabled={isToday || isFutureDate}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {sortedGoals.length > 0 && !statsCache[id!] && (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700" />
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-700 rounded" />
                          <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700" />
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sortedGoals.map(goal => {
              const GoalIcon = getIcon(goal.icon);
              const completionsInPeriod = userPeriodCounts.countByGoalId[goal.id] || 0;
              const isCompleted = goal.maxCompletions ? completionsInPeriod >= goal.maxCompletions : false;
              const isProcessing = processingGoalId === goal.id;
              const isPenalty = goal.points < 0;

              return (
                <div key={goal.id} className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm transition-all ${isNotStarted ? 'opacity-80 grayscale' : 'hover:shadow-md'}`}>
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isCompleted ? (isPenalty ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400') : (isPenalty ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-500')}`}>
                           <GoalIcon size={24} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            {/* Restored truncate for Goal Title to prevent card expansion */}
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight truncate tracking-tight">{goal.title}</h3>
                              {goal.description && (
                                <div className="relative group">
                                  <button
                                    type="button"
                                    aria-label={language === 'nl' ? 'Toelichting' : 'Description'}
                                    className="p-1 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    <Info size={14} />
                                  </button>
                                  <div className="absolute left-1/2 top-full z-20 hidden w-56 -translate-x-1/2 pt-2 group-hover:block group-focus-within:block">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-lg">
                                      {goal.description}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1.5 py-0.5 bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-700">{t(goal.frequency as any)}</span>
                                <span className={`text-xs font-bold ${isPenalty ? 'text-rose-500 dark:text-rose-400' : 'text-brand-600'}`}>
                                    {goal.points >= 0 ? '+' : ''}{goal.points} pts • {completionsInPeriod}/{goal.maxCompletions || 1}
                                </span>
                            </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {completionsInPeriod > 0 && !isNotStarted && (
                           <button disabled={isProcessing} onClick={() => handleReduceGoal(goal.id)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all bg-white dark:bg-slate-800 active:scale-90">
                              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Minus size={18} />}
                           </button>
                        )}
                        <button
                            disabled={isCompleted || isProcessing}
                            onClick={() => handleLogGoal(goal)}
                            className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all shadow-sm active:scale-95 ${
                                isCompleted
                                    ? (isPenalty ? 'bg-rose-500 border-rose-500 text-white' : 'bg-green-500 border-green-500 text-white')
                                    : isNotStarted
                                        ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                        : isPenalty
                                            ? 'border-slate-200 dark:border-slate-600 hover:border-rose-300 dark:hover:border-rose-700 bg-white dark:bg-slate-800 text-transparent hover:text-rose-300 dark:hover:text-rose-400'
                                            : 'border-slate-200 dark:border-slate-600 hover:border-brand-300 dark:hover:border-brand-700 bg-white dark:bg-slate-800 text-transparent hover:text-brand-300'
                            }`}
                        >
                           {isProcessing ? <Loader2 size={24} className="animate-spin" /> : (isNotStarted ? <Lock size={18} /> : (isCompleted ? <Check size={24} strokeWidth={3} /> : <Check size={24} className="text-slate-100 dark:text-slate-700" />))}
                        </button>
                      </div>
                  </div>
                  {isCompleted && (
                      <div className={`mt-4 border rounded-xl py-2 px-3 flex items-center gap-2 text-xs font-bold animate-fadeIn ${isPenalty ? 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-100/50 dark:border-rose-800/50 text-rose-700 dark:text-rose-400' : 'bg-green-50/50 dark:bg-green-900/20 border-green-100/50 dark:border-green-800/50 text-green-700 dark:text-green-400'}`}>
                          {isPenalty ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                          <span>{isPenalty ? 'Limit reached for this habit.' : t('completed_today')}</span>
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'wrapped' && wrappedEnabled && (
          <WrappedTab
            challenge={challenge}
            stats={stats}
            logs={wrappedLogs || []}
            isLoadingLogs={isWrappedLogsLoading || !wrappedLogs}
            language={language}
            showConfetti={showWrappedConfetti}
            currentUserId={user?.id}
          />
        )}
        {activeTab === 'leaderboard' && (
          <div className="animate-fadeIn space-y-6">
            <div className="relative">
              <select value={selectedLeaderboardGoalId} onChange={(e) => setSelectedLeaderboardGoalId(e.target.value)} className="w-full pl-4 pr-10 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl text-base font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/20 appearance-none shadow-sm transition-all">
                <option value="total">{language === 'nl' ? 'Totaal Klassement' : 'Overall Standing'}</option>
                {sortedGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={20} />
            </div>
            <div className="space-y-3">
              {currentLeaderboard.map((participant, index) => (
                <div key={participant.userId} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${participant.userId === user?.id ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-700 ring-1 ring-brand-500/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 flex items-center justify-center font-black rounded-lg text-xs shadow-sm ${index === 0 ? 'bg-yellow-400 text-white' : index === 1 ? 'bg-slate-300 dark:bg-slate-500 text-white' : index === 2 ? 'bg-orange-400 text-white' : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-700'}`}>
                      {index + 1}
                    </div>
                    <img src={participant.avatar} alt={participant.name} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 object-cover shadow-sm border-2 border-white dark:border-slate-700" />
                    <span className={`font-bold truncate max-w-[150px] md:max-w-none tracking-tight ${participant.userId === user?.id ? 'text-brand-900 dark:text-brand-300' : 'text-slate-900 dark:text-slate-100'}`}>{participant.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-black text-2xl tracking-tighter ${participant.score < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{participant.score}</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-1">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'progress' && (
          <div className="animate-fadeIn space-y-8">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{selectedProgressGoalId === 'total' ? t('progress') : challenge.goals.find(g => g.id === selectedProgressGoalId)?.title}</h2>
                <div className="relative min-w-[200px]">
                  <select value={selectedProgressGoalId} onChange={(e) => setSelectedProgressGoalId(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm appearance-none">
                    <option value="total">Alle Doelen</option>
                    {sortedGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={16} />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm overflow-hidden">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressData.chart} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} tickMargin={10} stroke={chartAxisStroke} fontWeight="bold" />
                      <YAxis axisLine={false} tickLine={false} fontSize={10} stroke={chartAxisStroke} fontWeight="bold" />
                      <Tooltip cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={chartTooltipStyle} />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" formatter={(value) => <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">{value}</span>} />
                      <Line type="monotone" dataKey="Gemiddelde" stroke={chartAvgLineStroke} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 0 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Jouw Punten" stroke="#f97316" strokeWidth={4} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: resolvedTheme === 'dark' ? '#1e293b' : '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 rounded-2xl p-5 shadow-sm">
                  <span className="text-[10px] font-black text-brand-700 dark:text-brand-300 uppercase tracking-widest">{t('points').toLowerCase()}</span>
                  <div className="mt-1"><span className={`text-3xl font-black tracking-tighter ${(stats.scores.find(s => s.user_id === user?.id)?.total_score ?? 0) < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-brand-600'}`}>{stats.scores.find(s => s.user_id === user?.id)?.total_score ?? 0}</span></div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Groep Gem. (7d)</span>
                  <div className="mt-1"><span className={`text-4xl font-black tracking-tighter ${progressData.groupAvg < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{progressData.groupAvg}</span></div>
               </div>
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
            <div className="flex flex-col bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm h-[500px] overflow-hidden relative animate-fadeIn">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2 py-10">
                            <MessageCircle size={48} strokeWidth={1} />
                            <p className="text-sm font-medium">Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((m) => {
                            const isMe = m.userId === user?.id;
                            const date = m.createdAt ? new Date(m.createdAt) : new Date();
                            const formattedTime = !isNaN(date.getTime()) ? format(date, 'HH:mm') : '--:--';

                            return (
                                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                                    <div className={`flex max-w-[80%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <img src={m.userAvatar || `https://api.dicebear.com/9.x/initials/svg?seed=${m.userName}`} alt={m.userName} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 shrink-0" />
                                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            {!isMe && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 ml-1 tracking-wider">{m.userName}</span>}
                                            <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-brand-500 text-white rounded-tr-none shadow-md shadow-brand-500/10' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-none'}`}>
                                                <p className="selectable leading-relaxed">{m.messageText}</p>
                                            </div>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1">{formattedTime}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-50 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2 items-end">
                    <textarea
                        rows={1}
                        placeholder={t('type_message')}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 text-sm max-h-32 transition-all resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
                        className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/20 active:scale-90 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
                    </button>
                </form>
            </div>
        )}
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => !isDeleting && setIsDeleteModalOpen(false)}>
           <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-sm shadow-2xl animate-scaleIn relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setIsDeleteModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors" disabled={isDeleting}><X size={20} /></button>
              <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm"><AlertTriangle size={28} /></div>
                 <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-tighter">{t('delete_confirm_title')}</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">Type de naam om te verwijderen: <br/><span className="text-slate-900 dark:text-slate-100 font-bold block mt-2 text-base select-all">"{challenge.name}"</span></p>
              </div>
              <div className="space-y-4">
                <input autoFocus type="text" placeholder={challenge.name} className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-slate-900 dark:text-slate-100 font-bold text-center tracking-widest placeholder:text-slate-400 dark:placeholder:text-slate-500" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} />
                <button disabled={deleteConfirmText !== challenge.name || isDeleting} onClick={handleConfirmDelete} className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-red-600/20 flex items-center justify-center gap-2">
                   {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />} {t('delete')}
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChallengeDetail;
