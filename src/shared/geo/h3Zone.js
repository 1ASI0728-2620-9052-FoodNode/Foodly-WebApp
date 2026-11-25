import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

/** Same resolution Foodly-Radar-Service indexes with (RADAR_H3_RESOLUTION, default 9). */
export const H3_RESOLUTION = 9;

/**
 * Coverage zone of a search: the user's cell plus `kRing` rings around it.
 * @returns {{ origin: string, cells: string[], polygons: { id: string, isOrigin: boolean, latLngs: number[][] }[] }}
 */
export function buildCoverage({ latitude, longitude }, kRing) {
  const origin = latLngToCell(latitude, longitude, H3_RESOLUTION);
  const cells = gridDisk(origin, kRing);
  return {
    origin,
    cells,
    polygons: cells.map((id) => ({ id, isOrigin: id === origin, latLngs: cellToBoundary(id) })),
  };
}

export function cellOf({ latitude, longitude }) {
  return latLngToCell(latitude, longitude, H3_RESOLUTION);
}
