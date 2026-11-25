import { ref } from 'vue';
import { defineStore } from 'pinia';
import { createReservationService } from '../infrastructure/reservationServiceFactory.js';
import {
  RESERVATION_STATUS,
  buildNotes,
  canTransition,
  validateReservationForm,
} from '../domain/reservation.js';
import { useAuthStore } from '../../iam/application/useAuthStore.js';
import { MOCK_RESERVATION } from '../../../shared/config/index.js';
import { districtOf, findDistrict } from '../../../shared/geo/districts.js';

const service = createReservationService({
  mock: MOCK_RESERVATION,
  getUser: () => {
    const profile = useAuthStore().profile;
    return profile ? { id: profile.id, name: profile.name } : null;
  },
});

const replaceIn = (list, updated) =>
  list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));

/**
 * Reservations of the signed-in user: the explorer's own (`mine`) and, for an owner, those of their
 * huarique (`forHuarique`). The service is the mock or the HTTP adapter, chosen by VITE_MOCK_RESERVATION.
 */
export const useReservationStore = defineStore('reservations', () => {
  const mine = ref([]);
  const forHuarique = ref([]);
  const loading = ref(false);
  const error = ref('');

  async function run(load) {
    loading.value = true;
    error.value = '';
    try {
      await load();
    } catch (cause) {
      error.value = cause?.message ?? 'No pudimos cargar las reservas.';
    } finally {
      loading.value = false;
    }
  }

  /** `silent` refreshes in the background (polling) without flashing the loading state. */
  async function loadMine({ silent = false } = {}) {
    if (silent) {
      try {
        mine.value = await service.listMine();
      } catch {
        /* the next tick retries */
      }
      return;
    }
    await run(async () => (mine.value = await service.listMine()));
  }

  async function loadForHuarique(huariqueId, { silent = false } = {}) {
    if (silent) {
      try {
        forHuarique.value = await service.listByHuarique(huariqueId);
      } catch {
        /* the next tick retries */
      }
      return;
    }
    await run(async () => (forHuarique.value = await service.listByHuarique(huariqueId)));
  }

  const byId = (id) =>
    mine.value.find((r) => r.id === id) ?? forHuarique.value.find((r) => r.id === id) ?? null;

  /**
   * Validates (including the opening hours of the huarique) and requests the table.
   * @param {{ huarique: object, form: { date, time, partySize, notes, dishOfInterest? }, fromLia?: boolean }} input
   * @returns {Promise<{ ok: boolean, reservation?: object, errors?: object, error?: string }>}
   */
  async function create({ huarique, form, fromLia = false, now = new Date() }) {
    const validation = validateReservationForm(form, { openingHours: huarique.openingHours, now });
    if (!validation.valid) return { ok: false, errors: validation.errors };

    const profile = useAuthStore().profile;
    const districtId = districtOf(huarique);
    try {
      const reservation = await service.create(
        {
          huariqueId: huarique.id,
          date: form.date,
          time: form.time,
          partySize: Number(form.partySize),
          notes: buildNotes({
            notes: form.notes,
            dishOfInterest: form.dishOfInterest,
            liaNote: fromLia ? 'Reserva solicitada desde el chat con Lía.' : '',
          }),
        },
        {
          dinerName: profile?.name,
          huariqueName: huarique.name,
          zone: districtId ? findDistrict(districtId).name : '',
        },
      );
      mine.value = [...mine.value, reservation];
      return { ok: true, reservation };
    } catch (cause) {
      return { ok: false, error: cause?.message ?? 'No pudimos registrar tu reserva.' };
    }
  }

  /** Approve / reject (owner), check in (explorer: COMPLETED). Local rules first, then the service. */
  async function updateStatus(id, status) {
    const current = byId(id);
    if (current && !canTransition(current.status, status)) {
      return { ok: false, error: 'Esta reserva ya no admite ese cambio.' };
    }
    try {
      const updated = await service.updateStatus(id, status);
      mine.value = replaceIn(mine.value, updated);
      forHuarique.value = replaceIn(forHuarique.value, updated);
      return { ok: true, reservation: byId(id) };
    } catch (cause) {
      return {
        ok: false,
        error: cause?.message ?? 'No pudimos actualizar la reserva.',
        status: cause?.status,
      };
    }
  }

  const approve = (id) => updateStatus(id, RESERVATION_STATUS.APPROVED);
  const reject = (id) => updateStatus(id, RESERVATION_STATUS.REJECTED);
  const checkIn = (id) => updateStatus(id, RESERVATION_STATUS.COMPLETED);

  function reset() {
    mine.value = [];
    forHuarique.value = [];
    error.value = '';
  }

  return {
    mine,
    forHuarique,
    loading,
    error,
    byId,
    loadMine,
    loadForHuarique,
    create,
    updateStatus,
    approve,
    reject,
    checkIn,
    reset,
  };
});
