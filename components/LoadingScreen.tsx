
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const LoadingScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <style>
        {`
          @keyframes monkeyRun {
            0% { transform: translateY(0) rotate(-5deg); }
            25% { transform: translateY(-8px) rotate(5deg); }
            50% { transform: translateY(0) rotate(-5deg); }
            75% { transform: translateY(-8px) rotate(5deg); }
            100% { transform: translateY(0) rotate(-5deg); }
          }
          @keyframes groundMove {
            0% { transform: translateX(100%); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateX(-100%); opacity: 0; }
          }
          .animate-monkey {
            animation: monkeyRun 0.6s infinite ease-in-out;
          }
          .speed-line {
            position: absolute;
            height: 3px;
            border-radius: 99px;
            animation: groundMove 0.8s infinite linear;
          }
          :root .speed-line { background: #cbd5e1; }
          .dark .speed-line { background: #475569; }
        `}
      </style>

      <div className="relative mb-8 w-32 h-32 flex items-center justify-center">
        {/* Speed lines for "running" effect */}
        <div className="speed-line w-12 top-1/4 -right-8" style={{ animationDelay: '0s' }}></div>
        <div className="speed-line w-8 top-1/2 -right-12" style={{ animationDelay: '0.2s' }}></div>
        <div className="speed-line w-10 bottom-1/4 -right-10" style={{ animationDelay: '0.4s' }}></div>

        {/* The Monkey */}
        <div className="text-7xl animate-monkey select-none drop-shadow-xl">
          🦍
        </div>

        {/* Ground shadow/dust */}
        <div className="absolute -bottom-2 w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-[100%] blur-[2px] opacity-60"></div>
      </div>

      <div className="text-center">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter mb-2">
          {t('loading')}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
          Swinging into action...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
