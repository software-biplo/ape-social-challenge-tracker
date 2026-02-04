import { createClient } from '@supabase/supabase-js';

// Read Supabase config from Vite environment variables.
// On Vercel: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the dashboard.
// Locally: create a .env.local file with these values, or use env.ts (gitignored).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Supabase Configuration Missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file or Vercel environment variables.'
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
