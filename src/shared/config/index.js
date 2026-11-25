const env = import.meta.env;

const isTrue = (value) => String(value).toLowerCase() === 'true';

/**
 * Base URL for every HTTP call.
 * - Development: empty string, so requests are same-origin and Vite proxies them to Kong.
 * - Production build: the gateway URL from VITE_API_GATEWAY_URL.
 */
export const API_BASE_URL = env.DEV ? '' : (env.VITE_API_GATEWAY_URL || '').replace(/\/+$/, '');

export const HTTP_TIMEOUT_MS = 10_000;

export const MOCK_RESERVATION = isTrue(env.VITE_MOCK_RESERVATION);
export const MOCK_COMMUNITY = isTrue(env.VITE_MOCK_COMMUNITY);
