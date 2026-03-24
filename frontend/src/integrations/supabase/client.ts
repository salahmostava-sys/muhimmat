import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const cleanEnv = (value: string | undefined) =>
  value
    ?.trim()
    // Handle values accidentally saved with wrapping quotes in hosting env vars.
    .replace(/^['"]+|['"]+$/g, '');

const SUPABASE_URL = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const SUPABASE_PUBLISHABLE_KEY = cleanEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

// إنتاج أونلاين: يجب أن يشير إلى مشروع Supabase السحابي (https://….supabase.co) وليس خادماً محلياً
if (import.meta.env.PROD) {
  const u = SUPABASE_URL.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1') || u.includes('0.0.0.0')) {
    console.error(
      '[Config] VITE_SUPABASE_URL يبدو محلياً بينما البناء للإنتاج. عيّن في Vercel قيم مشروعك السحابي على Supabase.'
    );
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
