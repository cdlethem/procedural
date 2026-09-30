import { componentSeed } from "./core.js";
import { CANVAS } from "./laplacian-layout.js";
import { lastActiveStep } from "./laplacian-growth.js";
import type { GrowthSnapshots } from "./laplacian-growth.js";
import { finalState } from "./snapshots.js";
import type { Site } from "./types.js";

/**
 * Sites published by a growth run for motifs (brief 16). Both are pure functions of the final state of the run, cached per run,
 * frozen, with ids that do not depend on how they are drawn.
 *
 * AGE SITES. A lattice of `spacing` canvas units (points at `(i + ½) spacing, (j + ½) spacing`, id `age:<i>,<j>`) over the
 * canvas; a point becomes a site when its cell is occupied. It is nudged by up to 0.3 spacing in x and y from seeded draws
 * (`componentSeed(seed, id, "jitter-x" | "jitter-y")`) unless the nudge would leave the occupied region. `amount` is the age
 * fraction `age / lastActiveStep` in [0, 1] (0 the seed, 1 the newest cells) and `scale` is `0.45 + 0.55 amount`: the marks grow
 * outward. Bounds: spacing >= 4 (at most 25,600 lattice points).
 *
 * TIP SITES. Every frontier cell whose rate is a local maximum over its eight neighbours (equal rates go to the lower cell id)
 * and at least `threshold` times the fastest rate. Position: the front point on the normal through the cell centre,
 * `(fill − ½) cell` outward of the centre; `angle` (radians) the outward normal, the direction of increasing potential;
 * `scale = 0.4 + 0.9 amount` with `amount = rate / fastest rate`. id `cell:<cell id>`. Consumers choose the palette tone from `amount`.
 * A run whose growth has ended has no tips.
 */

export const MIN_AGE_SPACING = 4;

export interface GrowthSite extends Site {
  /** Age fraction (age sites) or relative speed (tip sites), in [0, 1]. */
  readonly amount: number;
}

const ageCache = new WeakMap<object, Map<number, readonly GrowthSite[]>>();
const tipCache = new WeakMap<object, Map<number, readonly GrowthSite[]>>();

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;

function remembered<T>(cache: WeakMap<object, Map<number, T>>, owner: object, key: number, make: () => T): T {
  let byKey = cache.get(owner);
  if (!byKey) { byKey = new Map(); cache.set(owner, byKey); }
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const made = make();
  byKey.set(key, made);
  if (byKey.size > 8) byKey.delete(byKey.keys().next().value!);
  return made;
}

export function ageSites(snaps: GrowthSnapshots, spacing: number): readonly GrowthSite[] {
  if (!Number.isFinite(spacing) || spacing < MIN_AGE_SPACING) throw new Error(`Mark spacing must be at least ${MIN_AGE_SPACING}`);
  return remembered(ageCache, snaps, spacing, () => {
    const state = finalState(snaps), n = Math.round(Math.sqrt(state.age.length)), cell = CANVAS / n, last = Math.max(1, lastActiveStep(snaps));
    const count = Math.floor(CANVAS / spacing), sites: GrowthSite[] = [];
    const cellAt = (x: number, y: number): number => Math.min(n - 1, Math.max(0, Math.floor(y / cell))) * n + Math.min(n - 1, Math.max(0, Math.floor(x / cell)));
    for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
      const x0 = (i + 0.5) * spacing, y0 = (j + 0.5) * spacing;
      if (state.age[cellAt(x0, y0)] < 0) continue;
      const id = `age:${i},${j}`;
      let x = x0 + 0.3 * spacing * (2 * unit(snaps.seed, id, "jitter-x") - 1), y = y0 + 0.3 * spacing * (2 * unit(snaps.seed, id, "jitter-y") - 1);
      if (x < 0 || y < 0 || x > CANVAS || y > CANVAS || state.age[cellAt(x, y)] < 0) { x = x0; y = y0; }
      const amount = Math.min(1, state.age[cellAt(x, y)] / last);
      sites.push(Object.freeze({ id, seed: componentSeed(snaps.seed, id, "site"), position: Object.freeze([x, y] as const), angle: 0,
        scale: 0.45 + 0.55 * amount, amount }));
    }
    return Object.freeze(sites);
  });
}

export function tipSites(snaps: GrowthSnapshots, threshold: number): readonly GrowthSite[] {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error("Tip threshold must be from 0 to 1");
  return remembered(tipCache, snaps, threshold, () => {
    const state = finalState(snaps), n = Math.round(Math.sqrt(state.rate.length)), cell = CANVAS / n, { rate, phi, fill } = state;
    if (state.stopped !== 0 || state.rateMax <= 0) return Object.freeze([]);
    const sites: GrowthSite[] = [];
    const at = (i: number, j: number): number => Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i));
    for (let c = 0; c < rate.length; c++) {
      if (rate[c] <= 0) continue;
      const amount = rate[c] / state.rateMax;
      if (amount < threshold) continue;
      const i = c % n, j = (c - i) / n;
      let top = true;
      for (let dj = -1; dj <= 1 && top; dj++) for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const k = at(i + di, j + dj);
        if (k === c) continue;
        if (rate[k] > rate[c] || (rate[k] === rate[c] && k < c)) { top = false; break; }
      }
      if (!top) continue;
      const gx = phi[at(i + 1, j)] - phi[at(i - 1, j)], gy = phi[at(i, j + 1)] - phi[at(i, j - 1)], length = Math.hypot(gx, gy);
      const nx = length > 0 ? gx / length : 0, ny = length > 0 ? gy / length : 0, offset = (fill[c] - 0.5) * cell;
      const id = `cell:${c}`;
      sites.push(Object.freeze({ id, seed: componentSeed(snaps.seed, id, "site"),
        position: Object.freeze([(i + 0.5) * cell + nx * offset, (j + 0.5) * cell + ny * offset] as const),
        angle: Math.atan2(ny, nx), scale: 0.4 + 0.9 * amount, amount }));
    }
    return Object.freeze(sites);
  });
}
