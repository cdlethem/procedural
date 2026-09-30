/**
 * Sphere-tracing a signed-distance tree through a camera (brief 56): ray batches, the marching itself, and the
 * camera-dependent VIEW stage (per-cell hit, depth, normal, ambient occlusion, silhouette coverage).
 *
 * THE MARCHER. `marchRays` walks each ray by the field value (safe only for `exact` and `bound` trees; a `scalar` tree
 * is refused by name). The rule is the released `raymarchImplicitRays3D` one (`@procedurals/javascript`, catalog id
 * `field.raymarch-implicit-rays-3d`): step by the field; HIT when the field is at most `hitEpsilon`; INSIDE when the
 * first sample is already negative; MISS_RANGE past `maxDistance`; MISS_STEPS at the step cap; MISS_STALLED when a step
 * does not advance. Two engines evaluate it, chosen by `engine`:
 *  - `released`: the released operation itself, available when the tree is expressible in its typed scene (spheres,
 *    boxes without rounding, placements without rotation, union, intersection, subtraction, smooth union: see
 *    `releasedScene`). It is the default whenever it fits (`engine: "auto"`).
 *  - `local`: the same rule over the compiled closure, for everything else (torus, capsule, cylinder, rounded box,
 *    rotation, shell, repeat, twist, bend, fold, fields).
 * A test pins that both give identical kinds and hit distances on the shared subset. The released operation returns no
 * closest approach, so silhouettes are refined by extra hit tests (below), which works for either engine.
 *
 * WORK. A march costs at most `rays * (maxSteps + 6) * sdf.cost` primitive evaluations, checked against `maxWork`
 * BEFORE any ray is traced; over it the call throws naming the options to reduce. This is a worst case, not typical:
 * a typical ray ends in a small fraction of `maxSteps`.
 *
 * THE VIEW. `sdfView(sdf, camera, options)` tiles the sculpture's projected bounding disc with a square lattice of
 * `cellSize` canvas units anchored at the disc's frame corner (so the lattice moves with the sculpture), keeps the
 * cells that intersect the canvas, fires one ray through each cell centre and records for each hit the camera depth, a
 * unit normal (tetrahedron gradient at step 1.5 hit epsilons, from the field), and an ambient-occlusion term (five
 * samples along the normal out to 0.155 of the bounding radius, weights 0.95^i, `1 - 3 * occlusion / radius`). A cell
 * whose 8-neighbourhood is not uniformly hit or missed is REFINED with the eight other rays of a 3 x 3 pattern, giving
 * `coverage` in ninths: the silhouette contour is the 0.5 level of coverage. Rays that miss the bounding sphere are
 * misses without marching. The hit epsilon is 0.05 of a cell's world size at the target depth (`view.hitEpsilon`).
 * Everything here depends on the sdf, camera, `cellSize`, `maxSteps` and `ao`, and on nothing about palette, light or
 * material. Results are frozen, cached (4 views) and built in cancellable chunks (`buildSdfView` generator).
 */
import { raymarchImplicitRays3D } from "@procedurals/javascript";
import type { Camera } from "./camera.js";
import type { Sdf, SdfNode } from "./sdf.js";
import type { CompositionRun } from "./types.js";

export const MARCH = Object.freeze({ HIT: 1, INSIDE: 2, MISS_RANGE: 3, MISS_STEPS: 4, MISS_STALLED: 5 });
export const DEFAULT_MARCH_WORK = 500_000_000;
export const MAX_VIEW_CELLS = 60_000;
export const CANVAS_SIZE = 640;
export type MarchEngine = "auto" | "released" | "local";

export interface RayBatch {
  readonly count: number;
  /** x, y, z per ray. */
  readonly origins: Float64Array;
  /** Unit directions, x, y, z per ray. */
  readonly directions: Float64Array;
}
export interface MarchOptions {
  readonly maxSteps: number;
  readonly hitEpsilon: number;
  /** Farthest distance any ray may travel from its origin. */
  readonly maxDistance: number;
  readonly engine?: MarchEngine;
  readonly maxWork?: number;
  readonly run?: CompositionRun;
}
export interface MarchResult {
  /** One of `MARCH`. */
  readonly kind: Uint8Array;
  /** Distance travelled from the ray origin (the hit distance for hits). */
  readonly traveled: Float64Array;
  /** Field evaluations made. */
  readonly steps: Uint16Array;
  readonly engine: "released" | "local";
  /** Worst-case work charged, in primitive evaluations. */
  readonly work: number;
}

type Vec3 = readonly [number, number, number];

/** The tree in the released operation's typed scene, or null with the first reason it cannot be expressed. */
export function releasedScene(tree: Sdf): { scene: unknown } | { reason: string } {
  const walk = (node: SdfNode, path: string): unknown => {
    const n = node as unknown as Record<string, any>;
    const chain = (kind: string, list: readonly SdfNode[], extra: Record<string, unknown> = {}): unknown => {
      let acc = walk(list[0], `${path}.0`);
      for (let i = 1; i < list.length; i++) acc = { kind, left: acc, right: walk(list[i], `${path}.${i}`), ...extra };
      return acc;
    };
    switch (n.kind) {
      case "sphere": return { kind: "sphere", center: [...n.center], radius: n.radius };
      case "box":
        if (n.round !== 0) throw new Error(`${path}: a rounded box is not in the released scene`);
        return { kind: "axisBox", center: [0, 0, 0], halfExtents: [...n.half] };
      case "place":
        if (n.rotate.some((v: number) => v !== 0)) throw new Error(`${path}: a rotated placement is not in the released scene`);
        return { kind: "translateUniform", translation: [...n.translate], scale: n.scale, child: walk(n.child, `${path}.0`) };
      case "union": return chain("union", n.children);
      case "intersection": return chain("intersection", n.children);
      case "smoothUnion": return chain("smoothUnion", n.children, { k: n.k });
      case "subtract": {
        let acc = walk(n.base, `${path}.base`);
        n.cuts.forEach((c: SdfNode, i: number) => { acc = { kind: "difference", left: acc, right: walk(c, `${path}.cut${i}`) }; });
        return acc;
      }
      default: throw new Error(`${path}: a ${n.kind} is not in the released scene`);
    }
  };
  try { return { scene: walk(tree.root, "0") }; } catch (error) { return { reason: (error as Error).message }; }
}

function traceLocal(f: Sdf["distance"], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance: number, eps: number, maxSteps: number, out: { t: number; samples: number }): number {
  let t = 0, px = ox, py = oy, pz = oz, samples = 0;
  for (;;) {
    const d = f(px, py, pz);
    samples++;
    out.t = t; out.samples = samples;
    if (samples === 1 && d < 0) return MARCH.INSIDE;
    if (d <= eps) return MARCH.HIT;
    if (t === maxDistance) return MARCH.MISS_RANGE;
    if (samples === maxSteps) return MARCH.MISS_STEPS;
    const remaining = maxDistance - t;
    if (d > remaining) return MARCH.MISS_RANGE;
    const next = d === remaining ? maxDistance : t + d;
    if (next === t) return MARCH.MISS_STALLED;
    if (next > maxDistance) return MARCH.MISS_RANGE;
    t = next;
    px = ox + t * dx; py = oy + t * dy; pz = oz + t * dz;
  }
}

const RELEASED_KIND: Record<string, number> = { hit_epsilon: MARCH.HIT, inside_start: MARCH.INSIDE, miss_range: MARCH.MISS_RANGE, miss_steps: MARCH.MISS_STEPS, miss_stalled: MARCH.MISS_STALLED };
const RELEASED_CHUNK = 1024;

function checkOptions(o: MarchOptions): void {
  if (!Number.isInteger(o.maxSteps) || o.maxSteps < 1 || o.maxSteps > 65535) throw new Error(`marchRays: maxSteps must be an integer in [1, 65535] (got ${String(o.maxSteps)})`);
  if (!(o.hitEpsilon > 0) || !Number.isFinite(o.hitEpsilon)) throw new Error(`marchRays: hitEpsilon must be positive and finite (got ${String(o.hitEpsilon)})`);
  if (!(o.maxDistance > 0) || !Number.isFinite(o.maxDistance)) throw new Error(`marchRays: maxDistance must be positive and finite (got ${String(o.maxDistance)})`);
}

/** Worst-case primitive evaluations of marching `rays` rays; the number `marchRays` checks against `maxWork`. */
export const marchWork = (tree: Sdf, rays: number, maxSteps: number): number => Math.ceil(rays * (maxSteps + 6) * tree.cost);

export function marchRays(tree: Sdf, batch: RayBatch, options: MarchOptions): MarchResult {
  checkOptions(options);
  if (tree.class === "scalar") throw new Error(`marchRays: the tree "${tree.key.slice(0, 16)}" contains a general scalar field (no declared Lipschitz constant); sphere tracing needs a distance bound, so it is refused. Declare a Lipschitz constant on the field, or extract a mesh with sdfMesh instead`);
  const n = batch.count, work = marchWork(tree, n, options.maxSteps), limit = options.maxWork ?? DEFAULT_MARCH_WORK;
  if (work > limit) throw new Error(`marchRays: ${n} rays x ${options.maxSteps + 6} steps x cost ${tree.cost.toFixed(1)} = ${work} exceeds maxWork ${limit}; reduce the number of rays (raise the cell size), the step cap or the tree's size`);
  const wanted = options.engine ?? "auto";
  const lowered = wanted === "local" ? null : releasedScene(tree);
  if (wanted === "released" && lowered && "reason" in lowered) throw new Error(`marchRays: the released engine cannot evaluate this tree (${lowered.reason})`);
  const kind = new Uint8Array(n), traveled = new Float64Array(n), steps = new Uint16Array(n);
  const o = batch.origins, d = batch.directions;
  if (lowered && "scene" in lowered) {
    for (let start = 0; start < n; start += RELEASED_CHUNK) {
      options.run?.check();
      const end = Math.min(n, start + RELEASED_CHUNK), rays: { origin: number[]; direction: number[] }[] = [];
      for (let i = start; i < end; i++) rays.push({ origin: [o[i * 3], o[i * 3 + 1], o[i * 3 + 2]], direction: [d[i * 3], d[i * 3 + 1], d[i * 3 + 2]] });
      const { results } = raymarchImplicitRays3D({
        scene: lowered.scene, rays, maxDistance: options.maxDistance, hitEpsilon: options.hitEpsilon, normalStep: options.hitEpsilon,
        maxSteps: options.maxSteps, maxRays: rays.length, maxSceneNodes: tree.nodeCount, maxWork: Math.ceil(rays.length * (options.maxSteps + 6) * tree.nodeCount),
      });
      results.forEach((r, k) => { kind[start + k] = RELEASED_KIND[r.kind]; traveled[start + k] = r.traveled; steps[start + k] = r.samples; });
    }
    return Object.freeze({ kind, traveled, steps, engine: "released", work });
  }
  const scratch = { t: 0, samples: 0 };
  for (let i = 0; i < n; i++) {
    if ((i & 1023) === 0) options.run?.check();
    kind[i] = traceLocal(tree.distance, o[i * 3], o[i * 3 + 1], o[i * 3 + 2], d[i * 3], d[i * 3 + 1], d[i * 3 + 2], options.maxDistance, options.hitEpsilon, options.maxSteps, scratch);
    traveled[i] = scratch.t; steps[i] = scratch.samples;
  }
  return Object.freeze({ kind, traveled, steps, engine: "local", work });
}

// ---------------------------------------------------------------------------------------------
// Rays through the camera

/**
 * The ray through canvas point `(x, y)`, started where it enters the sculpture's bounding sphere: writes origin and unit
 * direction into `out[at..at+5]` and returns true; false (nothing written) when it misses the sphere.
 */
export function primaryRay(view: Camera, tree: Sdf, x: number, y: number, out: Float64Array, at: number): boolean {
  const perspective = view.options.projection === "perspective", [cx, cy, cz] = tree.center;
  let ox: number, oy: number, oz: number, dx: number, dy: number, dz: number;
  if (perspective) {
    const target = view.unproject(x, y, view.options.distance);
    ox = view.eye[0]; oy = view.eye[1]; oz = view.eye[2];
    dx = target[0] - ox; dy = target[1] - oy; dz = target[2] - oz;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= l; dy /= l; dz /= l;
  } else {
    const p = view.unproject(x, y, 0);
    ox = p[0]; oy = p[1]; oz = p[2];
    dx = view.forward[0]; dy = view.forward[1]; dz = view.forward[2];
  }
  const px = ox - cx, py = oy - cy, pz = oz - cz, b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - tree.radius * tree.radius, disc = b * b - c;
  if (disc < 0) return false;
  const t0 = -b - Math.sqrt(disc);
  out[at] = ox + t0 * dx; out[at + 1] = oy + t0 * dy; out[at + 2] = oz + t0 * dz;
  out[at + 3] = dx; out[at + 4] = dy; out[at + 5] = dz;
  return true;
}

/** Half side, in canvas units, of the square around the camera centre that contains the bounding sphere's projection. */
export function frameHalf(view: Camera, tree: Sdf): number {
  const { zoom, distance } = view.options, r = tree.radius;
  return view.options.projection === "orthographic" ? zoom * r : zoom * distance * r / Math.sqrt(distance * distance - r * r);
}

// ---------------------------------------------------------------------------------------------
// The view

export interface ViewOptions {
  /** Lattice cell size in canvas units. */
  readonly cellSize: number;
  readonly maxSteps: number;
  /** Compute the occlusion term (five extra field samples per hit). */
  readonly ao: boolean;
  readonly maxWork?: number;
  readonly engine?: MarchEngine;
  readonly canvas?: number;
  readonly run?: CompositionRun;
}
export interface ViewStats {
  readonly cells: number;
  readonly rays: number;
  readonly refinementRays: number;
  readonly hits: number;
  readonly missSteps: number;
  readonly missStalled: number;
  readonly work: number;
  readonly engine: "released" | "local";
}
export interface SdfView {
  readonly key: string;
  readonly sdfKey: string;
  readonly cameraKey: string;
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  /** Canvas position of the CENTRE of cell (0, 0); cell `(i, j)` is centred at `(x0 + i * cellSize, y0 + j * cellSize)`. */
  readonly x0: number;
  readonly y0: number;
  readonly hitEpsilon: number;
  /** 1 where the centre ray hit (or started inside) the solid. */
  readonly hit: Uint8Array;
  /** Share of the cell's nine samples that hit: 0 or 1 away from the silhouette, ninths near it. */
  readonly coverage: Float32Array;
  /** Camera depth of the hit point (larger is farther); NaN for misses. */
  readonly depth: Float32Array;
  /** Unit normal per cell (x, y, z), zeros for misses; a hit with an undefined gradient faces the viewer. */
  readonly normal: Float32Array;
  /** Occlusion term in [0, 1], 1 for none (all ones when `ao` is off). */
  readonly occlusion: Float32Array;
  readonly kind: Uint8Array;
  readonly steps: Uint16Array;
  readonly stats: ViewStats;
}

const viewCache = new Map<string, SdfView>();
export const viewKey = (tree: Sdf, view: Camera, o: ViewOptions): string => `${tree.key}|${view.key}|${o.cellSize}|${o.maxSteps}|${o.ao ? 1 : 0}|${o.canvas ?? CANVAS_SIZE}`;
/** A finished view for these inputs if one is cached (used to prove appearance edits recompute nothing). */
export const cachedSdfView = (tree: Sdf, view: Camera, o: ViewOptions): SdfView | undefined => viewCache.get(viewKey(tree, view, o));

const AO_STEPS = 5, AO_REACH = 0.155;

/** Build a view in cancellable chunks: a generator that yields between chunks and returns the frozen view. */
export function* buildSdfView(tree: Sdf, view: Camera, options: ViewOptions): Generator<void, SdfView, void> {
  const { cellSize, maxSteps } = options, canvas = options.canvas ?? CANVAS_SIZE;
  if (!(cellSize > 0) || !Number.isFinite(cellSize)) throw new Error(`sdfView: cellSize must be positive (got ${String(cellSize)}); raise Cell size`);
  const key = viewKey(tree, view, options), hit0 = viewCache.get(key);
  if (hit0) { viewCache.delete(key); viewCache.set(key, hit0); return hit0; }
  const half = frameHalf(view, tree), [cx, cy] = view.options.center, fx0 = cx - half, fy0 = cy - half;
  const total = Math.max(1, Math.ceil(2 * half / cellSize));
  const i0 = Math.max(0, Math.floor((0 - fx0) / cellSize)), i1 = Math.min(total - 1, Math.floor((canvas - fx0) / cellSize));
  const j0 = Math.max(0, Math.floor((0 - fy0) / cellSize)), j1 = Math.min(total - 1, Math.floor((canvas - fy0) / cellSize));
  const columns = Math.max(0, i1 - i0 + 1), rows = Math.max(0, j1 - j0 + 1), cells = columns * rows;
  if (cells > MAX_VIEW_CELLS) throw new Error(`sdfView: ${cells} cells exceed the limit ${MAX_VIEW_CELLS}; raise Cell size (now ${cellSize}) or Size`);
  const x0 = fx0 + (i0 + 0.5) * cellSize, y0 = fy0 + (j0 + 0.5) * cellSize;
  const cellWorld = cellSize / view.options.zoom, hitEpsilon = 0.05 * cellWorld, maxDistance = 2 * tree.radius;
  const kind = new Uint8Array(cells).fill(MARCH.MISS_RANGE), steps = new Uint16Array(cells), hit = new Uint8Array(cells);
  const coverage = new Float32Array(cells), depth = new Float32Array(cells).fill(NaN), normal = new Float32Array(cells * 3), occlusion = new Float32Array(cells).fill(1);
  const travelled = new Float64Array(cells), origin = new Float64Array(cells * 6);
  // Center rays.
  const live: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const c = j * columns + i;
    if (primaryRay(view, tree, x0 + i * cellSize, y0 + j * cellSize, origin, c * 6)) live.push(c);
  }
  const chunk = 4096;
  let engine: "released" | "local" = "local", work = 0, missSteps = 0, missStalled = 0, refinementRays = 0;
  const centerBatch = (from: number, to: number): RayBatch => {
    const count = to - from, origins = new Float64Array(count * 3), directions = new Float64Array(count * 3);
    for (let k = 0; k < count; k++) {
      const c = live[from + k];
      origins.set(origin.subarray(c * 6, c * 6 + 3), k * 3); directions.set(origin.subarray(c * 6 + 3, c * 6 + 6), k * 3);
    }
    return { count, origins, directions };
  };
  // Worst case is checked once, over every ray of the pass, before any is traced.
  const limit = options.maxWork ?? DEFAULT_MARCH_WORK;
  const first = marchWork(tree, live.length, maxSteps);
  if (first > limit) throw new Error(`sdfView: ${live.length} rays x ${maxSteps + 6} steps x cost ${tree.cost.toFixed(1)} = ${first} exceeds maxWork ${limit}; raise Cell size, lower March steps, or simplify the sculpture`);
  for (let from = 0; from < live.length; from += chunk) {
    const to = Math.min(live.length, from + chunk), batch = centerBatch(from, to);
    const result = marchRays(tree, batch, { maxSteps, hitEpsilon, maxDistance, engine: options.engine, maxWork: Infinity, run: options.run });
    engine = result.engine; work += result.work;
    for (let k = 0; k < to - from; k++) {
      const c = live[from + k], kd = result.kind[k];
      kind[c] = kd; steps[c] = result.steps[k]; travelled[c] = result.traveled[k];
      hit[c] = kd === MARCH.HIT || kd === MARCH.INSIDE ? 1 : 0;
      if (kd === MARCH.MISS_STEPS) missSteps++; else if (kd === MARCH.MISS_STALLED) missStalled++;
    }
    yield;
  }
  for (let c = 0; c < cells; c++) coverage[c] = hit[c];
  // Refinement of cells next to a change of hit status.
  const mixed: number[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const c = j * columns + i;
    let differs = false;
    for (let dj = -1; dj <= 1 && !differs; dj++) for (let di = -1; di <= 1; di++) {
      if (di === 0 && dj === 0) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= columns || jj >= rows) continue;
      if (hit[jj * columns + ii] !== hit[c]) { differs = true; break; }
    }
    if (differs) mixed.push(c);
  }
  const offsets: [number, number][] = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a !== 0 || b !== 0) offsets.push([a / 3, b / 3]);
  const subOwner: number[] = [], subBuffer = new Float64Array(6);
  const subOrigins: number[] = [], subDirs: number[] = [];
  for (const c of mixed) {
    const i = c % columns, j = (c - i) / columns;
    for (const [ox, oy] of offsets) {
      if (!primaryRay(view, tree, x0 + (i + ox) * cellSize, y0 + (j + oy) * cellSize, subBuffer, 0)) continue;
      subOwner.push(c);
      subOrigins.push(subBuffer[0], subBuffer[1], subBuffer[2]); subDirs.push(subBuffer[3], subBuffer[4], subBuffer[5]);
    }
  }
  refinementRays = subOwner.length;
  const second = marchWork(tree, refinementRays, maxSteps);
  if (work + second > limit) throw new Error(`sdfView: silhouette refinement adds ${refinementRays} rays; ${work + second} exceeds maxWork ${limit}; raise Cell size or lower March steps`);
  const subHits = new Float32Array(cells);
  for (let from = 0; from < refinementRays; from += chunk) {
    const to = Math.min(refinementRays, from + chunk), count = to - from;
    const result = marchRays(tree, { count, origins: Float64Array.from(subOrigins.slice(from * 3, to * 3)), directions: Float64Array.from(subDirs.slice(from * 3, to * 3)) },
      { maxSteps, hitEpsilon, maxDistance, engine: options.engine, maxWork: Infinity, run: options.run });
    engine = result.engine; work += result.work;
    for (let k = 0; k < count; k++) if (result.kind[k] === MARCH.HIT || result.kind[k] === MARCH.INSIDE) subHits[subOwner[from + k]]++;
    yield;
  }
  for (const c of mixed) coverage[c] = (hit[c] + subHits[c]) / 9;
  // Depth, normal and occlusion at the hits.
  const R = tree.radius, h = 1.5 * hitEpsilon, aoUnit = AO_REACH * R;
  let hits = 0;
  const f = tree.distance;
  for (let c = 0; c < cells; c++) {
    if (!hit[c]) continue;
    hits++;
    const px = origin[c * 6] + travelled[c] * origin[c * 6 + 3], py = origin[c * 6 + 1] + travelled[c] * origin[c * 6 + 4], pz = origin[c * 6 + 2] + travelled[c] * origin[c * 6 + 5];
    depth[c] = ((px - view.eye[0]) * view.forward[0] + (py - view.eye[1]) * view.forward[1] + (pz - view.eye[2]) * view.forward[2]);
    let n = tree.normal(px, py, pz, h);
    if (!n) n = [-origin[c * 6 + 3], -origin[c * 6 + 4], -origin[c * 6 + 5]];
    normal[c * 3] = n[0]; normal[c * 3 + 1] = n[1]; normal[c * 3 + 2] = n[2];
    if (options.ao) {
      let occ = 0, weight = 1;
      for (let s = 0; s < AO_STEPS; s++) {
        const step = aoUnit * (0.1 + 0.9 * s / (AO_STEPS - 1)), d = f(px + n[0] * step, py + n[1] * step, pz + n[2] * step);
        occ += (step - d) * weight; weight *= 0.95;
      }
      occlusion[c] = Math.max(0, Math.min(1, 1 - 3 * occ / R));
    }
    if ((c & 2047) === 2047) yield;
  }
  const frozen: SdfView = Object.freeze({
    key, sdfKey: tree.key, cameraKey: view.key, cellSize, columns, rows, x0, y0, hitEpsilon, hit, coverage, depth, normal, occlusion, kind, steps,
    stats: Object.freeze({ cells, rays: live.length, refinementRays, hits, missSteps, missStalled, work, engine }),
  });
  viewCache.set(key, frozen);
  if (viewCache.size > 4) viewCache.delete(viewCache.keys().next().value!);
  return frozen;
}

/** The view for these inputs, cached; synchronous (see `buildSdfView` for the cancellable form). */
export function sdfView(tree: Sdf, view: Camera, options: ViewOptions): SdfView {
  const generator = buildSdfView(tree, view, options);
  for (;;) { const step = generator.next(); if (step.done) return step.value; }
}

// ---------------------------------------------------------------------------------------------
// Lighting (cheap, recomputed per light, never touching the view)

export interface Light {
  /** Degrees, in the viewer's frame: 0 lights from the front, positive swings toward the viewer's right. */
  readonly azimuth: number;
  /** Degrees above the horizon of the viewer's frame. */
  readonly elevation: number;
  /** Share of light that reaches every surface regardless of direction, in [0, 1]. */
  readonly ambient: number;
  /** How strongly occlusion darkens, in [0, 1]. */
  readonly aoStrength: number;
  /** How much the far side of the sculpture darkens, in [0, 1]. */
  readonly depthFade: number;
}

/** World direction toward the light for a viewer-relative azimuth and elevation. */
export function lightDirection(view: Camera, azimuth: number, elevation: number): Vec3 {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180, ce = Math.cos(el);
  const x = ce * Math.sin(az), y = Math.sin(el), z = ce * Math.cos(az);
  const [rx, ry, rz] = view.right, [ux, uy, uz] = view.up, [fx, fy, fz] = view.forward;
  return [x * rx + y * ux - z * fx, x * ry + y * uy - z * fy, x * rz + y * uz - z * fz];
}

/** Lambert shading with ambient, occlusion and depth cue, in [0, 1] per cell (NaN for misses). */
export function shadeView(view: SdfView, camera: Camera, tree: Sdf, light: Light): Float32Array {
  const [lx, ly, lz] = lightDirection(camera, light.azimuth, light.elevation);
  const out = new Float32Array(view.hit.length).fill(NaN), near = camera.options.distance - tree.radius, span = 2 * tree.radius;
  for (let c = 0; c < out.length; c++) {
    if (!view.hit[c]) continue;
    const lambert = Math.max(0, view.normal[c * 3] * lx + view.normal[c * 3 + 1] * ly + view.normal[c * 3 + 2] * lz);
    let s = light.ambient + (1 - light.ambient) * lambert;
    s *= 1 - light.aoStrength * (1 - view.occlusion[c]);
    const t = Math.max(0, Math.min(1, (view.depth[c] - near) / span));
    s *= 1 - light.depthFade * t;
    out[c] = Math.max(0, Math.min(1, s));
  }
  return out;
}
