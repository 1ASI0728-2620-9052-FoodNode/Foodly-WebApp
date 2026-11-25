import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { makeToken } from '../../../../tests/jwtHelper.js';

vi.mock('../infrastructure/IamService.js', () => ({
  iamService: { login: vi.fn(), register: vi.fn(), getMe: vi.fn().mockResolvedValue(null) },
}));

import { iamService } from '../infrastructure/IamService.js';
import AuthForm from './AuthForm.vue';

const flush = () => new Promise((resolve) => setTimeout(resolve));

function mountForm() {
  return mount(AuthForm, { global: { plugins: [createPinia()] } });
}

describe('AuthForm', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts on the login tab with accessible tab semantics', () => {
    const wrapper = mountForm();
    const tabs = wrapper.findAll('[role="tab"]');

    expect(tabs.map((tab) => tab.text())).toEqual(['Iniciar Sesión', 'Registrarse']);
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('input[name="role"]').exists()).toBe(false);
  });

  it('shows the register-only fields after switching tabs', async () => {
    const wrapper = mountForm();
    await wrapper.findAll('[role="tab"]')[1].trigger('click');

    expect(wrapper.findAll('input[name="role"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Explorador Gastronómico');
    expect(wrapper.text()).toContain('Dueño de Huarique');
    expect(wrapper.text()).toContain('(opcional)');
  });

  it('shows validation errors on submit and does not call the API', async () => {
    const wrapper = mountForm();
    await wrapper.find('form').trigger('submit');

    expect(iamService.login).not.toHaveBeenCalled();
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Ingresa tu correo electrónico.');
  });

  it('shows the 401 message inside the form and keeps the user on it', async () => {
    iamService.login.mockRejectedValue({ status: 401, message: 'x' });
    const wrapper = mountForm();
    await wrapper.find('input[type="email"]').setValue('ana@foodly.pe');
    await wrapper.find('input[type="password"]').setValue('wrongpass');
    await wrapper.find('form').trigger('submit');
    await flush();

    expect(wrapper.find('[role="alert"]').text()).toContain('Correo o contraseña incorrectos.');
    expect(wrapper.emitted('authenticated')).toBeUndefined();
  });

  it('emits authenticated with the role after a successful login', async () => {
    iamService.login.mockResolvedValue({
      token: makeToken({ role: 'GASTRONOMIC_EXPLORER' }),
      expiresAt: '2030-01-01T00:00:00Z',
      user: { id: 'u1', name: 'Ana' },
    });
    const wrapper = mountForm();
    await wrapper.find('input[type="email"]').setValue('ana@foodly.pe');
    await wrapper.find('input[type="password"]').setValue('secret123');
    await wrapper.find('form').trigger('submit');
    await flush();

    expect(wrapper.emitted('authenticated')[0]).toEqual(['GASTRONOMIC_EXPLORER']);
  });

  it('labels the password visibility toggle for assistive technology', async () => {
    const wrapper = mountForm();
    const toggle = wrapper.find('button[aria-label="Mostrar contraseña"]');
    expect(toggle.exists()).toBe(true);

    await toggle.trigger('click');
    expect(wrapper.find('input[autocomplete="current-password"]').attributes('type')).toBe('text');
    expect(wrapper.find('button[aria-label="Ocultar contraseña"]').exists()).toBe(true);
  });
});
