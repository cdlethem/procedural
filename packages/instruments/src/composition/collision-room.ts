/**
 * The room of a Collision Scores instrument: the bundled container with its barriers, resolved once per
 * construction, and the deterministic checks that say whether the emitter can start in it.
 *
 * `checkFeasible` runs when the scalar controls are validated, so a combination the model cannot place is
 * rejected with a message naming the controls to change, before any simulation. It is conservative in one
 * stated way: discs are assumed to have their largest possible radius `radius × (1 + radiusSpread)`, so a line,
 * ring or nozzle that passes always fits, and the exact placement (`collision.ts`) uses the true radii.
 * A `scatter` emitter is seeded rejection sampling, so it is only bounded by area: the discs may cover at most
 * 35% of the free area. Whether a particular seed places every disc is decided when the simulation starts.
 */
import { COLLISION_LIMITS } from "./collision.js";
import { barriers, bundledContainer, containerRings, type BarrierKind, type ContainerShape } from "./collision-containers.js";
import { buildWalls, distanceToWalls, insideContainer, wallsNear, type WallSet } from "./collision-walls.js";
import type { PlanarDomain } from "./domains.js";

export interface RoomParams {
  readonly container: ContainerShape;
  readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number; readonly rotation: number;
  readonly barriers: BarrierKind; readonly barrierCount: number; readonly barrierSize: number; readonly barrierAngle: number;
  readonly radius: number; readonly radiusSpread: number; readonly count: number;
  readonly emitter: "scatter" | "line" | "ring" | "nozzle";
  readonly emitterX: number; readonly emitterY: number; readonly emitterSize: number; readonly emitterAngle: number;
}
export interface Room { readonly container: PlanarDomain; readonly posts: readonly (readonly [number, number, number])[]; readonly walls: WallSet }

/** Read the room controls from validated scalar parameters. */
export function roomParams(q: Readonly<Record<string, number | string | boolean>>): RoomParams {
  return {
    container: q.container as ContainerShape, centerX: q.centerX as number, centerY: q.centerY as number, width: q.width as number, height: q.height as number, rotation: q.rotation as number,
    barriers: q.barriers as BarrierKind, barrierCount: q.barrierCount as number, barrierSize: q.barrierSize as number, barrierAngle: q.barrierAngle as number,
    radius: q.radius as number, radiusSpread: q.radiusSpread as number, count: q.count as number,
    emitter: q.emitter as RoomParams["emitter"], emitterX: q.emitterX as number, emitterY: q.emitterY as number, emitterSize: q.emitterSize as number, emitterAngle: q.emitterAngle as number,
  };
}

const rooms = new Map<string, Room>();
/** Container and barriers of the controls, memoised (the same values give the same object). */
export function resolveRoom(p: RoomParams): Room {
  const line = p.emitter === "line", ring = p.emitter === "ring", nozzle = p.emitter === "nozzle";
  // Only what the emitter mode reads may enter the key: barriers keep clear of the emitter's footprint and of nothing else.
  const key = JSON.stringify([p.container, p.centerX, p.centerY, p.width, p.height, p.rotation, p.barriers,
    p.barriers === "none" ? 0 : [p.barrierCount, p.barrierSize, p.barrierAngle, p.radius, p.radiusSpread, p.emitter,
      nozzle || line || ring ? [p.emitterX, p.emitterY] : 0, line || ring ? p.emitterSize : 0, line ? p.emitterAngle : 0]]);
  const hit = rooms.get(key);
  if (hit) { rooms.delete(key); rooms.set(key, hit); return hit; }
  const largest = p.radius * (1 + p.radiusSpread);
  const built = barriers(bundledContainer({ shape: p.container, centerX: p.centerX, centerY: p.centerY, width: p.width, height: p.height, rotation: p.rotation }),
    p.barriers, p.barrierCount, p.barrierSize, p.barrierAngle, 2 * largest + 2, { mode: p.emitter, x: p.emitterX, y: p.emitterY, extent: p.emitterSize, angle: p.emitterAngle });
  const room: Room = Object.freeze({ container: built.container, posts: built.posts, walls: buildWalls(containerRings(built.container), built.posts) });
  rooms.set(key, room);
  if (rooms.size > 4) rooms.delete(rooms.keys().next().value!);
  return room;
}

/** Throw, naming the controls to change, when the emitter cannot start its discs in this room. */
export function checkFeasible(p: RoomParams): void {
  const largest = p.radius * (1 + p.radiusSpread), need = 2 * largest + COLLISION_LIMITS.placementGap, n = p.count;
  if (p.emitter === "line" && n > 1 && p.emitterSize < (n - 1) * need)
    throw new Error(`Emitter size ${p.emitterSize} is too short for ${n} discs of radius up to ${+largest.toFixed(2)}: the line needs at least ${Math.ceil((n - 1) * need)}; lengthen it or lower Bodies or Radius`);
  if (p.emitter === "ring" && n > 1 && p.emitterSize * Math.sin(Math.PI / n) < need)
    throw new Error(`Emitter size ${p.emitterSize} is too small for ${n} discs of radius up to ${+largest.toFixed(2)}: the ring needs a diameter of at least ${Math.ceil(need / Math.sin(Math.PI / n))}; enlarge it or lower Bodies or Radius`);
  const room = resolveRoom(p), walls = room.walls;
  if (p.emitter === "scatter") {
    const free = room.container.area - room.posts.reduce((sum, post) => sum + Math.PI * post[2] ** 2, 0);
    if (n * Math.PI * largest ** 2 > 0.35 * free)
      throw new Error(`${n} discs of radius up to ${+largest.toFixed(2)} would cover more than 35% of the container; lower Bodies or Radius, or enlarge the container`);
    return;
  }
  const marks = new Int32Array(walls.segmentCount + walls.roundCount), near: number[] = [];
  let stamp = 0;
  const clear = (x: number, y: number): boolean => {
    if (!insideContainer(walls, x, y)) return false;
    const reach = largest + COLLISION_LIMITS.placementGap;
    wallsNear(walls, x - reach, y - reach, x + reach, y + reach, marks, ++stamp, near);
    return distanceToWalls(walls, x, y, near) >= reach;
  };
  const where = p.emitter === "nozzle" ? "The nozzle does not fit: move Emitter X/Y inside the container, away from walls and barriers, or lower Radius"
    : `The ${p.emitter} emitter puts a disc against a wall, a barrier or outside the container: move Emitter X/Y, resize the emitter, or lower Bodies or Radius`;
  if (p.emitter === "nozzle") { if (!clear(p.emitterX, p.emitterY)) throw new Error(where); return; }
  for (let k = 0; k < n; k++) {
    let x: number, y: number;
    if (p.emitter === "line") {
      const along = n === 1 ? 0 : (k / (n - 1) - 0.5) * p.emitterSize, a = p.emitterAngle * Math.PI / 180;
      x = p.emitterX + Math.cos(a) * along; y = p.emitterY + Math.sin(a) * along;
    } else {
      const theta = 2 * Math.PI * k / n;
      x = p.emitterX + Math.cos(theta) * p.emitterSize / 2; y = p.emitterY + Math.sin(theta) * p.emitterSize / 2;
    }
    if (!clear(x, y)) throw new Error(where);
  }
}
