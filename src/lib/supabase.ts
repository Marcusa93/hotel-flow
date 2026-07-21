
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Se recortan espacios y barra final: un espacio invisible al final de la
// variable en Vercel rompía las URLs armadas a mano (fetch a
// "supabase.co%20/functions/..." → ERR_NAME_NOT_RESOLVED). El cliente de
// Supabase lo tolera porque normaliza con new URL(); el resto del código no.
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Singleton guard — prevents Vite HMR from creating duplicate GoTrueClient instances
const GLOBAL_KEY = '__supabase_client__' as const;

export const supabase: SupabaseClient =
    (globalThis as unknown as Record<string, SupabaseClient>)[GLOBAL_KEY] ??
    ((globalThis as unknown as Record<string, SupabaseClient>)[GLOBAL_KEY] = createClient(supabaseUrl, supabaseAnonKey));
