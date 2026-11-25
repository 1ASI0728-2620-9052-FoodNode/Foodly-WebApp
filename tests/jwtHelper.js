// Builds an unsigned JWT-shaped string for tests. The web app never verifies signatures.
const encode = (value) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function makeToken({
  role = 'GASTRONOMIC_EXPLORER',
  expiresInSeconds = 3600,
  sub = 'user-1',
} = {}) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role, iat: exp - 3600, exp })}.signature`;
}
