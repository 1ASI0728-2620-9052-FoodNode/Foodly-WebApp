import { httpClient as defaultClient } from '../../../shared/http/index.js';

/**
 * Every HTTP call to Foodly-Radar-Service (through Kong, prefix /radar).
 * Requires a GASTRONOMIC_EXPLORER token.
 */
export class RadarService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /**
   * POST /radar/search { latitude, longitude, kRing } -> RadarSearchResultResource
   * { huariques: [{ huariqueId, latitude, longitude, distanceMeters }], total }, sorted by distance.
   * Radar returns only active huariques and no names or open/closed state; Business has those.
   */
  async search({ latitude, longitude, kRing }) {
    const data = await this.client.post('/radar/search', { latitude, longitude, kRing });
    return (data?.huariques ?? []).map((item) => ({
      huariqueId: item.huariqueId,
      latitude: item.latitude,
      longitude: item.longitude,
      distanceMeters: item.distanceMeters,
    }));
  }
}

export const radarService = new RadarService();
