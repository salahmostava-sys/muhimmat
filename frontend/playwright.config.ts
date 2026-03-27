import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

/**
 * قيم احتياطية حتى يُحمَّل التطبيق في CI أو بدون `.env.local`؛ للاختبار الحقيقي ضع مشروعك في `.env.local`.
 */
const E2E_FALLBACK_SUPABASE_URL = 'https://placeholder.supabase.co';
const E2E_FALLBACK_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || E2E_FALLBACK_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || E2E_FALLBACK_SUPABASE_KEY;

/**
 * المنفذ الافتراضي للمشروع: 5000 (انظر `vite.config.ts`).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'ar-SA',
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    },
  },
});
