import { distanceMeters } from './distance.js';

/** Lima districts offered when the user does not share the location. Fixed centroids. */
export const DISTRICTS = Object.freeze([
  { id: 'miraflores', name: 'Miraflores', latitude: -12.1219, longitude: -77.0297 },
  { id: 'barranco', name: 'Barranco', latitude: -12.1497, longitude: -77.0219 },
  { id: 'surquillo', name: 'Surquillo', latitude: -12.1119, longitude: -77.0111 },
  { id: 'lince', name: 'Lince', latitude: -12.0847, longitude: -77.0364 },
  { id: 'cercado', name: 'Cercado de Lima', latitude: -12.0464, longitude: -77.0428 },
]);

/** A huarique farther than this from every centroid is not assigned to a district. */
const MAX_DISTRICT_DISTANCE_M = 3000;

export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function findDistrict(id) {
  return DISTRICTS.find((district) => district.id === id) ?? null;
}

/**
 * District of a huarique: first by name found in its address, then by nearest centroid
 * (Business stores only a free-text address, there is no district field).
 * @returns {string|null} district id
 */
export function districtOf({ address, location }) {
  const text = normalizeText(address);
  const byAddress = DISTRICTS.find((d) =>
    text.includes(normalizeText(d.id === 'cercado' ? 'Cercado' : d.name)),
  );
  if (byAddress) return byAddress.id;
  if (!location) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const district of DISTRICTS) {
    const meters = distanceMeters(location, district);
    if (meters < bestDistance) {
      best = district;
      bestDistance = meters;
    }
  }
  return bestDistance <= MAX_DISTRICT_DISTANCE_M ? best.id : null;
}
