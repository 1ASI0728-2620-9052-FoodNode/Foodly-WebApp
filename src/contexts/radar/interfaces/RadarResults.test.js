import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import RadarResults from './RadarResults.vue';
import { RADAR_STATUS } from '../application/useRadarStore.js';

const item = (id, name, distanceMeters) => ({
  huariqueId: id,
  distanceMeters,
  huarique: {
    id,
    name,
    cuisineType: 'MARINA',
    priceMin: 20,
    priceMax: 45,
    isOpen: id === 'a',
    images: [],
    tags: [],
  },
});

function mountResults(props) {
  return mount(RadarResults, {
    props: { status: RADAR_STATUS.SUCCESS, items: [], totalCount: 0, ...props },
    global: {
      plugins: [createPinia()],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  });
}

describe('RadarResults', () => {
  it('shows the empty state when the zone has no huariques', () => {
    const wrapper = mountResults({ totalCount: 0 });
    expect(wrapper.text()).toContain('No hay huariques aquí aún, ¡recomienda uno!');
    expect(wrapper.find('ul').exists()).toBe(false);
  });

  it('offers to widen the radius from the empty state when it can', async () => {
    const wrapper = mountResults({ totalCount: 0, canWiden: true });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('widen')).toHaveLength(1);
  });

  it('shows skeletons while loading', () => {
    const wrapper = mountResults({ status: RADAR_STATUS.LOADING });
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('No hay huariques');
  });

  it('shows the error with a retry button', async () => {
    const wrapper = mountResults({ status: RADAR_STATUS.ERROR, error: 'Servicio caído' });
    expect(wrapper.text()).toContain('Servicio caído');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('tells "filters too strict" apart from "empty zone"', async () => {
    const wrapper = mountResults({ totalCount: 3, items: [] });
    expect(wrapper.text()).toContain('Ningún huarique coincide con tus filtros');
    expect(wrapper.text()).not.toContain('recomienda uno');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('reset-filters')).toHaveLength(1);
  });

  it('lists cards in the given (distance) order with badge and distance', () => {
    const wrapper = mountResults({
      totalCount: 2,
      items: [item('a', 'Don Pepe', 320), item('b', 'Chifa Wong', 1450)],
    });
    const titles = wrapper.findAll('h3').map((h) => h.text());
    expect(titles).toEqual(['Don Pepe', 'Chifa Wong']);
    expect(wrapper.text()).toContain('320 m');
    expect(wrapper.text()).toContain('1.4 km');
    expect(wrapper.text()).toContain('Abierto Ahora');
    expect(wrapper.text()).toContain('Cerrado');
    expect(wrapper.text()).toContain('S/ 20 – S/ 45');
  });

  it('highlights the selected card and emits select on click', async () => {
    const wrapper = mountResults({
      totalCount: 1,
      items: [item('a', 'Don Pepe', 100)],
      selectedId: 'a',
    });
    const card = wrapper.find('article');
    expect(card.attributes('aria-current')).toBe('true');
    await card.trigger('click');
    expect(wrapper.emitted('select')[0]).toEqual(['a']);
  });

  it('warns when the list may be incomplete', () => {
    const wrapper = mountResults({
      totalCount: 1,
      items: [item('a', 'Don Pepe', 100)],
      incompleteCount: 2,
    });
    expect(wrapper.text()).toContain('La lista puede estar incompleta');
  });
});
