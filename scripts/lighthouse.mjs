// Runs Lighthouse (mobile and desktop) on /login and /radar of the production build and writes
// the scores to docs/LIGHTHOUSE.md plus the HTML reports to docs/lighthouse/.
//
//   VITE_MOCK_RESERVATION=true VITE_MOCK_COMMUNITY=true npm run build && node scripts/lighthouse.mjs
//
// /radar needs a session: the script registers a throwaway explorer through the gateway and seeds
// its JWT into sessionStorage before the page loads. Requires the gateway (default :8000).
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import puppeteer from 'puppeteer-core';

const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8000';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const TOKEN_KEY = 'foodly.session.token';

async function waitFor(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not come up`);
}

async function explorerToken() {
  const id = Date.now().toString(36);
  const response = await fetch(`${GATEWAY}/iam/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Lighthouse ${id}`,
      email: `e2e-lh-${id}@foodly.test`,
      username: `e2e_lh_${id}`,
      password: `Passw0rd!${id}`,
      role: 'GASTRONOMIC_EXPLORER',
    }),
  });
  if (!response.ok) throw new Error(`register failed: ${response.status}`);
  return (await response.json()).token;
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
  env: { ...process.env, VITE_API_GATEWAY_URL: GATEWAY },
});

try {
  await waitFor(`${BASE}/login`);
  const token = await explorerToken();
  const browser = await puppeteer.launch({
    executablePath: chromium.executablePath(),
    headless: true,
    args: ['--no-sandbox'],
  });

  await mkdir('docs/lighthouse', { recursive: true });
  const rows = [];
  const targets = [
    { name: 'login', path: '/login', session: false },
    { name: 'radar', path: '/radar', session: true },
  ];

  for (const target of targets) {
    for (const form of ['mobile', 'desktop']) {
      const page = await browser.newPage();
      if (target.session) {
        await page.evaluateOnNewDocument(
          (key, value) => window.sessionStorage.setItem(key, value),
          TOKEN_KEY,
          token,
        );
      }
      const flags = { logLevel: 'error', output: 'html', onlyCategories: CATEGORIES };
      const run = await lighthouse(
        `${BASE}${target.path}`,
        flags,
        form === 'desktop' ? desktopConfig : undefined,
        page,
      );
      const scores = Object.fromEntries(
        CATEGORIES.map((id) => [id, Math.round(run.lhr.categories[id].score * 100)]),
      );
      const finalUrl = new URL(run.lhr.finalDisplayedUrl).pathname;
      await writeFile(`docs/lighthouse/${target.name}-${form}.html`, run.report);
      rows.push({ ...target, form, scores, finalUrl });
      console.log(target.name, form, JSON.stringify(scores), finalUrl);
      await page.close();
    }
  }
  await browser.close();

  const date = new Date().toISOString().slice(0, 10);
  const table = rows
    .map(
      (r) =>
        `| \`${r.path}\` | ${r.form} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.scores.seo} | [informe](lighthouse/${r.name}-${r.form}.html) |`,
    )
    .join('\n');
  await writeFile(
    'docs/LIGHTHOUSE.md',
    `# Lighthouse\n\nMedido el ${date} sobre el build de producción (\`vite preview\`), con Lighthouse ${'13'} y Chromium headless.\n\`/radar\` se mide con una sesión de explorador sembrada en \`sessionStorage\`; se carga sin ubicación compartida (estado inicial).\n\n| Página | Dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | SEO | Informe |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n${table}\n\nReproducir: \`VITE_MOCK_RESERVATION=true VITE_MOCK_COMMUNITY=true npm run build && node scripts/lighthouse.mjs\` (requiere el gateway en ${GATEWAY}).\n`,
  );
} finally {
  preview.kill();
  spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
}
