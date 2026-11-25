import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { isGatewayUp, registerThroughUi, uniqueSuffix } from './helpers.js';

const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

let gatewayUp = false;
test.beforeAll(async () => {
  gatewayUp = await isGatewayUp();
});

/** Fails on the first element that makes the page scroll sideways. */
async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('body *')]
      .filter(
        (el) =>
          el.getBoundingClientRect().right > limit + 1 && getComputedStyle(el).position !== 'fixed',
      )
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    return { scrollWidth: document.documentElement.scrollWidth, limit, wide };
  });
  expect(
    overflow.scrollWidth,
    `elementos que se salen: ${overflow.wide.join(', ')}`,
  ).toBeLessThanOrEqual(overflow.limit);
}

async function expectTouchTargets(page, selector) {
  const small = await page.evaluate((sel) => {
    return (
      [...document.querySelectorAll(sel)]
        .filter((el) => el.offsetParent !== null)
        // A checkbox or radio is operated through its label, which is the real touch target.
        .map((el) => ({
          el,
          box: (el.type === 'checkbox' || el.type === 'radio'
            ? (el.closest('label') ?? el)
            : el
          ).getBoundingClientRect(),
        }))
        .filter(({ box }) => box.width < 44 || box.height < 44)
        .map(
          ({ el, box }) =>
            `${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 30) || el.tagName} (${Math.round(box.width)}x${Math.round(box.height)})`,
        )
    );
  }, selector);
  expect(small, 'áreas táctiles menores a 44 px').toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('/login: sin scroll horizontal, áreas táctiles y sin violaciones WCAG AA', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(page.getByRole('tab', { name: 'Iniciar Sesión' })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(page, 'button, a[href], input:not([type=hidden]), select');

      await page.getByRole('tab', { name: 'Registrarse' }).click();
      await expectNoHorizontalScroll(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    });

    test('/radar: navegación según el ancho y sin violaciones WCAG AA', async ({ page }) => {
      test.skip(!gatewayUp, 'El API Gateway no responde.');
      const id = uniqueSuffix();
      await registerThroughUi(page, {
        role: 'explorer',
        name: `A11y ${id}`,
        email: `e2e-a11y-${id}@foodly.test`,
        username: `e2e_a11y_${id}`,
        password: `Passw0rd!${id}`,
      });
      await expect(page).toHaveURL(/\/radar/);
      await page.getByRole('button', { name: 'Compartir Mi Ubicación' }).click();
      await expect(
        page
          .getByText('Zona H3')
          .or(page.getByText(/huariques? cerca de ti|No hay huariques aquí aún/))
          .first(),
      ).toBeVisible();

      const topbar = page.locator('header.topbar');
      const bottombar = page.locator('nav.bottombar');
      if (viewport.width >= 768) {
        await expect(topbar).toBeVisible();
        await expect(bottombar).toBeHidden();
      } else {
        await expect(bottombar).toBeVisible();
        await expect(topbar).toBeHidden();
      }
      await expectNoHorizontalScroll(page);
      await expectTouchTargets(
        page,
        'nav a, nav button, .location-picker button, .filters input, .filters select',
      );

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .exclude('.leaflet-container') // third-party map tiles and controls
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
        ),
      ).toEqual([]);
    });
  });
}

test('teclado: el skip-link y el orden de tabulación llegan al formulario con foco visible', async ({
  page,
}) => {
  await page.goto('/login');
  // Wait for the app to mount: the skip-link is the first thing it renders.
  await expect(page.getByRole('tab', { name: 'Iniciar Sesión' })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar al contenido' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  // Tabs are a roving-tabindex group: arrows move between them.
  await page.getByRole('tab', { name: 'Iniciar Sesión' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Registrarse' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Every stop in the form shows a visible focus indicator.
  await page.keyboard.press('Tab');
  const stops = [];
  for (let i = 0; i < 6; i += 1) {
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        label:
          el.getAttribute('aria-label') || el.id || el.name || el.textContent.trim().slice(0, 20),
        visible:
          (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== 'none',
      };
    });
    stops.push(info);
    await page.keyboard.press('Tab');
  }
  expect(
    stops.filter((stop) => !stop.visible),
    JSON.stringify(stops),
  ).toEqual([]);
});
