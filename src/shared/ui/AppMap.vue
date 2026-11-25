<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Thin Leaflet wrapper (OpenStreetMap tiles). Vue owns the data, Leaflet only draws it.
 * Markers use CSS pins (divIcon) so no image assets are needed.
 *
 * markers:   [{ id, latitude, longitude, kind: 'user'|'huarique', label, draggable?, selected? }]
 * polygons:  [{ id, latLngs: [[lat, lng], ...], highlight? }]
 * polylines: [{ id, latLngs }]
 * `fitToken` changes => the view fits all drawn shapes (use it when a new search arrives).
 */
const props = defineProps({
  center: { type: Object, required: true }, // { latitude, longitude }
  zoom: { type: Number, default: 15 },
  markers: { type: Array, default: () => [] },
  polygons: { type: Array, default: () => [] },
  polylines: { type: Array, default: () => [] },
  fitToken: { type: [Number, String], default: 0 },
  interactive: { type: Boolean, default: true },
  clickable: { type: Boolean, default: false },
  ariaLabel: { type: String, default: 'Mapa' },
});

const emit = defineEmits(['marker-click', 'marker-drag', 'map-click']);

const el = ref(null);
const map = shallowRef(null);
let layer = null;
let resizeObserver = null;

function pinIcon(marker) {
  const classes = ['foodly-pin', `foodly-pin--${marker.kind}`];
  if (marker.selected) classes.push('foodly-pin--selected');
  return L.divIcon({
    className: 'foodly-pin-wrapper',
    html: `<span class="${classes.join(' ')}"></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function draw() {
  if (!map.value) return;
  layer.clearLayers();

  for (const polygon of props.polygons) {
    L.polygon(polygon.latLngs, {
      color: '#964100',
      weight: polygon.highlight ? 3 : 1,
      fillColor: '#964100',
      fillOpacity: polygon.highlight ? 0.22 : 0.07,
      interactive: false,
    }).addTo(layer);
  }
  for (const line of props.polylines) {
    L.polyline(line.latLngs, { color: '#492906', weight: 4, dashArray: '8 8' }).addTo(layer);
  }
  for (const marker of props.markers) {
    const leafletMarker = L.marker([marker.latitude, marker.longitude], {
      icon: pinIcon(marker),
      title: marker.label,
      alt: marker.label,
      keyboard: true,
      draggable: Boolean(marker.draggable),
      zIndexOffset: marker.selected ? 1000 : marker.kind === 'user' ? 500 : 0,
    }).addTo(layer);
    leafletMarker.on('click', () => emit('marker-click', marker.id));
    if (marker.draggable) {
      leafletMarker.on('dragend', () => {
        const { lat, lng } = leafletMarker.getLatLng();
        emit('marker-drag', { id: marker.id, latitude: lat, longitude: lng });
      });
    }
  }
}

function fit() {
  if (!map.value) return;
  const points = [
    ...props.polygons.flatMap((p) => p.latLngs),
    ...props.polylines.flatMap((p) => p.latLngs),
    ...props.markers.map((m) => [m.latitude, m.longitude]),
  ];
  if (points.length > 1) {
    map.value.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
  }
}

function recenter() {
  if (!map.value) return;
  const target = L.latLng(props.center.latitude, props.center.longitude);
  if (!map.value.getBounds().contains(target)) map.value.panTo(target);
}

onMounted(() => {
  map.value = L.map(el.value, {
    center: [props.center.latitude, props.center.longitude],
    zoom: props.zoom,
    dragging: props.interactive,
    scrollWheelZoom: props.interactive,
    doubleClickZoom: props.interactive,
    touchZoom: props.interactive,
    keyboard: props.interactive,
    zoomControl: props.interactive,
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map.value);
  layer = L.layerGroup().addTo(map.value);
  if (props.clickable) {
    map.value.on('click', (event) =>
      emit('map-click', { latitude: event.latlng.lat, longitude: event.latlng.lng }),
    );
  }
  draw();
  fit();
  resizeObserver = new ResizeObserver(() => map.value?.invalidateSize());
  resizeObserver.observe(el.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  map.value?.remove();
  map.value = null;
});

watch(() => [props.markers, props.polygons, props.polylines], draw, { deep: true });
watch(() => props.fitToken, fit);
watch(() => [props.center.latitude, props.center.longitude], recenter);
</script>

<template>
  <div ref="el" class="app-map" role="region" :aria-label="ariaLabel" />
</template>

<style scoped>
.app-map {
  width: 100%;
  height: 100%;
  min-height: 220px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  z-index: 0;
}
</style>

<style>
.foodly-pin-wrapper {
  background: none;
  border: 0;
}

.foodly-pin {
  display: block;
  width: 28px;
  height: 28px;
  margin: 3px;
  border: 3px solid #fff;
  border-radius: 50% 50% 50% 0;
  background: #964100;
  box-shadow: 0 2px 6px rgb(73 41 6 / 40%);
  transform: rotate(-45deg);
}

.foodly-pin--user {
  background: #0b57d0;
}

.foodly-pin--selected {
  background: #ff8a00;
  transform: rotate(-45deg) scale(1.25);
}

.leaflet-marker-icon:focus-visible {
  outline: 3px solid #0b57d0;
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
