import { record, array, work, charge } from './internal/systems-a-utils.js';
import { dimensions, field, computed, get, number, fail, sample } from './internal/periodic-grid.js';

/** Explicit backward characteristic trace, with supplied MAC velocities and sample offset. */
export function advectPeriodicScalar2D(input) {
  record(input, ['columns', 'rows', 'values', 'u', 'v', 'offset', 'dt', 'maxWork']);
  const { columns, rows, size } = dimensions(input);
  const values = field(get(input, 'values'), size);
  const u = field(get(input, 'u'), size), v = field(get(input, 'v'), size);
  const offset = get(input, 'offset'); array(offset, 2);
  const ox = number(get(offset, '0')), oy = number(get(offset, '1'));
  if (ox < 0 || ox >= 1 || oy < 0 || oy >= 1) fail('INVALID_INPUT');
  const dt = number(get(input, 'dt')); if (dt < 0) fail('INVALID_INPUT');
  const maxWork = work(get(input, 'maxWork')); charge(3 * size, maxWork);
  if (dt === 0) return { values: values.map(value => value === 0 ? 0 : value) };
  const out = new Array(size);
  for (let i = 0; i < size; i++) {
    const x = computed((i % columns) + ox), y = computed(Math.floor(i / columns) + oy);
    const vx = sample(u, columns, rows, computed(x - .5), y);
    const vy = sample(v, columns, rows, x, computed(y - .5));
    const bx = computed(x - computed(dt * vx)), by = computed(y - computed(dt * vy));
    out[i] = sample(values, columns, rows, computed(bx - ox), computed(by - oy));
  }
  return { values: out };
}
