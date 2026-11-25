import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// Every path prefix Kong routes. In development they are proxied so the
// browser only talks to the Vite origin and CORS never comes into play.
const GATEWAY_PREFIXES = [
  '/iam',
  '/business-api',
  '/radar',
  '/messaging',
  '/reservation-api',
  '/community',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_GATEWAY_URL || 'http://localhost:8000';

  const proxy = Object.fromEntries(
    GATEWAY_PREFIXES.map((prefix) => [
      prefix,
      { target, changeOrigin: true, ws: prefix === '/messaging' },
    ]),
  );

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, proxy },
    test: {
      environment: 'jsdom',
      globals: false,
      include: ['src/**/*.test.js', 'tests/**/*.test.js'],
      restoreMocks: true,
      setupFiles: ['./tests/setup.js'],
    },
  };
});
