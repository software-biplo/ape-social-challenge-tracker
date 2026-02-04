
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/dataService';
import Card from '../components/Card';
import { User, Save, Camera, Mail, Lock, LogOut, Globe, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Language } from '../services/translations';

const Profile: React.FC = () => {
  const { user, updatePassword, logout, refreshUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [loading, setLoading] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selectedLang if provider language changes externally (e.g. from profile load)
  useEffect(() => {
      setSelectedLang(language);
  }, [language]);

  // Sync name/avatar when user profile loads/changes
  useEffect(() => {
    if (user) {
        setName(user.name);
        setAvatarUrl(user.avatar || '');
    }
  }, [user]);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
        // 1. Save to DB (resilient update handles missing columns)
        await api.updateUserProfile(user.id, name, avatarUrl, selectedLang);
        
        // 2. Update local language context
        setLanguage(selectedLang);
        
        // 3. Refresh user state in AuthContext to update UI globally
        await refreshUser();
        
        toast.success(t('success_update'));
    } catch (e: any) {
        toast.error(t('error_generic') + " " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          toast.error(t('error_generic'));
          return;
      }
      if (newPassword.length < 6) {
          toast.error("Min 6 chars");
          return;
      }

      setLoadingPassword(true);
      try {
          await updatePassword(newPassword);
          toast.success(t('success_update'));
          setNewPassword('');
          setConfirmPassword('');
      } catch (e: any) {
          toast.error(t('error_generic'));
      } finally {
          setLoadingPassword(false);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
  };

  const defaultAvatar = `https://api.dicebear.com/9.x/initials/svg?seed=${name}`;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
         <Link to="/" className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors shadow-sm">
            <ArrowLeft size={20} />
         </Link>
         <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('settings')}</h1>
      </div>
      
      {/* Profile Info Card */}
      <Card>
        <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex flex-col items-center mb-6">
                <div 
                    className="relative cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <img 
                        src={avatarUrl || defaultAvatar} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full bg-slate-50 border-4 border-white shadow-md object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera size={24} />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-brand-500 text-white p-2 rounded-full shadow-lg pointer-events-none">
                        <Camera size={14} />
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                />
                <p className="text-sm text-slate-500 mt-2">{t('tap_change')}</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('full_name')}</label>
                <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 text-base"
                        placeholder="Your Name"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('email')}</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        value={user?.email}
                        disabled
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed text-base"
                    />
                </div>
            </div>

            {/* Language Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('preferred_language')}</label>
                <div className="relative">
                    <Globe className="absolute left-3 top-3 text-slate-400 w-5 h-5 pointer-events-none" />
                    <select 
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value as Language)}
                        className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none appearance-none text-base"
                    >
                        <option value="nl">Nederlands</option>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-current"></div>
                    </div>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-base"
            >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {t('save')}</>}
            </button>
        </form>
      </Card>

      {/* Security Card */}
      <Card>
        <h2 className="text-lg font-bold text-slate-900 mb-4">{t('security')}</h2>
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('new_password')}</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input 
                        type="password" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 text-base"
                        placeholder="Min. 6 characters"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('confirm_password')}</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 text-base"
                        placeholder="..."
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={loadingPassword || !newPassword}
                className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-base"
            >
                {loadingPassword ? <Loader2 className="animate-spin" size={18} /> : t('update_password')}
            </button>
        </form>
      </Card>

      {/* Mobile Logout Button */}
      <div className="pt-4 md:hidden">
         <button 
            onClick={logout}
            className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 text-base"
         >
            <LogOut size={20} />
            {t('sign_out')}
         </button>
         <p className="text-center text-xs text-slate-400 mt-4">Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Profile;
