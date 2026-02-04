import { supabase } from '../lib/supabase';

export const authService = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  signup: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: name } }
    });
    
    if (error) throw error;

    // Only attempt to create profile if we have a valid session (email confirmed or auto-confirm enabled)
    // If we don't have a session, the RLS policy (auth.uid() = id) will likely fail.
    // In that case, we defer profile creation to the first login (see AuthContext).
    if (data.session && data.user) {
        await authService.createProfile(data.user.id, name, email);
    }
    
    return { user: data.user, session: data.session };
  },

  // Extracted to allow calling from AuthContext if profile is missing on login
  createProfile: async (userId: string, name: string, email?: string) => {
      // Check if profile exists first to avoid duplicate key errors if not handled by upsert
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (existing) return;

      const { error } = await supabase.from('profiles').insert({
          id: userId,
          display_name: name || email?.split('@')[0] || 'User',
          avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${name}`
      });

      if (error) {
          // Log warning but don't crash app flow. 
          // If RLS fails here, the app will continue with a "virtual" profile in AuthContext.
          console.warn("Profile creation failed (likely RLS or Trigger exists):", error.message);
      }
  },

  updatePassword: async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  getSession: async () => {
    return supabase.auth.getSession();
  }
};