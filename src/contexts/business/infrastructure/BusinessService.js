import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { EMPTY_MENU, toHuarique, toImages, toMenu } from '../domain/huarique.js';

const BASE = '/business-api/huariques';
const UPLOAD_TIMEOUT_MS = 60_000; // images go up to 5 MB

/**
 * Every HTTP call to Foodly-Business-Service (through Kong, prefix /business-api).
 *
 * Concurrency: huariques and menus carry a `version`. Every write that changes them must send the
 * version it last read and answers 409 when it is stale. Write methods return the normalized
 * resource WITH its new version so the caller can keep it.
 */
export class BusinessService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  // --- reads ----------------------------------------------------------------------------------

  /**
   * GET /business-api/huariques/me -> the owner's huarique, or null when the owner has not
   * registered one yet (the API answers 404).
   */
  async getMyHuarique() {
    try {
      return toHuarique(await this.client.get(`${BASE}/me`));
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

  // --- huarique writes ------------------------------------------------------------------------

  /** POST /business-api/huariques (Requests.Profile). Always created CLOSED. 409: owner already has one. */
  async registerHuarique(profile) {
    return toHuarique(await this.client.post(BASE, profile));
  }

  /** PUT /business-api/huariques/{id} (Requests.Profile, `version` required). */
  async updateHuarique(id, profile, version) {
    return toHuarique(
      await this.client.put(`${BASE}/${encodeURIComponent(id)}`, { ...profile, version }),
    );
  }

  /** PATCH /business-api/huariques/{id}/open-status { openStatus: 'OPEN'|'CLOSED', version } */
  async setOpenStatus(id, openStatus, version) {
    return toHuarique(
      await this.client.patch(`${BASE}/${encodeURIComponent(id)}/open-status`, {
        openStatus,
        version,
      }),
    );
  }

  // --- menu writes ----------------------------------------------------------------------------

  /**
   * PUT /business-api/huariques/{id}/menu (Requests.MenuBody).
   * The first time (menu does not exist) `version` must be OMITTED; afterwards it is required.
   */
  async replaceMenu(id, categories, version) {
    const body = { categories };
    if (version !== null && version !== undefined) body.version = version;
    return toMenu(await this.client.put(`${BASE}/${encodeURIComponent(id)}/menu`, body));
  }

  /** PATCH .../menu/dishes/{dishId}/price { price, version } (menu version) */
  async setDishPrice(id, dishId, price, version) {
    return toMenu(
      await this.client.patch(`${BASE}/${encodeURIComponent(id)}/menu/dishes/${dishId}/price`, {
        price,
        version,
      }),
    );
  }

  /** PATCH .../menu/dishes/{dishId}/availability { available, version } (menu version) */
  async setDishAvailability(id, dishId, available, version) {
    return toMenu(
      await this.client.patch(
        `${BASE}/${encodeURIComponent(id)}/menu/dishes/${dishId}/availability`,
        {
          available,
          version,
        },
      ),
    );
  }

  // --- images (ImageController) ---------------------------------------------------------------
  // The image endpoints answer only { id, url }, NOT the new huarique/menu version: after an image
  // change the caller must read the resource again to get the version.

  #imagesPath(id, dishId) {
    const base = `${BASE}/${encodeURIComponent(id)}`;
    return dishId ? `${base}/menu/dishes/${dishId}/images` : `${base}/images`;
  }

  /** POST multipart `file` (PNG/JPEG/WebP, max 5 MB). With `replaceId` it PUTs over that image. */
  async uploadImage(id, file, { dishId = null, replaceId = null } = {}) {
    const form = new FormData();
    form.append('file', file);
    const path = this.#imagesPath(id, dishId);
    const options = { timeoutMs: UPLOAD_TIMEOUT_MS };
    const data = replaceId
      ? await this.client.put(`${path}/${replaceId}`, form, options)
      : await this.client.post(path, form, options);
    return toImages([data])[0];
  }

  /** DELETE .../images/{imageId} */
  async deleteImage(id, imageId, { dishId = null } = {}) {
    await this.client.delete(`${this.#imagesPath(id, dishId)}/${imageId}`);
  }
}

export const businessService = new BusinessService();
