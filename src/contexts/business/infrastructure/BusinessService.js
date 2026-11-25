import { httpClient as defaultClient } from '../../../shared/http/index.js';

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
      return await this.client.get('/business-api/huariques/me');
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }
}

export const businessService = new BusinessService();
