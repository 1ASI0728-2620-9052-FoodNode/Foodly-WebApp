import { HttpError, NETWORK_MESSAGES, messageForStatus } from './HttpError.js';

const DEFAULT_TIMEOUT_MS = 10_000;

function buildUrl(baseUrl, path, query) {
  const base = (baseUrl || '').replace(/\/+$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractServerMessage(data) {
  if (data && typeof data === 'object' && typeof data.message === 'string') return data.message;
  return typeof data === 'string' ? data : null;
}

/**
 * Builds a fetch based JSON client.
 *
 * - Sends `Authorization: Bearer <token>` when `getToken()` returns a token.
 * - Aborts after `timeoutMs`.
 * - Maps 400/401/403/404/409/5xx to Spanish messages (see HttpError.js).
 * - On a 401 to a request that carried a token, calls `onUnauthorized()`. A 401 from a request
 *   without a token (login with bad credentials) is a normal answer, not an expired session.
 *
 * `configure()` lets the app wire the token provider and the 401 handler after creation,
 * so `shared` never imports from a bounded context.
 */
export function createHttpClient({
  baseUrl = '',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  getToken = () => null,
  onUnauthorized = () => {},
  fetchImpl,
} = {}) {
  const state = { baseUrl, timeoutMs, getToken, onUnauthorized };

  async function request(method, path, { body, query, headers, signal, timeoutMs } = {}) {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    const token = state.getToken();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs ?? state.timeoutMs);
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const init = {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // FormData sets its own multipart boundary: never force a content type on it.
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
    };

    let response;
    try {
      response = await doFetch(buildUrl(state.baseUrl, path, query), init);
    } catch (cause) {
      clearTimeout(timer);
      if (timedOut) {
        throw new HttpError({ status: 0, kind: 'timeout', message: NETWORK_MESSAGES.timeout });
      }
      if (cause?.name === 'AbortError') throw cause; // aborted by the caller
      throw new HttpError({ status: 0, kind: 'network', message: NETWORK_MESSAGES.network });
    }

    try {
      const data = await parseBody(response);
      if (response.ok) return data;

      const error = new HttpError({
        status: response.status,
        message: messageForStatus(response.status),
        serverMessage: extractServerMessage(data),
        data,
      });
      if (response.status === 401 && token) state.onUnauthorized(error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    configure(options = {}) {
      if (options.baseUrl !== undefined) state.baseUrl = options.baseUrl;
      if (options.timeoutMs !== undefined) state.timeoutMs = options.timeoutMs;
      if (options.getToken) state.getToken = options.getToken;
      if (options.onUnauthorized) state.onUnauthorized = options.onUnauthorized;
    },
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  };
}
