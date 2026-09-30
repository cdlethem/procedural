/**
 * The room of a Collision Scores instrument: the bundled container with its barriers, resolved once per
 * construction. Nothing about where or how many discs start is refused: line, ring and nozzle places are fitted to the
 * room (`snapToClear`) and discs that do not fit are released later, in order (`collision.ts`).
 */
import { barriers, bundledContainer, containerRings, type BarrierKind, type ContainerShape } from "./collision-containers.js";
import { buildWalls, type WallSet } from "./collision-walls.js";
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
