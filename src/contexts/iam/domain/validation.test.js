import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateLoginForm,
  validateName,
  validatePassword,
  validatePhone,
  validateRegisterForm,
  validateUsername,
} from './validation.js';
import { ROLES } from './roles.js';

const ROLE_LIST = [ROLES.EXPLORER, ROLES.OWNER];

const validRegistration = () => ({
  role: ROLES.OWNER,
  name: 'Ana Pérez',
  email: 'ana@foodly.pe',
  username: 'ana_perez',
  phone: '',
  password: 'secret123',
});

describe('validateEmail (Email value object)', () => {
  it.each(['ana@foodly.pe', ' ANA@Foodly.PE ', 'a.b+c@sub.dominio.com'])('accepts %s', (value) => {
    expect(validateEmail(value)).toBe('');
  });

  it.each(['', '   ', 'ana', 'ana@foodly', '@foodly.pe', 'a na@foodly.pe', 'a@@b.co'])(
    'rejects "%s"',
    (value) => {
      expect(validateEmail(value)).not.toBe('');
    },
  );

  it('rejects emails longer than 254 characters', () => {
    expect(validateEmail(`${'a'.repeat(250)}@b.co`)).not.toBe('');
  });
});

describe('validateUsername', () => {
  it.each(['abc', 'Ana_01', 'a'.repeat(30)])('accepts %s', (value) => {
    expect(validateUsername(value)).toBe('');
  });

  it.each(['', 'ab', 'a'.repeat(31), 'ana perez', 'ana-perez', 'añana', 'ana@'])(
    'rejects "%s"',
    (value) => {
      expect(validateUsername(value)).not.toBe('');
    },
  );
});

describe('validatePhone (optional)', () => {
  it.each(['', '   ', '987654321', '+51987654321', '123456789012345'])('accepts "%s"', (value) => {
    expect(validatePhone(value)).toBe('');
  });

  it.each(['12345678', '1234567890123456', '+', '++51987654321', '987 654 321', 'abc123456789'])(
    'rejects "%s"',
    (value) => {
      expect(validatePhone(value)).not.toBe('');
    },
  );
});

describe('validatePassword', () => {
  it('accepts 8 to 72 characters', () => {
    expect(validatePassword('12345678')).toBe('');
    expect(validatePassword('a'.repeat(72))).toBe('');
  });

  it('rejects empty, too short and too long', () => {
    expect(validatePassword('')).not.toBe('');
    expect(validatePassword('1234567')).not.toBe('');
    expect(validatePassword('a'.repeat(73))).not.toBe('');
  });

  it('rejects multibyte passwords above 72 bytes even if under 72 characters (BCrypt limit)', () => {
    expect(validatePassword('ñ'.repeat(40))).not.toBe('');
  });
});

describe('validateName', () => {
  it('requires a non-blank name up to 150 characters', () => {
    expect(validateName('Ana')).toBe('');
    expect(validateName('   ')).not.toBe('');
    expect(validateName('a'.repeat(151))).not.toBe('');
  });
});

describe('validateLoginForm', () => {
  it('is valid with a proper email and any non-blank password', () => {
    expect(validateLoginForm({ email: 'ana@foodly.pe', password: 'x' }).valid).toBe(true);
  });

  it('reports each invalid field', () => {
    const { valid, errors } = validateLoginForm({ email: 'nope', password: '' });
    expect(valid).toBe(false);
    expect(errors.email).not.toBe('');
    expect(errors.password).not.toBe('');
  });
});

describe('validateRegisterForm', () => {
  it('accepts a complete form without phone', () => {
    expect(validateRegisterForm(validRegistration(), ROLE_LIST).valid).toBe(true);
  });

  it('accepts a form with a valid phone', () => {
    expect(
      validateRegisterForm({ ...validRegistration(), phone: '+51987654321' }, ROLE_LIST).valid,
    ).toBe(true);
  });

  it('rejects an unknown role', () => {
    const { valid, errors } = validateRegisterForm(
      { ...validRegistration(), role: 'ADMIN' },
      ROLE_LIST,
    );
    expect(valid).toBe(false);
    expect(errors.role).not.toBe('');
  });

  it('collects every error at once', () => {
    const { valid, errors } = validateRegisterForm(
      { role: '', name: '', email: 'x', username: 'x', phone: '1', password: '1' },
      ROLE_LIST,
    );
    expect(valid).toBe(false);
    expect(Object.values(errors).every(Boolean)).toBe(true);
  });
});
