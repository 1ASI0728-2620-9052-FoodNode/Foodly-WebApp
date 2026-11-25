import { computed, reactive, ref } from 'vue';
import { useAuthStore } from './useAuthStore.js';
import { ROLES } from '../domain/roles.js';
import { validateLoginForm, validateRegisterForm } from '../domain/validation.js';
import { authErrorMessage } from '../domain/authErrors.js';

export const AUTH_MODES = Object.freeze({ LOGIN: 'login', REGISTER: 'register' });

const REGISTER_ROLES = [ROLES.EXPLORER, ROLES.OWNER];

const emptyForm = () => ({
  role: ROLES.EXPLORER,
  name: '',
  email: '',
  username: '',
  phone: '',
  password: '',
});

/**
 * State and behavior of the login/register form (UF-W1). The view only renders what this returns.
 *
 * @param {{ onAuthenticated: (role: string) => (void|Promise<void>) }} options
 *   Called after a successful login/register. Where to go next is decided by the app layer.
 */
export function useAuthForm({ onAuthenticated }) {
  const auth = useAuthStore();

  const mode = ref(AUTH_MODES.LOGIN);
  const form = reactive(emptyForm());
  const touched = reactive({});
  const submitAttempted = ref(false);
  const submitting = ref(false);
  const formError = ref('');

  const validation = computed(() =>
    mode.value === AUTH_MODES.LOGIN
      ? validateLoginForm(form)
      : validateRegisterForm(form, REGISTER_ROLES),
  );

  /** Field errors that should be on screen: only touched fields, or all after a submit attempt. */
  const errors = computed(() => {
    const visible = {};
    for (const [field, message] of Object.entries(validation.value.errors)) {
      if (message && (submitAttempted.value || touched[field])) visible[field] = message;
    }
    return visible;
  });

  function touch(field) {
    touched[field] = true;
  }

  function resetFeedback() {
    for (const key of Object.keys(touched)) delete touched[key];
    submitAttempted.value = false;
    formError.value = '';
  }

  function setMode(next) {
    if (next === mode.value) return;
    mode.value = next;
    resetFeedback();
  }

  async function submit() {
    if (submitting.value) return;
    submitAttempted.value = true;
    formError.value = '';
    if (!validation.value.valid) return;

    submitting.value = true;
    try {
      const role =
        mode.value === AUTH_MODES.LOGIN
          ? await auth.login({ email: form.email, password: form.password })
          : await auth.register({ ...form });
      await onAuthenticated(role);
    } catch (error) {
      formError.value = authErrorMessage(error, mode.value);
    } finally {
      submitting.value = false;
    }
  }

  return {
    mode,
    form,
    errors,
    formError,
    submitting,
    roleOptions: REGISTER_ROLES,
    touch,
    setMode,
    submit,
  };
}
