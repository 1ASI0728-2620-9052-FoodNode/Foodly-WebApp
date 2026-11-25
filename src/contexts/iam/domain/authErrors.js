/**
 * Turns an HttpError from the IAM endpoints into the message shown inside the auth form.
 * IAM answers `{ "message": "<english text>" }`; the form never shows that text.
 *
 * @param {{ status?: number, message?: string }} error
 * @param {'login' | 'register'} mode
 */
export function authErrorMessage(error, mode) {
  switch (error?.status) {
    case 409:
      // IAM returns the same text for a duplicated email or username.
      return 'El correo electrónico o el nombre de usuario ya están registrados.';
    case 401:
      return 'Correo o contraseña incorrectos.';
    case 400:
      return mode === 'register'
        ? 'Algunos datos no son válidos. Revisa el formulario e inténtalo de nuevo.'
        : 'El correo o la contraseña no tienen un formato válido.';
    default:
      return error?.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
}
