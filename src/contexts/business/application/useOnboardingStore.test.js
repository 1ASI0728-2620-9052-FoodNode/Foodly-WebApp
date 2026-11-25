import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../infrastructure/BusinessService.js', () => ({
  businessService: {
    registerHuarique: vi.fn(),
    replaceMenu: vi.fn(),
    setOpenStatus: vi.fn(),
    getMyHuarique: vi.fn(),
  },
}));

import { businessService } from '../infrastructure/BusinessService.js';
import { useOnboardingStore } from './useOnboardingStore.js';
import {
  emptyHuariqueForm,
  validateIdentity,
  validateOpeningHours,
  validatePricingAndLocation,
  validateScheduleAndDishes,
} from '../domain/huariqueForm.js';

const validForm = () => ({
  ...emptyHuariqueForm(),
  name: ' Cevichería Don Pepe ',
  cuisineType: 'MARINA',
  tags: ['ceviche', 'pescado'],
  address: 'Av. Larco 345, Miraflores',
  priceMin: '20',
  priceMax: '45,50',
  latitude: -12.1219,
  longitude: -77.0297,
  openingHours: [
    { day: 'MONDAY', opensAt: '12:00', closesAt: '22:00' },
    { day: 'TUESDAY', opensAt: '12:00', closesAt: '22:00' },
  ],
  dishes: [
    { name: 'Ceviche clásico', price: '32' },
    { name: 'Arroz con mariscos', price: '38.50' },
  ],
});

const fill = (store, overrides = {}) => Object.assign(store.form, validForm(), overrides);

describe('onboarding validations per step', () => {
  it('step 1: name, specialty (real CuisineType) and tags', () => {
    expect(validateIdentity(validForm()).valid).toBe(true);
    expect(validateIdentity({ ...validForm(), name: '  ' }).errors.name).toBeTruthy();
    expect(validateIdentity({ ...validForm(), name: 'a'.repeat(151) }).errors.name).toBeTruthy();
    expect(validateIdentity({ ...validForm(), cuisineType: '' }).errors.cuisineType).toBeTruthy();
    expect(
      validateIdentity({ ...validForm(), cuisineType: 'ITALIANA' }).errors.cuisineType,
    ).toBeTruthy();
    expect(validateIdentity({ ...validForm(), tags: ['a', 'A'] }).errors.tags).toMatch(/repetidas/);
    expect(validateIdentity({ ...validForm(), tags: ['x'.repeat(41)] }).errors.tags).toBeTruthy();
    expect(
      validateIdentity({ ...validForm(), tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })
        .errors.tags,
    ).toBeTruthy();
  });

  it('step 2: prices in S/, address and pin', () => {
    expect(validatePricingAndLocation(validForm()).valid).toBe(true);
    const bad = (patch) => validatePricingAndLocation({ ...validForm(), ...patch });
    expect(bad({ priceMin: '' }).errors.priceMin).toBeTruthy();
    expect(bad({ priceMin: '10.999' }).errors.priceMin).toBeTruthy();
    expect(bad({ priceMax: 'abc' }).errors.priceMax).toBeTruthy();
    expect(bad({ priceMin: '50', priceMax: '40' }).errors.priceMax).toMatch(/mínimo/);
    expect(bad({ address: '' }).errors.address).toBeTruthy();
    expect(bad({ latitude: null }).errors.location).toBeTruthy();
    expect(bad({ latitude: 95 }).errors.location).toBeTruthy();
  });

  it('step 3: hours (opens < closes, no overlap) and exactly 2 star dishes with price', () => {
    expect(validateScheduleAndDishes(validForm()).valid).toBe(true);

    expect(validateOpeningHours([])).toMatch(/al menos un horario/);
    expect(
      validateOpeningHours([{ day: 'MONDAY', opensAt: '22:00', closesAt: '12:00' }]),
    ).toBeTruthy();
    expect(
      validateOpeningHours([{ day: 'MONDAY', opensAt: '12:00', closesAt: '12:00' }]),
    ).toBeTruthy();
    expect(validateOpeningHours([{ day: 'MONDAY', opensAt: '', closesAt: '12:00' }])).toBeTruthy();
    expect(
      validateOpeningHours([
        { day: 'MONDAY', opensAt: '12:00', closesAt: '16:00' },
        { day: 'MONDAY', opensAt: '15:00', closesAt: '20:00' },
      ]),
    ).toMatch(/se cruzan/);
    // Split shifts on the same day are fine, and the same range on another day is not an overlap.
    expect(
      validateOpeningHours([
        { day: 'MONDAY', opensAt: '12:00', closesAt: '16:00' },
        { day: 'MONDAY', opensAt: '18:00', closesAt: '22:00' },
        { day: 'TUESDAY', opensAt: '12:00', closesAt: '16:00' },
      ]),
    ).toBe('');

    const noDish = validateScheduleAndDishes({
      ...validForm(),
      dishes: [
        { name: '', price: '' },
        { name: 'X', price: '1' },
      ],
    });
    expect(noDish.valid).toBe(false);
    expect(noDish.errors.dishList[0].name).toBeTruthy();
    expect(noDish.errors.dishList[0].price).toBeTruthy();
    expect(
      validateScheduleAndDishes({ ...validForm(), dishes: [{ name: 'Solo uno', price: '10' }] })
        .valid,
    ).toBe(false);
  });
});

describe('useOnboardingStore wizard', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    Object.values(businessService).forEach((fn) => fn.mockReset());
    store = useOnboardingStore();
  });

  it('does not advance from an invalid step and shows that step’s errors', () => {
    expect(store.next()).toBe(false);
    expect(store.step).toBe(1);
    expect(store.currentErrors.name).toBeTruthy();
  });

  it('advances step by step once each one is valid, reporting progress', () => {
    fill(store);
    expect(store.progressPercent).toBe(0);
    expect(store.next()).toBe(true);
    expect(store.step).toBe(2);
    expect(store.progressPercent).toBe(33);
    expect(store.next()).toBe(true);
    expect(store.step).toBe(3);
    expect(store.progressPercent).toBe(67);
    store.back();
    expect(store.step).toBe(2);
  });

  it('publishes with POST -> PUT menu -> PATCH open-status, in that order, with the right bodies', async () => {
    const calls = [];
    businessService.registerHuarique.mockImplementation(async (payload) => {
      calls.push('POST');
      return { id: 'h1', version: 0, ...payload };
    });
    businessService.replaceMenu.mockImplementation(async () => {
      calls.push('PUT menu');
      return { version: 0, categories: [] };
    });
    businessService.setOpenStatus.mockImplementation(async () => {
      calls.push('PATCH open-status');
      return { id: 'h1', isOpen: true, version: 1 };
    });
    fill(store);

    const result = await store.publish();

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(['POST', 'PUT menu', 'PATCH open-status']);

    expect(businessService.registerHuarique).toHaveBeenCalledWith({
      name: 'Cevichería Don Pepe',
      address: 'Av. Larco 345, Miraflores',
      cuisineType: 'MARINA',
      priceRange: { minimum: 20, maximum: 45.5 },
      location: { latitude: -12.1219, longitude: -77.0297 },
      tags: ['ceviche', 'pescado'],
      openingHours: [
        { day: 'MONDAY', opensAt: '12:00', closesAt: '22:00' },
        { day: 'TUESDAY', opensAt: '12:00', closesAt: '22:00' },
      ],
    });
    // First menu: no version. Two dishes, prices parsed to numbers.
    const [menuHuarique, categories, menuVersion] = businessService.replaceMenu.mock.calls[0];
    expect(menuHuarique).toBe('h1');
    expect(menuVersion).toBeNull();
    expect(categories[0].dishes).toEqual([
      { name: 'Ceviche clásico', description: '', price: 32, available: true },
      { name: 'Arroz con mariscos', description: '', price: 38.5, available: true },
    ]);
    // Opened with the version POST returned.
    expect(businessService.setOpenStatus).toHaveBeenCalledWith('h1', 'OPEN', 0);
  });

  it('refuses to publish an invalid draft and jumps to the first invalid step', async () => {
    fill(store, { priceMax: '' });
    const result = await store.publish();
    expect(result).toEqual({ ok: false, invalidStep: 2 });
    expect(store.step).toBe(2);
    expect(businessService.registerHuarique).not.toHaveBeenCalled();
  });

  it('on 409 at POST: "ya tienes un huarique", clears the draft and does not call the next steps', async () => {
    businessService.registerHuarique.mockRejectedValue({ status: 409 });
    fill(store);
    store.saveDraft();

    const result = await store.publish();

    expect(result).toEqual({ ok: false, alreadyRegistered: true });
    expect(store.alreadyRegistered).toBe(true);
    expect(businessService.replaceMenu).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('a failure at the menu step is resumed without registering the huarique twice', async () => {
    businessService.registerHuarique.mockResolvedValue({ id: 'h1', version: 0 });
    businessService.replaceMenu.mockRejectedValueOnce({ status: 500, message: 'Servicio caído' });
    businessService.setOpenStatus.mockResolvedValue({ isOpen: true });
    fill(store);

    const first = await store.publish();
    expect(first.ok).toBe(false);
    expect(store.failedStage).toBe('menu');
    expect(store.error).toContain('Servicio caído');
    expect(businessService.setOpenStatus).not.toHaveBeenCalled();

    businessService.replaceMenu.mockResolvedValue({ version: 0 });
    const second = await store.publish();

    expect(second.ok).toBe(true);
    expect(businessService.registerHuarique).toHaveBeenCalledTimes(1);
    expect(businessService.replaceMenu).toHaveBeenCalledTimes(2);
  });

  it('refreshes a stale version once when opening the local answers 409', async () => {
    businessService.registerHuarique.mockResolvedValue({ id: 'h1', version: 0 });
    businessService.replaceMenu.mockResolvedValue({});
    businessService.setOpenStatus.mockRejectedValueOnce({ status: 409 }).mockResolvedValueOnce({});
    businessService.getMyHuarique.mockResolvedValue({ id: 'h1', version: 3 });
    fill(store);

    expect((await store.publish()).ok).toBe(true);
    expect(businessService.setOpenStatus).toHaveBeenLastCalledWith('h1', 'OPEN', 3);
  });

  describe('draft in localStorage', () => {
    it('saves while typing and restores for the same owner', async () => {
      store.form.name = 'Mi huarique';
      store.form.tags = ['criollo'];
      store.next(); // invalid: stays on step 1, but the draft is saved
      await Promise.resolve();
      store.saveDraft();

      setActivePinia(createPinia());
      const reopened = useOnboardingStore();
      expect(reopened.restoreDraft()).toBe(true);
      expect(reopened.form.name).toBe('Mi huarique');
      expect(reopened.form.tags).toEqual(['criollo']);
    });

    it('keeps the progress of a partially published huarique in the draft', async () => {
      businessService.registerHuarique.mockResolvedValue({ id: 'h1', version: 0 });
      businessService.replaceMenu.mockRejectedValue({ status: 500 });
      fill(store);
      await store.publish();
      store.saveDraft();

      setActivePinia(createPinia());
      const reopened = useOnboardingStore();
      reopened.restoreDraft();
      expect(reopened.progress).toMatchObject({ huariqueId: 'h1', version: 0, menuDone: false });
    });

    it('is cleared after publishing', async () => {
      businessService.registerHuarique.mockResolvedValue({ id: 'h1', version: 0 });
      businessService.replaceMenu.mockResolvedValue({});
      businessService.setOpenStatus.mockResolvedValue({});
      fill(store);
      store.saveDraft();
      expect(localStorage.length).toBe(1);
      await store.publish();
      expect(localStorage.length).toBe(0);
    });

    it('ignores a corrupted draft', () => {
      localStorage.setItem('foodly.owner.onboarding.draft.anonymous', '{broken');
      expect(store.restoreDraft()).toBe(false);
    });
  });
});
