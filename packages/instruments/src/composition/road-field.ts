import { gradientNoise2D01 } from "@procedurals/javascript";
import { componentSeed } from "./core.js";

/**
 * The alignment field that guides street growth: a 4-fold (tensor-like) orientation field. At every
 * point it names one angle `theta` (radians); streets may run along `theta` or across it
 * (`theta + π/2`), so the field has no preferred sign and no "up". Coordinates are the street model's
 * local frame (canvas units, the site centre at the origin, y down).
 *
 * - `grid`: `theta` is `angle` everywhere (a Cartesian grid at that angle).
 * - `radial`: `theta` is the direction away from `focus`: spokes along it, rings across it.
 * - `spiral`: as radial, turned by `spin` (degrees): logarithmic-spiral streets and their crossings.
 * - `organic`: `theta` follows smooth seeded noise of feature size `scale`, sweeping about ±1 radian,
 *   so streets bend gently and never settle on one axis.
 * - `warp` (degrees, all but organic): adds smooth seeded noise of feature size `scale`, at most ±`warp`.
 *
 * The field is pure in `(options, x, y)`: the seed enters only through `componentSeed(seed, "road-field", …)`.
 */
export type RoadFieldKind = "grid" | "radial" | "spiral" | "organic";

export interface RoadFieldOptions {
  readonly kind: RoadFieldKind;
  /** Grid angle, degrees. */
  readonly angle: number;
  /** Spiral turn, degrees. */
  readonly spin: number;
  readonly focus: readonly [number, number];
  /** Noise amplitude added to grid, radial and spiral fields, degrees. */
  readonly warp: number;
  /** Noise feature size, canvas units. */
  readonly scale: number;
  readonly seed: number;
}

export interface RoadField {
  /** Orientation angle in radians at a local point (defined modulo π/2). */
  orientation(x: number, y: number): number;
  /**
   * The unit direction of the field at a point that is closest to `previous` (streets keep their heading
   * through the field). `bias` (radians) turns the field's angle first: a street's own wobble.
   */
  direction(x: number, y: number, previous: readonly [number, number], bias?: number): [number, number];
}

const radians = Math.PI / 180;

export function roadField(options: RoadFieldOptions): RoadField {
  const { kind, angle, spin, focus, warp, scale, seed } = options;
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("Field scale must be a positive number");
  const shape = gradientNoise2D01({ seed: componentSeed(seed, "road-field", "shape") });
  const bend = gradientNoise2D01({ seed: componentSeed(seed, "road-field", "warp") });
  const orientation = (x: number, y: number): number => {
    let theta: number;
    if (kind === "grid") theta = angle * radians;
    else if (kind === "radial") theta = Math.atan2(y - focus[1], x - focus[0]);
    else if (kind === "spiral") theta = Math.atan2(y - focus[1], x - focus[0]) + spin * radians;
    else return (shape.sample(x / scale, y / scale) - 0.5) * 2 * 2;
    return warp === 0 ? theta : theta + (bend.sample(x / scale, y / scale) - 0.5) * 2 * warp * radians;
  };
  return {
    orientation,
    direction(x, y, previous, bias = 0) {
      const theta = orientation(x, y) + bias, c = Math.cos(theta), s = Math.sin(theta);
      // Candidates +-along and +-across; the largest dot with the previous heading wins (ties: along, positive).
      let best: [number, number] = [c, s], bestDot = c * previous[0] + s * previous[1];
      for (const candidate of [[-c, -s], [-s, c], [s, -c]] as const) {
        const dot = candidate[0] * previous[0] + candidate[1] * previous[1];
        if (dot > bestDot + 1e-12) { bestDot = dot; best = [candidate[0], candidate[1]]; }
      }
      return best;
    },
  };
}
