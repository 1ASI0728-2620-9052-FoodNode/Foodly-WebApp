import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { makeToken } from '../../tests/jwtHelper.js';

vi.mock('../contexts/iam/infrastructure/IamService.js', () => ({
  iamService: { login: vi.fn(), register: vi.fn(), getMe: vi.fn().mockResolvedValue(null) },
}));

import { resolveNavigation } from './guards.js';
import { createAppRouter } from './router.js';
import { useAuthStore } from '../contexts/iam/application/useAuthStore.js';
import { ROLES } from '../contexts/iam/domain/roles.js';

const explorer = { isAuthenticated: true, role: ROLES.EXPLORER };
const owner = { isAuthenticated: true, role: ROLES.OWNER };
const anonymous = { isAuthenticated: false, role: null };

describe('resolveNavigation (pure rule)', () => {
  it('sends anonymous users from a protected route to login', () => {
    const to = { path: '/radar', meta: { role: ROLES.EXPLORER } };
    expect(resolveNavigation(to, anonymous)).toEqual({ name: 'login' });
  });

  it('lets anonymous users reach public routes', () => {
    expect(resolveNavigation({ path: '/404', meta: { public: true } }, anonymous)).toBe(true);
  });

  it('allows a route whose role matches', () => {
    expect(resolveNavigation({ path: '/radar', meta: { role: ROLES.EXPLORER } }, explorer)).toBe(
      true,
    );
    expect(
      resolveNavigation({ path: '/owner/dashboard', meta: { role: ROLES.OWNER } }, owner),
    ).toBe(true);
  });

  it('answers 403 when the role does not match', () => {
    expect(
      resolveNavigation({ path: '/owner/dashboard', meta: { role: ROLES.OWNER } }, explorer),
    ).toEqual({ name: 'forbidden' });
    expect(resolveNavigation({ path: '/radar', meta: { role: ROLES.EXPLORER } }, owner)).toEqual({
      name: 'forbidden',
    });
  });

  it('keeps authenticated users out of login and sends them home', () => {
    const to = { path: '/login', meta: { public: true, guestOnly: true } };
    expect(resolveNavigation(to, explorer)).toEqual({ path: '/radar' });
    expect(resolveNavigation(to, owner)).toEqual({ path: '/owner/dashboard' });
  });

  it('resolves "/" by session and role', () => {
    expect(resolveNavigation({ path: '/', meta: {} }, anonymous)).toEqual({ name: 'login' });
    expect(resolveNavigation({ path: '/', meta: {} }, explorer)).toEqual({ path: '/radar' });
    expect(resolveNavigation({ path: '/', meta: {} }, owner)).toEqual({
      path: '/owner/dashboard',
    });
  });

  it('treats a route without meta as protected', () => {
    expect(resolveNavigation({ path: '/x' }, anonymous)).toEqual({ name: 'login' });
  });
});

describe('router with guards installed', () => {
  let router;
  let auth;

  beforeEach(async () => {
    sessionStorage.clear();
    setActivePinia(createPinia());
    auth = useAuthStore();
    router = createAppRouter(createMemoryHistory());
  });

  async function loginAs(role) {
    sessionStorage.setItem('foodly.session.token', makeToken({ role }));
    await auth.restore();
  }

  it('redirects an anonymous visit to /login', async () => {
    await router.push('/radar');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('shows the 404 page for unknown paths, with or without session', async () => {
    await router.push('/does-not-exist');
    expect(router.currentRoute.value.name).toBe('not-found');
  });

  it('lets an explorer into /radar but not into the owner area', async () => {
    await loginAs(ROLES.EXPLORER);

    await router.push('/radar');
    expect(router.currentRoute.value.name).toBe('radar');

    await router.push('/owner/dashboard');
    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('lets an owner into the dashboard but not into the explorer area', async () => {
    await loginAs(ROLES.OWNER);

    await router.push('/owner/dashboard');
    expect(router.currentRoute.value.name).toBe('owner-dashboard');

    await router.push('/radar');
    expect(router.currentRoute.value.name).toBe('forbidden');
  });

  it('redirects /login to the role home when already authenticated', async () => {
    await loginAs(ROLES.EXPLORER);
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('radar');
  });

  it('closes an expired session on navigation and goes to login with the reason', async () => {
    await loginAs(ROLES.EXPLORER);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 2 * 3600 * 1000);
      await router.push('/radar');
    } finally {
      vi.useRealTimers();
    }
    expect(auth.isAuthenticated).toBe(false);
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.reason).toBe('expired');
  });
});
