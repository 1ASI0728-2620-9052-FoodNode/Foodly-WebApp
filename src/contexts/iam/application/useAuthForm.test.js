import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeToken } from '../../../../tests/jwtHelper.js';

vi.mock('../infrastructure/IamService.js', () => ({
  iamService: { login: vi.fn(), register: vi.fn(), getMe: vi.fn().mockResolvedValue(null) },
}));

import { iamService } from '../infrastructure/IamService.js';
import { AUTH_MODES, useAuthForm } from './useAuthForm.js';

const ok = (role) => ({
  token: makeToken({ role }),
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', name: 'Ana' },
});

describe('useAuthForm', () => {
  let onAuthenticated;
  let ctx;

  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
    onAuthenticated = vi.fn();
    ctx = useAuthForm({ onAuthenticated });
  });

  it('does not call the API and shows field errors when the form is invalid', async () => {
    await ctx.submit();
    expect(iamService.login).not.toHaveBeenCalled();
    expect(ctx.errors.value.email).toBeTruthy();
    expect(ctx.errors.value.password).toBeTruthy();
  });

  it('only shows errors for touched fields before the first submit', () => {
    expect(ctx.errors.value).toEqual({});
    ctx.touch('email');
    expect(Object.keys(ctx.errors.value)).toEqual(['email']);
  });

  it('logs in and reports the role to the caller', async () => {
    iamService.login.mockResolvedValue(ok('HUARIQUE_OWNER'));
    ctx.form.email = 'ana@foodly.pe';
    ctx.form.password = 'secret123';

    await ctx.submit();

    expect(iamService.login).toHaveBeenCalledWith({
      email: 'ana@foodly.pe',
      password: 'secret123',
    });
    expect(onAuthenticated).toHaveBeenCalledWith('HUARIQUE_OWNER');
    expect(ctx.formError.value).toBe('');
  });

  it('shows the credentials error on 401', async () => {
    iamService.login.mockRejectedValue({ status: 401, message: 'x' });
    ctx.form.email = 'ana@foodly.pe';
    ctx.form.password = 'wrong';

    await ctx.submit();

    expect(ctx.formError.value).toMatch(/incorrectos/);
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(ctx.submitting.value).toBe(false);
  });

  describe('register mode', () => {
    beforeEach(() => {
      ctx.setMode(AUTH_MODES.REGISTER);
      Object.assign(ctx.form, {
        name: 'Ana Pérez',
        email: 'ana@foodly.pe',
        username: 'ana_perez',
        password: 'secret123',
      });
    });

    it('registers with the chosen role', async () => {
      iamService.register.mockResolvedValue(ok('HUARIQUE_OWNER'));
      ctx.form.role = 'HUARIQUE_OWNER';

      await ctx.submit();

      expect(iamService.register).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'HUARIQUE_OWNER', username: 'ana_perez' }),
      );
      expect(onAuthenticated).toHaveBeenCalledWith('HUARIQUE_OWNER');
    });

    it('shows the duplicated account error on 409', async () => {
      iamService.register.mockRejectedValue({ status: 409 });
      await ctx.submit();
      expect(ctx.formError.value).toMatch(/ya están registrados/);
    });

    it('shows the invalid data error on 400', async () => {
      iamService.register.mockRejectedValue({ status: 400 });
      await ctx.submit();
      expect(ctx.formError.value).toMatch(/no son válidos/);
    });

    it('falls back to the HTTP client message for other errors', async () => {
      iamService.register.mockRejectedValue({ status: 500, message: 'Servicio caído' });
      await ctx.submit();
      expect(ctx.formError.value).toBe('Servicio caído');
    });

    it('clears feedback when switching tabs', async () => {
      iamService.register.mockRejectedValue({ status: 409 });
      await ctx.submit();
      ctx.setMode(AUTH_MODES.LOGIN);
      expect(ctx.formError.value).toBe('');
      expect(ctx.errors.value).toEqual({});
    });
  });
});
