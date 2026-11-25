import { expect, test } from '@playwright/test';

// /radar is a SPA route AND the API prefix Kong routes to Radar. Loading it directly (a refresh, a
// shared link) must serve the app: before the proxy bypass the dev server answered Radar's 401 JSON.
test('abrir /radar directamente carga la app (no el JSON del servicio Radar)', async ({ page }) => {
  const response = await page.goto('/radar');
  expect(response.headers()['content-type']).toContain('text/html');
  await expect(page).toHaveURL(/\/login/); // anonymous: the guard sends the visitor to login
  await expect(page.getByRole('tab', { name: 'Iniciar Sesión' })).toBeVisible();
});

test('las rutas desconocidas muestran la página 404 de la app', async ({ page }) => {
  await page.goto('/esto-no-existe');
  await expect(page.getByText('404 · Página no encontrada')).toBeVisible();
});

test('el prefijo de API sigue llegando al gateway con fetch JSON', async ({ request }) => {
  const response = await request.get('/radar/status', { headers: { accept: 'application/json' } });
  // Whatever Radar answers (401 without token), it is NOT the SPA's index.html.
  expect(response.headers()['content-type'] ?? '').not.toContain('text/html');
});
