import { marchingSquares2D } from "@procedurals/javascript";
import { cachedBy, componentSeed } from "./core.js";
import { domainIntersection, planarDomain, ringsDomain, type PlanarDomain } from "./domains.js";
import { clipPaths } from "./domains-paths.js";
import { maskDomain } from "./domains-raster.js";
import { circleMode, rectangleMode, NODAL_MAX_INDEX, type ModeFunction, type NodalEdge, type NodalShape } from "./nodal-modes.js";
import { contourChains, memoized } from "./sources.js";
import type { Path, Point, Site } from "./types.js";

/*
 * Nodal plates: the zero set and low-amplitude neighbourhood of an ideal standing-wave superposition.
 *
 * Inputs   `NodalFieldOptions`: plate shape and ONE edge condition, placement, an ordered list of modes
 *          (indices, weight, phase, circle orientation), a snapshot time and a sampling resolution.
 *          Modes are the Laplacian eigenfunctions described in `nodal-modes.ts` (a scalar wave model, not a
 *          validated plate-vibration simulation). Mode i oscillates as w_i·cos(2π·t·k_i/k_ref + φ_i), the
 *          dispersion ω = c·k, where k_ref is the smallest positive wavenumber of the listed modes and `time`
 *          counts periods of that lowest mode. The field is u = Σ coefficient_i·ψ_i / Σ|w_i|, so |u| ≤ 1.
 * Outputs  Deeply frozen, cached values (never keyed by appearance):
 *          `nodalField`   analytic amplitude `amplitude(x, y)` in canvas units (NaN outside the plate), the sampled
 *                         grid (row-major, a square cell, odd counts so the grid is symmetric about the plate
 *                         center; it extends two cells past the plate), the modes with their wavenumbers,
 *                         `peak` (max |u| over samples inside the plate) and the plate outline domain.
 *                         The sign is canonical: the first sample within 1e-9 of the peak is positive.
 *          `nodalPaths`   the nodal lines u = 0, marching squares of the grid, clipped to the plate with the exact
 *                         planar-domain clipper. Ids `nodal:<k>` in scan order; lines shorter than 0.75 cell are
 *                         below the sampling resolution and dropped; under a fixed edge the edge itself is a
 *                         node by construction and is not reported as a line.
 *          `nodalSites`   `particles` sites drawn to where |u| is small (rule below).
 *          `nodalBands`   the node bands |u| ≤ tolerance·peak as a planar domain (holes allowed).
 * Site rule  Candidate j is a point uniform in the plate's bounding box from the stream
 *          componentSeed(seed, "cand:j", "site"). It is rejected if outside the plate, then accepted with
 *          probability ρ = exp(−½(u/(τ·peak))²) (ρ ≈ 0.61 at the band edge |u| = τ·peak), then rejected if
 *          within `separation` of an accepted site (dart throwing). The first `particles` accepted candidates
 *          in index order are the sites `grain:0…`. So raising `particles` only appends, and appearance
 *          edits never move a site. Sites whose |u| exceeds a few τ·peak are exponentially rare.
 * Units    Canvas units; angles in options are degrees, in frames radians; time in periods; tolerance is a
 *          fraction of peak amplitude.
 * Work     Grid cells ≤ 300,000; sampling resolution 16–480 cells across the longest side; modes ≤ 8;
 *          indices ≤ 24; particles ≤ 20,000; candidates ≤ 2,000,000. A request that exceeds any bound
 *          throws before expansion naming the controlling parameter. Nothing is truncated.
 * Failure  Non-finite or out-of-range input, all weights zero, coefficients that cancel to a zero field, only
 *          the uniform mode, a site request that cannot be met.
 * Known limit  Marching squares resolves a crossing of two nodal lines to one cell: the two lines are two
 *          curves that touch or bounce at the crossing, exactly like any marching-squares saddle.
 */

export const NODAL_LIMITS = Object.freeze({
  modes: 8, index: NODAL_MAX_INDEX, minResolution: 16, maxResolution: 480, cells: 300_000, particles: 20_000,
  candidates: 2_000_000, size: 8192, pad: 2, minLineCells: 0.75, circleSides: 192,
});

export interface NodalMode {
  /** Interior nodal lines across the width (rectangle) or nodal diameters (circle), 0…24. */
  n: number;
  /** Interior nodal lines across the height (rectangle) or nodal circles (circle), 0…24. */
  m: number;
  /** Signed weight; only ratios matter. */
  weight: number;
  /** Initial phase in degrees. */
  phase: number;
  /** Circle only: turns the angular pattern, degrees clockwise on screen. Ignored for rectangles. */
  orient: number;
}
export interface NodalFieldOptions {
  shape: NodalShape;
  edge: NodalEdge;
  centerX: number;
  centerY: number;
  /** Rectangle width; the side of a square; the diameter of a circle. */
  width: number;
  /** Rectangle height. Ignored for square and circle. */
  height: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  modes: readonly NodalMode[];
  /** Snapshot time in periods of the lowest listed mode. */
  time: number;
  /** Sample cells across the plate's longest side. */
  resolution: number;
}
export interface NodalResolvedMode extends NodalMode {
  readonly index: number;
  /** Radians per canvas unit. */
  readonly k: number;
  /** k divided by the reference (lowest positive) wavenumber. */
  readonly ratio: number;
  /** Signed amplitude at the snapshot before normalisation: weight·cos(2π·time·ratio + phase). */
  readonly coefficient: number;
}
export interface NodalGrid {
  readonly columns: number;
  readonly rows: number;
  /** Square cell size in canvas units. */
  readonly cell: number;
  /** Local coordinates (plate center origin, +y down, before rotation) of sample (0, 0). */
  readonly x0: number;
  readonly y0: number;
  /** Row-major normalised amplitude, including the two-cell margin past the plate. */
  readonly values: readonly number[];
  /** Max |value| over samples inside the plate. */
  readonly peak: number;
}
export interface NodalField {
  readonly shape: NodalShape;
  readonly edge: NodalEdge;
  readonly centerX: number;
  readonly centerY: number;
  /** Half extents of the plate's bounding box in its own frame (canvas units). */
  readonly halfWidth: number;
  readonly halfHeight: number;
  /** Radians, clockwise on screen. */
  readonly rotation: number;
  readonly modes: readonly NodalResolvedMode[];
  readonly grid: NodalGrid;
  /** Analytic normalised amplitude at a canvas point; NaN outside the plate. */
  amplitude(x: number, y: number): number;
  contains(x: number, y: number): boolean;
  /** Local (plate frame) to canvas. */
  toCanvas(x: number, y: number): Point;
  /** Canvas to local. */
  toLocal(x: number, y: number): Point;
  /** Amplitude in the plate frame, without the inside test (analytic continuation beyond the edge). */
  amplitudeLocal(x: number, y: number): number;
  readonly outline: PlanarDomain;
}
export interface NodalSiteOptions {
  seed: number;
  /** Node half-width as a fraction of `peak`. */
  tolerance: number;
  particles: number;
  /** Minimum distance between sites, canvas units; 0 allows any. */
  separation: number;
}
/** A site with its local field values; `angle` follows the nodal line's tangent. */
export interface NodalSite extends Site {
  /** Normalised amplitude at the site. */
  readonly amplitude: number;
  /** ρ = exp(−½(u/(τ·peak))²) in (0, 1]. */
  readonly proximity: number;
  /** First-order distance to the nearest node, |u|/|∇u| in canvas units (an estimate, not a bound). */
  readonly nodeDistance: number;
  /** 0 where the amplitude is non-negative, 1 where negative (the two lobes). */
  readonly lobe: 0 | 1;
}

function requireRange(label: string, value: number, min: number, max: number, integer = false): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}]`);
}
const seedOf = (seed: number): number => {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Nodal plate seed must be a uint32 integer");
  return seed;
};

const fieldCache = new Map<string, NodalField>();

/** Analytic field, sample grid and outline of the plate. Cached by construction. */
export function nodalField(options: NodalFieldOptions): NodalField {
  const { shape, edge, centerX, centerY, width, height, rotation, modes, time, resolution } = options;
  if (shape !== "square" && shape !== "rectangle" && shape !== "circle") throw new Error(`Unknown plate shape: ${String(shape)}`);
  if (edge !== "free" && edge !== "fixed") throw new Error(`Unknown edge condition: ${String(edge)}`);
  requireRange("Center X", centerX, -1e6, 1e6); requireRange("Center Y", centerY, -1e6, 1e6);
  requireRange("Width", width, 1, NODAL_LIMITS.size);
  requireRange("Height", height, 1, NODAL_LIMITS.size);
  requireRange("Rotation", rotation, -3600, 3600);
  requireRange("Time", time, -1000, 1000);
  requireRange("Resolution", resolution, NODAL_LIMITS.minResolution, NODAL_LIMITS.maxResolution, true);
  if (!Array.isArray(modes) || modes.length < 1 || modes.length > NODAL_LIMITS.modes)
    throw new Error(`A plate needs 1 to ${NODAL_LIMITS.modes} modes`);
  modes.forEach((mode, i) => {
    const label = `Mode ${i + 1}`;
    requireRange(`${label} index n`, mode.n, 0, NODAL_LIMITS.index, true);
    requireRange(`${label} index m`, mode.m, 0, NODAL_LIMITS.index, true);
    requireRange(`${label} weight`, mode.weight, -1000, 1000);
    requireRange(`${label} phase`, mode.phase, -3600, 3600);
    requireRange(`${label} orientation`, mode.orient, -3600, 3600);
  });
  const key = JSON.stringify([shape, edge, centerX, centerY, width, shape === "rectangle" ? height : 0, rotation, time, resolution,
    modes.map((mode) => [mode.n, mode.m, mode.weight, mode.phase, shape === "circle" ? mode.orient : 0])]);
  return memoized(fieldCache, key, () => buildField(options));
}

function buildField(options: NodalFieldOptions): NodalField {
  const { shape, edge, centerX, centerY, width, rotation, modes, time, resolution } = options;
  const W = width, H = shape === "rectangle" ? options.height : width, R = W / 2;
  const functions: ModeFunction[] = modes.map((mode) => shape === "circle"
    ? circleMode(edge, mode.n, mode.m, R, mode.orient * Math.PI / 180)
    : rectangleMode(edge, mode.n, mode.m, W, H));
  const positive = functions.map((f) => f.k).filter((k) => k > 0);
  if (positive.length === 0) throw new Error("Every mode is the uniform (0, 0) mode, which has no nodes. Raise an index n or m of a mode");
  const reference = Math.min(...positive);
  const total = modes.reduce((sum, mode) => sum + Math.abs(mode.weight), 0);
  if (!(total > 0)) throw new Error("All mode weights are zero. Give at least one mode a nonzero Weight");
  const resolved: NodalResolvedMode[] = modes.map((mode, i) => {
    const ratio = functions[i].k / reference;
    return Object.freeze({ ...mode, index: i, k: functions[i].k, ratio, coefficient: mode.weight * Math.cos(2 * Math.PI * time * ratio + mode.phase * Math.PI / 180) });
  });
  const active = resolved.map((mode, i) => ({ c: mode.coefficient / total, at: functions[i].at })).filter((entry) => entry.c !== 0);
  const raw = (x: number, y: number): number => { let sum = 0; for (const entry of active) sum += entry.c * entry.at(x, y); return sum; };

  const cell = Math.max(W, H) / resolution, pad = NODAL_LIMITS.pad;
  const halfColumns = Math.ceil(W / 2 / cell) + pad, halfRows = Math.ceil(H / 2 / cell) + pad;
  const columns = 2 * halfColumns + 1, rows = 2 * halfRows + 1;
  if (columns * rows > NODAL_LIMITS.cells)
    throw new Error(`The sample grid would have ${columns * rows} cells; the limit is ${NODAL_LIMITS.cells}. Lower Resolution`);
  const inside = (x: number, y: number): boolean => shape === "circle" ? x * x + y * y <= R * R : Math.abs(x) <= W / 2 && Math.abs(y) <= H / 2;
  const x0 = -halfColumns * cell, y0 = -halfRows * cell;
  const values = new Array<number>(columns * rows);
  let peak = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const x = x0 + i * cell, y = y0 + j * cell, v = raw(x, y);
    values[j * columns + i] = v;
    if (inside(x, y) && Math.abs(v) > peak) peak = Math.abs(v);
  }
  if (!(peak > 1e-9)) throw new Error("The modes cancel to a zero field at this snapshot. Change a Weight, a Phase or Time");
  let sign = 1;
  for (let j = 0; j < rows && sign === 1; j++) for (let i = 0; i < columns; i++) {
    const v = values[j * columns + i];
    if (inside(x0 + i * cell, y0 + j * cell) && Math.abs(v) >= peak * (1 - 1e-9)) { if (v < 0) sign = -1; j = rows; break; }
  }
  if (sign < 0) for (let i = 0; i < values.length; i++) values[i] = -values[i];

  const theta = rotation * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
  const toCanvas = (x: number, y: number): Point => [centerX + x * c - y * s, centerY + x * s + y * c];
  const toLocal = (x: number, y: number): Point => { const dx = x - centerX, dy = y - centerY; return [dx * c + dy * s, -dx * s + dy * c]; };
  const local = (x: number, y: number): number => sign * raw(x, y);
  const ring: Point[] = shape === "circle"
    ? Array.from({ length: NODAL_LIMITS.circleSides }, (_, k) => toCanvas(R * Math.cos(2 * Math.PI * k / NODAL_LIMITS.circleSides), R * Math.sin(2 * Math.PI * k / NODAL_LIMITS.circleSides)))
    : [toCanvas(-W / 2, -H / 2), toCanvas(W / 2, -H / 2), toCanvas(W / 2, H / 2), toCanvas(-W / 2, H / 2)];
  const grid: NodalGrid = Object.freeze({ columns, rows, cell, x0, y0, values: Object.freeze(values), peak });
  return Object.freeze({
    shape, edge, centerX, centerY, halfWidth: W / 2, halfHeight: H / 2, rotation: theta,
    modes: Object.freeze(resolved), grid,
    amplitude: (x: number, y: number) => { const [lx, ly] = toLocal(x, y); return inside(lx, ly) ? local(lx, ly) : NaN; },
    contains: (x: number, y: number) => { const [lx, ly] = toLocal(x, y); return inside(lx, ly); },
    toCanvas, toLocal, amplitudeLocal: local,
    outline: planarDomain({ id: "plate", outer: ring }),
  });
}

// ------------------------------------------------------------------------------------------------ nodal lines

/** Split segments into non-branching runs (union across vertices met by exactly two segments). */
export function nonBranching(segments: readonly (readonly number[])[]): number[][][] {
  const incident = new Map<string, number[]>();
  const keys = segments.map(([x1, y1, x2, y2]) => [`${x1},${y1}`, `${x2},${y2}`]);
  keys.forEach((pair, edge) => { for (const key of pair) { const list = incident.get(key); if (list) list.push(edge); else incident.set(key, [edge]); } });
  const parent = Int32Array.from(segments, (_, i) => i);
  const find = (e: number): number => { while (parent[e] !== e) { parent[e] = parent[parent[e]]; e = parent[e]; } return e; };
  for (const list of incident.values()) if (list.length === 2) parent[find(list[0])] = find(list[1]);
  const groups = new Map<number, number[][]>();
  segments.forEach((segment, edge) => {
    const root = find(edge), group = groups.get(root);
    if (group) group.push(segment as number[]); else groups.set(root, [segment as number[]]);
  });
  return [...groups.values()];
}
const length = (points: readonly Point[], closed: boolean): number => {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  if (closed && points.length > 1) sum += Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  return sum;
};
/** Distance of a plate-frame point to the plate edge (positive inside). */
function edgeDistance(field: NodalField, x: number, y: number): number {
  return field.shape === "circle" ? field.halfWidth - Math.hypot(x, y) : Math.min(field.halfWidth - Math.abs(x), field.halfHeight - Math.abs(y));
}

const pathCache = new WeakMap<NodalField, Map<string, readonly Path[]>>();
/** The nodal lines u = 0 inside the plate as frozen paths in canvas coordinates (see the header). */
export function nodalPaths(field: NodalField, seed: number): readonly Path[] {
  seedOf(seed);
  return cachedBy(pathCache, field, String(seed), () => {
    const { columns, rows, cell, x0, y0, values } = field.grid;
    const { segments } = marchingSquares2D({ values: values as number[], columns, rows, origin: [x0, y0], spacing: [cell, cell], threshold: 0,
      maxWork: columns * rows + (columns - 1) * (rows - 1) });
    const groups = nonBranching(segments);
    const raw = contourChains(groups.map((group) => ({ level: 0, segments: group })), seed, groups.length,
      (x, y) => field.toCanvas(x, y), ". Lower Resolution or the mode indices");
    // Under a fixed edge the edge is a node by construction. The extended field's edge contour, and the turns marching
    // squares makes where an interior line meets it, run along the edge: those segments (both ends within 0.35 cell of
    // the edge) are removed and the line is cut there. A line that merely ends on the edge keeps its last segment.
    const onEdge = (x: number, y: number): boolean => { const [lx, ly] = field.toLocal(x, y); return Math.abs(edgeDistance(field, lx, ly)) <= 0.35 * cell; };
    const pieces: { points: readonly Point[]; closed: boolean }[] = [];
    for (const piece of clipPaths(raw, field.outline)) {
      if (field.edge !== "fixed") { pieces.push(piece); continue; }
      const flags = piece.points.map(([x, y]) => onEdge(x, y)), count = piece.points.length;
      const segments = piece.closed ? count : count - 1;
      const along = (i: number): boolean => flags[i] && flags[(i + 1) % count];
      if (!Array.from({ length: segments }, (_, i) => along(i)).some(Boolean)) { pieces.push(piece); continue; }
      let run: Point[] = [];
      const flush = () => { if (run.length > 1) pieces.push({ points: run, closed: false }); run = []; };
      // A closed path starts after a removed segment so that its first run is not split in two.
      const start = piece.closed ? Array.from({ length: segments }, (_, i) => i).find((i) => along(i))! + 1 : 0;
      for (let step = 0; step < segments; step++) {
        const i = (start + step) % segments, next = (i + 1) % count;
        if (along(i)) { flush(); continue; }
        if (run.length === 0) run.push(piece.points[i]);
        run.push(piece.points[next]);
      }
      flush();
    }
    const kept = pieces.filter((piece) => length(piece.points, piece.closed) >= NODAL_LIMITS.minLineCells * cell);
    return Object.freeze(kept.map((piece, k) => {
      const id = `nodal:${k}`;
      return Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: Object.freeze(piece.points.map((q) => Object.freeze([q[0], q[1]] as const))), closed: piece.closed, level: 0, levelFraction: 0 });
    }));
  });
}

// ------------------------------------------------------------------------------------------------ grains

/** Proximity ρ = exp(−½(u/(τ·peak))²) at a plate-frame point; the site density before separation. */
const proximityAt = (field: NodalField, tolerance: number, x: number, y: number): number => {
  const z = field.amplitudeLocal(x, y) / (tolerance * field.grid.peak);
  return Math.exp(-0.5 * z * z);
};
function gradient(field: NodalField, x: number, y: number): [number, number] {
  const e = 1e-3 * Math.min(field.halfWidth, field.halfHeight);
  return [(field.amplitudeLocal(x + e, y) - field.amplitudeLocal(x - e, y)) / (2 * e), (field.amplitudeLocal(x, y + e) - field.amplitudeLocal(x, y - e)) / (2 * e)];
}
/** First-order distance from a canvas point to the nearest node, |u|/|∇u| (NaN outside the plate). An estimate, not a bound. */
export function nodalDistance(field: NodalField, x: number, y: number): number {
  const [lx, ly] = field.toLocal(x, y);
  if (!field.contains(x, y)) return NaN;
  const [gx, gy] = gradient(field, lx, ly);
  return Math.abs(field.amplitudeLocal(lx, ly)) / Math.max(Math.hypot(gx, gy), 1e-9 / field.halfWidth);
}
/** Site density ρ in (0, 1] at a canvas point (NaN outside the plate). */
export function nodalProximity(field: NodalField, tolerance: number, x: number, y: number): number {
  const [lx, ly] = field.toLocal(x, y);
  return field.contains(x, y) ? proximityAt(field, tolerance, lx, ly) : NaN;
}

function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const PILOT = 20_000;
const siteCache = new WeakMap<NodalField, Map<string, readonly NodalSite[]>>();
/** Sites drawn toward the nodes by the seeded rejection rule in the header. */
export function nodalSites(field: NodalField, options: NodalSiteOptions): readonly NodalSite[] {
  const { seed, tolerance, particles, separation } = options;
  seedOf(seed);
  requireRange("Node width", tolerance, 0.002, 1);
  requireRange("Particles", particles, 0, NODAL_LIMITS.particles, true);
  requireRange("Separation", separation, 0, 1000);
  return cachedBy(siteCache, field, `${seed}:${tolerance}:${particles}:${separation}`, () => {
    if (particles === 0) return Object.freeze([]);
    const { peak } = field.grid;
    const sites: NodalSite[] = [];
    const hash = new Map<number, number[]>(), bin = separation > 0 ? separation : 1;
    const bins = (x: number, y: number): [number, number] => [Math.floor(x / bin), Math.floor(y / bin)];
    const width = 2 * field.halfWidth, height = 2 * field.halfHeight;
    // Pilot: the first PILOT candidates measure the acceptance of the density alone, and a request that would need
    // more than the candidate limit is refused there, before the bulk of the work.
    let passes = 0;
    for (let j = 0; sites.length < particles; j++) {
      if (j === PILOT) {
        const expected = particles * PILOT / Math.max(passes, 1);
        if (expected > NODAL_LIMITS.candidates)
          throw new Error(`Placing ${particles} sites this close to the nodes needs about ${Math.round(expected)} candidates; the limit is ${NODAL_LIMITS.candidates}. Lower Particles or raise Node width`);
      }
      if (j >= NODAL_LIMITS.candidates)
        throw new Error(`Only ${sites.length} of ${particles} sites fit after ${NODAL_LIMITS.candidates} candidates. Lower Particles or Separation, or raise Node width`);
      const draw = stream(componentSeed(seed, `cand:${j}`, "site"));
      const x = (draw() - 0.5) * width, y = (draw() - 0.5) * height, a = draw();
      if (field.shape === "circle" && x * x + y * y > field.halfWidth * field.halfWidth) continue;
      const u = field.amplitudeLocal(x, y), z = u / (tolerance * peak), rho = Math.exp(-0.5 * z * z);
      if (a >= rho) continue;
      passes++;
      const [bx, by] = bins(x, y);
      if (separation > 0) {
        let clear = true;
        for (let dx = -1; dx <= 1 && clear; dx++) for (let dy = -1; dy <= 1 && clear; dy++) {
          const list = hash.get((bx + dx) * 100_003 + (by + dy));
          if (list) for (let q = 0; q < list.length; q += 2) if (Math.hypot(list[q] - x, list[q + 1] - y) < separation) { clear = false; break; }
        }
        if (!clear) continue;
        const cellKey = bx * 100_003 + by, list = hash.get(cellKey);
        if (list) list.push(x, y); else hash.set(cellKey, [x, y]);
      }
      const [gx, gy] = gradient(field, x, y), slope = Math.hypot(gx, gy);
      const id = `grain:${sites.length}`;
      sites.push(Object.freeze({
        id, seed: componentSeed(seed, id, "site"), position: Object.freeze(field.toCanvas(x, y)),
        // The nodal line's tangent (perpendicular to ∇u), turned into the canvas frame.
        angle: slope > 0 ? Math.atan2(gx, -gy) + field.rotation : field.rotation, scale: 1,
        amplitude: u, proximity: rho, nodeDistance: Math.abs(u) / Math.max(slope, 1e-9 / field.halfWidth), lobe: u >= 0 ? 0 : 1,
      }));
    }
    return Object.freeze(sites);
  });
}

// ------------------------------------------------------------------------------------------------ node bands

const bandCache = new WeakMap<NodalField, Map<string, PlanarDomain>>();
/**
 * The node band {|u| ≤ tolerance·peak} as a planar domain. The grid is read as a scalar raster of the proximity ρ
 * (pixel centers at the samples, so the band edge is the marching-squares contour at ρ = e^(−½), the exact
 * |u| = τ·peak level), turned into canvas coordinates and intersected with the plate outline.
 */
export function nodalBands(field: NodalField, tolerance: number): PlanarDomain {
  requireRange("Node width", tolerance, 0.002, 1);
  return cachedBy(bandCache, field, String(tolerance), () => {
    const { columns, rows, cell, x0, y0, values, peak } = field.grid;
    const data = values.map((v) => { const z = v / (tolerance * peak); return Math.exp(-0.5 * z * z); });
    const band = maskDomain({ width: columns, height: rows, data }, { threshold: Math.exp(-0.5), mode: "contour", cell, origin: [x0 - cell / 2, y0 - cell / 2], id: "band" });
    if (band.regions.length === 0) return band;
    const rings = band.regions.flatMap((region) => [region.outer, ...region.holes]).map((r) => r.map(([x, y]) => field.toCanvas(x, y)));
    return domainIntersection(ringsDomain(rings, { fill: "nonzero", id: "band" }), field.outline, { id: "bands" });
  });
}
