export const GEO_ERRORS = Object.freeze({
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
  UNSUPPORTED: 'unsupported',
});

/**
 * Promise wrapper over navigator.geolocation.
 * Rejects with `{ code: GEO_ERRORS.* }` so callers never deal with GeolocationPositionError.
 */
export function getCurrentLocation({
  timeoutMs = 10_000,
  geolocation = globalThis.navigator?.geolocation,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject({ code: GEO_ERRORS.UNSUPPORTED });
      return;
    }
    geolocation.getCurrentPosition(
      (position) =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => {
        const code =
          error.code === 1
            ? GEO_ERRORS.DENIED
            : error.code === 3
              ? GEO_ERRORS.TIMEOUT
              : GEO_ERRORS.UNAVAILABLE;
        reject({ code });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
