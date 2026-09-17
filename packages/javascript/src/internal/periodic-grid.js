/** Shared private arithmetic for the reviewed periodic scalar/MAC contracts. */
import { array, get, integer, number, computed, fail, product } from './systems-a-utils.js';
export { computed, get, number, fail };
export function dimensions(input) {
  const columns = integer(get(input, 'columns'), 1, 4294967295);
  const rows = integer(get(input, 'rows'), 1, 4294967295);
  return { columns, rows, size: product(columns, rows) };
}
export function field(value, size) {
  array(value, size);
  for (let i = 0; i < size; i++) number(get(value, String(i)));
  return value;
}
export function wrap(value, extent) {
  let r = value % extent;
  if (r < 0) r = computed(r + extent);
  if (r >= extent) r = 0;
  return r === 0 ? 0 : r;
}
export function sample(values, columns, rows, x, y) {
  const px = wrap(x, columns), py = wrap(y, rows);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = x0 + 1 === columns ? 0 : x0 + 1;
  const y1 = y0 + 1 === rows ? 0 : y0 + 1;
  const tx = computed(px - x0), ty = computed(py - y0);
  const ix = computed(1 - tx), iy = computed(1 - ty);
  const h0 = computed(computed(ix * values[y0 * columns + x0]) + computed(tx * values[y0 * columns + x1]));
  const h1 = computed(computed(ix * values[y1 * columns + x0]) + computed(tx * values[y1 * columns + x1]));
  return computed(computed(iy * h0) + computed(ty * h1));
}
export function neighbors(index, columns, rows) {
  const x = index % columns, y = Math.floor(index / columns);
  return [y * columns + (x === 0 ? columns - 1 : x - 1),
    y * columns + (x + 1 === columns ? 0 : x + 1),
    (y === 0 ? rows - 1 : y - 1) * columns + x,
    (y + 1 === rows ? 0 : y + 1) * columns + x];
}
export function divergence(u, v, columns, rows) {
  const out = new Array(u.length);
  for (let i = 0; i < u.length; i++) {
    const [left, , up] = neighbors(i, columns, rows);
    out[i] = computed(computed(u[i] - u[left]) + computed(v[i] - v[up]));
  }
  return out;
}
