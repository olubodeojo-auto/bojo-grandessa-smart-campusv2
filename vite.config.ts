import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Unit tests import services that create a Supabase client at module load time.
// Give Vitest inert values only; production builds continue using Vercel's configured env vars.
// No test should make real network requests to this local placeholder.
export default defineConfig(({ mode }) => {
  const isTestMode = mode === 'test' || process.env.VITEST === 'true'

  return {
    plugins: [react()],
    ...(isTestMode
      ? {
          define: {
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key-not-a-secret'),
          },
        }
      : {}),
  }
})
