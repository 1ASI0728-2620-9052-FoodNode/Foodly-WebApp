import { API_BASE_URL, HTTP_TIMEOUT_MS } from '../config/index.js';
import { createHttpClient } from './createHttpClient.js';

export { HttpError } from './HttpError.js';
export { createHttpClient } from './createHttpClient.js';

/** App-wide client. The token provider and 401 handler are wired in `src/app/bootstrap.js`. */
export const httpClient = createHttpClient({ baseUrl: API_BASE_URL, timeoutMs: HTTP_TIMEOUT_MS });
