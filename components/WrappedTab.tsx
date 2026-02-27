import React, { useEffect, useMemo, useState } from 'react';
import { addDays, eachDayOfInterval, format, isAfter, parseISO, startOfDay, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Challenge, ChallengeStats, CompletionLog } from '../types';

interface WrappedTabProps {
  challenge: Challenge;
  stats: ChallengeStats;
  logs: CompletionLog[];
  isLoadingLogs: boolean;
  language: 'nl' | 'en' | 'fr';
  showConfetti: boolean;
  currentUserId?: string;
}

type WrappedParticipant = {
  userId: string;
  name: string;
  avatar?: string;
  score: number;
};

type GoalRanking = {
  goalId: string;
  goalTitle: string;
  averageScore: number;
  ranking: WrappedParticipant[];
  topThree: WrappedParticipant[];
  myScore: number;
  myRank: number;
};

const WrappedTab: React.FC<WrappedTabProps> = ({
  challenge,
  stats,
  logs,
  isLoadingLogs,
  language,
  showConfetti,
  currentUserId,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [goalSlideIndex, setGoalSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
    setGoalSlideIndex(0);
  }, [challenge.id]);

  const copy = useMemo(() => {
    if (language === 'nl') {
      return {
        wrappedTitle: 'Challenge Wrapped',
        wrappedSub: 'Jullie eindresultaat in een paar slides',
        noData: 'Nog onvoldoende data om Wrapped te tonen.',
        loading: 'Wrapped data laden...',
        previous: 'Vorige',
        next: 'Volgende',
        done: 'Klaar',
        introTitle: 'APE Wrapped',
        introSub: 'De challenge is voorbij. Tijd voor de highlights.',
        slidePodium: 'Top 3 Podium',
        slidePodiumSub: 'De sterkste finishers van de challenge',
        slideChampions: 'Winnaars & Verliezers',
        slideChampionsSub: 'Wie was het sterkst, wie was er minder sterk.',
        slideGoalWinners: 'Top 3 per doel',
        slideGoalWinnersSub: 'Bekijk per subgoal de top 3',
        slidePersonal: 'Mijn persoonlijke stats',
        slidePersonalSub: 'Per subdoel: jouw score, jouw ranking en het groepsgemiddelde',
        slideTeam: 'Team Stats',
        slideTeamSub: 'Overzicht van de challenge als geheel',
        biggestTotal: 'Biggest Total Score',
        mostNegativeSubgoal: 'Meest negatieve totaal op een subgoal',
        points: 'punten',
        noWinner: 'Nog geen duidelijke winnaar',
        completions: 'voltooiingen',
        totalPoints: 'totaal punten',
        avgPerParticipant: 'gem. per deelnemer',
        activeParticipants: 'actieve deelnemers',
        completionRate: 'completion rate',
        rank: 'plek',
        goal: 'doel',
        myScore: 'jouw score',
        avgScore: 'gemiddelde',
      };
    }

    if (language === 'fr') {
      return {
        wrappedTitle: 'Challenge Wrapped',
        wrappedSub: 'Résumé final du challenge en quelques slides',
        noData: 'Pas assez de données pour afficher le Wrapped.',
        loading: 'Chargement des données Wrapped...',
        previous: 'Précédent',
        next: 'Suivant',
        done: 'Terminé',
        introTitle: 'APE Wrapped',
        introSub: 'Le challenge est terminé. Voici les temps forts.',
        slidePodium: 'Podium Top 3',
        slidePodiumSub: 'Les meilleurs finishers du challenge',
        slideChampions: 'Gagnants & Perdants',
        slideChampionsSub: 'Qui etait le plus fort, et qui l etait moins.',
        slideGoalWinners: 'Top 3 par objectif',
        slideGoalWinnersSub: 'Voir le top 3 pour chaque sous-objectif',
        slidePersonal: 'Mes stats personnelles',
        slidePersonalSub: 'Par sous-objectif: ton score, ton rang et la moyenne du groupe',
        slideTeam: 'Stats équipe',
        slideTeamSub: 'Résumé global du challenge',
        biggestTotal: 'Meilleur score total',
        mostNegativeSubgoal: 'Total le plus negatif sur un sous-objectif',
        points: 'points',
        noWinner: 'Pas encore de vainqueur clair',
        completions: 'complétions',
        totalPoints: 'points totaux',
        avgPerParticipant: 'moy. par participant',
        activeParticipants: 'participants actifs',
        completionRate: 'taux de completion',
        rank: 'rang',
        goal: 'objectif',
        myScore: 'ton score',
        avgScore: 'moyenne',
      };
    }

    return {
      wrappedTitle: 'Challenge Wrapped',
      wrappedSub: 'Your final challenge story in a few slides',
      noData: 'Not enough data yet to show Wrapped.',
      loading: 'Loading wrapped data...',
      previous: 'Previous',
      next: 'Next',
      done: 'Done',
      introTitle: 'APE Wrapped',
      introSub: 'The challenge is over. Time for the highlights.',
      slidePodium: 'Top 3 Podium',
      slidePodiumSub: 'The strongest finishers of the challenge',
      slideChampions: 'Winners & Strugglers',
      slideChampionsSub: 'Who was strongest, and who struggled most.',
      slideGoalWinners: 'Top 3 by Goal',
      slideGoalWinnersSub: 'Navigate each subgoal and see the top 3',
      slidePersonal: 'My Personal Stats',
      slidePersonalSub: 'Per subgoal: your score, your rank, and group average',
      slideTeam: 'Team Stats',
      slideTeamSub: 'A full challenge summary',
      biggestTotal: 'Biggest Total Score',
      mostNegativeSubgoal: 'Most negative total on a subgoal',
      points: 'points',
      noWinner: 'No clear winner yet',
      completions: 'completions',
      totalPoints: 'total points',
      avgPerParticipant: 'avg per participant',
      activeParticipants: 'active participants',
      completionRate: 'completion rate',
      rank: 'rank',
      goal: 'goal',
      myScore: 'your score',
      avgScore: 'average',
    };
  }, [language]);

  const leaderboard: WrappedParticipant[] = useMemo(() => {
    const participantMap = new Map(challenge.participants.map(p => [p.userId, p]));

    if (stats.scores.length > 0) {
      return [...stats.scores]
        .map(s => {
          const p = participantMap.get(s.user_id);
          return {
            userId: s.user_id,
            name: p?.name || 'Anonymous',
            avatar: p?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${p?.name || s.user_id}`,
            score: s.total_score,
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    return [...challenge.participants]
      .map(p => ({ ...p, avatar: p.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${p.name}` }))
      .sort((a, b) => b.score - a.score);
  }, [challenge.participants, stats.scores]);

  const topThree = leaderboard.slice(0, 3);

  const sortedGoals = useMemo(() => {
    return [...challenge.goals].sort((a, b) => {
      const groupA = a.points < 0 ? 1 : 0;
      const groupB = b.points < 0 ? 1 : 0;
      if (groupA !== groupB) return groupA - groupB;
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
  }, [challenge.goals]);

  const scoreByGoalAndUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stats.goalScores) {
      map.set(`${row.goal_id}:${row.user_id}`, row.score);
    }
    return map;
  }, [stats.goalScores]);

  const goalRankings = useMemo<GoalRanking[]>(() => {
    return sortedGoals.map(goal => {
      const fullRanking = leaderboard.map(participant => ({
        ...participant,
        score: scoreByGoalAndUser.get(`${goal.id}:${participant.userId}`) || 0,
      }));

      fullRanking.sort((a, b) => b.score - a.score);

      const averageRaw = fullRanking.reduce((sum, p) => sum + p.score, 0) / Math.max(1, fullRanking.length);
      const averageScore = Math.round(averageRaw * 10) / 10;

      const myEntry = currentUserId ? fullRanking.find(p => p.userId === currentUserId) : undefined;
      const myScore = myEntry?.score || 0;
      const myRank = myEntry ? fullRanking.findIndex(p => p.score === myScore) + 1 : 0;

      return {
        goalId: goal.id,
        goalTitle: goal.title,
        averageScore,
        ranking: fullRanking,
        topThree: fullRanking.slice(0, 3),
        myScore,
        myRank,
      };
    });
  }, [sortedGoals, leaderboard, scoreByGoalAndUser, currentUserId]);

  const currentGoalRanking = goalRankings[goalSlideIndex] || null;

  useEffect(() => {
    if (goalRankings.length === 0) {
      setGoalSlideIndex(0);
      return;
    }
    setGoalSlideIndex(prev => {
      if (prev < goalRankings.length) return prev;
      return 0;
    });
  }, [goalRankings.length]);

  const mostNegativeSubgoal = useMemo(() => {
    const candidates = goalRankings.flatMap(goal =>
      goal.ranking.map(participant => ({
        participant,
        goalTitle: goal.goalTitle,
        score: participant.score,
      }))
    );

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0];
  }, [goalRankings]);

  const teamStats = useMemo(() => {
    const totalCompletions = logs.length;
    const totalPoints = logs.reduce((sum, log) => sum + log.pointsEarned, 0);
    const participantCount = Math.max(1, challenge.participants.length);
    const avgPerParticipant = Math.round(totalPoints / participantCount);

    const activeUsers = new Set(logs.map(log => log.userId)).size;
    const activeParticipantsRate = Math.round((activeUsers / participantCount) * 100);

    const start = startOfDay(parseISO(challenge.startDate));
    const end = startOfDay(parseISO(challenge.endDate));
    const allDays = isAfter(start, end) ? [] : eachDayOfInterval({ start, end });

    const getPeriodCount = (frequency: string) => {
      if (allDays.length === 0) return 0;
      if (frequency === 'daily') return allDays.length;
      if (frequency === 'once') return 1;

      if (frequency === 'weekly') {
        return new Set(allDays.map(day => format(day, 'yyyy-II'))).size;
      }

      if (frequency === 'monthly') {
        return new Set(allDays.map(day => format(day, 'yyyy-MM'))).size;
      }

      return 0;
    };

    const maxCompletionsPerParticipant = sortedGoals.reduce((sum, goal) => {
      const periods = getPeriodCount(goal.frequency);
      const maxCompletions = goal.maxCompletions || 1;
      return sum + periods * maxCompletions;
    }, 0);

    const maxGroupCompletions = maxCompletionsPerParticipant * participantCount;
    const completionRate = maxGroupCompletions > 0 ? Math.round((totalCompletions / maxGroupCompletions) * 100) : 0;

    return {
      totalCompletions,
      totalPoints,
      avgPerParticipant,
      activeUsers,
      activeParticipantsRate,
      completionRate,
    };
  }, [challenge.endDate, sortedGoals, challenge.participants.length, challenge.startDate, logs]);

  const slides = useMemo(() => {
    return [
      {
        id: 'podium',
        title: copy.slidePodium,
        subtitle: copy.slidePodiumSub,
      },
      {
        id: 'champions',
        title: copy.slideChampions,
        subtitle: copy.slideChampionsSub,
      },
      {
        id: 'goals',
        title: copy.slideGoalWinners,
        subtitle: copy.slideGoalWinnersSub,
      },
      {
        id: 'personal',
        title: copy.slidePersonal,
        subtitle: copy.slidePersonalSub,
      },
      {
        id: 'team',
        title: copy.slideTeam,
        subtitle: copy.slideTeamSub,
      },
    ];
  }, [copy]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, index) => ({
        id: `${challenge.id}-confetti-${index}`,
        left: Math.random() * 100,
        delay: Math.random() * 450,
        duration: 1700 + Math.random() * 1400,
        rotate: Math.random() * 360,
        color: ['#f97316', '#0ea5e9', '#22c55e', '#facc15', '#ef4444'][index % 5],
        scale: 0.7 + Math.random() * 0.9,
      })),
    [challenge.id]
  );

  if (isLoadingLogs) {
    return (
      <div className="animate-fadeIn bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
        {copy.loading}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="animate-fadeIn bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
        {copy.noData}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-5">
      <style>{`
        @keyframes wrapped-confetti-fall {
          0% { transform: translateY(-120vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }

        @keyframes wrapped-podium-rise {
          0% { transform: translateY(24px); opacity: 0; }
          100% { transform: translateY(0px); opacity: 1; }
        }
      `}</style>

      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-slate-700 rounded-2xl px-5 py-4 shadow-xl">
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight text-center">{copy.introTitle}</h3>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 text-center mt-1">{copy.introSub}</p>
            </div>
          </div>
          {confettiPieces.map(piece => (
            <span
              key={piece.id}
              className="absolute top-0 block rounded-sm"
              style={{
                left: `${piece.left}%`,
                width: `${8 * piece.scale}px`,
                height: `${14 * piece.scale}px`,
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate}deg)`,
                animation: `wrapped-confetti-fall ${piece.duration}ms linear ${piece.delay}ms forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 text-white rounded-3xl px-5 py-4 shadow-lg">
        <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-white/70">{copy.wrappedTitle}</p>
        <h2 className="text-2xl font-black tracking-tight">{challenge.name}</h2>
        <p className="text-sm text-white/70 mt-1">{copy.wrappedSub}</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-5 shadow-sm min-h-[420px] flex flex-col">
        <div className="mb-4">
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{slides[slideIndex].title}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{slides[slideIndex].subtitle}</p>
        </div>

        <div className="flex-1">
          {slides[slideIndex].id === 'podium' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3 items-end pt-4">
                {[1, 0, 2].map((podiumIndex, visualIndex) => {
                  const person = topThree[podiumIndex];
                  const maxScore = Math.max(1, ...(topThree.map(p => p?.score || 0)));
                  const scoreRatio = person ? Math.max(0.25, person.score / maxScore) : 0.18;
                  const rank = podiumIndex + 1;
                  const barHeight = `${Math.round(70 + scoreRatio * 120)}px`;

                  const palette =
                    rank === 1
                      ? 'from-yellow-300 to-amber-500 text-amber-900'
                      : rank === 2
                        ? 'from-slate-200 to-slate-400 text-slate-700'
                        : 'from-orange-300 to-orange-500 text-orange-900';

                  return (
                    <div
                      key={`podium-${visualIndex}`}
                      className="flex flex-col items-center"
                      style={{ animation: `wrapped-podium-rise 500ms ease ${visualIndex * 100}ms both` }}
                    >
                      <img
                        src={person?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${person?.name || rank}`}
                        alt={person?.name || `#${rank}`}
                        className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow mb-2 bg-slate-100"
                      />
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 truncate max-w-[90px]">{person?.name || '-'}</span>
                      <div
                        className={`w-full rounded-t-2xl bg-gradient-to-b ${palette} flex items-start justify-center shadow`}
                        style={{ height: barHeight }}
                      >
                        <span className="pt-2 text-xs font-black">#{rank}</span>
                      </div>
                      <span className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">{person?.score ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {slides[slideIndex].id === 'champions' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.biggestTotal}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={topThree[0]?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${topThree[0]?.name || 'winner'}`} alt={topThree[0]?.name || copy.noWinner} className="w-12 h-12 rounded-full" />
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">{topThree[0]?.name || copy.noWinner}</p>
                  </div>
                  <p className="text-3xl font-black tracking-tight text-brand-600">{topThree[0]?.score ?? 0}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.mostNegativeSubgoal}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={mostNegativeSubgoal?.participant.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${mostNegativeSubgoal?.participant.name || 'negative'}`}
                      alt={mostNegativeSubgoal?.participant.name || copy.noWinner}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">{mostNegativeSubgoal?.participant.name || copy.noWinner}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{copy.goal}: {mostNegativeSubgoal?.goalTitle || '-'}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight text-rose-600">{mostNegativeSubgoal?.score ?? 0}</p>
                </div>
              </div>
            </div>
          )}

          {slides[slideIndex].id === 'goals' && (
            <div className="space-y-3">
              {currentGoalRanking ? (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <button
                      onClick={() => setGoalSlideIndex(prev => (prev === 0 ? goalRankings.length - 1 : prev - 1))}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300"
                      aria-label="Previous goal"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="text-center min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{currentGoalRanking.goalTitle}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">{goalSlideIndex + 1}/{goalRankings.length}</p>
                    </div>
                    <button
                      onClick={() => setGoalSlideIndex(prev => (prev + 1) % goalRankings.length)}
                      className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300"
                      aria-label="Next goal"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentGoalRanking.topThree.map((participant, index) => (
                      <div key={`${currentGoalRanking.goalId}-${participant.userId}`} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black flex items-center justify-center">{index + 1}</span>
                          <img src={participant.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${participant.name}`} alt={participant.name} className="w-8 h-8 rounded-full" />
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{participant.name}</p>
                        </div>
                        <p className="text-lg font-black text-brand-600">{participant.score}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{copy.noData}</p>
              )}
            </div>
          )}

          {slides[slideIndex].id === 'personal' && (
            <div className="space-y-3">
              {currentUserId ? (
                goalRankings.map(goal => (
                  <div key={goal.goalId} className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{goal.goalTitle}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider font-black text-brand-700 dark:text-brand-300">{copy.myScore}</p>
                        <p className="text-lg font-black text-brand-700 dark:text-brand-300 mt-1">{goal.myScore}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider font-black text-slate-500 dark:text-slate-400">{copy.rank}</p>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">{goal.myRank ? `#${goal.myRank}` : '-'}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider font-black text-slate-500 dark:text-slate-400">{copy.avgScore}</p>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">{goal.averageScore}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{copy.noData}</p>
              )}
            </div>
          )}

          {slides[slideIndex].id === 'team' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.completions}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{teamStats.totalCompletions}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.totalPoints}</p>
                <p className="text-3xl font-black text-brand-600 mt-1">{teamStats.totalPoints}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.avgPerParticipant}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{teamStats.avgPerParticipant}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.activeParticipants}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">{teamStats.activeUsers}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{teamStats.activeParticipantsRate}%</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-brand-100 dark:border-brand-800 p-4 bg-brand-50 dark:bg-brand-900/30 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-300">{copy.completionRate}</p>
                <p className="text-3xl font-black text-brand-700 dark:text-brand-300 mt-1">{teamStats.completionRate}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setSlideIndex(idx)}
                className={`h-2.5 rounded-full transition-all ${idx === slideIndex ? 'w-7 bg-brand-500' : 'w-2.5 bg-slate-300 dark:bg-slate-600'}`}
                aria-label={`${slide.title} ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
              disabled={slideIndex === 0}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 font-bold text-sm text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copy.previous}
            </button>

            <button
              onClick={() => setSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm"
            >
              {slideIndex === slides.length - 1 ? copy.done : copy.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WrappedTab;
