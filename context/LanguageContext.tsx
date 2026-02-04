
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { translations, Language } from '../services/translations';
import { nl, enUS, fr } from 'date-fns/locale';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['nl']) => string;
  dateLocale: any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to Dutch ('nl') or stored preference
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('ape_preferred_lang');
    return (stored as Language) || 'nl';
  });

  const t = (key: keyof typeof translations['nl']) => {
    return translations[language][key] || key;
  };

  const setLanguageWithPersistence = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('ape_preferred_lang', lang);
  };

  const dateLocale = language === 'nl' ? nl : (language === 'fr' ? fr : enUS);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageWithPersistence, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
