import { expect, test } from '@playwright/test';
import {
  isGatewayUp,
  logoutThroughUi,
  publishHuarique,
  registerThroughUi,
  uniqueSuffix,
} from './helpers.js';

let gatewayUp = false;

test.beforeAll(async () => {
  gatewayUp = await isGatewayUp();
});

test('un dueño publica su huarique y un explorador lo ve en el Radar', async ({ page }) => {
  test.skip(
    !gatewayUp,
    'El API Gateway (Kong) no responde: levanta foodly-infra para correr este test.',
  );

  const id = uniqueSuffix();
  const huariqueName = `E2E Cevichería ${id}`;
  const password = `Passw0rd!${id}`;

  // 1. Register an owner (UF-W1): no huarique yet, so the onboarding opens.
  await registerThroughUi(page, {
    role: 'owner',
    name: `E2E Dueño ${id}`,
    email: `e2e-owner-${id}@foodly.test`,
    username: `e2e_owner_${id}`,
    password,
  });

  // 2. Onboarding (UF-W5): publish and open it.
  await publishHuarique(page, { name: huariqueName });
  await expect(page.getByText('Visible en el Radar en unos segundos').first()).toBeVisible();

  // 3. Log out and register an explorer.
  await logoutThroughUi(page, '/owner/profile');
  await registerThroughUi(page, {
    role: 'explorer',
    name: `E2E Explorador ${id}`,
    email: `e2e-exp-${id}@foodly.test`,
    username: `e2e_exp_${id}`,
    password,
  });
  await expect(page).toHaveURL(/\/radar/);

  // 4. Radar (UF-W2): share the location (Miraflores) and find the huarique.
  await page.getByRole('button', { name: 'Compartir Mi Ubicación' }).click();
  // Radar is fed through RabbitMQ: allow a retry if the first search beats the event.
  await expect(async () => {
    await page.getByRole('button', { name: 'Actualizar mi ubicación' }).click();
    await expect(page.getByRole('heading', { name: huariqueName })).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });

  const card = page.locator('article', { hasText: huariqueName });
  await expect(card.getByText('Abierto Ahora')).toBeVisible();
  await expect(card.getByText(/\d+ m|\d\.\d km/)).toBeVisible();
  await expect(card.getByText('S/ 20 – S/ 45')).toBeVisible();

  // RNF-01: the whole search (Radar + Business enrichment) takes at most 2 s. The dev build shows it.
  const timing = await page.getByTestId('search-timing').innerText();
  const ms = Number(/: (\d+) ms/.exec(timing)[1]);
  console.log(`RNF-01: búsqueda Radar + Business = ${ms} ms`);
  expect(ms).toBeLessThanOrEqual(2000);

  // 5. Open the detail: the menu shows the two star dishes.
  await card.getByRole('link', { name: huariqueName }).click();
  await expect(page.getByRole('heading', { level: 1, name: huariqueName })).toBeVisible();
  await expect(page.getByText('Ceviche clásico')).toBeVisible();
  await expect(page.getByText('S/ 38.50')).toBeVisible();
});
