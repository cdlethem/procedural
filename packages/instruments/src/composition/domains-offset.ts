import { PlanarError, ringArea, overlay, checkCoordinate, type Pt } from "./planar-kernel.js";
import {
  PLANAR_LIMITS, resolveShape, ringsOfRegions, finishRaw, workFor, checkEdgeLimit, unionDomains,
  type PlanarDomain, type PlanarOptions, type PlanarShape,
} from "./domains.js";

/**
 * Offsetting of regions with holes, inward and outward, with stated joins.
 *
 * MODEL. The boundary of a region is a set of rings with the region on their left. Distance `d > 0`
 * grows the region (outward = to the right of the rings, so holes shrink); `d < 0` shrinks it
 * (holes grow); `0` returns the region normalised. For the offset side, every boundary edge is
 * swept into a rectangle of width `|d|`, and every vertex whose offset edges would otherwise
 * separate (a convex vertex when growing, a reflex vertex when shrinking) gets a join wedge.
 * Growing is the exact union of the region with those pieces; shrinking is the region minus their
 * exact union, so pieces overlapping each other, thin necks, collapsing holes, and a shape
 * narrower than `2|d|` (it vanishes) all fall out of the exact Boolean without special cases.
 *
 * JOINS (`join`). "round": a circular arc of radius |d| about the vertex, as an inscribed
 * polygon (its vertices lie on the true offset curve, chords inside it) with chord-to-arc
 * deviation at most `arcTolerance` (default |d|/50). "miter": the two offset lines are extended
 * to their intersection; when the tip would lie farther than `miterLimit × |d|` from the vertex
 * (default limit 4, the SVG default; `1/sin(θ/2)` for interior angle θ) the join falls back to
 * "bevel", the straight chord between the two offset edge ends (SVG `miter` semantics, not
 * `miter-clip`). Vertices that need no join (the offset edges overlap) contribute none.
 *
 * Limits: `PLANAR_LIMITS.maxEdges` boundary edges in, and the generated pieces are bounded by
 * the same limit; exceeding either throws naming `distance`, `arcTolerance` or the input size.
 */
export interface OffsetOptions extends PlanarOptions {
  readonly join?: "round" | "miter" | "bevel";
  readonly miterLimit?: number;
  readonly arcTolerance?: number;
}

const MAX_ARC_STEPS = 4096;

export function offsetDomain(shape: PlanarShape, distance: number, options: OffsetOptions = {}): PlanarDomain {
  checkCoordinate("distance", distance);
  const join = options.join ?? "round";
  if (join !== "round" && join !== "miter" && join !== "bevel") throw new PlanarError("INVALID_INPUT", `options.join must be "round", "miter" or "bevel"`);
  const miterLimit = options.miterLimit ?? 4;
  if (typeof miterLimit !== "number" || !(miterLimit >= 1) || !Number.isFinite(miterLimit)) throw new PlanarError("INVALID_INPUT", "options.miterLimit must be a finite number ≥ 1");
  const D = Math.abs(distance);
  const tolerance = options.arcTolerance ?? (D > 0 ? D / 50 : 1);
  if (typeof tolerance !== "number" || !(tolerance > 0) || !Number.isFinite(tolerance)) throw new PlanarError("INVALID_INPUT", "options.arcTolerance must be a finite number > 0");
  const work = workFor("offsetDomain", options);
  const domain = resolveShape(shape, 0, work);
  const regions = "regions" in domain ? domain.regions : [domain];
  const id = options.id ?? `offset(${"regions" in domain ? domain.id : domain.id},${distance})`;
  if (distance === 0 || regions.length === 0) return unionDomains(regions, { ...options, id });
  const rings = ringsOfRegions(regions);
  checkEdgeLimit(rings, "offsetDomain input");
  const outward = distance > 0;
  const step = tolerance >= D ? Math.PI / 2 : 2 * Math.acos(1 - tolerance / D);

  const pieces: Pt[][] = [];
  let vertices = 0;
  const emit = (piece: Pt[]): void => {
    vertices += piece.length;
    if (vertices > PLANAR_LIMITS.maxEdges) throw new PlanarError("WORK_LIMIT", `offsetDomain would generate more than ${PLANAR_LIMITS.maxEdges} boundary edges; use a coarser arcTolerance, a bevel or miter join, or a simpler input`);
    if (ringArea(piece) === 0) return;
    pieces.push(ringArea(piece) > 0 ? piece : piece.reverse());
  };
  for (const ring of rings) {
    const n = ring.length;
    // Unit direction and offset-side normal of every edge (edge i runs ring[i] → ring[i+1]).
    const ux = new Float64Array(n), uy = new Float64Array(n), nx = new Float64Array(n), ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (!(length > 0) || !Number.isFinite(length)) throw new PlanarError("INVALID_INPUT", "A ring has an edge whose length is not representable");
      ux[i] = dx / length; uy[i] = dy / length;
      // Rings keep the region on their left: the left normal points into it, the right normal away.
      if (outward) { nx[i] = uy[i]; ny[i] = -ux[i]; } else { nx[i] = -uy[i]; ny[i] = ux[i]; }
    }
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      emit([[a[0], a[1]], [b[0], b[1]], [b[0] + D * nx[i], b[1] + D * ny[i]], [a[0] + D * nx[i], a[1] + D * ny[i]]]);
    }
    for (let i = 0; i < n; i++) {
      const p = (i + n - 1) % n, v = ring[i];
      const turn = ux[p] * uy[i] - uy[p] * ux[i];
      if (turn === 0 || (outward ? turn < 0 : turn > 0)) continue; // offset edges overlap: no join needed
      const start: Pt = [v[0] + D * nx[p], v[1] + D * ny[p]], end: Pt = [v[0] + D * nx[i], v[1] + D * ny[i]];
      const wedge: Pt[] = [[v[0], v[1]], start];
      const c = nx[p] * nx[i] + ny[p] * ny[i];
      if (join === "miter" && 1 + c > 1e-12 && Math.sqrt(2 / (1 + c)) <= miterLimit)
        wedge.push([v[0] + D * (nx[p] + nx[i]) / (1 + c), v[1] + D * (ny[p] + ny[i]) / (1 + c)]);
      else if (join === "round") {
        const angle = Math.atan2(nx[p] * ny[i] - ny[p] * nx[i], c), base = Math.atan2(ny[p], nx[p]);
        const count = Math.max(1, Math.ceil(Math.abs(angle) / step));
        if (count > MAX_ARC_STEPS) throw new PlanarError("WORK_LIMIT", `A round join needs ${count} arc steps; raise arcTolerance`);
        for (let k = 1; k < count; k++) wedge.push([v[0] + D * Math.cos(base + angle * k / count), v[1] + D * Math.sin(base + angle * k / count)]);
      }
      wedge.push(end);
      emit(wedge);
    }
  }
  const raw = overlay([{ rings, fill: "nonzero" }, { rings: pieces, fill: "nonzero" }], outward ? ([a, b]) => a || b : ([a, b]) => a && !b, work);
  return finishRaw(id, raw, options);
}
