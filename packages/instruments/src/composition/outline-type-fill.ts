import { unit as unitDraw } from "./bristle.js";
import { componentSeed } from "./core.js";
import { domainClearance, domainIntersection, domainRings } from "./domains.js";
import type { PlanarDomain } from "./domains.js";
import { offsetDomain } from "./domains-offset.js";
import { clipPath, hatchDomain } from "./domains-paths.js";
import { patternFunction } from "./patterns.js";
import type { PatternFunction, PatternStroke } from "./patterns.js";
import { appendControls, withControls } from "./outline-type.js";
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
 * multiples of `spacing` (round joins, chord error ≤ 0.15), one closed path per ring, so counters
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
  /** Frequency drift of waves and rings, per 100 units from the origin. */
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
  finiteIn("Frequency drift", spec.chirp, -1, 1); finiteIn("Wave amplitude", spec.waveAmplitude, 0, 1000); finiteIn("Wavelength", spec.waveLength, 4, 10000);
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

/** The stock filler of a spec. */
export function outlineFillerFor(spec: OutlineFillSpec): OutlineFiller {
  validateOutlineFill(spec);
  const patterns = new Map<string, PatternFunction>();
  const pattern = (key: string, make: () => PatternFunction): PatternFunction => {
    let hit = patterns.get(key);
    if (!hit) { hit = make(); patterns.set(key, hit); }
    return hit;
  };
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
    const reach = Math.max(Math.hypot(left - origin[0], top - origin[1]), Math.hypot(right - origin[0], top - origin[1]),
      Math.hypot(left - origin[0], bottom - origin[1]), Math.hypot(right - origin[0], bottom - origin[1])) + 1;
    const request = { x: origin[0], y: origin[1], angle: kind === "rings" ? 0 : radians, reach, phase: 0.5, flatness: 0.08 };
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
      const make = pattern(`waves`, () => patternFunction({ kind: "waves", period: spec.spacing, chirp: spec.chirp, amplitude: spec.waveAmplitude, wavelength: spec.waveLength }));
      clipped(appendControls("Line spacing, Frequency drift, Wave amplitude, Type size", () => make(request).strokes));
    } else if (kind === "rings") {
      const make = pattern(`rings`, () => patternFunction({ kind: "rings", period: spec.spacing, chirp: spec.chirp }));
      clipped(appendControls("Line spacing, Frequency drift, Type size", () => make(request).strokes));
    } else if (kind === "contours") {
      for (let k = 1; k <= spec.count; k++) {
        const distance = k * spec.spacing;
        const inset = withControls("Contours", "Line spacing, Steps, Type size", () => offsetDomain(unit.domain, -distance, { join: "round", arcTolerance: Math.min(distance / 50, 0.15), id: `${unit.id}/c${k}` }));
        if (inset.regions.length === 0) break;
        domainRings(inset).forEach((ring, j) => paths.push(pathOf(`${unit.id}/c${k}#${j}`, seed, ring, true, k, (k - 1) / Math.max(1, spec.count - 1))));
      }
    } else if (kind === "dots") {
      const make = pattern(`dots`, () => patternFunction({ kind: "dots", period: spec.spacing, lattice: spec.lattice }));
      // The lattice repeats, so ask for it around a lattice translate nearest the unit (whole periods, an even row count keeps hex stagger): the
      // count then follows the unit's size, not its distance from a shared origin.
      const rowStep = spec.lattice === "hex" ? spec.spacing * Math.sqrt(3) / 2 : spec.spacing, c = Math.cos(radians), s = Math.sin(radians);
      const cx = (left + right) / 2 - origin[0], cy = (top + bottom) / 2 - origin[1];
      const j0 = 2 * Math.round((-cx * s + cy * c) / (2 * rowStep)), i0 = Math.round((cx * c + cy * s) / spec.spacing);
      const lx = i0 * spec.spacing, ly = j0 * rowStep;
      const local = { ...request, x: origin[0] + c * lx - s * ly, y: origin[1] + s * lx + c * ly, reach: Math.hypot(right - left, bottom - top) / 2 + 2 * spec.spacing };
      const sites = appendControls("Line spacing, Type size", () => make(local).dots);
      const dx = Math.cos(radians), dy = Math.sin(radians);
      const projections = [[left, top], [right, top], [left, bottom], [right, bottom]].map(([x, y]) => x * dx + y * dy);
      const low = Math.min(...projections), span = Math.max(...projections) - low || 1;
      const base = spec.markSize * spec.spacing / 2;
      for (const dot of sites) {
        const [x, y] = dot.position;
        if (x < left - base || x > right + base || y < top - base || y > bottom + base) continue;
        const scale = 1 - spec.ramp * ((x * dx + y * dy - low) / span), radius = base * scale;
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
