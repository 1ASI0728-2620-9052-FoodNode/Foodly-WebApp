import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../infrastructure/BusinessService.js', () => ({
  businessService: { getMyHuarique: vi.fn(), getMenu: vi.fn(), setOpenStatus: vi.fn() },
}));

import { businessService } from '../infrastructure/BusinessService.js';
import { useOwnerHuariqueStore } from '../application/useOwnerHuariqueStore.js';
import OwnerStatusSwitch from './OwnerStatusSwitch.vue';

const huarique = (isOpen, version) => ({
  id: 'h1',
  name: 'Don Pepe',
  isOpen,
  version,
  images: [],
  tags: [],
  openingHours: [],
});

describe('OwnerStatusSwitch', () => {
  let pinia;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    Object.values(businessService).forEach((fn) => fn.mockReset());
    businessService.getMenu.mockResolvedValue({ categories: [], version: null });
    businessService.getMyHuarique.mockResolvedValue(huarique(false, 1));
    await useOwnerHuariqueStore().load();
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve));
  const mountSwitch = () => mount(OwnerStatusSwitch, { global: { plugins: [pinia] } });

  it('shows Cerrado with an accessible switch', () => {
    const wrapper = mountSwitch();
    const toggle = wrapper.find('[role="switch"]');
    expect(toggle.attributes('aria-checked')).toBe('false');
    expect(wrapper.text()).toContain('Cerrado');
    expect(toggle.text()).toContain('Abrir el huarique');
  });

  it('opens the huarique when toggled, and shows text + state "Abierto Ahora"', async () => {
    businessService.setOpenStatus.mockResolvedValue(huarique(true, 2));
    const wrapper = mountSwitch();

    await wrapper.find('[role="switch"]').trigger('click');
    await flush();

    expect(businessService.setOpenStatus).toHaveBeenCalledWith('h1', 'OPEN', 1);
    expect(wrapper.find('[role="switch"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.text()).toContain('Abierto Ahora');
  });

  it('stays on the server state if the change fails', async () => {
    businessService.setOpenStatus.mockRejectedValue({ status: 500, message: 'Servicio caído' });
    const wrapper = mountSwitch();

    await wrapper.find('[role="switch"]').trigger('click');
    await flush();

    expect(wrapper.find('[role="switch"]').attributes('aria-checked')).toBe('false');
  });

  it('is disabled while a change is in flight, so it cannot be double-fired', async () => {
    let release;
    businessService.setOpenStatus.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(huarique(true, 2)))),
    );
    const wrapper = mountSwitch();

    await wrapper.find('[role="switch"]').trigger('click');
    expect(wrapper.find('[role="switch"]').attributes('disabled')).toBeDefined();

    release();
    await flush();
    expect(wrapper.find('[role="switch"]').attributes('disabled')).toBeUndefined();
  });
});
