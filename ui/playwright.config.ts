import { defineConfig } from '@playwright/test'

// Runs against the real API (retrieval, ACL, page images, audit are free). /api/ask and the other
// paid calls are intercepted in the specs, so no LLM call is ever made.
// By default it tests the built app served by FastAPI on :8010 (`npm run build` first).
// Set PW_BASE_URL=http://localhost:5173 to test the Vite dev server instead.
const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:8010'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL, viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
  ...(baseURL.includes(':5173')
    ? { webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 } }
    : {}),
})
