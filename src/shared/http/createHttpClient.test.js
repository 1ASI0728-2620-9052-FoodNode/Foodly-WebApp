import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './createHttpClient.js';
import { HttpError } from './HttpError.js';

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(fetchImpl, options = {}) {
  return createHttpClient({ baseUrl: 'http://gateway', fetchImpl, ...options });
}

describe('createHttpClient', () => {
  it('prefixes the base URL, serializes JSON and sets the content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const result = await setup(fetchImpl).post('/iam/auth/login', { email: 'a@b.co' });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://gateway/iam/auth/login');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"a@b.co"}');
  });

  it('adds the Bearer token only when there is one', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => jsonResponse(200, {}));
    const anonymous = setup(fetchImpl);
    const authenticated = setup(fetchImpl, { getToken: () => 'jwt-123' });

    await anonymous.get('/x');
    await authenticated.get('/x');

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer jwt-123');
  });

  it('builds the query string skipping empty values', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    await setup(fetchImpl).get('/radar/search', {
      query: { q: 'ceviche', page: 0, empty: '', nil: null },
    });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://gateway/radar/search?q=ceviche&page=0');
  });

  it('returns null for 204 responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await setup(fetchImpl).delete('/x')).toBeNull();
  });

  it.each([
    [400, /no son válidos/],
    [401, /sesión/],
    [403, /permiso/],
    [404, /No encontramos/],
    [409, /conflicto/],
    [500, /no está disponible/],
    [503, /no está disponible/],
  ])('maps status %i to a Spanish message', async (status, pattern) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(status, { message: 'English detail' }));
    const error = await setup(fetchImpl)
      .get('/x')
      .catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(status);
    expect(error.message).toMatch(pattern);
    expect(error.serverMessage).toBe('English detail');
  });

  it('calls onUnauthorized on a 401 when a token was sent', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'expired' }));
    const client = setup(fetchImpl, { getToken: () => 'jwt', onUnauthorized });

    await expect(client.get('/iam/users/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat a 401 without token (bad login) as an expired session', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: 'Invalid credentials' }));
    const client = setup(fetchImpl, { onUnauthorized });

    await expect(client.post('/iam/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not call onUnauthorized for other errors', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, {}));
    const client = setup(fetchImpl, { getToken: () => 'jwt', onUnauthorized });

    await expect(client.get('/x')).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('turns a network failure into a Spanish HttpError with status 0', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await setup(fetchImpl)
      .get('/x')
      .catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 0, kind: 'network' });
    expect(error.message).toMatch(/conectarnos/);
  });

  it('aborts and reports a timeout when the server takes too long', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );
      const pending = setup(fetchImpl, { timeoutMs: 1000 })
        .get('/slow')
        .catch((e) => e);

      await vi.advanceTimersByTimeAsync(1000);
      const error = await pending;

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 0, kind: 'timeout' });
      expect(error.message).toMatch(/tardó demasiado/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets configure() wire the token provider after creation', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = setup(fetchImpl);
    client.configure({ getToken: () => 'late-token' });

    await client.get('/x');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer late-token');
  });
});
