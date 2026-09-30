/**
 * Bundled containers and barriers for Collision Scores, as planar domains and free posts.
 *
 * A container is any `PlanarShape` (see `docs/composition-domains.md`): its boundary rings are the walls, holes are
 * islands the bodies bounce off. The instrument persists only a bundled shape name and scalar controls; a host
 * that resolves a user's own region hands the typed value to `collisionModel` directly (binding user assets
 * to a Studio layer is future host work).
 *
 * - `rectangle`, `ellipse` (a 96-gon inscribed in the ellipse: the walls are its edges), `diamond`, `l-room` (a
 *   reflex corner), `island` (a rectangle around a diamond island). All are scaled to `width × height`, rotated by
 *   `rotation` degrees about the centre, then placed at `(centerX, centerY)`.
 * - Barriers: `pins` are round posts on a staggered lattice; `slats` are thin bars cut out of the container by an
 *   exact Boolean difference. Both stay inside the container with room for a body to pass, and never block the
 *   emitter.
 */
import { PlanarError, domainDifference, domainRings, planarDomain, planarRegion, type PlanarDomain, type PlanarShape, type Ring } from "./domains.js";
import { buildWalls, distanceToWalls, insideContainer, wallsNear } from "./collision-walls.js";

export const containerShapes = ["rectangle", "ellipse", "diamond", "l-room", "island"] as const;
export type ContainerShape = (typeof containerShapes)[number];
export const barrierKinds = ["none", "pins", "slats"] as const;
export type BarrierKind = (typeof barrierKinds)[number];

export interface ContainerSpec {
  readonly shape: ContainerShape;
  readonly centerX: number; readonly centerY: number;
  readonly width: number; readonly height: number;
  /** Degrees. */
  readonly rotation: number;
}

/** The emitter footprint a barrier must keep clear (canvas units). Only what the emitter mode occupies. */
export interface EmitterFootprint {
  readonly mode: "scatter" | "line" | "ring" | "nozzle";
  readonly x: number; readonly y: number; readonly extent: number; readonly angle: number;
}

const ELLIPSE_SIDES = 96;
const SLAT_THICKNESS = 6;

function localRings(shape: ContainerShape, w: number, h: number): { outer: [number, number][]; holes: [number, number][][] } {
  const a = w / 2, b = h / 2;
  switch (shape) {
    case "rectangle": return { outer: [[-a, -b], [a, -b], [a, b], [-a, b]], holes: [] };
    case "ellipse": return { outer: Array.from({ length: ELLIPSE_SIDES }, (_, i) => [a * Math.cos(2 * Math.PI * i / ELLIPSE_SIDES), b * Math.sin(2 * Math.PI * i / ELLIPSE_SIDES)] as [number, number]), holes: [] };
    case "diamond": return { outer: [[0, -b], [a, 0], [0, b], [-a, 0]], holes: [] };
    case "l-room": return { outer: [[-a, -b], [0, -b], [0, 0], [a, 0], [a, b], [-a, b]], holes: [] };
    case "island": return { outer: [[-a, -b], [a, -b], [a, b], [-a, b]], holes: [[[0, -b / 2.4], [a / 2.4, 0], [0, b / 2.4], [-a / 2.4, 0]]] };
  }
}

const place = (points: readonly (readonly [number, number])[], spec: ContainerSpec): [number, number][] => {
  const c = Math.cos(spec.rotation * Math.PI / 180), s = Math.sin(spec.rotation * Math.PI / 180);
  return points.map(([x, y]) => [spec.centerX + x * c - y * s, spec.centerY + x * s + y * c]);
};

/** A bundled container as a planar domain. */
export function bundledContainer(spec: ContainerSpec): PlanarDomain {
  if (!(containerShapes as readonly string[]).includes(spec.shape)) throw new Error(`Unknown container: ${String(spec.shape)}`);
  for (const [name, value] of [["width", spec.width], ["height", spec.height]] as const)
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Container ${name} must be positive`);
  const local = localRings(spec.shape, spec.width, spec.height);
  return planarDomain(planarRegion({ id: `container:${spec.shape}`, outer: place(local.outer, spec), holes: local.holes.map((hole) => place(hole, spec)) }), { id: `container:${spec.shape}` });
}

/** The boundary rings of a container as plain arrays, region on the left of every ring. */
export function containerRings(shape: PlanarShape): number[][][] {
  const domain = planarDomain(shape);
  if (domain.regions.length === 0) throw new Error("The container is empty");
  return domainRings(domain).map((ring: Ring) => ring.map(([x, y]) => [x, y]));
}

function emitterDistance(e: EmitterFootprint, x: number, y: number): number {
  switch (e.mode) {
    case "scatter": return Infinity;
    case "nozzle": return Math.hypot(x - e.x, y - e.y);
    case "ring": return Math.abs(Math.hypot(x - e.x, y - e.y) - e.extent / 2);
    case "line": {
      const rad = e.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
      const along = Math.max(-e.extent / 2, Math.min(e.extent / 2, (x - e.x) * ux + (y - e.y) * uy));
      return Math.hypot(x - (e.x + ux * along), y - (e.y + uy * along));
    }
  }
}

/**
 * Barriers for a container. `size` is a pin radius or a slat length (canvas units), `count` the lattice rows or the
 * number of slats, `angle` the slat tilt in degrees (alternating sides). `room` is the clearance to keep around every
 * barrier for the largest body plus a margin.
 */
export function barriers(container: PlanarDomain, kind: BarrierKind, count: number, size: number, angle: number, room: number,
  emitter: EmitterFootprint): { container: PlanarDomain; posts: [number, number, number][] } {
  if (kind === "none") return { container, posts: [] };
  const [left, top, right, bottom] = container.bounds!;
  const width = right - left, height = bottom - top, cx = (left + right) / 2, cy = (top + bottom) / 2;
  if (kind === "pins") {
    const walls = buildWalls(domainRings(container), []);
    const marks = new Int32Array(walls.segmentCount + walls.roundCount);
    const near: number[] = [];
    const posts: [number, number, number][] = [];
    let stamp = 0;
    const columns = count;
    for (let row = 0; row < count; row++) for (let column = 0; column < columns; column++) {
      const x = cx + ((column + 0.25 + (row % 2 ? 0.5 : 0)) / columns - 0.5) * width * 0.78;
      const y = cy + ((row + 0.5) / count - 0.5) * height * 0.78;
      if (!insideContainer(walls, x, y)) continue;
      wallsNear(walls, x - size - room, y - size - room, x + size + room, y + size + room, marks, ++stamp, near);
      if (distanceToWalls(walls, x, y, near) < size + room) continue;
      if (emitterDistance(emitter, x, y) < size + room) continue;
      posts.push([x, y, size]);
    }
    return { container, posts };
  }
  let result = container;
  for (let i = 0; i < count; i++) {
    const tilt = (i % 2 ? -1 : 1) * angle * Math.PI / 180, c = Math.cos(tilt), s = Math.sin(tilt);
    const x = cx + (i % 2 ? 1 : -1) * width * 0.16, y = cy + ((i + 0.5) / count - 0.5) * height * 0.8;
    const a = size / 2, b = SLAT_THICKNESS / 2;
    const bar = planarRegion({ id: `slat:${i}`, outer: [[-a, -b], [a, -b], [a, b], [-a, b]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as [number, number]) });
    try { result = domainDifference(result, bar, { id: container.id }); }
    catch (error) { if (error instanceof PlanarError) throw new Error(`Barrier ${i} cannot be cut from the container (${error.message}); lower Barrier count or Barrier size`); throw error; }
    if (result.regions.length === 0) throw new Error("The barriers leave no container; lower Barrier count or Barrier size");
  }
  return { container: result, posts: [] };
}
