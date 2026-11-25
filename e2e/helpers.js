import { expect } from '@playwright/test';

export const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8000';

/** True when Kong answers (IAM answers 401 to an anonymous /users/me: it is up). */
export async function isGatewayUp() {
  try {
    const response = await fetch(`${GATEWAY}/iam/users/me`, { signal: AbortSignal.timeout(3000) });
    return response.status === 401 || response.ok;
  } catch {
    return false;
  }
}

export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Registers through the UI; the caller waits for the post-register redirect it expects. */
export async function registerThroughUi(page, { role, name, email, username, password, phone }) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Registrarse' }).click();
  await page
    .getByText(role === 'owner' ? 'Dueño de Huarique' : 'Explorador Gastronómico', { exact: true })
    .click();
  await page.getByLabel('Nombre completo').fill(name);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Nombre de usuario').fill(username);
  if (phone) await page.getByLabel('Teléfono').fill(phone);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
}

export async function loginThroughUi(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

export async function logoutThroughUi(page, profilePath) {
  await page.goto(profilePath);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Walks the 3-step onboarding wizard and publishes the huarique. */
export async function publishHuarique(page, { name }) {
  await expect(page).toHaveURL(/\/owner\/onboarding/);

  // Step 1: identity
  await page.getByLabel('Nombre oficial del huarique').fill(name);
  await page.getByLabel('Especialidad').selectOption('MARINA');
  await page.getByLabel('Etiquetas').fill('ceviche');
  await page.getByLabel('Etiquetas').press('Enter');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Step 2: prices and location (browser geolocation is granted and fixed to Miraflores)
  await page.getByLabel('Precio mínimo (S/)').fill('20');
  await page.getByLabel('Precio máximo (S/)').fill('45');
  await page.getByLabel('Dirección').fill('Av. Larco 345, Miraflores');
  await page.getByRole('button', { name: 'Usar mi ubicación actual' }).click();
  await expect(page.getByText(/Pin en -12\.1219/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Step 3: hours (Monday to Saturday plus Sunday, so reservations can be made any day) and 2 dishes
  await page.getByRole('button', { name: /Rellenar de lunes a sábado/ }).click();
  await page
    .getByRole('button', { name: /Agregar horario/ })
    .last()
    .click(); // Sunday
  await page.getByLabel('Platillo 1', { exact: true }).fill('Ceviche clásico');
  await page.getByLabel('Precio del platillo 1 (S/)').fill('32');
  await page.getByLabel('Platillo 2', { exact: true }).fill('Arroz con mariscos');
  await page.getByLabel('Precio del platillo 2 (S/)').fill('38.50');
  await page.getByRole('button', { name: 'Publicar Huarique y Activar Radar' }).click();

  await expect(page).toHaveURL(/\/owner\/dashboard/);
  await expect(page.getByText('Abierto Ahora').first()).toBeVisible();
}
