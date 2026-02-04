
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/dataService';
import { Challenge } from '../types';
import { useAuth } from '../context/AuthContext';
import { useChallenges } from '../context/ChallengeContext';
import { useLanguage } from '../context/LanguageContext';
import Card from '../components/Card';
import LoadingScreen from '../components/LoadingScreen';
import { Users, Hash, X, Plus, ShieldCheck, Share2, Copy, Link as LinkIcon, Smartphone } from 'lucide-react';
// Fixed date-fns imports to use named imports from the main package to resolve 'not callable' errors
import { format, isBefore, isAfter, startOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { challenges, refreshChallenges, isLoading } = useChallenges();
  const { t, dateLocale } = useLanguage();
  const navigate = useNavigate();
  
  const [showActionModal, setShowActionModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [inviteChallenge, setInviteChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    // Check for pending invite code on mount
    const pendingCode = localStorage.getItem('strive_pending_invite');
    if (pendingCode) {
        setJoinCode(pendingCode);
        setShowJoinModal(true);
        localStorage.removeItem('strive_pending_invite');
    }
  }, []);

  useEffect(() => {
    refreshChallenges();
  }, [user, refreshChallenges]);

  const getMagicLink = (code: string) => {
      // Construction logic for a cleaner absolute URL
      const origin = window.location.origin;
      const pathname = window.location.pathname === '/' ? '' : window.location.pathname;
      return `${origin}${pathname}/#/?joinCode=${code}`;
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;

    setIsJoining(true);
    try {
        await api.joinChallengeByCode(joinCode.trim(), user.id);
        toast.success(t('success_join'));
        setShowJoinModal(false);
        setJoinCode('');
        refreshChallenges(true); // force refresh after joining
    } catch (err: any) {
        toast.error(err.message || t('error_generic'));
    } finally {
        setIsJoining(false);
    }
  };

  const handleNativeShare = async () => {
      if (!inviteChallenge) return;
      
      const magicLink = getMagicLink(inviteChallenge.joinCode);
      const shareText = t('share_msg')
        .replace('%s', inviteChallenge.name)
        .replace('%s', inviteChallenge.joinCode);

      const shareData = {
          title: 'APE Challenge',
          text: shareText,
          url: magicLink
      };

      console.log("[Native Share] Attempting share with payload:", shareData);

      if (navigator.share) {
          try {
              // Optional check for modern browsers to see if the payload is shareable
              if (navigator.canShare && !navigator.canShare(shareData)) {
                  console.warn("[Native Share] Browser indicates payload might not be shareable. Proceeding anyway...");
              }

              await navigator.share(shareData);
              console.log("[Native Share] Success");
              setInviteChallenge(null);
          } catch (error: any) {
              // AbortError means the user just closed the share sheet
              if (error.name !== 'AbortError') {
                  console.error("[Native Share] Error:", error);
                  toast.error(`Sharing failed: ${error.message || 'Unknown error'}`);
              } else {
                  console.log("[Native Share] User cancelled");
              }
          }
      } else {
          console.warn("[Native Share] API not available in this browser context (requires HTTPS and supported browser)");
          toast.error("Native sharing not supported on this browser/device.");
      }
  };

  const copyMagicLink = () => {
      if (!inviteChallenge) return;
      const magicLink = getMagicLink(inviteChallenge.joinCode);
      navigator.clipboard.writeText(magicLink);
      toast.success(t('link_copied'));
  };

  const copyCode = () => {
      if (!inviteChallenge) return;
      navigator.clipboard.writeText(inviteChallenge.joinCode);
      toast.success(t('code_copied'));
  };

  if (isLoading && !challenges) return <LoadingScreen />;

  const relevantChallenges = challenges?.filter(c => c.status !== 'cancelled' && c.status !== 'draft') || [];

  return (
    <div className="space-y-6 relative max-w-6xl mx-auto">
      {/* Desktop Only Header - Mobile is handled by Layout */}
      <header className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 text-3xl">
            🦍
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">APE</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Social Challenge Tracker</p>
          </div>
        </div>
      </header>

      {/* Floating Action Button - Hugs bottom right corner now that bottom nav is gone */}
      <button 
         onClick={() => setShowActionModal(true)}
         className="fixed right-6 bottom-[calc(24px+env(safe-area-inset-bottom))] md:right-10 md:bottom-10 z-40 w-14 h-14 bg-brand-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-500/40 hover:bg-brand-600 hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white/20"
         title={t('start_or_join')}
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      <section>
        {relevantChallenges.length === 0 && !isLoading ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300">
            <p className="text-slate-500 mb-4">{t('no_challenges')}</p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setShowActionModal(true)}
                className="text-brand-600 font-semibold"
              >
                {t('start_new')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relevantChallenges.map(challenge => {
               const isOwner = user?.id === challenge.creatorId;
               const now = startOfDay(new Date());
               const start = startOfDay(parseISO(challenge.startDate));
               const end = startOfDay(parseISO(challenge.endDate));
               
               let statusLabel = t('active');
               let statusColor = 'text-green-700 bg-white/90';
               let subtitle = `${t('ends')} ${format(end, 'd MMM', { locale: dateLocale })}`;
               
               if (isBefore(now, start)) {
                 statusLabel = t('planned');
                 statusColor = 'text-blue-700 bg-blue-50/90';
                 subtitle = `${t('starts_on')} ${format(start, 'd MMM', { locale: dateLocale })}`;
               } else if (isAfter(now, end)) {
                 statusLabel = t('completed');
                 statusColor = 'text-slate-600 bg-slate-100/90';
                 subtitle = t('finished_msg');
               }

               return (
                <div 
                  key={challenge.id} 
                  className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col relative"
                >
                  <div 
                    onClick={() => navigate(`/challenge/${challenge.id}`)}
                    className="absolute inset-0 z-0 cursor-pointer"
                  />
                  <div className="h-40 w-full relative overflow-hidden z-0">
                      <img 
                          src={challenge.coverImage} 
                          alt={challenge.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                           {isOwner && (
                              <span className="bg-slate-900/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                                 <ShieldCheck size={10} /> {t('host')}
                              </span>
                           )}
                           <span className={`${statusColor} backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm`}>
                              {statusLabel}
                           </span>
                      </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col relative z-10 pointer-events-none">
                    <div className="flex justify-between items-start mb-1">
                         <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors pointer-events-auto cursor-pointer" onClick={() => navigate(`/challenge/${challenge.id}`)}>
                            {challenge.name}
                        </h3>
                        {isOwner && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setInviteChallenge(challenge);
                                }}
                                className="pointer-events-auto p-2 -mr-2 -mt-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                                title={t('invite_friends')}
                            >
                                <Share2 size={20} />
                            </button>
                        )}
                    </div>
                    <p className={`text-sm font-medium mb-4 ${statusLabel === t('planned') ? 'text-blue-600' : statusLabel === t('completed') ? 'text-slate-500' : 'text-green-600'}`}>
                       {subtitle}
                    </p>
                    <div className="mt-auto flex items-center text-slate-500 text-sm gap-2">
                        <Users className="w-4 h-4" />
                        <span>{challenge.participants.length} {t('participants')}</span>
                    </div>
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </section>

      {showActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={() => setShowActionModal(false)}>
             <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                 <div className="mb-6">
                     <h3 className="text-xl font-bold text-slate-900 mb-1">{t('what_to_do')}</h3>
                 </div>
                 <div className="grid gap-4">
                     <button onClick={() => navigate('/create')} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left">
                        <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                        </div>
                        <div>
                            <span className="block font-bold text-slate-900 group-hover:text-brand-700">{t('create_own')}</span>
                            <span className="block text-sm text-slate-500">{t('create_own_sub')}</span>
                        </div>
                     </button>
                     <button onClick={() => { setShowActionModal(false); setShowJoinModal(true); }} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group text-left">
                        <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Hash size={24} />
                        </div>
                        <div>
                            <span className="block font-bold text-slate-900 group-hover:text-brand-700">{t('join_existing')}</span>
                            <span className="block text-sm text-slate-500">{t('join_existing_sub')}</span>
                        </div>
                     </button>
                 </div>
                 <button onClick={() => setShowActionModal(false)} className="mt-6 w-full py-3 text-slate-500 font-medium hover:text-slate-800">
                    {t('cancel')}
                 </button>
             </div>
          </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
           <div className="bg-white w-full max-sm:rounded-3xl p-6 shadow-2xl relative">
              <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <div className="flex flex-col items-center mb-6">
                <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-500 mb-3">
                  <Hash size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{t('join_challenge')}</h3>
                <p className="text-sm text-slate-500 text-center">{t('join_sub')}</p>
              </div>
              <form onSubmit={handleJoinByCode} className="space-y-4">
                <input autoFocus type="text" placeholder="e.g. STRIVE-1234" className="w-full p-3 text-center text-lg font-mono tracking-widest uppercase border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 placeholder:text-slate-300" value={joinCode} onChange={e => setJoinCode(e.target.value)} />
                <button type="submit" disabled={isJoining || !joinCode} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isJoining ? t('joining') : t('join_now')}
                </button>
              </form>
           </div>
        </div>
      )}

      {inviteChallenge && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setInviteChallenge(null)}>
             <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                 <div className="flex justify-between items-start mb-6">
                     <div>
                        <h3 className="text-xl font-bold text-slate-900">{t('invite_modal_title')}</h3>
                        <p className="text-sm text-slate-500">{t('invite_modal_desc').replace('%s', inviteChallenge.name)}</p>
                     </div>
                     <button onClick={() => setInviteChallenge(null)} className="p-1 text-slate-400 hover:text-slate-600">
                         <X size={20} />
                     </button>
                 </div>
                 <div className="space-y-4">
                     {navigator.share && (
                        <button onClick={handleNativeShare} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-all flex items-center justify-center gap-3 font-bold text-slate-700">
                            <Smartphone size={20} />
                            {t('share_native')}
                        </button>
                     )}
                     <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                         <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                                 <LinkIcon size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('copy_link')}</p>
                                 <p className="text-sm font-medium text-slate-900 truncate">
                                     {getMagicLink(inviteChallenge.joinCode)}
                                 </p>
                             </div>
                         </div>
                         <button onClick={copyMagicLink} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                             <Copy size={20} />
                         </button>
                     </div>
                     <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                         <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                 <Hash size={20} />
                             </div>
                             <div className="flex-1 min-w-0">
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('copy_code')}</p>
                                 <p className="text-lg font-mono font-bold text-slate-900 tracking-wide">
                                     {inviteChallenge.joinCode}
                                 </p>
                             </div>
                         </div>
                         <button onClick={copyCode} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                             <Copy size={20} />
                         </button>
                     </div>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;
