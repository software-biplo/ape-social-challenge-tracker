
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { api } from '../services/dataService';
import { toast } from 'sonner';
import { GUEST_USER } from '../services/mockStore';
import { useLanguage } from './LanguageContext';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  recoveryMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const { t, setLanguage, language } = useLanguage();

  // We need to capture the initial hash before Supabase or Router clears it
  const initialHashRef = useRef(window.location.hash);
  // Track whether initSession already loaded user data to avoid duplicate call from onAuthStateChange
  const sessionInitializedRef = useRef(false);

  // Helper to fetch profile or create it if missing (Lazy Creation)
  const loadUserdata = async (sessionUser: any) => {
      try {
        let profile = await api.getUserProfile(sessionUser.id, sessionUser.email);
        
        // If profile not found in DB, try to create it now that we have a session
        if (!profile) {
            const fullName = sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0];
            await authService.createProfile(sessionUser.id, fullName, sessionUser.email);
            
            // Construct immediate profile object to update UI without refetch
            profile = {
                id: sessionUser.id,
                email: sessionUser.email,
                name: fullName,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sessionUser.id}`
            };
        }
        
        // Sync language preference from profile if it differs from current session
        if (profile?.preferredLanguage && profile.preferredLanguage !== language) {
            setLanguage(profile.preferredLanguage);
        }
        
        setUser(profile);
      } catch (e) {
        console.error("Failed to load user data", e);
        // Fallback for UI to prevent crash
        setUser({ id: sessionUser.id, email: sessionUser.email, name: sessionUser.email?.split('@')[0] });
      }
  };

  const refreshUser = async () => {
    if (!user || user.id === 'guest') return;
    const { data } = await authService.getSession();
    if (data?.session?.user) {
        await loadUserdata(data.session.user);
    }
  };

  useEffect(() => {
    // Check Guest Mode First
    const isGuest = localStorage.getItem('strive_guest') === 'true';
    if (isGuest) {
        setUser(GUEST_USER);
        setIsLoading(false);
        return;
    }

    const initSession = async () => {
      try {
        const { data, error } = await authService.getSession();
        if (error) {
           console.warn("Session init error:", error.message);
           setUser(null);
        } else if (data?.session?.user) {
           await loadUserdata(data.session.user);
           sessionInitializedRef.current = true;
        }
      } catch (err) {
        console.error("Unexpected session error:", err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    const { data } = authService.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Skip duplicate loadUserdata if initSession already handled this user
        if (sessionInitializedRef.current) {
            sessionInitializedRef.current = false; // Reset for future auth changes
        } else if (!user || user.id !== session.user.id) {
            loadUserdata(session.user);
        }

        // Handle specific Auth Events
        if (event === 'SIGNED_IN') {
             // Check if this was a signup confirmation or recovery
             const hash = initialHashRef.current;
             
             if (hash.includes('type=signup') || hash.includes('type=invite')) {
                 toast.success(t('email_verified'), { description: t('email_verified_sub'), duration: 5000 });
                 initialHashRef.current = ''; 
             } else if (hash.includes('type=recovery')) {
                 toast.info(t('recovery_mode'), { description: t('recovery_mode_sub'), duration: 6000 });
                 setRecoveryMode(true);
                 initialHashRef.current = '';
             }
        } else if (event === 'PASSWORD_RECOVERY') {
             toast.info(t('recovery_mode'), { description: t('recovery_mode_sub'), duration: 6000 });
             setRecoveryMode(true);
        }

      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setRecoveryMode(false);
      }
      setIsLoading(false);
    });

    return () => {
        if (data?.subscription) data.subscription.unsubscribe();
    };
  }, [t, setLanguage]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
        await authService.login(email, password);
    } catch (error: any) {
        toast.error(error.message || "Failed to sign in");
        setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true);
    try {
        const { session } = await authService.signup(email, password, name);
        if (!session) {
            toast.success(t('signup') + " Success!", { description: "Please check your email to confirm your account." });
            setIsLoading(false);
        }
        return true;
    } catch (error: any) {
        toast.error(error.message || "Failed to create account");
        setIsLoading(false);
        return false;
    }
  };

  const updatePassword = async (password: string) => {
     if (localStorage.getItem('strive_guest') === 'true') {
         toast.success("Guest password updated (simulated)");
         return;
     }
     await authService.updatePassword(password);
     setRecoveryMode(false); // Clear recovery mode after success
  };

  const loginAsGuest = () => {
      localStorage.setItem('strive_guest', 'true');
      setUser(GUEST_USER);
      toast.success("Signed in as Guest");
  };

  const logout = async () => {
    if (localStorage.getItem('strive_guest') === 'true') {
        localStorage.removeItem('strive_guest');
        setUser(null);
        toast.info("Signed out");
        return;
    }
    await authService.logout();
    toast.info("Signed out successfully");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, updatePassword, loginAsGuest, logout, refreshUser, isLoading, recoveryMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
