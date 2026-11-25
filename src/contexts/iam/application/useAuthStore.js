import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { iamService } from '../infrastructure/IamService.js';
import { sessionTokenStorage } from '../infrastructure/sessionTokenStorage.js';
import { isExpired, readTokenClaims } from '../domain/session.js';
import { ROLES } from '../domain/roles.js';

// setTimeout stores its delay in a signed 32-bit integer; larger values fire immediately.
const MAX_TIMER_MS = 2 ** 31 - 1;

export const LOGOUT_REASONS = Object.freeze({
  EXPIRED: 'expired',
  UNAUTHORIZED: 'unauthorized',
});

/**
 * Session store.
 *
 * Token storage trade-off: the JWT lives in `sessionStorage` (and in memory).
 * + Cleared when the tab closes and never shared across tabs, so a forgotten session does not
 *   survive on a shared computer.
 * + Survives a page reload, which an in-memory-only token would not.
 * - Readable by any script running on the page, so an XSS bug exposes the token. An httpOnly
 *   cookie would avoid that but needs IAM changes (cookie issuing, CSRF protection) and is
 *   not part of the current contract (IAM returns the token in the JSON body).
 * Mitigations: no `v-html` with user data, a strict CSP when deployed, and a short token
 * lifetime plus automatic logout on `exp`. Do not move the token to `localStorage` without a
 * team decision.
 *
 * The JWT is decoded only to read `role` and `exp`; the signature is validated by the backend.
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref(null);
  const role = ref(null);
  const expiresAtMs = ref(null);
  const profile = ref(null);
  const logoutReason = ref(null);
  let expiryTimer = null;

  const isAuthenticated = computed(() => Boolean(token.value && role.value));
  const isOwner = computed(() => role.value === ROLES.OWNER);
  const isExplorer = computed(() => role.value === ROLES.EXPLORER);

  function clearTimer() {
    if (expiryTimer !== null) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function scheduleExpiry() {
    clearTimer();
    if (expiresAtMs.value === null) return;
    const delay = Math.min(Math.max(expiresAtMs.value - Date.now(), 0), MAX_TIMER_MS);
    expiryTimer = setTimeout(() => {
      // A clamped timer fires early for very distant expirations: re-check before closing.
      if (!ensureValidSession()) return;
      scheduleExpiry();
    }, delay);
  }

  /** Returns false (and leaves the store logged out) if the token is unreadable or expired. */
  function applyToken(newToken) {
    const claims = readTokenClaims(newToken);
    if (!claims || isExpired(claims.expiresAtMs)) {
      clearSession();
      return false;
    }
    token.value = newToken;
    role.value = claims.role;
    expiresAtMs.value = claims.expiresAtMs;
    logoutReason.value = null;
    sessionTokenStorage.save(newToken);
    scheduleExpiry();
    return true;
  }

  function clearSession() {
    clearTimer();
    token.value = null;
    role.value = null;
    expiresAtMs.value = null;
    profile.value = null;
    sessionTokenStorage.clear();
  }

  async function establishSession(result) {
    if (!applyToken(result.token)) {
      throw new Error('IAM returned an unreadable or expired token');
    }
    profile.value = { ...result.user, role: role.value };
    try {
      profile.value = await iamService.getMe();
    } catch {
      // The login itself succeeded; keep the minimal profile from the auth response.
    }
    return role.value;
  }

  /** @returns {Promise<string>} the authenticated role */
  async function login(credentials) {
    return establishSession(await iamService.login(credentials));
  }

  /** @returns {Promise<string>} the authenticated role (register already returns a token) */
  async function register(data) {
    return establishSession(await iamService.register(data));
  }

  /** Rebuilds the session from sessionStorage after a page reload. */
  async function restore() {
    const saved = sessionTokenStorage.load();
    if (!saved) return false;
    if (!applyToken(saved)) return false;
    try {
      profile.value = await iamService.getMe();
    } catch {
      // A 401 already logged us out through the HTTP client; other errors keep the session.
    }
    return isAuthenticated.value;
  }

  /** Logs out when the token has expired. Cheap enough to call from every navigation. */
  function ensureValidSession(now = Date.now()) {
    if (token.value && expiresAtMs.value !== null && isExpired(expiresAtMs.value, now)) {
      logout(LOGOUT_REASONS.EXPIRED);
    }
    return isAuthenticated.value;
  }

  function logout(reason = null) {
    clearSession();
    logoutReason.value = reason;
  }

  function consumeLogoutReason() {
    const reason = logoutReason.value;
    logoutReason.value = null;
    return reason;
  }

  return {
    token,
    role,
    expiresAtMs,
    profile,
    logoutReason,
    isAuthenticated,
    isOwner,
    isExplorer,
    login,
    register,
    restore,
    ensureValidSession,
    logout,
    consumeLogoutReason,
  };
});
