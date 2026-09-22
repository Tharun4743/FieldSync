import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Auth will not work.');
}

/**
 * Supabase client — used ONLY for authentication.
 * All data storage goes through Vercel Functions → Supabase server-side.
 * The browser never directly queries Supabase for data.
 */
export const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    storageKey: 'fieldsync-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
