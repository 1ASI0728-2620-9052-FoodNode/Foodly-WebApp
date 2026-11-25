import { describe, expect, it, vi } from 'vitest';
import { BusinessService } from './BusinessService.js';

describe('BusinessService.getMyHuarique', () => {
  it('returns the huarique on 200', async () => {
    const client = { get: vi.fn().mockResolvedValue({ id: 'h1' }) };
    expect(await new BusinessService(client).getMyHuarique()).toEqual({ id: 'h1' });
    expect(client.get).toHaveBeenCalledWith('/business-api/huariques/me');
  });

  it('returns null on 404 (owner without huarique)', async () => {
    const client = { get: vi.fn().mockRejectedValue({ status: 404 }) };
    expect(await new BusinessService(client).getMyHuarique()).toBeNull();
  });

  it('rethrows any other error', async () => {
    const error = { status: 500 };
    const client = { get: vi.fn().mockRejectedValue(error) };
    await expect(new BusinessService(client).getMyHuarique()).rejects.toBe(error);
  });
});
