
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Global Top Header - Includes Safe Area Padding */}
      <header
        className="md:hidden flex items-center justify-between px-5 pb-3 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center text-xl shadow-sm">
            🦍
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase leading-none">APE</h1>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">Challenge Tracker</p>
          </div>
        </Link>
        <Link to="/profile" className={`p-0.5 rounded-full border-2 transition-all ${isActive('/profile') ? 'border-brand-500 scale-105 shadow-lg shadow-brand-500/10' : 'border-white dark:border-slate-700 shadow-sm'}`}>
          <img src={user?.avatar} alt="Profile" className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 object-cover" />
        </Link>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-2xl shadow-sm">
            🦍
          </div>
          <span className="text-2xl font-black tracking-tighter bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent uppercase">
            APE
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/')
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <LayoutDashboard size={20} />
            {t('dashboard')}
          </Link>
          <Link
            to="/profile"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/profile')
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserIcon size={20} />
            {t('profile')}
          </Link>
        </nav>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <img src={user?.avatar} alt="User" className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2 w-full text-left text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            {t('sign_out')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
