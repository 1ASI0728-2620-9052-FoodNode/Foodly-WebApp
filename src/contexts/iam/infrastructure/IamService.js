import { httpClient as defaultClient } from '../../../shared/http/index.js';

/**
 * Every HTTP call to Foodly-IAM-Service (through Kong). Response shapes were verified against
 * AuthResponseResource and UserProfileResource.
 *
 * AuthResponse: { token, tokenType: 'Bearer', expiresAt (ISO-8601), userId, name, role }
 * UserProfile:  { id, name, email, username, phone | null, role }
 */
export class IamService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /** POST /iam/auth/register -> 201 AuthResponse (the user is already authenticated). */
  async register({ name, email, username, phone, password, role }) {
    const body = {
      name: name.trim(),
      email: email.trim(),
      username: username.trim(),
      password,
      role,
    };
    // An empty string fails IAM's @Pattern, so an absent phone must be omitted entirely.
    const cleanPhone = phone?.trim();
    if (cleanPhone) body.phone = cleanPhone;
    return toAuthResult(await this.client.post('/iam/auth/register', body));
  }

  /** POST /iam/auth/login -> 200 AuthResponse. */
  async login({ email, password }) {
    const data = await this.client.post('/iam/auth/login', { email: email.trim(), password });
    return toAuthResult(data);
  }

  /** GET /iam/users/me -> 200 UserProfile. Requires the Bearer token. */
  async getMe() {
    const data = await this.client.get('/iam/users/me');
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      username: data.username,
      phone: data.phone ?? null,
      role: data.role,
    };
  }
}

function toAuthResult(data) {
  if (!data?.token) throw new Error('IAM response has no token');
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    user: { id: data.userId, name: data.name, role: data.role },
  };
}

export const iamService = new IamService();
