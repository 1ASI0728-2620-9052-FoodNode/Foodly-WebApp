import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { EMPTY_MENU, toHuarique, toMenu } from '../domain/huarique.js';

const BASE = '/business-api/huariques';

/** Every HTTP call to Foodly-Business-Service (through Kong, prefix /business-api). */
export class BusinessService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /**
   * GET /business-api/huariques/me -> the owner's huarique, or null when the owner has not
   * registered one yet (the API answers 404).
   */
  async getMyHuarique() {
    try {
      return await this.client.get(`${BASE}/me`);
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  /** GET /business-api/huariques/{id} -> normalized huarique. A 404 propagates as HttpError. */
  async getHuarique(id) {
    return toHuarique(await this.client.get(`${BASE}/${encodeURIComponent(id)}`));
  }

  /** GET /business-api/huariques/{id}/menu -> normalized menu; a huarique without menu yields an empty one. */
  async getMenu(id) {
    try {
      return toMenu(await this.client.get(`${BASE}/${encodeURIComponent(id)}/menu`));
    } catch (error) {
      if (error?.status === 404) return EMPTY_MENU;
      throw error;
    }
  }
}

export const businessService = new BusinessService();
