import { describe, expect, it, vi } from 'vitest';
import { IamService } from './IamService.js';

const authResponse = {
  token: 'jwt',
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  userId: 'u1',
  name: 'Ana',
  role: 'GASTRONOMIC_EXPLORER',
};

describe('IamService', () => {
  it('registers trimming fields and omitting an empty phone', async () => {
    const client = { post: vi.fn().mockResolvedValue(authResponse) };
    const result = await new IamService(client).register({
      name: ' Ana ',
      email: ' ana@foodly.pe ',
      username: ' ana ',
      phone: '  ',
      password: ' secret123 ',
      role: 'GASTRONOMIC_EXPLORER',
    });

    const [path, body] = client.post.mock.calls[0];
    expect(path).toBe('/iam/auth/register');
    expect(body).toEqual({
      name: 'Ana',
      email: 'ana@foodly.pe',
      username: 'ana',
      password: ' secret123 ', // passwords are never altered
      role: 'GASTRONOMIC_EXPLORER',
    });
    expect(body).not.toHaveProperty('phone');
    expect(result).toEqual({
      token: 'jwt',
      expiresAt: '2030-01-01T00:00:00Z',
      user: { id: 'u1', name: 'Ana', role: 'GASTRONOMIC_EXPLORER' },
    });
  });

  it('sends the phone when provided', async () => {
    const client = { post: vi.fn().mockResolvedValue(authResponse) };
    await new IamService(client).register({
      name: 'Ana',
      email: 'a@b.co',
      username: 'ana',
      phone: '+51987654321',
      password: 'secret123',
      role: 'HUARIQUE_OWNER',
    });
    expect(client.post.mock.calls[0][1].phone).toBe('+51987654321');
  });

  it('logs in against /iam/auth/login', async () => {
    const client = { post: vi.fn().mockResolvedValue(authResponse) };
    await new IamService(client).login({ email: ' ana@foodly.pe ', password: 'secret123' });
    expect(client.post).toHaveBeenCalledWith('/iam/auth/login', {
      email: 'ana@foodly.pe',
      password: 'secret123',
    });
  });

  it('fails when IAM returns no token', async () => {
    const client = { post: vi.fn().mockResolvedValue({}) };
    await expect(
      new IamService(client).login({ email: 'a@b.co', password: 'x' }),
    ).rejects.toThrow();
  });

  it('reads the profile from /iam/users/me and defaults a missing phone to null', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 'u1',
        name: 'Ana',
        email: 'ana@foodly.pe',
        username: 'ana',
        role: 'GASTRONOMIC_EXPLORER',
      }),
    };
    const profile = await new IamService(client).getMe();
    expect(client.get).toHaveBeenCalledWith('/iam/users/me');
    expect(profile.phone).toBeNull();
  });
});
