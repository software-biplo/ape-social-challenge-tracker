import { createClient } from '@supabase/supabase-js';
import { ENV } from '../env';

// Helper to safely access environment variables in different environments
const getEnv = (key: string) => {
  try {
    // Priority 1: The local env.ts file
    // Cast to any to avoid TypeScript indexing errors during build
    const localEnv = ENV as any;
    if (localEnv && localEnv[key]) return localEnv[key];

    // Priority 2: Process environment (Node/Cloud Run)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
    
    // Priority 3: Vite/Meta environment
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore errors
  }
  return undefined;
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Supabase Configuration Missing. Please ensure keys are set in env.ts or your environment variables.'
  );
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});