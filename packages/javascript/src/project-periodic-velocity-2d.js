import { record, integer, work, charge } from './internal/systems-a-utils.js';
import { dimensions, field, computed, get, neighbors, divergence } from './internal/periodic-grid.js';

/** Bounded weighted-Jacobi projection on a periodic unit-cell MAC grid. */
export function projectPeriodicVelocity2D(input) {
  record(input, ['columns', 'rows', 'u', 'v', 'iterations', 'maxWork']);
  const { columns, rows, size } = dimensions(input);
  const u = field(get(input, 'u'), size), v = field(get(input, 'v'), size);
  const iterations = integer(get(input, 'iterations'), 0, Number.MAX_SAFE_INTEGER);
  const maxWork = work(get(input, 'maxWork'));
  charge(size * (iterations + 3), maxWork);
  const before = divergence(u, v, columns, rows);
  let pressure = new Array(size).fill(0), next = new Array(size);
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let i = 0; i < size; i++) {
      const [left, right, up, down] = neighbors(i, columns, rows);
      const sum = computed(computed(computed(pressure[left] + pressure[right]) + pressure[up]) + pressure[down]);
      const target = computed(computed(sum - before[i]) / 4);
      next[i] = computed(pressure[i] + computed((2 / 3) * computed(target - pressure[i])));
    }
    [pressure, next] = [next, pressure];
  }
  const nextU = new Array(size), nextV = new Array(size);
  for (let i = 0; i < size; i++) {
    const [, right, , down] = neighbors(i, columns, rows);
    nextU[i] = computed(u[i] - computed(pressure[right] - pressure[i]));
    nextV[i] = computed(v[i] - computed(pressure[down] - pressure[i]));
  }
  return { u: nextU, v: nextV, pressure, divergenceBefore: before,
    divergenceAfter: divergence(nextU, nextV, columns, rows) };
}
