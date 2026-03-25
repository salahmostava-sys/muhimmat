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

let refreshInFlight: Promise<void> | null = null;
const shouldAttemptSilentRefresh = (res: Response, input: RequestInfo | URL): boolean => {
  if (res.status !== 401) return false;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  // Avoid recursion / loops when refreshing auth tokens.
  if (url.includes('/auth/v1/token')) return false;
  return true;
};

let client: ReturnType<typeof createClient<Database>> | null = null;
const wrappedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!shouldAttemptSilentRefresh(res, input)) return res;

  // If the tab was idle, the access token may be expired. Try a single silent refresh, then retry once.
  try {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        if (!client) return;
        const { error } = await client.auth.refreshSession();
        if (error) throw error;
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    await refreshInFlight;
  } catch (e) {
    console.error('[Supabase] silent session refresh failed after 401', e);
    // Refresh failed; return the original 401 to callers (React Query will handle it without redirect).
    return res;
  }

  return fetch(input, init);
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: wrappedFetch },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

client = supabase;
