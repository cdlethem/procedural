import { record, work, charge } from './internal/systems-a-utils.js';
import { dimensions, field, computed, get, number, fail, neighbors } from './internal/periodic-grid.js';

/** One synchronous periodic five-point diffusion/retention step. */
export function diffusePeriodicScalar2D(input) {
  record(input, ['columns', 'rows', 'values', 'rate', 'retention', 'maxWork']);
  const { columns, rows, size } = dimensions(input);
  const values = field(get(input, 'values'), size);
  const rate = number(get(input, 'rate')); if (rate < 0 || rate > .25) fail('INVALID_INPUT');
  const retention = number(get(input, 'retention')); if (retention < 0 || retention > 1) fail('INVALID_INPUT');
  const maxWork = work(get(input, 'maxWork')); charge(size, maxWork);
  const out = new Array(size), centerWeight = computed(1 - computed(4 * rate));
  for (let i = 0; i < size; i++) {
    const [left, right, up, down] = neighbors(i, columns, rows);
    let sum = computed(centerWeight * values[i]);
    for (const neighbor of [left, right, up, down]) sum = computed(sum + computed(rate * values[neighbor]));
    out[i] = computed(retention * sum);
  }
  return { values: out };
}
