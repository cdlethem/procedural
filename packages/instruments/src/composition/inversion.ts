import type { Point } from "./types.js";

/**
 * Exact circle inversion on the plane, for circles, lines, points and oriented frames.
 *
 * REPRESENTATION. An oriented generalized circle ("cline") is the vector (a, bx, by, d) of the
 * region { p : a|p|² + 2 b·p + d < 0 }, normalized so that bx² + by² − a·d = 1. For a circle
 * a is its signed curvature (positive: the region is the disc, negative: everything outside the
 * circle) and the centre is −b/a; for a line a = 0, |b| = 1 and the region is the half plane
 * { b·p < −d/2 }. The bilinear form ⟨u, v⟩ = ub·vb − (ua·vd + ud·va)/2 makes inversion in a
 * circle O (normalized, ⟨O, O⟩ = 1) the reflection v ↦ v − 2⟨v, O⟩ O. That single formula
 * carries every image rule (a circle through the centre becomes a line, a line missing the
 * centre becomes a circle through it, orthogonal circles are fixed) and keeps track of which
 * side of the image is the image of the region. ⟨u, v⟩ is preserved, so tangency (⟨u, v⟩ = ±1)
 * and the angle between circles survive.
 *
 * UNITS. Canvas units; curvature is 1/unit. A circle of radius above 10⁹ units is a line
 * (`LINE_CURVATURE`). Nothing here fetches, randomizes or allocates beyond its return value.
 * Failure: nonpositive or nonfinite radii throw; a point at a pole has no image and is null.
 */
export interface Cline { readonly a: number; readonly bx: number; readonly by: number; readonly d: number }

export const LINE_CURVATURE = 1e-9;
/** Squared distance from a pole, relative to r², under which a point is treated as the pole itself. */
const POLE_EPSILON = 1e-24;

export type ClineShape =
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly disc: boolean }
  | { readonly kind: "line"; readonly nx: number; readonly ny: number; readonly offset: number };

function finite(label: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

/** The circle centre (cx, cy), radius r; `disc` chooses whether the region is the inside or the outside. */
export function circleCline(cx: number, cy: number, r: number, disc = true): Cline {
  finite("Circle centre", cx); finite("Circle centre", cy);
  if (!Number.isFinite(r) || r <= 0) throw new Error("Circle radius must be positive and finite");
  const a = (disc ? 1 : -1) / r;
  return Object.freeze({ a, bx: -a * cx, by: -a * cy, d: a * (cx * cx + cy * cy - r * r) });
}

/** The half plane { n·p < offset } for a direction (nx, ny) of any nonzero length. */
export function lineCline(nx: number, ny: number, offset: number): Cline {
  const length = Math.hypot(nx, ny);
  if (!Number.isFinite(length) || length === 0) throw new Error("Line direction must be finite and nonzero");
  finite("Line offset", offset);
  return Object.freeze({ a: 0, bx: nx / length, by: ny / length, d: -2 * offset / length });
}

/** Value of the defining form at p; negative inside the region, zero on the cline. */
export function clineValue(v: Cline, x: number, y: number): number {
  return v.a * (x * x + y * y) + 2 * (v.bx * x + v.by * y) + v.d;
}

/** ⟨u, v⟩. Two clines are orthogonal at 0, tangent at ±1 (oriented: −1 when the regions touch from outside). */
export function clineDot(u: Cline, v: Cline): number {
  return u.bx * v.bx + u.by * v.by - (u.a * v.d + u.d * v.a) / 2;
}

/** Circle or line, with centre/radius or normal/offset; the region side is `disc` or the normal's negative side. */
export function clineShape(v: Cline): ClineShape {
  if (Math.abs(v.a) < LINE_CURVATURE) {
    const length = Math.hypot(v.bx, v.by);
    return { kind: "line", nx: v.bx / length, ny: v.by / length, offset: -v.d / (2 * length) };
  }
  return { kind: "circle", cx: -v.bx / v.a, cy: -v.by / v.a, r: 1 / Math.abs(v.a), disc: v.a > 0 };
}

/** A circle inversion: the pole, radius and the reflection vector it applies to clines. */
export interface CircleInversion {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly r2: number;
  readonly cline: Cline;
}

export function circleInversion(cx: number, cy: number, r: number): CircleInversion {
  return Object.freeze({ cx, cy, r, r2: r * r, cline: circleCline(cx, cy, r) });
}

/** The image of a point, or null at the pole. An involution off the pole. */
export function invertPoint(inv: CircleInversion, x: number, y: number): Point | null {
  const dx = x - inv.cx, dy = y - inv.cy, rho2 = dx * dx + dy * dy;
  if (!(rho2 > POLE_EPSILON * inv.r2)) return null;
  const k = inv.r2 / rho2;
  return [inv.cx + dx * k, inv.cy + dy * k];
}

/** The image of an oriented cline; the image region is the image of the region. */
export function invertCline(v: Cline, inv: CircleInversion): Cline {
  const o = inv.cline, t = 2 * clineDot(v, o);
  return { a: v.a - t * o.a, bx: v.bx - t * o.bx, by: v.by - t * o.by, d: v.d - t * o.d };
}

/**
 * A local frame: position, axis angle (radians) and signed scale (negative mirrors across the
 * axis, the `Site` convention). Inversion is conformal with reversed orientation: at distance ρ
 * from the pole with radial direction φ the scale multiplies by r²/ρ², the axis becomes
 * 2φ + π − θ and the mirror flag flips. Null at the pole.
 */
export interface Frame { readonly x: number; readonly y: number; readonly angle: number; readonly scale: number }

export function invertFrame(inv: CircleInversion, frame: Frame): Frame | null {
  const dx = frame.x - inv.cx, dy = frame.y - inv.cy, rho2 = dx * dx + dy * dy;
  if (!(rho2 > POLE_EPSILON * inv.r2)) return null;
  const k = inv.r2 / rho2;
  return { x: inv.cx + dx * k, y: inv.cy + dy * k, angle: 2 * Math.atan2(dy, dx) + Math.PI - frame.angle, scale: -frame.scale * k };
}

/* ---------------------------------------------------------------- curves */

export interface Segment { readonly kind: "segment"; readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
export interface Circle { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
/** Counterclockwise for a positive sweep (angles increase from +x toward +y). */
export interface Arc { readonly kind: "arc"; readonly cx: number; readonly cy: number; readonly r: number; readonly start: number; readonly sweep: number }

/** Keep the part of a curve where the region's form is negative (`inside`) or nonnegative (`!inside`). */
export interface Constraint { readonly region: Cline; readonly inside: boolean }

const TAU = 2 * Math.PI;
const INTERVAL_EPSILON = 1e-12;

function holds(constraints: readonly Constraint[], x: number, y: number): boolean {
  for (const { region, inside } of constraints) {
    const value = clineValue(region, x, y);
    if (inside ? !(value < 0) : value < 0) return false;
  }
  return true;
}

function quadraticRoots(a: number, b: number, c: number, out: number[]): void {
  if (Math.abs(a) < 1e-18 * (Math.abs(b) + Math.abs(c) + 1e-300)) {
    if (b !== 0) out.push(-c / b);
    return;
  }
  const disc = b * b - 4 * a * c;
  if (!(disc >= 0)) return;
  const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(disc)) / 2;
  out.push(q / a);
  if (q !== 0) out.push(c / q);
}

/** Parameter intervals [t0, t1] ⊂ [0, 1] of the segment on which every constraint holds. */
export function segmentIntervals(s: Segment, constraints: readonly Constraint[]): [number, number][] {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, breaks = [0, 1];
  for (const { region: v } of constraints) {
    const roots: number[] = [];
    quadraticRoots(v.a * (dx * dx + dy * dy), 2 * (v.a * (dx * s.x0 + dy * s.y0) + v.bx * dx + v.by * dy), clineValue(v, s.x0, s.y0), roots);
    for (const t of roots) if (t > 0 && t < 1) breaks.push(t);
  }
  breaks.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const t0 = breaks[i], t1 = breaks[i + 1];
    if (t1 - t0 <= INTERVAL_EPSILON) continue;
    const t = (t0 + t1) / 2;
    if (!holds(constraints, s.x0 + dx * t, s.y0 + dy * t)) continue;
    const last = out[out.length - 1];
    if (last && last[1] >= t0 - INTERVAL_EPSILON) last[1] = t1; else out.push([t0, t1]);
  }
  return out;
}

/**
 * Angular intervals [start, end] (radians, end − start ≤ 2π, counterclockwise) of a circle on
 * which every constraint holds. A whole circle is the single interval [0, 2π].
 */
export function circleIntervals(c: Circle, constraints: readonly Constraint[]): [number, number][] {
  const breaks: number[] = [];
  for (const { region: v } of constraints) {
    const k = clineValue(v, c.cx, c.cy) + v.a * c.r * c.r;
    const wx = 2 * c.r * (v.a * c.cx + v.bx), wy = 2 * c.r * (v.a * c.cy + v.by), l = Math.hypot(wx, wy);
    if (!(l > 0) || !(Math.abs(k) < l)) continue;
    const phi = Math.atan2(wy, wx), spread = Math.acos(-k / l);
    for (const angle of [phi - spread, phi + spread]) breaks.push(((angle % TAU) + TAU) % TAU);
  }
  const at = (theta: number) => holds(constraints, c.cx + c.r * Math.cos(theta), c.cy + c.r * Math.sin(theta));
  breaks.sort((p, q) => p - q);
  const unique = breaks.filter((value, i) => i === 0 || value - breaks[i - 1] > INTERVAL_EPSILON);
  if (unique.length && unique[unique.length - 1] - unique[0] > TAU - INTERVAL_EPSILON) unique.pop();
  if (unique.length < 2) return at(unique.length ? unique[0] + 0.5 * Math.PI : 0) ? [[0, TAU]] : [];
  const m = unique.length;
  const spans = unique.map((start, i) => ({ start, end: i + 1 < m ? unique[i + 1] : unique[0] + TAU }));
  const valid = spans.map((span) => at((span.start + span.end) / 2));
  if (valid.every(Boolean)) return [[0, TAU]];
  const out: [number, number][] = [];
  for (let s = 0; s < m; s++) {
    if (!valid[s] || valid[(s + m - 1) % m]) continue;
    let end = spans[s].end, j = s;
    while (valid[(j + 1) % m]) { j = (j + 1) % m; end = spans[j].end + (j < s ? TAU : 0); }
    out.push([spans[s].start, end]);
  }
  return out;
}

/**
 * The arc through three points in order, exact for any image of a straight edge under inversion:
 * a `segment` when the three points are collinear to within one thousandth of a unit of sag.
 */
export function arcThrough(p0: Point, pm: Point, p1: Point): Segment | Arc {
  const bx = pm[0] - p0[0], by = pm[1] - p0[1], cx = p1[0] - p0[0], cy = p1[1] - p0[1];
  const cross = bx * cy - by * cx, scale = bx * bx + by * by + cx * cx + cy * cy;
  const straight: Segment = { kind: "segment", x0: p0[0], y0: p0[1], x1: p1[0], y1: p1[1] };
  if (!(Math.abs(cross) > 1e-12 * scale)) return straight;
  const d = 2 * cross, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d, uy = (bx * c2 - cx * b2) / d, r = Math.hypot(ux, uy);
  const centreX = p0[0] + ux, centreY = p0[1] + uy;
  const a0 = Math.atan2(-uy, -ux), a1 = Math.atan2(p1[1] - centreY, p1[0] - centreX);
  const sweep = cross > 0 ? (((a1 - a0) % TAU) + TAU) % TAU : -((((a0 - a1) % TAU) + TAU) % TAU);
  if (r * (1 - Math.cos(sweep / 2)) < 1e-3 && Math.abs(sweep) < Math.PI) return straight;
  return { kind: "arc", cx: centreX, cy: centreY, r, start: a0, sweep };
}

/** Steps needed so a chord never falls more than `tolerance` units from the arc. */
export function arcSteps(r: number, sweep: number, tolerance: number, minimum = 1): number {
  const step = r <= tolerance ? Math.PI : 2 * Math.acos(1 - tolerance / r);
  return Math.max(minimum, Math.ceil(Math.abs(sweep) / step));
}

/** `steps + 1` points along the arc, endpoints included. */
export function sampleArc(arc: Arc, steps: number, into: Point[] = []): Point[] {
  for (let i = 0; i <= steps; i++) {
    const theta = arc.start + arc.sweep * i / steps;
    into.push([arc.cx + arc.r * Math.cos(theta), arc.cy + arc.r * Math.sin(theta)]);
  }
  return into;
}

/** The circle through three points, or null when they are collinear. */
export function circumcircle(p: Point, q: Point, s: Point): { cx: number; cy: number; r: number } | null {
  const bx = q[0] - p[0], by = q[1] - p[1], cx = s[0] - p[0], cy = s[1] - p[1];
  const d = 2 * (bx * cy - by * cx);
  if (Math.abs(d) < 1e-14 * (bx * bx + by * by + cx * cx + cy * cy)) return null;
  const b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d, uy = (bx * c2 - cx * b2) / d;
  return { cx: p[0] + ux, cy: p[1] + uy, r: Math.hypot(ux, uy) };
}
