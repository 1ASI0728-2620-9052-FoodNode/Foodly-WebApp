import { expect, test } from '@playwright/test';
import {
  isGatewayUp,
  loginThroughUi,
  logoutThroughUi,
  registerThroughUi,
  uniqueSuffix,
} from './helpers.js';

/**
 * Captures W1..W8 for the report (section 7.2.1.5) into docs/screenshots.
 * Opt-in because it registers users and writes files:  E2E_SCREENSHOTS=1 npm run e2e -- screenshots
 * It follows the real flow: owner publishes, explorer finds it, books, owner approves, explorer
 * checks in and reviews. Reservation and Community run on their localStorage mocks.
 */
const OUT = 'docs/screenshots';
const enabled = process.env.E2E_SCREENSHOTS === '1';

let gatewayUp = false;
test.beforeAll(async () => {
  gatewayUp = await isGatewayUp();
});

const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 3600 * 1000);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD
};

async function settle(page, ms = 1800) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms); // map tiles
}

async function shot(page, name, options = {}) {
  await page.evaluate(() => window.scrollTo(0, 0)); // a sticky bar would otherwise sit mid-image
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: options.fullPage ?? true });
}

test('capturas W1 a W8', async ({ page }) => {
  test.skip(!enabled, 'Opt-in: E2E_SCREENSHOTS=1');
  test.skip(!gatewayUp, 'El API Gateway no responde.');
  test.setTimeout(240_000);

  const id = uniqueSuffix();
  const password = `Passw0rd!${id}`;
  const owner = { email: `e2e-owner-${id}@foodly.test`, password };
  const explorer = { email: `e2e-exp-${id}@foodly.test`, password };
  const huariqueName = `La Cevichería de Pepe ${id.slice(-3)}`;
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- W1: registro / inicio de sesión --------------------------------------------------------
  await page.goto('/login');
  await shot(page, 'w1-login', { fullPage: false });
  await page.getByRole('tab', { name: 'Registrarse' }).click();
  await page.getByText('Dueño de Huarique', { exact: true }).click();
  await shot(page, 'w1-registro', { fullPage: false });

  await registerThroughUi(page, {
    role: 'owner',
    name: 'Pepe Quispe',
    email: owner.email,
    username: `e2e_owner_${id}`,
    password,
    phone: '+51987654321',
  });

  // --- W6: onboarding en 3 pasos ---------------------------------------------------------------
  await expect(page).toHaveURL(/\/owner\/onboarding/);
  await page.getByLabel('Nombre oficial del huarique').fill(huariqueName);
  await page.getByLabel('Especialidad').selectOption('MARINA');
  await page.getByLabel('Etiquetas').fill('ceviche');
  await page.getByLabel('Etiquetas').press('Enter');
  await page.getByLabel('Etiquetas').fill('pescado fresco');
  await page.getByLabel('Etiquetas').press('Enter');
  await shot(page, 'w6-onboarding-1-identidad');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Precio mínimo (S/)').fill('20');
  await page.getByLabel('Precio máximo (S/)').fill('45');
  await page.getByLabel('Dirección').fill('Av. Larco 345, Miraflores');
  await page.getByRole('button', { name: 'Usar mi ubicación actual' }).click();
  await settle(page);
  await shot(page, 'w6-onboarding-2-ubicacion');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByRole('button', { name: /Rellenar de lunes a sábado/ }).click();
  await page
    .getByRole('button', { name: /Agregar horario/ })
    .last()
    .click();
  await page.getByLabel('Platillo 1', { exact: true }).fill('Ceviche clásico');
  await page.getByLabel('Precio del platillo 1 (S/)').fill('32');
  await page.getByLabel('Platillo 2', { exact: true }).fill('Arroz con mariscos');
  await page.getByLabel('Precio del platillo 2 (S/)').fill('38.50');
  await shot(page, 'w6-onboarding-3-horarios');
  await page.getByRole('button', { name: 'Publicar Huarique y Activar Radar' }).click();

  // --- W7: gestión y edición ------------------------------------------------------------------
  await expect(page).toHaveURL(/\/owner\/dashboard/);
  await expect(page.getByText('Abierto Ahora').first()).toBeVisible();
  await settle(page);
  await shot(page, 'w7-dashboard');
  await page.goto('/owner/menu');
  await expect(page.getByText('Ceviche clásico').first())
    .toBeVisible()
    .catch(() => {});
  await settle(page, 500);
  await shot(page, 'w7-carta-y-precios');
  await page.goto('/owner/gallery');
  await settle(page, 500);
  await shot(page, 'w7-galeria');

  // --- W2: Radar H3 ---------------------------------------------------------------------------
  await logoutThroughUi(page, '/owner/profile');
  await registerThroughUi(page, {
    role: 'explorer',
    name: 'Ana Torres',
    email: explorer.email,
    username: `e2e_exp_${id}`,
    password,
  });
  await expect(page).toHaveURL(/\/radar/);
  await shot(page, 'w2-radar-permiso', { fullPage: false });
  await page.getByRole('button', { name: 'Compartir Mi Ubicación' }).click();
  await expect(async () => {
    await page.getByRole('button', { name: 'Actualizar mi ubicación' }).click();
    await expect(page.getByRole('heading', { name: huariqueName })).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 40_000 });
  await settle(page, 2500);
  await page.locator('article', { hasText: huariqueName }).click();
  await shot(page, 'w2-radar-escritorio');

  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 1500);
  await shot(page, 'w2-radar-movil', { fullPage: false });
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- W3: detalle y favoritos ----------------------------------------------------------------
  await page
    .locator('article', { hasText: huariqueName })
    .getByRole('button', { name: /Agregar .* a favoritos/ })
    .click();
  await page
    .locator('article', { hasText: huariqueName })
    .getByRole('link', { name: huariqueName })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: huariqueName })).toBeVisible();
  await settle(page);
  await shot(page, 'w3-detalle');
  await page.goto('/favoritos');
  await expect(page.getByRole('heading', { name: huariqueName })).toBeVisible();
  await shot(page, 'w3-favoritos');

  // --- Lía: drawer "Preguntar a Lía" -----------------------------------------------------------
  await page.goto('/radar');
  await page.getByRole('button', { name: 'Preguntar a Lía' }).first().click();
  await page
    .getByLabel('Escribe tu mensaje para Lía')
    .fill('Quiero un ceviche barato cerca de aquí');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Quiero un ceviche barato cerca de aquí')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, 'lia-chat', { fullPage: false });
  await page.keyboard.press('Escape');

  // --- reservar + W4: reserva confirmada ---------------------------------------------------------
  await page.goto('/radar');
  await page
    .getByRole('button', { name: 'Compartir Mi Ubicación' })
    .click()
    .catch(() => {});
  await page.goBack().catch(() => {});
  await page.goto('/favoritos');
  await page.getByRole('link', { name: huariqueName }).click();
  await page.getByRole('button', { name: 'Reservar Mesa con Lía' }).click();
  await page.getByLabel('Fecha').fill(tomorrow());
  await page.getByLabel('Hora').fill('20:00');
  await page.getByLabel('Número de personas').fill('4');
  await page.getByLabel('Plato de interés').selectOption('Ceviche clásico');
  await page
    .getByLabel(/Notas para el huarique/)
    .fill('Es un cumpleaños, ¿pueden tener una mesa tranquila?');
  await shot(page, 'w4-reservar-mesa');
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/);
  const reservationPath = new URL(page.url()).pathname;
  await expect(page.getByText('Pendiente').first()).toBeVisible();
  await settle(page, 600);
  await shot(page, 'w4-reserva-pendiente');

  // --- W8: gestión de reservas de Lía (dueño) -----------------------------------------------------
  await logoutThroughUi(page, '/profile');
  await loginThroughUi(page, owner);
  await expect(page).toHaveURL(/\/owner\/dashboard/);
  await page.goto('/owner/reservations');
  await expect(page.getByText('Ana Torres')).toBeVisible();
  await shot(page, 'w8-reservas-pendientes');
  await page.getByRole('button', { name: 'Aprobar Reserva' }).click();
  await expect(page.getByText('Reserva aprobada.')).toBeVisible();
  await page.getByRole('tab', { name: /Aprobadas/ }).click();
  await shot(page, 'w8-reservas-aprobadas');

  // --- W4 aprobada, W5 cómo llegar, check-in y reseña verificada -----------------------------------
  await logoutThroughUi(page, '/owner/profile');
  await loginThroughUi(page, explorer);
  await expect(page).toHaveURL(/\/radar/);
  await page.goto(reservationPath);
  await expect(page.getByText('Aprobada').first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver Voucher' }).click();
  await settle(page, 600);
  await shot(page, 'w4-reserva-aprobada');

  await page.getByRole('button', { name: 'Ir en Ruta' }).click();
  await expect(page).toHaveURL(/\/ruta$/);
  await expect(page.getByText('Distancia en línea recta')).toBeVisible();
  await settle(page, 2500);
  await shot(page, 'w5-como-llegar');
  await page.getByRole('button', { name: 'Ya llegué al local' }).click();
  await expect(page).toHaveURL(new RegExp(`${reservationPath}$`));

  await page
    .getByRole('group', { name: 'Sabor' })
    .getByRole('button', { name: '5 estrellas' })
    .click();
  await page
    .getByRole('group', { name: 'Atención' })
    .getByRole('button', { name: '4 estrellas' })
    .click();
  await page.getByLabel('Plato estrella').fill('Ceviche clásico');
  await page
    .getByLabel('Tu comentario')
    .fill('Atención cálida y un ceviche fresquísimo. Volveremos pronto.');
  await shot(page, 'w4-resena-verificada');
  await page.getByRole('button', { name: 'Publicar reseña verificada' }).click();
  await expect(page.getByText('Ya reseñaste esta reserva').first()).toBeVisible();

  // --- reputación del dueño --------------------------------------------------------------------------
  await logoutThroughUi(page, '/profile');
  await loginThroughUi(page, owner);
  await expect(page.getByText('Reserva Verificada').first()).toBeVisible();
  await settle(page, 800);
  await shot(page, 'w7-reputacion');
});
