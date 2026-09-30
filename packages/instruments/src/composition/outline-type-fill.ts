import { unit as unitDraw } from "./bristle.js";
import { componentSeed } from "./core.js";
import { domainClearance, domainIntersection, domainRings } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { clipPath, hatchDomain } from "./domains-paths.js";
import { MAX_PATTERN_LINES, MAX_PATTERN_VERTICES, driftLimits, driftPhase, driftPosition, gratingLines } from "./patterns.js";
import type { PatternDot, PatternStroke } from "./patterns.js";
import { appendControls, robustOffset, withControls } from "./outline-type.js";
import type { OutlineUnit } from "./outline-type.js";
import type { Path, Point, Site } from "./types.js";

/**
 * Replaceable fillers for outline type. A filler turns ONE unit's domain into fill geometry that
 * lies inside it; it never draws. `outlineFillerFor(spec)` builds the stock fillers; any function of type
 * `OutlineFiller` may stand in for them (`buildOutlineType(recipe, { filler })`).
 *
 * OUTPUT (`OutlineFill`), all frozen, all in canvas units:
 *   paths   open or closed polylines. EXACTLY CLIPPED: every vertex lies inside or on the closed
 *           domain, holes excluded, and a line is cut at the exact boundary crossing (`clipPath`,
 *           `hatchDomain`); a stroke drawn along a path is centred on it, so its width extends half
 *           its weight past the boundary.
 *   shapes  filled polygons that are set operations on the domain (`domainIntersection`), so they
 *           lie inside it by construction; the solid fill is the domain itself.
 *   marks   sites for a mark callback. A mark is an arbitrary drawing, so containment (not
 *           clipping) is the rule: a site is kept when a disc of `radius` about it fits inside the
 *           domain (`domainClearance`); nothing is cut, partial marks are omitted.
 *
 * KINDS. solid: the domain. hatch: parallel lines from `hatchDomain`, optional second family at 90°.
 * waves / rings: `patterns.ts` waves grating (amplitude 0 is a straight grating) and concentric
 * rings with the frequency drift `chirp`, clipped. contours: the domain inset by successive
 * multiples of `spacing` (round joins, chord error ≤ 2% of the spacing), one closed path per ring, so counters
 * grow outward as the letter shrinks; stops at `count` rings or when the letter is gone. dots: a
 * `patterns.ts` dot lattice with a mark whose diameter is `markSize × spacing`, shrinking by `ramp`
 * along the `angle` direction across the unit. bands: `count` overlapping layers, layer k being the
 * domain cut by a half-plane that starts k/count of the way across the unit (perpendicular to the
 * stripe direction `angle`); the consumer draws each with a low alpha so the wash deepens stepwise.
 * mixed: each unit takes one of the six techniques by a seeded draw of its own id.
 *
 * FRAMES. Line and lattice families are counted from an origin: `shared` is the block centre, so
 * neighbouring units continue each other's lines; `unit` is the unit's own bounding-box centre.
 * Ids come from lattice indices, so neighbouring edits keep them. Each unit's angle is
 * `angle + angleSpread × (2u − 1)` with `u` drawn from `componentSeed(seed, unit id, "angle")`.
 * Nothing about colour, weight, stroke material or alpha is an input: those are appearance.
 *
 * Failure: invalid specs throw naming the field; a pattern or planar work limit throws naming the
 * controls that scale it. No fallbacks.
 */
export type OutlineFillKind = "none" | "solid" | "hatch" | "waves" | "rings" | "contours" | "dots" | "bands";
export const OUTLINE_MIXED_KINDS: readonly OutlineFillKind[] = Object.freeze(["hatch", "waves", "rings", "contours", "dots", "bands"] as const);

export interface OutlineFillSpec {
  readonly kind: OutlineFillKind | "mixed";
  /** Line spacing, lattice period or contour interval, canvas units (≥ 3). */
  readonly spacing: number;
  /** Degrees, clockwise on the canvas. */
  readonly angle: number;
  /** Each unit turns by up to ± this many degrees. */
  readonly angleSpread: number;
  /** Hatch: add a second family at 90°. */
  readonly cross: boolean;
  readonly origin: "shared" | "unit";
  /**
   * Frequency drift of waves and rings: the fractional change of the line frequency between the pattern origin and the farthest point
   * of the unit (positive tightens outward). Independent of size: it is admitted whenever `spacing / (1 + |chirp|)` is at least the
   * pattern minimum period (3) and |chirp| ≤ 0.8.
   */
  readonly chirp: number;
  /** Waves: peak sideways displacement and wavelength, canvas units. */
  readonly waveAmplitude: number;
  readonly waveLength: number;
  readonly lattice: "square" | "hex";
  readonly markKind: "dot" | "rings" | "rosette";
  /** Mark diameter as a share of the lattice period. */
  readonly markSize: number;
  /** Share of the mark's size lost from one side of the unit to the other. */
  readonly ramp: number;
  /** Contour rings, or band layers. */
  readonly count: number;
}

export interface OutlineFillShape {
  readonly id: string;
  readonly domain: PlanarDomain;
  /** Position among the shapes of one unit; bands stack from layer 0. */
  readonly layer: number;
  readonly layers: number;
}
export interface OutlineFillMark extends Site {
  /** Radius of the disc kept inside the domain, canvas units. */
  readonly radius: number;
}
export interface OutlineFill {
  /** The unit's id. */
  readonly id: string;
  /** The technique this unit got (`mixed` resolved). */
  readonly kind: OutlineFillKind;
  readonly paths: readonly Path[];
  readonly shapes: readonly OutlineFillShape[];
  readonly marks: readonly OutlineFillMark[];
}
export interface OutlineFillContext {
  readonly seed: number;
  /** The block centre: the `shared` origin. */
  readonly origin: Point;
}
export type OutlineFiller = (unit: Pick<OutlineUnit, "id" | "domain">, context: OutlineFillContext) => OutlineFill;

const freezePoint = (p: readonly [number, number]): Point => Object.isFrozen(p) ? p as Point : Object.freeze([p[0], p[1]] as const);
function pathOf(id: string, seed: number, points: readonly (readonly [number, number])[], closed: boolean, level = 0, levelFraction = 0): Path {
  return Object.freeze({ id, seed: componentSeed(seed, id, "path"), points: Object.freeze(points.map(freezePoint)), closed, level, levelFraction });
}
const empty = (id: string, kind: OutlineFillKind): OutlineFill => Object.freeze({ id, kind, paths: Object.freeze([]), shapes: Object.freeze([]), marks: Object.freeze([]) });
const finiteIn = (label: string, value: number, min: number, max: number): void => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be finite and in [${min}, ${max}]`);
};

export function validateOutlineFill(spec: OutlineFillSpec): void {
  if (spec.kind !== "mixed" && !["none", "solid", "hatch", "waves", "rings", "contours", "dots", "bands"].includes(spec.kind)) throw new Error(`Unknown fill kind: ${String(spec.kind)}`);
  finiteIn("Line spacing", spec.spacing, 3, 1000); finiteIn("Fill angle", spec.angle, -3600, 3600); finiteIn("Angle variation", spec.angleSpread, 0, 360);
  finiteIn("Frequency drift", spec.chirp, -0.8, 0.8); finiteIn("Wave amplitude", spec.waveAmplitude, 0, 1000); finiteIn("Wavelength", spec.waveLength, 4, 10000);
  finiteIn("Mark size", spec.markSize, 0.05, 1); finiteIn("Size ramp", spec.ramp, 0, 0.95); finiteIn("Steps", spec.count, 1, 64);
  if (!Number.isInteger(spec.count)) throw new Error("Steps must be an integer");
  if (!["shared", "unit"].includes(spec.origin)) throw new Error(`Unknown pattern origin: ${String(spec.origin)}`);
  if (!["square", "hex"].includes(spec.lattice)) throw new Error(`Unknown lattice: ${String(spec.lattice)}`);
  if (!["dot", "rings", "rosette"].includes(spec.markKind)) throw new Error(`Unknown mark: ${String(spec.markKind)}`);
}

/** The technique a unit gets: the spec's, or for `mixed` a seeded draw of the unit's own id. */
export function resolveOutlineFillKind(spec: Pick<OutlineFillSpec, "kind">, seed: number, unitId: string): OutlineFillKind {
  return spec.kind === "mixed" ? OUTLINE_MIXED_KINDS[componentSeed(seed, unitId, "technique") % OUTLINE_MIXED_KINDS.length] : spec.kind;
}

const WORK = "Line spacing, Type size, Fill unit";
const FLATNESS = 0.12;
/** Most vertices of the wave lines generated for one unit (before clipping). */
export const MAX_WAVE_VERTICES = 1_000_000;
const PHASE = 0.5;
const TAU = 2 * Math.PI;
type Box = readonly [number, number, number, number];

/**
 * The lines of a drifting wave family that can touch a unit, indexed from the pattern origin exactly as `patterns.ts` numbers them
 * (id `line:<k>`, position `driftPosition(k + ½)` along the normal), but generated over the unit only: the normal range is that of the
 * unit's corners, and the origin is slid along the lines by whole wavelengths to the unit's middle, which leaves every wave in phase.
 * The cost follows the unit, not its distance from a shared origin.
 */
function waveLines(spec: OutlineFillSpec, [left, top, right, bottom]: Box, origin: Point, angle: number): PatternStroke[] {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, amplitude = spec.waveAmplitude, wavelength = spec.waveLength;
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]];
  const us = corners.map(([x, y]) => (x - origin[0]) * dx + (y - origin[1]) * dy), vs = corners.map(([x, y]) => (x - origin[0]) * nx + (y - origin[1]) * ny);
  const vlow = Math.min(...vs) - amplitude - 1, vhigh = Math.max(...vs) + amplitude + 1, bound = Math.max(Math.abs(vlow), Math.abs(vhigh));
  const chirp = spec.chirp * 100 / bound;
  driftLimits(spec.spacing, chirp, bound);
  const first = Math.ceil(driftPhase(vlow, spec.spacing, chirp) - PHASE), last = Math.floor(driftPhase(vhigh, spec.spacing, chirp) - PHASE);
  if (last - first + 1 > MAX_PATTERN_LINES) throw new Error(`Wave lines need ${last - first + 1} lines; limit ${MAX_PATTERN_LINES}`);
  const ulow = Math.min(...us), uhigh = Math.max(...us);
  const slide = amplitude === 0 ? (ulow + uhigh) / 2 : Math.round((ulow + uhigh) / 2 / wavelength) * wavelength;
  const travel = Math.max(Math.abs(ulow - slide), Math.abs(uhigh - slide)) + 1;
  // Chord deviation of a sine: curvature A(2π/λ)², so a step h keeps it below h²·curvature/8 ≤ flatness.
  const curvature = amplitude * (TAU / wavelength) ** 2;
  const steps = amplitude === 0 ? 1 : Math.max(2, Math.ceil(2 * travel / Math.sqrt(8 * FLATNESS / curvature)));
  if ((last - first + 1) * (steps + 1) > MAX_WAVE_VERTICES) throw new Error(`Wave lines need ${(last - first + 1) * (steps + 1)} vertices for one unit; limit ${MAX_WAVE_VERTICES}`);
  const offsets: number[] = [];
  for (let k = first; k <= last; k++) offsets.push(driftPosition(k + PHASE, spec.spacing, chirp));
  const lines = gratingLines({ originX: origin[0] + dx * slide, originY: origin[1] + dy * slide, angle, offsets, travel, steps, curve: amplitude, waveCycles: 1, waveSpan: wavelength });
  return lines.map((line, index): PatternStroke => Object.freeze({ id: `line:${first + index}`, closed: false, points: Object.freeze(line.map(([x, y]) => freezePoint([x, y]))) }));
}

/**
 * True when insetting `domain` by `distance` certainly leaves nothing: the largest clearance found on a grid, plus the most the
 * true maximum can exceed it (clearance is 1-Lipschitz, so a point is within 0.71 of a grid pitch of a sample), is still below the
 * distance. A conservative certificate (false never means the inset is non-empty) that spares the kernel the wedges of a large
 * inset on thin strokes; skipped when the grid would be fine enough to cost more than the inset.
 */
function cannotInset(domain: OutlineUnit["domain"], [left, top, right, bottom]: Box, distance: number): boolean {
  const pitch = distance / 2, columns = Math.ceil((right - left) / pitch) + 1, rows = Math.ceil((bottom - top) / pitch) + 1;
  if (columns * rows > 6000) return false;
  let best = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) best = Math.max(best, domainClearance(domain, left + i * pitch, top + j * pitch, distance));
  return best + 0.71 * pitch < distance;
}

/** Most lattice sites examined for one unit (marks are then kept only where they fit). */
export const MAX_LATTICE_SITES = 300_000;

/**
 * The lattice sites (square or staggered, ids `dot:<i>:<j>` and positions exactly those of the `patterns.ts` dot pattern about the origin)
 * inside the unit's box in the lattice frame: the count follows the unit, not its distance from a shared origin.
 */
function dotSites(spec: OutlineFillSpec, [left, top, right, bottom]: Box, origin: Point, angle: number): PatternDot[] {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, hex = spec.lattice === "hex";
  const rowStep = hex ? spec.spacing * Math.sqrt(3) / 2 : spec.spacing;
  const corners = [[left, top], [right, top], [left, bottom], [right, bottom]];
  const us = corners.map(([x, y]) => (x - origin[0]) * dx + (y - origin[1]) * dy), vs = corners.map(([x, y]) => (x - origin[0]) * nx + (y - origin[1]) * ny);
  const ulow = Math.min(...us) - spec.spacing, uhigh = Math.max(...us) + spec.spacing;
  const rows0 = Math.floor(Math.min(...vs) / rowStep), rows1 = Math.ceil(Math.max(...vs) / rowStep);
  const estimate = (rows1 - rows0 + 1) * ((uhigh - ulow) / spec.spacing + 1);
  if (estimate > MAX_LATTICE_SITES) throw new Error(`The dot lattice needs about ${Math.ceil(estimate)} sites for one unit; limit ${MAX_LATTICE_SITES}`);
  const dots: PatternDot[] = [];
  for (let j = rows0; j <= rows1; j++) {
    const stagger = hex && Math.abs(j) % 2 === 1 ? 0.5 : 0;
    for (let i = Math.ceil(ulow / spec.spacing - PHASE - stagger); i <= Math.floor(uhigh / spec.spacing - PHASE - stagger); i++) {
      const u = (i + PHASE + stagger) * spec.spacing, v = j * rowStep;
      dots.push(Object.freeze({ id: `dot:${i}:${j}`, position: freezePoint([origin[0] + dx * u + nx * v, origin[1] + dy * u + ny * v]), angle }));
    }
  }
  return dots;
}

/** The concentric rings (about the origin, radius `driftPosition(k + ½)`, ids `ring:<k>`) that can touch a unit: those whose radius lies between its nearest and farthest points. */
function ringLines(spec: OutlineFillSpec, [left, top, right, bottom]: Box, origin: Point): PatternStroke[] {
  const near = Math.hypot(Math.max(left - origin[0], 0, origin[0] - right), Math.max(top - origin[1], 0, origin[1] - bottom));
  const far = Math.max(...[[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => Math.hypot(x - origin[0], y - origin[1]))) + 1;
  const chirp = spec.chirp * 100 / far;
  driftLimits(spec.spacing, chirp, far);
  const first = Math.max(0, Math.ceil(driftPhase(Math.max(0, near - 1), spec.spacing, chirp) - PHASE)), last = Math.floor(driftPhase(far, spec.spacing, chirp) - PHASE);
  if (last - first + 1 > MAX_PATTERN_LINES) throw new Error(`Rings need ${last - first + 1} rings; limit ${MAX_PATTERN_LINES}`);
  const strokes: PatternStroke[] = [];
  let vertices = 0;
  for (let k = first; k <= last; k++) {
    const r = driftPosition(k + PHASE, spec.spacing, chirp);
    if (!(r > 0)) continue;
    const n = r <= FLATNESS ? 12 : Math.max(12, Math.ceil(Math.PI / Math.acos(1 - FLATNESS / r)));
    vertices += n;
    if (vertices > MAX_PATTERN_VERTICES) throw new Error(`Rings need more than ${MAX_PATTERN_VERTICES} vertices`);
    const points: Point[] = [];
    for (let j = 0; j < n; j++) points.push(freezePoint([origin[0] + r * Math.cos(TAU * j / n), origin[1] + r * Math.sin(TAU * j / n)]));
    strokes.push(Object.freeze({ id: `ring:${k}`, closed: true, points: Object.freeze(points) }));
  }
  return strokes;
}

/** The stock filler of a spec. */
export function outlineFillerFor(spec: OutlineFillSpec): OutlineFiller {
  validateOutlineFill(spec);
    return (unit, context) => {
    const kind = resolveOutlineFillKind(spec, context.seed, unit.id);
    const bounds = unit.domain.bounds;
    if (kind === "none" || !bounds) return empty(unit.id, kind);
    if (kind === "solid") return Object.freeze({ id: unit.id, kind, paths: Object.freeze([]), marks: Object.freeze([]),
      shapes: Object.freeze([Object.freeze({ id: `${unit.id}/solid`, domain: unit.domain, layer: 0, layers: 1 })]) });
    const [left, top, right, bottom] = bounds;
    const seed = componentSeed(context.seed, unit.id, "fill");
    const degrees = spec.angle + spec.angleSpread * (2 * unitDraw(context.seed, unit.id, "angle") - 1), radians = degrees * Math.PI / 180;
    const origin: Point = spec.origin === "shared" ? context.origin : [(left + right) / 2, (top + bottom) / 2];
    const paths: Path[] = [], shapes: OutlineFillShape[] = [], marks: OutlineFillMark[] = [];
    const clipped = (strokes: readonly PatternStroke[]): void => {
      for (const stroke of strokes) for (const piece of withControls("Clipping", WORK, () => clipPath(stroke.points, unit.domain, { closed: stroke.closed, id: `${unit.id}/${stroke.id}` })))
        paths.push(pathOf(piece.id, seed, piece.points, piece.closed));
    };
    if (kind === "hatch") {
      const families = spec.cross ? [[degrees, unit.id], [degrees + 90, `${unit.id}/x`]] as const : [[degrees, unit.id]] as const;
      for (const [angle, id] of families) for (const stroke of withControls("Hatching", WORK, () => hatchDomain(unit.domain, { spacing: spec.spacing, angle, origin, id })))
        paths.push(pathOf(stroke.id, seed, stroke.points, false));
    } else if (kind === "waves") {
      clipped(appendControls("Line spacing, Frequency drift, Wave amplitude, Wavelength, Type size", () => waveLines(spec, bounds, origin, radians)));
    } else if (kind === "rings") {
      clipped(appendControls("Line spacing, Frequency drift, Type size", () => ringLines(spec, bounds, origin)));
    } else if (kind === "contours") {
      // Each ring insets the previous one by one spacing (erosion by a disc composes, and every step then works on a simpler shape
      // with wedges of one spacing's radius, so the cost does not grow with the ring number).
      let current = unit.domain;
      const vanishes = cannotInset(unit.domain, bounds, spec.spacing);
      for (let k = 1; !vanishes && k <= spec.count; k++) {
        const inset = withControls("Contours", "Line spacing, Steps, Type size", () => robustOffset(current, -spec.spacing, "round", `${unit.id}/c${k}`));
        if (inset.regions.length === 0) break;
        current = inset;
        domainRings(inset).forEach((ring, j) => paths.push(pathOf(`${unit.id}/c${k}#${j}`, seed, ring, true, k, (k - 1) / Math.max(1, spec.count - 1))));
      }
    } else if (kind === "dots") {
      const sites = appendControls("Line spacing, Type size", () => dotSites(spec, bounds, origin, radians));
      const dx = Math.cos(radians), dy = Math.sin(radians);
      const projections = [[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => x * dx + y * dy);
      const low = Math.min(...projections), span = Math.max(...projections) - low || 1;
      const base = spec.markSize * spec.spacing / 2;
      for (const dot of sites) {
        const [x, y] = dot.position;
        if (x < left - base || x > right + base || y < top - base || y > bottom + base) continue;
        const scale = 1 - spec.ramp * Math.min(1, Math.max(0, (x * dx + y * dy - low) / span)), radius = base * scale;
        if (domainClearance(unit.domain, x, y, radius) < radius) continue;
        const id = `${unit.id}/${dot.id}`;
        marks.push(Object.freeze({ id, seed: componentSeed(seed, id, "mark"), position: freezePoint(dot.position), angle: dot.angle, scale, radius }));
      }
    } else if (kind === "bands") {
      const nx = -Math.sin(radians), ny = Math.cos(radians), tx = Math.cos(radians), ty = Math.sin(radians);
      const corners = [[left, top], [right, top], [left, bottom], [right, bottom]];
      const vs = corners.map(([x, y]) => x * nx + y * ny), us = corners.map(([x, y]) => x * tx + y * ty);
      const v0 = Math.min(...vs), v1 = Math.max(...vs), u0 = Math.min(...us) - 1, u1 = Math.max(...us) + 1;
      for (let k = 0; k < spec.count; k++) {
        const id = `${unit.id}/b${k}`;
        if (k === 0) { shapes.push(Object.freeze({ id, domain: unit.domain, layer: 0, layers: spec.count })); continue; }
        const from = v0 + (v1 - v0) * k / spec.count, to = v1 + 1;
        const cut = [[u0, from], [u1, from], [u1, to], [u0, to]].map(([u, v]): [number, number] => [u * tx + v * nx, u * ty + v * ny]);
        const layer = withControls("Bands", "Steps, Type size", () => domainIntersection(unit.domain, { outer: cut }, { id }));
        if (layer.regions.length) shapes.push(Object.freeze({ id, domain: layer, layer: k, layers: spec.count }));
      }
    }
    return Object.freeze({ id: unit.id, kind, paths: Object.freeze(paths), shapes: Object.freeze(shapes), marks: Object.freeze(marks) });
  };
}
