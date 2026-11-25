const STORAGE_KEY = 'foodly.session.token';

/**
 * Persists only the JWT, in sessionStorage. Storage access can throw (private mode, blocked
 * site data), so every call is guarded and the app keeps working with an in-memory session.
 */
export const sessionTokenStorage = {
  load() {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  save(token) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* in-memory session only */
    }
  },
  clear() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
