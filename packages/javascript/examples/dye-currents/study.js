import { projectPeriodicVelocity2D } from '../../src/project-periodic-velocity-2d.js';
import { advectPeriodicScalar2D } from '../../src/advect-periodic-scalar-2d.js';
import { diffusePeriodicScalar2D } from '../../src/diffuse-periodic-scalar-2d.js';

export const SIZE = 96, CELLS = SIZE * SIZE;
export function initialFluid(texture = false) {
  const u = [], v = [], dyes = [[], [], []];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    u.push(1.1 * Math.sin(2 * Math.PI * y / SIZE));
    v.push(.9 * Math.sin(2 * Math.PI * x / SIZE));
    for (let k = 0; k < 3; k++) {
      const dx = x - [28, 60, 48][k], dy = y - [34, 36, 64][k];
      const disk = Math.exp(-(dx * dx + dy * dy) / 120);
      dyes[k].push(texture ? disk * ((x + y + k * 6) % 14 < 6 ? 1 : .04) : disk);
    }
  }
  return { tick: 0, u, v, dyes, pressure: new Array(CELLS).fill(0), residualBefore: 0, residualAfter: 0 };
}
const grid = { columns: SIZE, rows: SIZE };
const l2 = values => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
export function stepFluid(old, { injection = .1, viscosity = .01, projection = true } = {}) {
  // These two transports deliberately read the same old MAC velocities.
  const transport = { ...grid, u: old.u, v: old.v, dt: .4, maxWork: 3 * CELLS };
  let u = advectPeriodicScalar2D({ ...transport, values: old.u, offset: [.5, 0] }).values;
  let v = advectPeriodicScalar2D({ ...transport, values: old.v, offset: [0, .5] }).values;
  // Authored forcing is external input to the solver, independent of dye/palette.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = y * SIZE + x, dx = x - 48, dy = y - 48;
    const force = injection * Math.exp(-(dx * dx + dy * dy) / 440);
    u[i] += force * (-dy + .5 * dx) / 16;
    v[i] += force * (dx + .5 * dy) / 16;
  }
  u = diffusePeriodicScalar2D({ ...grid, values: u, rate: viscosity, retention: 1, maxWork: CELLS }).values;
  v = diffusePeriodicScalar2D({ ...grid, values: v, rate: viscosity, retention: 1, maxWork: CELLS }).values;
  const projected = projectPeriodicVelocity2D({ ...grid, u, v, iterations: projection ? 64 : 0, maxWork: CELLS * 67 });
  const dyes = old.dyes.map(values => advectPeriodicScalar2D({ ...grid, values, u: projected.u, v: projected.v, offset: [0, 0], dt: .4, maxWork: CELLS * 3 }).values);
  return { tick: old.tick + 1, u: projected.u, v: projected.v, dyes, pressure: projected.pressure,
    residualBefore: l2(projected.divergenceBefore), residualAfter: l2(projected.divergenceAfter) };
}
