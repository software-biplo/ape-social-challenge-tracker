
import React, { useState, useEffect, useMemo } from 'react';
// Consolidated react-router-dom imports to resolve named export errors in specific environments
import { useNavigate, useParams } from 'react-router-dom';
import { Challenge, Goal } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/dataService';
import { ALL_ICONS } from '../services/iconService';
import Card from '../components/Card';
import DatePicker from '../components/DatePicker';
import LoadingScreen from '../components/LoadingScreen';
import { ChevronRight, ChevronLeft, Check, Plus, Trash2, Calendar, Target, Settings, Share2, Activity, Pencil, X, Image as ImageIcon, AlertTriangle, Search, Info } from 'lucide-react';
import { toast } from 'sonner';

const THEME_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80', label: 'Food' },
  { url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80', label: 'Fitness' },
  { url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80', label: 'Mind' },
  { url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80', label: 'Run' },
];

const ChallengeWizard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // Exit Confirmation State
  const [showExitModal, setShowExitModal] = useState(false);

  // Goal Form State
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({
    frequency: 'daily',
    points: 10,
    maxCompletions: 1,
    icon: 'activity'
  });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Challenge>>({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    maxPlayers: 10,
    goals: [],
    coverImage: THEME_IMAGES[0].url
  });

  useEffect(() => {
    if (isEditing && id) {
      setLoading(true);
      api.getChallengeById(id).then(existing => {
        if (existing) {
          setFormData({
            ...existing,
            startDate: existing.startDate.split('T')[0],
            endDate: existing.endDate.split('T')[0],
          });
        } else {
          navigate('/');
        }
        setLoading(false);
      });
    }
  }, [id, isEditing, navigate]);

  const filteredIcons = useMemo(() => {
    const keys = Object.keys(ALL_ICONS);
    if (!iconSearch) return keys;
    return keys.filter(k => k.toLowerCase().includes(iconSearch.toLowerCase()));
  }, [iconSearch]);

  const handleExit = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    navigate('/');
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const saveGoal = () => {
    if (!newGoal.title || newGoal.points === undefined) return;

    if (editingGoalId) {
      setFormData(prev => ({
        ...prev,
        goals: prev.goals?.map(g => g.id === editingGoalId ? {
            ...g,
            ...newGoal,
            points: Number(newGoal.points),
            maxCompletions: newGoal.maxCompletions ? Number(newGoal.maxCompletions) : 1
        } as Goal : g)
      }));
    } else {
      const goal: Goal = {
        id: Math.random().toString(36).substr(2, 9), // Temp ID until saved
        title: newGoal.title,
        description: newGoal.description,
        points: Number(newGoal.points),
        frequency: newGoal.frequency as any,
        maxCompletions: newGoal.maxCompletions ? Number(newGoal.maxCompletions) : 1,
        icon: newGoal.icon || 'activity'
      } as Goal;
      setFormData(prev => ({ ...prev, goals: [...(prev.goals || []), goal] }));
    }

    resetGoalForm();
  };

  const resetGoalForm = () => {
    setNewGoal({ frequency: 'daily', points: 10, maxCompletions: 1, icon: 'activity' });
    setEditingGoalId(null);
    setShowGoalForm(false);
    setIconSearch('');
  }

  const startEditGoal = (goal: Goal) => {
    setNewGoal(goal);
    setEditingGoalId(goal.id);
    setShowGoalForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeGoal = (goalId: string) => {
    setFormData(prev => ({ ...prev, goals: prev.goals?.filter(g => g.id !== goalId) }));
  };

  const finishCreation = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isEditing && formData.id) {
         await api.updateChallenge({
           ...formData as Challenge,
           startDate: new Date(formData.startDate!).toISOString(),
           endDate: new Date(formData.endDate!).toISOString(),
         });
         toast.success(t('success_update'));
         navigate(`/challenge/${formData.id}`);
      } else {
        const newId = await api.createChallenge({
          ...formData as Challenge,
          startDate: new Date(formData.startDate!).toISOString(),
          endDate: new Date(formData.endDate!).toISOString(),
        }, user.id);
        toast.success(t('success_create'));
        navigate(`/challenge/${newId}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: t('basics'), icon: Calendar },
    { id: 2, title: t('goals'), icon: Target },
    { id: 3, title: t('theme'), icon: ImageIcon },
    { id: 4, title: t('review'), icon: Check },
  ];

  if (loading && isEditing && step === 1) return <LoadingScreen />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEditing ? 'Edit Challenge' : t('create')}</h1>
            <button
                onClick={handleExit}
                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shadow-sm"
                aria-label={t('cancel')}
            >
                <X size={20} />
            </button>
        </div>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700 -z-10 rounded-full" />
          {steps.map((s) => {
             const Icon = s.icon;
             const active = s.id <= step;
             return (
              <div key={s.id} className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-950 px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-brand-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'}`}>
                  <Icon size={18} />
                </div>
                <span className={`text-xs font-medium ${active ? 'text-brand-700' : 'text-slate-500 dark:text-slate-400'}`}>{s.title}</span>
              </div>
             );
          })}
        </div>
      </div>

      <Card className="min-h-[400px] relative">
        {/* STEP 1: BASICS */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('basics')}</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('challenge_name')}</label>
              <input
                type="text"
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-slate-100 text-base"
                placeholder="e.g., Summer Fitness Sprint"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('description')}</label>
              <textarea
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-slate-100 text-base"
                placeholder="..."
                rows={3}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DatePicker
                label={t('start_date')}
                value={formData.startDate || ''}
                onChange={(val) => setFormData({...formData, startDate: val})}
                min={new Date().toISOString().split('T')[0]}
              />
              <DatePicker
                label={t('end_date')}
                value={formData.endDate || ''}
                onChange={(val) => setFormData({...formData, endDate: val})}
                min={formData.startDate}
              />
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('max_players')}</label>
               <input
                  type="number"
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-900 dark:text-slate-100 text-base"
                  value={formData.maxPlayers}
                  onChange={e => setFormData({...formData, maxPlayers: Number(e.target.value)})}
                />
            </div>
          </div>
        )}

        {/* STEP 2: GOALS */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
               <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('define_goals')}</h2>
               {!showGoalForm && (
                 <button
                    onClick={() => {
                        resetGoalForm();
                        setShowGoalForm(true);
                    }}
                    className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors text-base"
                  >
                   <Plus size={16} /> {t('add_goal')}
                 </button>
               )}
            </div>

            {showGoalForm && (
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-600 space-y-5 shadow-sm">
                 <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-600 pb-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{editingGoalId ? 'Edit Goal' : t('add_goal')}</h3>
                    <button onClick={resetGoalForm} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                      <X size={20} />
                    </button>
                 </div>

                 <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('title')}</label>
                      <input
                          type="text"
                          placeholder="e.g. Drink 2L Water"
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-base"
                          value={newGoal.title || ''}
                          onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                      />
                   </div>
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('description')}</label>
                        {newGoal.description && (
                          <div className="relative group">
                            <button
                              type="button"
                              aria-label={t('description')}
                              className="p-1 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Info size={14} />
                            </button>
                            <div className="absolute left-1/2 top-full z-20 hidden w-56 -translate-x-1/2 pt-2 group-hover:block group-focus-within:block">
                              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-lg">
                                {newGoal.description}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <textarea
                          placeholder="..."
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-base"
                          rows={3}
                          value={newGoal.description || ''}
                          onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${(newGoal.points || 0) < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {t('points')} {(newGoal.points || 0) < 0 ? '(Penalty)' : ''}
                        </label>
                        <input
                          type="number"
                          className={`w-full p-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-base transition-colors ${
                            (newGoal.points || 0) < 0 ? 'border-rose-200 dark:border-rose-800 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-600 focus:ring-brand-500'
                          }`}
                          value={newGoal.points}
                          onChange={e => setNewGoal({...newGoal, points: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('frequency')}</label>
                        <select
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-base"
                          value={newGoal.frequency}
                          onChange={e => setNewGoal({...newGoal, frequency: e.target.value as any})}
                        >
                          <option value="daily">{t('daily')}</option>
                          <option value="weekly">{t('weekly')}</option>
                          <option value="monthly">{t('monthly')}</option>
                          <option value="once">{t('once')}</option>
                        </select>
                      </div>
                   </div>

                   {/* Max Completions Input */}
                   {newGoal.frequency !== 'once' && (
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('max_completions')}</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-base"
                          value={newGoal.maxCompletions || ''}
                          onChange={e => setNewGoal({...newGoal, maxCompletions: Number(e.target.value)})}
                          placeholder="e.g. 1"
                        />
                     </div>
                   )}

                   {/* Icon Picker Upgrade */}
                   <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('icon')}</label>
                      <div className="relative mb-3">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search 100 icons..."
                          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          value={iconSearch}
                          onChange={e => setIconSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 h-44 overflow-y-auto p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 custom-scrollbar overscroll-contain">
                        {filteredIcons.map(k => {
                          const IconComp = ALL_ICONS[k];
                          const isSelected = newGoal.icon === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setNewGoal({...newGoal, icon: k})}
                              className={`aspect-square rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                                isSelected
                                  ? 'bg-brand-500 text-white shadow-md scale-110 z-10'
                                  : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-500'
                              }`}
                              title={k}
                            >
                              <IconComp size={20} />
                            </button>
                          );
                        })}
                        {filteredIcons.length === 0 && (
                          <div className="col-span-full py-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                            No icons match your search.
                          </div>
                        )}
                      </div>
                   </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                   <button type="button" onClick={resetGoalForm} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-base">{t('cancel')}</button>
                   <button type="button" onClick={saveGoal} className="px-6 py-2 bg-brand-600 text-white font-bold rounded-lg shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition-all text-base">
                      {t('save')}
                   </button>
                 </div>
              </div>
            )}

            <div className="space-y-3">
              {formData.goals?.length === 0 && !showGoalForm && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl">
                  <p className="text-slate-400 dark:text-slate-500 mb-4">{t('no_goals')}</p>
                  <button onClick={() => setShowGoalForm(true)} className="text-brand-600 font-medium hover:underline text-base">
                    {t('add_goal')}
                  </button>
                </div>
              )}
              {formData.goals?.map(g => {
                  const GoalIcon = ALL_ICONS[g.icon] || Activity;
                  return (
                    <div key={g.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm">
                       <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${g.points < 0 ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-600'}`}>
                            <GoalIcon size={20} />
                         </div>
                         <div>
                           <h4 className="font-bold text-slate-900 dark:text-slate-100">{g.title}</h4>
                           <div className="text-xs font-bold">
                              <span className={g.points < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {g.points >= 0 ? '+' : ''}{g.points} pts
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 mx-1">&bull;</span>
                              <span className="text-slate-500 dark:text-slate-400 lowercase">{t(g.frequency as any)}</span>
                           </div>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         {g.description && (
                           <div className="relative group">
                             <button
                               type="button"
                               aria-label={t('description')}
                               className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                             >
                               <Info size={16} />
                             </button>
                             <div className="absolute right-0 top-full z-20 hidden w-64 pt-2 group-hover:block group-focus-within:block">
                               <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-lg">
                                 {g.description}
                               </div>
                             </div>
                           </div>
                         )}
                         <button onClick={() => removeGoal(g.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                         <button onClick={() => startEditGoal(g)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-500 transition-colors"><Pencil size={16} /></button>
                       </div>
                    </div>
                  );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: THEME */}
        {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('theme')}</h2>
                <div className="grid grid-cols-2 gap-4">
                    {THEME_IMAGES.map((theme, i) => (
                        <div
                            key={i}
                            onClick={() => setFormData({...formData, coverImage: theme.url})}
                            className={`relative rounded-2xl overflow-hidden cursor-pointer h-32 group ${
                                formData.coverImage === theme.url ? 'ring-4 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                            }`}
                        >
                            <img src={theme.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={theme.label} />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">{theme.label}</span>
                            </div>
                            {formData.coverImage === theme.url && (
                                <div className="absolute top-2 right-2 bg-brand-500 text-white p-1 rounded-full">
                                    <Check size={16} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn text-center py-6">
            <div className="w-full h-48 rounded-2xl overflow-hidden mb-6 shadow-md relative">
                <img src={formData.coverImage} className="w-full h-full object-cover" alt="Cover Preview" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-left">
                    <h2 className="text-2xl font-bold text-white">{formData.name}</h2>
                    <p className="text-white/80 text-sm">{formData.goals?.length} Goals • {formData.maxPlayers} Players</p>
                </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              You are about to launch this challenge. Get your friends ready!
            </p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className={`px-6 py-2 rounded-xl font-medium flex items-center gap-2 text-base ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <ChevronLeft size={18} /> {t('back')}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 2 && (!formData.goals || formData.goals.length === 0)}
              className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-200 flex items-center gap-2 disabled:opacity-50 text-base"
            >
              {t('next')} <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishCreation}
              disabled={loading}
              className="px-8 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/25 flex items-center gap-2 disabled:opacity-50 text-base"
            >
              {loading ? t('processing') : (isEditing ? t('save_changes') : t('launch'))}
            </button>
          )}
        </div>
      </Card>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm animate-fadeIn">
           <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 transition-transform">
              <div className="flex flex-col items-center text-center mb-6">
                 <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('confirm_exit_title')}</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-sm">{t('confirm_exit_body')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <button
                    onClick={() => setShowExitModal(false)}
                    className="py-3 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-base"
                 >
                    {t('keep_editing')}
                 </button>
                 <button
                    onClick={confirmExit}
                    className="py-3 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-base"
                 >
                    {t('discard')}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChallengeWizard;
