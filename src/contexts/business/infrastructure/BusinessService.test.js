import { describe, expect, it, vi } from 'vitest';
import { BusinessService } from './BusinessService.js';

const view = (extra = {}) => ({
  id: 'h1',
  ownerId: 'o1',
  name: 'Don Pepe',
  address: 'Miraflores',
  cuisineType: 'MARINA',
  priceRange: { minimum: 20, maximum: 40 },
  location: { latitude: -12.12, longitude: -77.03 },
  openStatus: 'CLOSED',
  tags: [],
  openingHours: [],
  images: [],
  version: 0,
  ...extra,
});

describe('BusinessService reads', () => {
  it('getMyHuarique returns the normalized huarique on 200', async () => {
    const client = { get: vi.fn().mockResolvedValue(view()) };
    const huarique = await new BusinessService(client).getMyHuarique();
    expect(client.get).toHaveBeenCalledWith('/business-api/huariques/me');
    expect(huarique).toMatchObject({ id: 'h1', name: 'Don Pepe', isOpen: false, version: 0 });
  });

  it('getMyHuarique returns null on 404 (owner without huarique)', async () => {
    const client = { get: vi.fn().mockRejectedValue({ status: 404 }) };
    expect(await new BusinessService(client).getMyHuarique()).toBeNull();
  });

  it('getMyHuarique rethrows any other error', async () => {
    const error = { status: 500 };
    const client = { get: vi.fn().mockRejectedValue(error) };
    await expect(new BusinessService(client).getMyHuarique()).rejects.toBe(error);
  });

  it('getMenu turns a 404 into an empty menu', async () => {
    const client = { get: vi.fn().mockRejectedValue({ status: 404 }) };
    expect((await new BusinessService(client).getMenu('h1')).categories).toEqual([]);
  });
});

describe('BusinessService writes', () => {
  it('registers a huarique with POST /business-api/huariques', async () => {
    const client = { post: vi.fn().mockResolvedValue(view()) };
    const created = await new BusinessService(client).registerHuarique({ name: 'Don Pepe' });
    expect(client.post).toHaveBeenCalledWith('/business-api/huariques', { name: 'Don Pepe' });
    expect(created.version).toBe(0);
  });

  it('updates with PUT sending the expected version in the body', async () => {
    const client = { put: vi.fn().mockResolvedValue(view({ version: 4 })) };
    const updated = await new BusinessService(client).updateHuarique('h1', { name: 'X' }, 3);
    expect(client.put).toHaveBeenCalledWith('/business-api/huariques/h1', {
      name: 'X',
      version: 3,
    });
    expect(updated.version).toBe(4);
  });

  it('changes the open status with PATCH and the version', async () => {
    const client = { patch: vi.fn().mockResolvedValue(view({ openStatus: 'OPEN', version: 1 })) };
    const updated = await new BusinessService(client).setOpenStatus('h1', 'OPEN', 0);
    expect(client.patch).toHaveBeenCalledWith('/business-api/huariques/h1/open-status', {
      openStatus: 'OPEN',
      version: 0,
    });
    expect(updated).toMatchObject({ isOpen: true, version: 1 });
  });

  it('omits the menu version on the first PUT and sends it afterwards', async () => {
    const client = { put: vi.fn().mockResolvedValue({ id: 'm1', version: 0, categories: [] }) };
    const service = new BusinessService(client);

    await service.replaceMenu('h1', [{ name: 'Platos', dishes: [] }], null);
    expect(client.put.mock.calls[0][1]).not.toHaveProperty('version');

    await service.replaceMenu('h1', [], 2);
    expect(client.put.mock.calls[1][1]).toEqual({ categories: [], version: 2 });
    expect(client.put.mock.calls[1][0]).toBe('/business-api/huariques/h1/menu');
  });

  it('patches dish price and availability with the menu version', async () => {
    const client = { patch: vi.fn().mockResolvedValue({ id: 'm1', version: 5, categories: [] }) };
    const service = new BusinessService(client);

    await service.setDishPrice('h1', 'd1', 25.5, 4);
    expect(client.patch).toHaveBeenLastCalledWith(
      '/business-api/huariques/h1/menu/dishes/d1/price',
      {
        price: 25.5,
        version: 4,
      },
    );
    await service.setDishAvailability('h1', 'd1', false, 5);
    expect(client.patch).toHaveBeenLastCalledWith(
      '/business-api/huariques/h1/menu/dishes/d1/availability',
      { available: false, version: 5 },
    );
  });

  it('uploads a gallery image as multipart and a replacement with PUT', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ id: 'i1', url: 'https://img/1.jpg' }),
      put: vi.fn().mockResolvedValue({ id: 'i2', url: 'https://img/2.jpg' }),
    };
    const service = new BusinessService(client);
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    expect(await service.uploadImage('h1', file)).toEqual({ id: 'i1', url: 'https://img/1.jpg' });
    const [path, body, options] = client.post.mock.calls[0];
    expect(path).toBe('/business-api/huariques/h1/images');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(File);
    expect(options.timeoutMs).toBeGreaterThan(10_000);

    await service.uploadImage('h1', file, { replaceId: 'i1' });
    expect(client.put.mock.calls[0][0]).toBe('/business-api/huariques/h1/images/i1');
  });

  it('targets the dish endpoints for dish images', async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ id: 'i1', url: 'https://img/1.jpg' }),
      delete: vi.fn().mockResolvedValue(null),
    };
    const service = new BusinessService(client);
    await service.uploadImage('h1', new File(['x'], 'a.png'), { dishId: 'd1' });
    expect(client.post.mock.calls[0][0]).toBe('/business-api/huariques/h1/menu/dishes/d1/images');
    await service.deleteImage('h1', 'i1', { dishId: 'd1' });
    expect(client.delete).toHaveBeenCalledWith(
      '/business-api/huariques/h1/menu/dishes/d1/images/i1',
    );
    await service.deleteImage('h1', 'i9');
    expect(client.delete).toHaveBeenLastCalledWith('/business-api/huariques/h1/images/i9');
  });
});
