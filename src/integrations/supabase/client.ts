import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const ENV_A = import.meta.env.VITE_SUPABASE_URL;
const ENV_B = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isUrl = (v: string) => typeof v === 'string' && v.startsWith('https://');

const SUPABASE_URL = isUrl(ENV_A) ? ENV_A : isUrl(ENV_B) ? ENV_B : `https://${ENV_A}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY = isUrl(ENV_A) ? ENV_B : ENV_A;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});