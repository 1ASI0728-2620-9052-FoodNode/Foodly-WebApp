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

/** 'YYYY-MM-DD' -> "martes, 24 de noviembre" (local date, no timezone shift). */
export function formatDateLong(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day));
}
