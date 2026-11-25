import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeToken } from '../../../../tests/jwtHelper.js';

vi.mock('../infrastructure/IamService.js', () => ({
  iamService: { login: vi.fn(), register: vi.fn(), getMe: vi.fn() },
}));

import { iamService } from '../infrastructure/IamService.js';
import { LOGOUT_REASONS, useAuthStore } from './useAuthStore.js';
import { ROLES } from '../domain/roles.js';

const STORAGE_KEY = 'foodly.session.token';

function authResult(token, extra = {}) {
  return { token, expiresAt: '2030-01-01T00:00:00Z', user: { id: 'u1', name: 'Ana', ...extra } };
}

describe('useAuthStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
    iamService.getMe.mockResolvedValue({
      id: 'u1',
      name: 'Ana Pérez',
      email: 'ana@foodly.pe',
      username: 'ana',
      phone: null,
      role: ROLES.EXPLORER,
    });
  });

  it('starts logged out', () => {
    const auth = useAuthStore();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('login stores the token in sessionStorage and reads role from the JWT', async () => {
    const token = makeToken({ role: ROLES.OWNER });
    iamService.login.mockResolvedValue(authResult(token));
    const auth = useAuthStore();

    const role = await auth.login({ email: 'ana@foodly.pe', password: 'secret123' });

    expect(role).toBe(ROLES.OWNER);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isOwner).toBe(true);
    expect(auth.token).toBe(token);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(token);
    expect(localStorage.length).toBe(0);
  });

  it('loads the full profile from /users/me after login', async () => {
    iamService.login.mockResolvedValue(authResult(makeToken()));
    const auth = useAuthStore();
    await auth.login({ email: 'ana@foodly.pe', password: 'secret123' });
    expect(auth.profile.email).toBe('ana@foodly.pe');
  });

  it('keeps the session with the minimal profile if /users/me fails', async () => {
    iamService.login.mockResolvedValue(authResult(makeToken()));
    iamService.getMe.mockRejectedValue(new Error('boom'));
    const auth = useAuthStore();

    await auth.login({ email: 'ana@foodly.pe', password: 'secret123' });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.profile.name).toBe('Ana');
  });

  it('register authenticates with the returned token', async () => {
    iamService.register.mockResolvedValue(authResult(makeToken({ role: ROLES.EXPLORER })));
    const auth = useAuthStore();
    const role = await auth.register({ name: 'Ana' });
    expect(role).toBe(ROLES.EXPLORER);
    expect(auth.isAuthenticated).toBe(true);
  });

  it('propagates login errors and stays logged out', async () => {
    iamService.login.mockRejectedValue({ status: 401 });
    const auth = useAuthStore();
    await expect(auth.login({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });
    expect(auth.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a token that cannot be read or has no valid role', async () => {
    iamService.login.mockResolvedValue(authResult('not-a-jwt'));
    const auth = useAuthStore();
    await expect(auth.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('rejects an already expired token', async () => {
    iamService.login.mockResolvedValue(authResult(makeToken({ expiresInSeconds: -10 })));
    const auth = useAuthStore();
    await expect(auth.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('restore() rebuilds the session from sessionStorage', async () => {
    const token = makeToken({ role: ROLES.OWNER });
    sessionStorage.setItem(STORAGE_KEY, token);
    const auth = useAuthStore();

    expect(await auth.restore()).toBe(true);
    expect(auth.role).toBe(ROLES.OWNER);
    expect(iamService.getMe).toHaveBeenCalledTimes(1);
  });

  it('restore() discards an expired stored token', async () => {
    sessionStorage.setItem(STORAGE_KEY, makeToken({ expiresInSeconds: -5 }));
    const auth = useAuthStore();

    expect(await auth.restore()).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('logout clears memory and storage', async () => {
    iamService.login.mockResolvedValue(authResult(makeToken()));
    const auth = useAuthStore();
    await auth.login({ email: 'a@b.co', password: 'x' });

    auth.logout();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.profile).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('logs out automatically when the token expires', async () => {
    vi.useFakeTimers();
    try {
      iamService.login.mockResolvedValue(authResult(makeToken({ expiresInSeconds: 60 })));
      const auth = useAuthStore();
      await auth.login({ email: 'a@b.co', password: 'x' });
      expect(auth.isAuthenticated).toBe(true);

      await vi.advanceTimersByTimeAsync(61_000);

      expect(auth.isAuthenticated).toBe(false);
      expect(auth.logoutReason).toBe(LOGOUT_REASONS.EXPIRED);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ensureValidSession closes an expired session when called with a later clock', async () => {
    iamService.login.mockResolvedValue(authResult(makeToken({ expiresInSeconds: 60 })));
    const auth = useAuthStore();
    await auth.login({ email: 'a@b.co', password: 'x' });

    expect(auth.ensureValidSession(Date.now())).toBe(true);
    expect(auth.ensureValidSession(Date.now() + 120_000)).toBe(false);
    expect(auth.logoutReason).toBe(LOGOUT_REASONS.EXPIRED);
  });

  it('consumeLogoutReason returns the reason once', () => {
    const auth = useAuthStore();
    auth.logout(LOGOUT_REASONS.UNAUTHORIZED);
    expect(auth.consumeLogoutReason()).toBe(LOGOUT_REASONS.UNAUTHORIZED);
    expect(auth.consumeLogoutReason()).toBeNull();
  });
});
