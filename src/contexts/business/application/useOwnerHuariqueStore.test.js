import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../infrastructure/BusinessService.js', () => ({
  businessService: {
    getMyHuarique: vi.fn(),
    getMenu: vi.fn(),
    updateHuarique: vi.fn(),
    setOpenStatus: vi.fn(),
    replaceMenu: vi.fn(),
    setDishPrice: vi.fn(),
    setDishAvailability: vi.fn(),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
  },
}));

import { businessService } from '../infrastructure/BusinessService.js';
import {
  CONFLICT_MESSAGE,
  OWNER_STATUS,
  VISIBILITY_MESSAGE,
  useOwnerHuariqueStore,
} from './useOwnerHuariqueStore.js';
import { emptyHuariqueForm } from '../domain/huariqueForm.js';

const huarique = (extra = {}) => ({
  id: 'h1',
  name: 'Don Pepe',
  isOpen: false,
  openStatus: 'CLOSED',
  version: 2,
  images: [],
  tags: [],
  openingHours: [],
  ...extra,
});
const menu = (extra = {}) => ({
  id: 'm1',
  version: 5,
  categories: [
    {
      id: 'c1',
      name: 'Platos',
      dishes: [{ id: 'd1', name: 'Ceviche', price: 30, available: true, images: [] }],
    },
  ],
  ...extra,
});

describe('useOwnerHuariqueStore', () => {
  let owner;

  beforeEach(async () => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    Object.values(businessService).forEach((fn) => fn.mockReset());
    businessService.getMyHuarique.mockResolvedValue(huarique());
    businessService.getMenu.mockResolvedValue(menu());
    owner = useOwnerHuariqueStore();
    await owner.load();
  });

  afterEach(() => vi.useRealTimers());

  it('loads the huarique and its menu', () => {
    expect(owner.status).toBe(OWNER_STATUS.READY);
    expect(owner.huarique.version).toBe(2);
    expect(owner.dishCount).toBe(1);
  });

  it('is "missing" when the owner has no huarique yet (404 -> null)', async () => {
    businessService.getMyHuarique.mockResolvedValue(null);
    await owner.load();
    expect(owner.status).toBe(OWNER_STATUS.MISSING);
  });

  it('goes to error when loading fails', async () => {
    businessService.getMyHuarique.mockRejectedValue({ message: 'Servicio caído' });
    await owner.load();
    expect(owner.status).toBe(OWNER_STATUS.ERROR);
    expect(owner.error).toBe('Servicio caído');
  });

  describe('open/closed switch', () => {
    it('opens a closed huarique with PATCH open-status OPEN and the held version', async () => {
      businessService.setOpenStatus.mockResolvedValue(
        huarique({ isOpen: true, openStatus: 'OPEN', version: 3 }),
      );

      const result = await owner.toggleOpen();

      expect(businessService.setOpenStatus).toHaveBeenCalledWith('h1', 'OPEN', 2);
      expect(result.ok).toBe(true);
      expect(owner.isOpen).toBe(true);
      expect(owner.huarique.version).toBe(3); // the new version is kept
    });

    it('closes an open one, and a second toggle uses the version of the first answer', async () => {
      businessService.setOpenStatus
        .mockResolvedValueOnce(huarique({ isOpen: true, version: 3 }))
        .mockResolvedValueOnce(huarique({ isOpen: false, version: 4 }));

      await owner.toggleOpen();
      await owner.toggleOpen();

      expect(businessService.setOpenStatus).toHaveBeenNthCalledWith(1, 'h1', 'OPEN', 2);
      expect(businessService.setOpenStatus).toHaveBeenNthCalledWith(2, 'h1', 'CLOSED', 3);
      expect(owner.isOpen).toBe(false);
    });

    it('keeps showing the server state when the PATCH fails', async () => {
      businessService.setOpenStatus.mockRejectedValue({ status: 500, message: 'Servicio caído' });
      const result = await owner.toggleOpen();
      expect(result).toMatchObject({ ok: false, error: 'Servicio caído' });
      expect(owner.isOpen).toBe(false);
      expect(owner.saving).toBe(false);
    });

    it('announces "Visible en el Radar en unos segundos" after changing the state (RNF-08), then hides it', async () => {
      businessService.setOpenStatus.mockResolvedValue(huarique({ isOpen: true, version: 3 }));
      expect(VISIBILITY_MESSAGE).toBe('Visible en el Radar en unos segundos.');

      await owner.toggleOpen();
      expect(owner.visibilityNotice).toBe(true);

      vi.advanceTimersByTime(8001);
      expect(owner.visibilityNotice).toBe(false);
    });
  });

  describe('version conflicts (409)', () => {
    it('reloads, warns "Alguien actualizó este huarique" and reports the conflict', async () => {
      businessService.setOpenStatus.mockRejectedValue({ status: 409 });
      businessService.getMyHuarique.mockResolvedValue(huarique({ version: 7, isOpen: true }));

      const result = await owner.toggleOpen();

      expect(result).toMatchObject({ ok: false, conflict: true });
      expect(CONFLICT_MESSAGE).toBe('Alguien actualizó este huarique, revisa los cambios.');
      expect(owner.conflictNotice).toBe(CONFLICT_MESSAGE);
      expect(owner.huarique.version).toBe(7); // fresh copy from the server
      expect(owner.isOpen).toBe(true);
      expect(owner.visibilityNotice).toBe(false); // nothing was saved
    });

    it('a profile save with a stale version reloads too, and the next save uses the new version', async () => {
      const form = {
        ...emptyHuariqueForm(),
        name: 'Nuevo',
        cuisineType: 'MARINA',
        address: 'X',
        priceMin: '1',
        priceMax: '2',
        latitude: 1,
        longitude: 1,
        openingHours: [],
      };
      businessService.updateHuarique.mockRejectedValueOnce({ status: 409 });
      businessService.getMyHuarique.mockResolvedValue(
        huarique({ version: 9, name: 'Cambiado por otro' }),
      );

      const conflict = await owner.saveProfile(form);
      expect(businessService.updateHuarique.mock.calls[0][2]).toBe(2);
      expect(conflict.conflict).toBe(true);
      expect(owner.huarique.name).toBe('Cambiado por otro');

      businessService.updateHuarique.mockResolvedValue(huarique({ version: 10 }));
      const ok = await owner.saveProfile(form);
      expect(businessService.updateHuarique.mock.calls[1][2]).toBe(9);
      expect(ok.ok).toBe(true);
      expect(owner.huarique.version).toBe(10);
    });

    it('a stale menu version reloads the menu', async () => {
      businessService.replaceMenu.mockRejectedValue({ status: 409 });
      businessService.getMenu.mockResolvedValue(menu({ version: 8 }));

      const result = await owner.saveMenu([]);

      expect(businessService.replaceMenu).toHaveBeenCalledWith('h1', [], 5);
      expect(result.conflict).toBe(true);
      expect(owner.menu.version).toBe(8);
    });

    it('can dismiss the notice', async () => {
      businessService.setOpenStatus.mockRejectedValue({ status: 409 });
      await owner.toggleOpen();
      owner.dismissConflict();
      expect(owner.conflictNotice).toBe('');
    });
  });

  describe('menu', () => {
    it('stores the new menu version after every write', async () => {
      businessService.setDishPrice.mockResolvedValue(menu({ version: 6 }));
      businessService.setDishAvailability.mockResolvedValue(menu({ version: 7 }));

      await owner.setDishPrice('d1', 28.5);
      await owner.setDishAvailability('d1', false);

      expect(businessService.setDishPrice).toHaveBeenCalledWith('h1', 'd1', 28.5, 5);
      expect(businessService.setDishAvailability).toHaveBeenCalledWith('h1', 'd1', false, 6);
      expect(owner.menu.version).toBe(7);
    });
  });

  describe('images', () => {
    const file = (type = 'image/jpeg', size = 1000) => {
      const f = new File(['x'], 'a.jpg', { type });
      Object.defineProperty(f, 'size', { value: size });
      return f;
    };

    it('rejects a wrong type or an oversized file without calling the API', async () => {
      expect((await owner.uploadImage(file('image/gif'))).ok).toBe(false);
      expect((await owner.uploadImage(file('image/png', 5 * 1024 * 1024 + 1))).ok).toBe(false);
      expect(businessService.uploadImage).not.toHaveBeenCalled();
    });

    it('reads the huarique again after an upload, because the image answer has no version', async () => {
      businessService.uploadImage.mockResolvedValue({ id: 'i1', url: 'https://img/1.jpg' });
      businessService.getMyHuarique.mockResolvedValue(
        huarique({ version: 3, images: [{ id: 'i1', url: 'https://img/1.jpg' }] }),
      );

      const result = await owner.uploadImage(file());

      expect(result.ok).toBe(true);
      expect(owner.huarique.version).toBe(3);
      expect(owner.huarique.images).toHaveLength(1);
    });

    it('stops at 20 gallery photos', async () => {
      businessService.getMyHuarique.mockResolvedValue(
        huarique({
          images: Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, url: 'https://x' })),
        }),
      );
      await owner.load();
      const result = await owner.uploadImage(file());
      expect(result.ok).toBe(false);
      expect(businessService.uploadImage).not.toHaveBeenCalled();
    });

    it('dish photos refresh the menu, not the huarique', async () => {
      businessService.uploadImage.mockResolvedValue({ id: 'i1', url: 'https://img/1.jpg' });
      businessService.getMenu.mockClear();

      await owner.uploadImage(file(), { dishId: 'd1' });

      expect(businessService.uploadImage).toHaveBeenCalledWith('h1', expect.any(File), {
        dishId: 'd1',
        replaceId: null,
      });
      expect(businessService.getMenu).toHaveBeenCalledTimes(1);
    });
  });
});
