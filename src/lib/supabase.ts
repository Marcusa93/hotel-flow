
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Singleton guard — prevents Vite HMR from creating duplicate GoTrueClient instances
const GLOBAL_KEY = '__supabase_client__' as const;

export const supabase: SupabaseClient =
    (globalThis as unknown as Record<string, SupabaseClient>)[GLOBAL_KEY] ??
    ((globalThis as unknown as Record<string, SupabaseClient>)[GLOBAL_KEY] = createClient(supabaseUrl, supabaseAnonKey));
