
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Trophy, Mail, Lock, ArrowRight, User } from 'lucide-react';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const { login, signup, isLoading } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  // Check for error parameters in URL (e.g. from invalid verification link)
  useEffect(() => {
      const hash = window.location.hash;
      if (hash.includes('error=access_denied') && hash.includes('error_description')) {
           // Simple parser for hash params
           const params = new URLSearchParams(hash.replace('#', '?')); // URLSearchParams expects ? usually
           const desc = params.get('error_description');
           if (desc) {
               // Translate generic message if possible, otherwise show raw
               toast.error(t('verification_error'), { description: desc.replace(/\+/g, ' ') });
           }
      }
  }, [t]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
        await login(email, password);
    } else {
        if (password !== confirmPassword) {
            toast.error(t('error_generic'));
            return;
        }
        const success = await signup(email, password, name);
        if (success) {
            setIsLogin(true);
            setPassword('');
            setConfirmPassword('');
        }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20 text-4xl">
            🦍
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">APE</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Social Challenge Tracker
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="name">{t('full_name')}</label>
                <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-base"
                    placeholder="Alex Johnson"
                    required
                />
                </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">{t('email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                id="email"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-base"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                id="password"
                name="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-base"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="confirmPassword">{t('confirm_password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-base"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-brand-500/20 mt-4 disabled:opacity-70 text-base"
          >
            {isLoading ? t('processing') : (isLogin ? t('login') : t('signup'))}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
                setIsLogin(!isLogin);
                setConfirmPassword('');
                setPassword('');
            }}
            className="text-sm text-slate-500 hover:text-brand-600 font-medium transition-colors"
          >
            {isLogin ? `${t('signup')}?` : `${t('login')}?`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
