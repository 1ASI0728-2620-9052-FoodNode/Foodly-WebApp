import { decodeJwtPayload } from '../../../shared/utils/jwt.js';
import { normalizeRole } from './roles.js';

/**
 * Reads the only claims the web app cares about. IAM issues `sub`, `role`, `iat`, `exp`.
 * Returns null when the token is malformed, has no valid role or no expiry: such a token is
 * treated as no session at all.
 */
export function readTokenClaims(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const role = normalizeRole(payload.role);
  const exp = Number(payload.exp);
  if (!role || !Number.isFinite(exp)) return null;
  return { role, userId: payload.sub ?? null, expiresAtMs: exp * 1000 };
}

export function isExpired(expiresAtMs, now = Date.now()) {
  return expiresAtMs <= now;
}
