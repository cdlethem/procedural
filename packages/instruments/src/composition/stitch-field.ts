import { imageField } from "./image-field.js";
import type { FieldFrame, FieldImage, ImageField } from "./image-field.js";

/**
 * The stitch direction field: which way the thread lies at every canvas point.
 *
 * A field is a pure function `angleAt(x, y)` returning the direction of the LINE the thread lies along, in radians in
 * [0, pi), UNSIGNED (a line has no sense; the router picks the sign). Angles are measured from +x toward +y on the
 * y-down canvas, i.e. clockwise on screen. Everything at the control boundary is degrees.
 *
 * - `constant`: `angle` everywhere.
 * - `radial`: the direction from the center `(centerX, centerY)` to the point, turned by `angle`. 0 lies along the spokes;
 *   90 lies along the rings; other values are logarithmic spirals.
 * - `swirl`: as radial, but the turn also grows with distance: `angle + twist * r / 100` for a point `r` canvas units from the
 *   center, so the thread runs along the spokes near the center and curls into rings farther out (or the other way for a
 *   negative twist).
 * - `image`: the foundation's structure-tensor orientation of a resolved picture (`imageField`, mode `follow`), placed on the
 *   canvas by `frame` and smoothed at `smoothing` canvas units. The thread follows the picture's edges and stripes where they
 *   are coherent: with the picture's own coherence `c` in [0, 1] the direction is the ORIENTATION average (double-angle
 *   vectors, so 0.05 and pi - 0.05 average to horizontal) of the picture's direction with weight `follow * c` and the
 *   constant `angle` with weight `1 - follow * c`. Flat areas (no direction) and `follow = 0` take `angle` exactly.
 *
 * Fields are stateless and cached by construction only (`fieldKey`); they never read a palette, material or seed.
 */
export type StitchFieldSpec =
  | { kind: "constant"; angle: number }
  | { kind: "radial"; angle: number; centerX: number; centerY: number }
  | { kind: "swirl"; angle: number; twist: number; centerX: number; centerY: number }
  | { kind: "image"; angle: number; follow: number; image: FieldImage; frame: FieldFrame; smoothing: number };

export type StitchFieldKind = StitchFieldSpec["kind"];
export const stitchFieldKinds: readonly StitchFieldKind[] = Object.freeze(["constant", "radial", "swirl", "image"] as const);

export interface StitchField {
  readonly spec: StitchFieldSpec;
  /** True when the direction is the same everywhere (exact straight rows are then possible). */
  readonly constant: boolean;
  /** Stable text naming the construction (image identity included); never includes appearance. */
  readonly key: string;
  /** Line direction at a canvas point, radians in [0, pi). */
  angleAt(x: number, y: number): number;
}

const RADIANS = Math.PI / 180;
export const halfTurn = (a: number): number => { const r = a - Math.PI * Math.floor(a / Math.PI); return r >= Math.PI ? 0 : r; };

function num(name: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a finite number in [${min}, ${max}]`);
}

function imageKey(image: FieldImage): string {
  return image.kind === "raster" ? `raster:${image.raster.hash}` : `bundled:${image.id}:${image.variant}:${image.size}`;
}

/** Text that identifies a field's construction. */
export function fieldKey(spec: StitchFieldSpec): string {
  switch (spec.kind) {
    case "constant": return `constant:${spec.angle}`;
    case "radial": return `radial:${spec.angle}:${spec.centerX}:${spec.centerY}`;
    case "swirl": return `swirl:${spec.angle}:${spec.twist}:${spec.centerX}:${spec.centerY}`;
    case "image": return `image:${spec.angle}:${spec.follow}:${imageKey(spec.image)}:${JSON.stringify(spec.frame)}:${spec.smoothing}`;
    default: throw new Error(`Unknown stitch field: ${String((spec as { kind: string }).kind)}`);
  }
}

const cache = new Map<string, StitchField>();

/** The direction field for a construction (cached, frozen). Throws naming the control for a bad number. */
export function stitchField(spec: StitchFieldSpec): StitchField {
  if (!stitchFieldKinds.includes(spec?.kind)) throw new Error(`Unknown stitch field: ${String((spec as { kind?: string } | undefined)?.kind)}; use ${stitchFieldKinds.join(", ")}`);
  num("Angle", spec.angle, -1e6, 1e6);
  if (spec.kind === "radial" || spec.kind === "swirl") { num("Field center X", spec.centerX, -1e6, 1e6); num("Field center Y", spec.centerY, -1e6, 1e6); }
  if (spec.kind === "swirl") num("Twist", spec.twist, -1e4, 1e4);
  if (spec.kind === "image") {
    num("Image follow", spec.follow, 0, 1); num("Direction smoothing", spec.smoothing, 0, 1e6);
  }
  const key = fieldKey(spec);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const base = spec.angle * RADIANS;
  let angleAt: (x: number, y: number) => number;
  switch (spec.kind) {
    case "constant": { const a = halfTurn(base); angleAt = () => a; break; }
    case "radial": { const { centerX: cx, centerY: cy } = spec; angleAt = (x, y) => halfTurn(Math.atan2(y - cy, x - cx) + base); break; }
    case "swirl": {
      const { centerX: cx, centerY: cy, twist } = spec, turn = twist * RADIANS / 100;
      angleAt = (x, y) => halfTurn(Math.atan2(y - cy, x - cx) + base + turn * Math.hypot(x - cx, y - cy));
      break;
    }
    case "image": {
      const picture: ImageField = imageField({ image: spec.image, value: "lightness", smoothing: spec.smoothing, mode: "follow",
        ambient: { kind: "angle", angle: 0, weight: 0 }, frame: spec.frame });
      const follow = spec.follow, ux = Math.cos(2 * halfTurn(base)), uy = Math.sin(2 * halfTurn(base));
      angleAt = (x, y) => {
        const s = picture.at(x, y);
        const w = s.defined ? follow * s.coherence : 0;
        if (w === 0) return halfTurn(base);
        const sx = w * Math.cos(2 * s.angle) + (1 - w) * ux, sy = w * Math.sin(2 * s.angle) + (1 - w) * uy;
        return Math.hypot(sx, sy) > 1e-12 ? halfTurn(0.5 * Math.atan2(sy, sx)) : halfTurn(base);
      };
      break;
    }
  }
  const field: StitchField = Object.freeze({ spec: Object.freeze({ ...spec }) as StitchFieldSpec, constant: spec.kind === "constant", key, angleAt });
  cache.set(key, field);
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  return field;
}
