import { defineConfig, devices } from '@playwright/test';

const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8000';
const PORT = Number(process.env.E2E_PORT ?? 5173);

// Miraflores: the Radar district the e2e flows search in.
export const E2E_GEOLOCATION = { latitude: -12.1219, longitude: -77.0297 };

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    permissions: ['geolocation'],
    geolocation: E2E_GEOLOCATION,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_API_GATEWAY_URL: GATEWAY,
      // Reservation and Community have no API yet: the e2e runs them on the localStorage mocks.
      VITE_MOCK_RESERVATION: 'true',
      VITE_MOCK_COMMUNITY: 'true',
    },
  },
});
