
import React, { useEffect } from 'react';
// Consolidated react-router-dom imports to fix resolution issues across different build environments
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ChallengeProvider } from './context/ChallengeContext';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChallengeWizard from './pages/ChallengeWizard';
import ChallengeDetail from './pages/ChallengeDetail';
import Profile from './pages/Profile';
import { Toaster } from 'sonner';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Layout>{children}</Layout>;
};

// Component to handle Recovery Mode Redirection
const AuthHandler = () => {
    const { recoveryMode, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && recoveryMode) {
            navigate('/profile');
        }
    }, [recoveryMode, isAuthenticated, navigate]);

    return null;
};

// Component to Capture Deep Links (Invite Codes)
const DeepLinkHandler = () => {
  useEffect(() => {
    const handleUrl = () => {
       let code = null;
       
       const searchParams = new URLSearchParams(window.location.search);
       if (searchParams.get('joinCode')) {
           code = searchParams.get('joinCode');
       }

       if (!code) {
          const hashParts = window.location.hash.split('?');
          if (hashParts.length > 1) {
             const hashParams = new URLSearchParams(hashParts[1]);
             if (hashParams.get('joinCode')) {
                 code = hashParams.get('joinCode');
             }
          }
       }

       if (code) {
           console.log("Detected Join Code:", code);
           localStorage.setItem('strive_pending_invite', code);
       }
    };

    handleUrl();
  }, []);

  return null;
}

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <DeepLinkHandler />
      <AuthHandler />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/create" element={
          <ProtectedRoute>
            <ChallengeWizard />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        <Route path="/challenge/:id/edit" element={
          <ProtectedRoute>
            <ChallengeWizard />
          </ProtectedRoute>
        } />
        
        <Route path="/challenge/:id" element={
          <ProtectedRoute>
            <ChallengeDetail />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
};

const ThemedToaster = () => {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-center" richColors theme={resolvedTheme} />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ChallengeProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
            <ThemedToaster />
          </ChallengeProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
