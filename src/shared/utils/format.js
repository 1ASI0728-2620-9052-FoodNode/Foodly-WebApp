export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatSoles(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  return `S/ ${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

export function formatPriceRange(min, max) {
  return min === max ? formatSoles(min) : `${formatSoles(min)} – ${formatSoles(max)}`;
}
