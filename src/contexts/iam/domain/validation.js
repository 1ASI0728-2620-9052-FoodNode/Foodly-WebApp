/**
 * Client-side mirror of the rules enforced by Foodly-IAM-Service:
 * RegisterUserResource / LoginResource (Jakarta Bean Validation) and the value objects
 * Email, Username and PhoneNumber. Keep both sides in sync when IAM changes.
 *
 * Each validator returns an error message in Spanish, or '' when the value is valid.
 */

export const NAME_MAX_LENGTH = 150;
export const EMAIL_MAX_LENGTH = 254;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
export const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

// Same expression as the Email value object.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value) {
  const name = (value ?? '').trim();
  if (!name) return 'Ingresa tu nombre.';
  if (name.length > NAME_MAX_LENGTH) return `El nombre admite hasta ${NAME_MAX_LENGTH} caracteres.`;
  return '';
}

export function validateEmail(value) {
  const email = (value ?? '').trim();
  if (!email) return 'Ingresa tu correo electrónico.';
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    return 'Ingresa un correo electrónico válido.';
  }
  return '';
}

export function validateUsername(value) {
  const username = (value ?? '').trim();
  if (!username) return 'Ingresa un nombre de usuario.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Usa de 3 a 30 letras, números o guiones bajos (sin espacios).';
  }
  return '';
}

/** Phone is optional; an empty value is valid and must not be sent to the API. */
export function validatePhone(value) {
  const phone = (value ?? '').trim();
  if (!phone) return '';
  if (!PHONE_PATTERN.test(phone)) {
    return 'Ingresa de 9 a 15 dígitos, con "+" opcional al inicio.';
  }
  return '';
}

/**
 * IAM checks 8-72 characters. BCrypt additionally truncates/rejects beyond 72 BYTES, so a
 * password with accents or emoji could pass the character count and still fail on the server.
 */
export function validatePassword(value) {
  const password = value ?? '';
  if (!password) return 'Ingresa tu contraseña.';
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return 'La contraseña es demasiado larga; evita demasiados acentos o símbolos especiales.';
  }
  return '';
}

/** Login only requires a non-empty password (LoginResource has @NotBlank and nothing else). */
export function validateLoginPassword(value) {
  return (value ?? '').trim() ? '' : 'Ingresa tu contraseña.';
}

export function validateRole(value, allowedRoles) {
  return allowedRoles.includes(value) ? '' : 'Elige un perfil.';
}

export function validateLoginForm(form) {
  const errors = {
    email: validateEmail(form.email),
    password: validateLoginPassword(form.password),
  };
  return { errors, valid: Object.values(errors).every((message) => !message) };
}

export function validateRegisterForm(form, allowedRoles) {
  const errors = {
    role: validateRole(form.role, allowedRoles),
    name: validateName(form.name),
    email: validateEmail(form.email),
    username: validateUsername(form.username),
    phone: validatePhone(form.phone),
    password: validatePassword(form.password),
  };
  return { errors, valid: Object.values(errors).every((message) => !message) };
}
