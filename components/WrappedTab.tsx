import React, { useEffect, useMemo, useState } from 'react';
import { addDays, eachDayOfInterval, format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import { Challenge, ChallengeStats, CompletionLog } from '../types';

interface WrappedTabProps {
  challenge: Challenge;
  stats: ChallengeStats;
  logs: CompletionLog[];
  isLoadingLogs: boolean;
  language: 'nl' | 'en' | 'fr';
  showConfetti: boolean;
}

type WrappedParticipant = {
  userId: string;
  name: string;
  avatar?: string;
  score: number;
};

const WrappedTab: React.FC<WrappedTabProps> = ({ challenge, stats, logs, isLoadingLogs, language, showConfetti }) => {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
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
        slideChampions: 'Champions',
        slideChampionsSub: 'Wie was het sterkst en meest consistent?',
        slideGoalWinners: 'Goal Winners',
        slideGoalWinnersSub: 'Per doel de beste score',
        slideImprovement: 'Most Improved',
        slideImprovementSub: 'Grootste groei van begin naar einde',
        slideTeam: 'Team Stats',
        slideTeamSub: 'Overzicht van de challenge als geheel',
        biggestTotal: 'Biggest Total Score',
        mostConsistent: 'Most Consistent',
        activeDays: 'actieve dagen',
        points: 'punten',
        noWinner: 'Nog geen duidelijke winnaar',
        improvementDelta: 'verbetering',
        completions: 'voltooiingen',
        totalPoints: 'totaal punten',
        avgPerParticipant: 'gem. per deelnemer',
        activeParticipants: 'actieve deelnemers',
        completionRate: 'completion rate',
        rank: 'plek',
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
        slideChampions: 'Champions',
        slideChampionsSub: 'Qui a dominé et qui a été le plus régulier ?',
        slideGoalWinners: 'Vainqueurs par objectif',
        slideGoalWinnersSub: 'Meilleur score pour chaque objectif',
        slideImprovement: 'Most Improved',
        slideImprovementSub: 'Plus forte progression entre début et fin',
        slideTeam: 'Stats équipe',
        slideTeamSub: 'Résumé global du challenge',
        biggestTotal: 'Meilleur score total',
        mostConsistent: 'Le plus régulier',
        activeDays: 'jours actifs',
        points: 'points',
        noWinner: 'Pas encore de vainqueur clair',
        improvementDelta: 'progression',
        completions: 'complétions',
        totalPoints: 'points totaux',
        avgPerParticipant: 'moy. par participant',
        activeParticipants: 'participants actifs',
        completionRate: 'taux de completion',
        rank: 'rang',
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
      slideChampions: 'Champions',
      slideChampionsSub: 'Who dominated and who stayed most consistent?',
      slideGoalWinners: 'Goal Winners',
      slideGoalWinnersSub: 'Best score per goal',
      slideImprovement: 'Most Improved',
      slideImprovementSub: 'Biggest growth from start to finish',
      slideTeam: 'Team Stats',
      slideTeamSub: 'A full challenge summary',
      biggestTotal: 'Biggest Total Score',
      mostConsistent: 'Most Consistent',
      activeDays: 'active days',
      points: 'points',
      noWinner: 'No clear winner yet',
      improvementDelta: 'improvement',
      completions: 'completions',
      totalPoints: 'total points',
      avgPerParticipant: 'avg per participant',
      activeParticipants: 'active participants',
      completionRate: 'completion rate',
      rank: 'rank',
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

  const consistencyWinner = useMemo(() => {
    const activeDayMap = new Map<string, Set<string>>();

    logs.forEach(log => {
      const dayKey = log.timestamp.slice(0, 10);
      const existing = activeDayMap.get(log.userId) || new Set<string>();
      existing.add(dayKey);
      activeDayMap.set(log.userId, existing);
    });

    const ranked = leaderboard.map(p => ({
      ...p,
      activeDays: activeDayMap.get(p.userId)?.size || 0,
    }));

    ranked.sort((a, b) => {
      if (b.activeDays !== a.activeDays) return b.activeDays - a.activeDays;
      return b.score - a.score;
    });

    return ranked[0];
  }, [leaderboard, logs]);

  const goalWinners = useMemo(() => {
    const participantMap = new Map(leaderboard.map(p => [p.userId, p]));

    return challenge.goals.map(goal => {
      const scoresForGoal = stats.goalScores
        .filter(gs => gs.goal_id === goal.id)
        .sort((a, b) => b.score - a.score);

      const topScore = scoresForGoal[0]?.score;
      if (topScore === undefined) {
        return {
          goalId: goal.id,
          goalTitle: goal.title,
          topScore: 0,
          winners: [] as WrappedParticipant[],
        };
      }

      const winners = scoresForGoal
        .filter(s => s.score === topScore)
        .map(s => {
          const participant = participantMap.get(s.user_id);
          return {
            userId: s.user_id,
            name: participant?.name || 'Anonymous',
            avatar: participant?.avatar,
            score: s.score,
          };
        });

      return {
        goalId: goal.id,
        goalTitle: goal.title,
        topScore,
        winners,
      };
    });
  }, [challenge.goals, leaderboard, stats.goalScores]);

  const mostImproved = useMemo(() => {
    if (logs.length === 0) return null;

    const start = startOfDay(parseISO(challenge.startDate));
    const end = startOfDay(parseISO(challenge.endDate));

    if (isAfter(start, end)) return null;

    const challengeDays = eachDayOfInterval({ start, end });
    const windowSize = Math.min(7, challengeDays.length);

    const firstWindowEnd = addDays(start, windowSize - 1);
    const lastWindowStart = subDays(end, windowSize - 1);

    const firstWindowPoints = new Map<string, number>();
    const lastWindowPoints = new Map<string, number>();

    logs.forEach(log => {
      const day = startOfDay(parseISO(log.timestamp));
      const uid = log.userId;

      if (!isBefore(day, start) && !isAfter(day, firstWindowEnd)) {
        firstWindowPoints.set(uid, (firstWindowPoints.get(uid) || 0) + log.pointsEarned);
      }

      if (!isBefore(day, lastWindowStart) && !isAfter(day, end)) {
        lastWindowPoints.set(uid, (lastWindowPoints.get(uid) || 0) + log.pointsEarned);
      }
    });

    const ranked = leaderboard.map(p => {
      const startPoints = firstWindowPoints.get(p.userId) || 0;
      const endPoints = lastWindowPoints.get(p.userId) || 0;
      return {
        ...p,
        startPoints,
        endPoints,
        delta: endPoints - startPoints,
      };
    });

    ranked.sort((a, b) => {
      if (b.delta !== a.delta) return b.delta - a.delta;
      return b.endPoints - a.endPoints;
    });

    return ranked[0] || null;
  }, [challenge.endDate, challenge.startDate, leaderboard, logs]);

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

    const maxCompletionsPerParticipant = challenge.goals.reduce((sum, goal) => {
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
  }, [challenge.endDate, challenge.goals, challenge.participants.length, challenge.startDate, logs]);

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
        id: 'improvement',
        title: copy.slideImprovement,
        subtitle: copy.slideImprovementSub,
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
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.biggestTotal}</p>
                  <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight mt-1">{topThree[0]?.name || copy.noWinner}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black tracking-tight text-brand-600">{topThree[0]?.score ?? 0}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.points}</p>
                </div>
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
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.mostConsistent}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={consistencyWinner?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${consistencyWinner?.name || 'consistency'}`}
                      alt={consistencyWinner?.name || copy.noWinner}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">{consistencyWinner?.name || copy.noWinner}</p>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{consistencyWinner?.activeDays || 0} {copy.activeDays}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">#{leaderboard.findIndex(p => p.userId === consistencyWinner?.userId) + 1}</p>
                </div>
              </div>
            </div>
          )}

          {slides[slideIndex].id === 'goals' && (
            <div className="space-y-3">
              {goalWinners.map(goal => (
                <div key={goal.goalId} className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{goal.goalTitle}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">{copy.points}: {goal.topScore}</p>
                    </div>
                    <div className="text-right min-w-[120px]">
                      {goal.winners.length > 0 ? (
                        <p className="text-sm font-bold text-brand-600 dark:text-brand-400 truncate">
                          {goal.winners.map(w => w.name).join(', ')}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{copy.noWinner}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {slides[slideIndex].id === 'improvement' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-5 bg-white dark:bg-slate-800 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.slideImprovement}</p>
                {mostImproved ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={mostImproved.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${mostImproved.name}`} alt={mostImproved.name} className="w-12 h-12 rounded-full" />
                        <div className="min-w-0">
                          <p className="text-xl font-black text-slate-900 dark:text-slate-100 truncate">{mostImproved.name}</p>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{copy.rank}: #{leaderboard.findIndex(p => p.userId === mostImproved.userId) + 1}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-green-600">{mostImproved.delta >= 0 ? '+' : ''}{mostImproved.delta}</p>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.improvementDelta}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm font-bold">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-slate-700">
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">Start window</p>
                        <p className="text-slate-900 dark:text-slate-100 text-xl">{mostImproved.startPoints}</p>
                      </div>
                      <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 border border-green-100 dark:border-green-800">
                        <p className="text-green-700 dark:text-green-300 text-[11px] uppercase tracking-wider">End window</p>
                        <p className="text-green-700 dark:text-green-300 text-xl">{mostImproved.endPoints}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{copy.noData}</p>
                )}
              </div>
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
