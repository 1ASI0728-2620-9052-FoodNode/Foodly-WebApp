import { describe, expect, it, vi } from 'vitest';
import { resolvePostLoginRoute } from './postLoginRoute.js';
import { ROLES } from '../contexts/iam/domain/roles.js';

describe('resolvePostLoginRoute', () => {
  it('sends the explorer to /radar without calling Business', async () => {
    const businessService = { getMyHuarique: vi.fn() };
    const result = await resolvePostLoginRoute(ROLES.EXPLORER, { businessService });
    expect(result).toEqual({ path: '/radar', degraded: false });
    expect(businessService.getMyHuarique).not.toHaveBeenCalled();
  });

  it('sends an owner without huarique (404 -> null) to onboarding', async () => {
    const businessService = { getMyHuarique: vi.fn().mockResolvedValue(null) };
    expect(await resolvePostLoginRoute(ROLES.OWNER, { businessService })).toEqual({
      path: '/owner/onboarding',
      degraded: false,
    });
  });

  it('sends an owner with a huarique to the dashboard', async () => {
    const businessService = { getMyHuarique: vi.fn().mockResolvedValue({ id: 'h1' }) };
    expect(await resolvePostLoginRoute(ROLES.OWNER, { businessService })).toEqual({
      path: '/owner/dashboard',
      degraded: false,
    });
  });

  it('lets the owner in, flagged as degraded, when Business fails', async () => {
    const businessService = { getMyHuarique: vi.fn().mockRejectedValue({ status: 500 }) };
    expect(await resolvePostLoginRoute(ROLES.OWNER, { businessService })).toEqual({
      path: '/owner/dashboard',
      degraded: true,
    });
  });
});
