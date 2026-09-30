import { componentSeed } from "./core.js";
import { circumcircle } from "./inversion.js";
import type { Point } from "./types.js";

/**
 * Apollonian gasket by Descartes' theorem, with exact curvatures.
 *
 * INPUT. A bounding circle (centre, radius R, curvature −1/R) and two circles inside it that
 * touch it and each other: the first has radius `first`·R (0 < first < 1), the second has
 * `second`·(R − first·R) (0 < second ≤ 1, so the pair fits; 1 puts both on a diameter). The
 * seed triple is generation 0. Every gap between three mutually tangent circles holds exactly
 * one more circle; the bounded triple has two gaps, filled by generation 1, and each new circle
 * opens three gaps for the next generation. Without cutoffs generation g ≥ 1 holds 2·3^(g−1)
 * circles, 2 + 3^g in all.
 *
 * METHOD. Four mutually tangent circles satisfy (Σk)² = 2Σk² for their signed curvatures
 * (bounding circle negative). Given three of them, the two fourth circles differ by
 * k′ = 2(k₁ + k₂ + k₃) − k, and the same linear relation holds for the curvature-weighted
 * centres (k·x, k·y): each step is exact arithmetic, an integer for the classic 1/2/2 seed.
 * Each step is also the inversion, in the circle through the three tangency points of the other
 * three, that swaps the old fourth circle for the new one; the tests verify that equivalence
 * independently. Generations 1 come from the complex Descartes formula, filtered by tangency.
 *
 * IDENTITY. `O`, `A`, `B` are the seed; `C0`, `C1` generation 1; a child is its parent's id, a
 * dot and the slot 0–2 it fills among the parent's three gaps, in the parent's quadruple order.
 * Ids do not depend on Generations, Minimum radius or the seed shape, only on the address, so
 * raising Generations adds circles and renames none. A gap is kept when its own id draws below
 * `retention`; a dropped gap and everything inside it is absent.
 *
 * BOUNDS. New circles are always smaller than the smallest of the other three, so cutting at
 * `minRadius` is a valid stop. More than `maxCircles` circles throws, naming Generations and
 * Minimum radius. Deterministic; the seed only feeds retention.
 */
export interface GasketOptions {
  seed: number;
  centerX: number;
  centerY: number;
  radius: number;
  /** Degrees, counterclockwise on screen; turns the seed triple about the centre. */
  rotation: number;
  first: number;
  second: number;
  generations: number;
  minRadius: number;
  retention: number;
  maxCircles: number;
}

export interface GasketCircle {
  readonly id: string;
  readonly seed: number;
  readonly generation: number;
  readonly parent: string | null;
  /** Signed: the bounding circle is negative. */
  readonly curvature: number;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Subtree of the first two generations below the seed: 0 for the seed and generation 1, then 1–6. */
  readonly branch: number;
  /** Radians, from the centre toward the tangency with `neighbour`; null for the bounding circle. */
  readonly anchor: number | null;
  readonly neighbour: string | null;
  /** floor(−log₂(r / R)), at least 0. */
  readonly octave: number;
}

export type GasketDual =
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: "line"; readonly x: number; readonly y: number; readonly dx: number; readonly dy: number };

export interface Gasket {
  readonly circles: readonly GasketCircle[];
  /** Circles per generation, generation 0 first. */
  readonly counts: readonly number[];
  /**
   * The four circles through the tangency points of each triple in the first quadruple (O, A, B, C0);
   * a triple whose points are collinear (the seed triple on a diameter) gives its line instead.
   */
  readonly duals: readonly GasketDual[];
}

type Vector = readonly [number, number, number];
interface Node { readonly quad: readonly Vector[]; readonly ids: readonly string[]; readonly last: number; readonly circle: GasketCircle }

const U32 = 0x1_0000_0000;
export const GASKET_LIMITS = Object.freeze({ maxCircles: 20_000, maxGenerations: 12 });

function finite(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}

/** The point where two tangent circles of signed curvatures ka, kb touch. */
export function tangencyPoint(ka: number, ax: number, ay: number, kb: number, bx: number, by: number): Point {
  return [(ka * ax + kb * bx) / (ka + kb), (ka * ay + kb * by) / (ka + kb)];
}

function complexSqrt(re: number, im: number): [number, number] {
  const m = Math.hypot(re, im), a = Math.sqrt((m + re) / 2), b = Math.sqrt(Math.max(0, (m - re) / 2));
  return [a, im < 0 ? -b : b];
}

export function apollonianGasket(options: GasketOptions): Gasket {
  const { seed, centerX, centerY, radius: R, rotation, first, second, generations, minRadius, retention, maxCircles } = options;
  finite("Gasket radius", R, 1e-6, 1e6);
  finite("Gasket first circle", first, 1e-3, 1 - 1e-3);
  finite("Gasket second circle", second, 1e-3, 1);
  finite("Gasket rotation", rotation, -1e6, 1e6);
  finite("Gasket retention", retention, 0, 1);
  finite("Gasket minimum radius", minRadius, 0, 1e6);
  if (!Number.isInteger(generations) || generations < 0 || generations > GASKET_LIMITS.maxGenerations)
    throw new Error(`Generations must be an integer in [0, ${GASKET_LIMITS.maxGenerations}]`);
  if (!Number.isInteger(maxCircles) || maxCircles < 3) throw new Error("Circle limit must be an integer of at least 3");

  const phi = rotation * Math.PI / 180;
  const rA = first * R, rB = second * (R - rA), dA = R - rA, dB = R - rB, dAB = rA + rB;
  const gamma = Math.acos(Math.max(-1, Math.min(1, (dA * dA + dB * dB - dAB * dAB) / (2 * dA * dB))));
  const seedCircles = [
    { id: "O", k: -1 / R, x: centerX, y: centerY },
    { id: "A", k: 1 / rA, x: centerX + dA * Math.cos(phi), y: centerY + dA * Math.sin(phi) },
    { id: "B", k: 1 / rB, x: centerX + dB * Math.cos(phi + gamma), y: centerY + dB * Math.sin(phi + gamma) },
  ];

  const vec = (c: { k: number; x: number; y: number }): Vector => [c.k, c.k * c.x, c.k * c.y];
  const circles: GasketCircle[] = [];
  const byId = new Map<string, GasketCircle>();
  const radiusOf = (v: Vector) => 1 / Math.abs(v[0]);
  const make = (id: string, generation: number, parent: string | null, v: Vector, branch: number, neighbour: GasketCircle | null): GasketCircle => {
    const cx = v[1] / v[0], cy = v[2] / v[0], r = radiusOf(v);
    let anchor: number | null = null;
    if (neighbour) {
      const [tx, ty] = tangencyPoint(v[0], cx, cy, neighbour.curvature, neighbour.cx, neighbour.cy);
      anchor = Math.atan2(ty - cy, tx - cx);
    }
    const circle = Object.freeze({ id, seed: componentSeed(seed, id, "gasket"), generation, parent, curvature: v[0], cx, cy, r, branch, anchor,
      neighbour: neighbour?.id ?? null, octave: Math.max(0, Math.floor(-Math.log2(r / R))) });
    circles.push(circle); byId.set(id, circle);
    return circle;
  };

  // The seed circles anchor toward the bounding circle; a convention for oriented marks only.
  const o = make("O", 0, null, vec(seedCircles[0]), 0, null);
  make("A", 0, null, vec(seedCircles[1]), 0, o);
  make("B", 0, null, vec(seedCircles[2]), 0, o);

  // Generation 1: both circles tangent to O, A and B (complex Descartes, keep the tangent candidates).
  const [k0, kA, kB] = seedCircles.map((c) => c.k);
  const sum = k0 + kA + kB, discriminant = Math.max(0, k0 * kA + kA * kB + kB * k0);
  const z = seedCircles.map((c) => [c.x, c.y] as const);
  const weighted = [0, 1].map((axis) => seedCircles.reduce((s, c, i) => s + c.k * z[i][axis], 0));
  const cross = (i: number, j: number): [number, number] => [
    seedCircles[i].k * seedCircles[j].k * (z[i][0] * z[j][0] - z[i][1] * z[j][1]),
    seedCircles[i].k * seedCircles[j].k * (z[i][0] * z[j][1] + z[i][1] * z[j][0])];
  const products = [cross(0, 1), cross(1, 2), cross(0, 2)];
  const [sqRe, sqIm] = complexSqrt(products.reduce((s, p) => s + p[0], 0), products.reduce((s, p) => s + p[1], 0));
  const candidates: { k: number; x: number; y: number }[] = [];
  for (const sk of [1, -1]) {
    const k4 = sum + 2 * sk * Math.sqrt(discriminant);
    if (!(k4 > 0)) continue;
    for (const sz of [1, -1]) {
      const x = (weighted[0] + 2 * sz * sqRe) / k4, y = (weighted[1] + 2 * sz * sqIm) / k4, r4 = 1 / k4;
      const tangent = seedCircles.every((c) => Math.abs(Math.hypot(x - c.x, y - c.y) - Math.abs(r4 + 1 / c.k)) < 1e-7 * R);
      if (tangent && !candidates.some((c) => Math.hypot(c.x - x, c.y - y) < 1e-9 * R && Math.abs(c.k - k4) < 1e-9 * k4)) candidates.push({ k: k4, x, y });
    }
  }
  if (candidates.length !== 2) throw new Error(`Gasket seed circles have ${candidates.length} tangent gap circles, expected 2`);
  candidates.sort((p, q) => (p.y - centerY) * Math.cos(phi) - (p.x - centerX) * Math.sin(phi) - ((q.y - centerY) * Math.cos(phi) - (q.x - centerX) * Math.sin(phi)));

  let level: Node[] = [];
  const quadIds = ["O", "A", "B"];
  if (generations >= 1) {
    candidates.forEach((c, i) => {
      const id = `C${i}`;
      const circle = make(id, 1, null, vec(c), 0, circles[0]);
      level.push({ quad: [...seedCircles.map(vec), vec(c)], ids: [...quadIds, id], last: 3, circle });
    });
  }
  const counts = [3, generations >= 1 ? 2 : 0];
  for (let generation = 2; generation <= generations && level.length; generation++) {
    const next: Node[] = [];
    for (const node of level) {
      let slot = 0;
      for (let j = 0; j < 4; j++) {
        if (j === node.last) continue;
        const id = `${node.circle.id}.${slot++}`;
        const sumOthers: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < 4; i++) if (i !== j) for (let c = 0; c < 3; c++) sumOthers[c] += node.quad[i][c];
        const v: Vector = [2 * sumOthers[0] - node.quad[j][0], 2 * sumOthers[1] - node.quad[j][1], 2 * sumOthers[2] - node.quad[j][2]];
        if (radiusOf(v) < minRadius) continue;
        if (retention < 1 && componentSeed(seed, id, "keep") / U32 >= retention) continue;
        if (circles.length >= maxCircles)
          throw new Error(`The gasket needs more than ${maxCircles} circles; lower Generations or raise Minimum radius`);
        const branch = generation === 2 ? 1 + Number(node.circle.id.slice(1)) * 3 + (slot - 1) : node.circle.branch;
        const neighbour = byId.get(node.ids[[0, 1, 2, 3].find((i) => i !== j)!])!;
        const circle = make(id, generation, node.circle.id, v, branch, neighbour);
        const quad = [...node.quad], ids = [...node.ids];
        quad[j] = v; ids[j] = id;
        next.push({ quad, ids, last: j, circle });
      }
    }
    counts.push(next.length);
    level = next;
  }
  counts.length = generations + 1;
  for (let g = 0; g <= generations; g++) counts[g] ??= 0;

  const duals: GasketDual[] = [];
  if (generations >= 1) {
    const quad = [...seedCircles.map(vec), vec(candidates[0])];
    const at = (i: number): [number, number] => [quad[i][1] / quad[i][0], quad[i][2] / quad[i][0]];
    for (let skip = 0; skip < 4; skip++) {
      const others = [0, 1, 2, 3].filter((i) => i !== skip);
      const points = [[0, 1], [1, 2], [0, 2]].map(([p, q]) => tangencyPoint(quad[others[p]][0], ...at(others[p]), quad[others[q]][0], ...at(others[q])));
      const circle = circumcircle(points[0], points[1], points[2]);
      duals.push(Object.freeze(circle ? { kind: "circle" as const, ...circle }
        : { kind: "line" as const, x: points[0][0], y: points[0][1], dx: points[1][0] - points[0][0], dy: points[1][1] - points[0][1] }));
    }
  }
  return Object.freeze({ circles: Object.freeze(circles), counts: Object.freeze(counts), duals: Object.freeze(duals) });
}
