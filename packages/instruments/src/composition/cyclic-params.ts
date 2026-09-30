import { checkConstruction, checkRunWork, lettersObstacle } from "./cyclic-rule.js";
import type { CyclicConstruction, InitialSpec, NeighbourhoodShape, ObstacleSpec, StampName } from "./cyclic-rule.js";
import type { CyclicFrame } from "./cyclic-structure.js";

/**
 * Stored scalar controls of Cyclic Fronts to the typed values the producers take. Shared by the instrument's
 * validation and its composition so there is one mapping: everything that shapes the grid goes into the
 * `CyclicConstruction` (and hidden controls are dropped from it, so a control that does not apply cannot change a
 * result or a cache key); everything that only decides how a grid is drawn goes into `CyclicInk`.
 */

type Scalar = number | string | boolean;
export type FillKind = "none" | "flat" | "hatch";
export type FrontKinds = "none" | "advance" | "all";
export type MarkKind = "none" | "dot" | "rings" | "rosette" | "arrow";
export type FrontColor = "state" | "dark" | "light";
export type StateColors = "ramp" | "cycle";

export interface CyclicInk {
  colors: StateColors;
  fill: { kind: FillKind; opacity: number; spacing: number; weight: number; angle: number };
  /** `size` is a fraction of the cell side. */
  cellMark: { kind: MarkKind; size: number; weight: number };
  fronts: { kinds: FrontKinds; color: FrontColor; material: "ink" | "stitch" | "beads"; weight: number; spacing: number; smoothing: number; echoes: number; echoSpacing: number };
  /** `size` is in canvas units. */
  coreMark: { kind: MarkKind; size: number; weight: number; reach: number };
  walls: "dark" | "light" | "hidden";
}

export interface CyclicParams {
  construction: CyclicConstruction;
  steps: number;
  frame: CyclicFrame;
  ink: CyclicInk;
}

const letterCache = new Map<string, ObstacleSpec>();
function letters(text: string, columns: number, rows: number): ObstacleSpec {
  const key = `${columns}x${rows}:${text}`;
  const hit = letterCache.get(key);
  if (hit) { letterCache.delete(key); letterCache.set(key, hit); return hit; }
  const made = lettersObstacle(text, columns, rows);
  if (letterCache.size >= 8) letterCache.delete(letterCache.keys().next().value!);
  letterCache.set(key, made);
  return made;
}

/** Resolve validated control values. Throws an Error naming the control for anything the model cannot run. */
export function cyclicParams(q: Record<string, Scalar>): CyclicParams {
  const num = (key: string) => q[key] as number;
  const columns = num("columns"), width = num("width"), height = num("height");
  const rows = Math.max(2, Math.round(columns * height / width));
  const neighbourhood = q.neighbourhood as NeighbourhoodShape;
  const initialKind = q.initial as string;
  let initial: InitialSpec;
  if (initialKind === "random") initial = { kind: "random", density: num("density") };
  else if (initialKind === "spirals") initial = { kind: "spirals", count: num("seedCount"), radius: num("seedSize"), noise: num("noise") };
  else if (initialKind === "stripes") initial = { kind: "stripes", width: num("stripeWidth"), angle: num("stripeAngle"), noise: num("noise") };
  else if (initialKind === "stamp") initial = { kind: "stamp", stamp: q.stamp as StampName, radius: num("seedSize"), x: num("stampX"), y: num("stampY"), noise: num("noise") };
  else throw new Error(`Unknown initialization: ${initialKind}`);
  const wallKind = q.obstacles as string;
  let obstacles: ObstacleSpec;
  if (wallKind === "none") obstacles = { kind: "none" };
  else if (wallKind === "blocks") obstacles = { kind: "blocks", count: num("obstacleCount"), size: num("obstacleSize") };
  else if (wallKind === "ring") obstacles = { kind: "ring", size: num("obstacleSize"), gap: num("obstacleGap") };
  else if (wallKind === "bars") obstacles = { kind: "bars", count: num("obstacleCount"), size: num("obstacleSize"), gap: num("obstacleGap") };
  else if (wallKind === "letters") {
    const text = q.obstacleText as string;
    if (!/^[\x20-\x7e]{1,20}$/.test(text)) throw new Error("Obstacle text must be 1 to 20 printable ASCII characters");
    if (columns >= 2 && rows >= 2 && columns <= 240) obstacles = letters(text, columns, rows);
    else obstacles = { kind: "none" };
  } else throw new Error(`Unknown obstacles: ${wallKind}`);
  const construction: CyclicConstruction = { columns, rows, rule: { states: num("states"), threshold: num("threshold"), range: num("range"), neighbourhood }, initial, obstacles };
  if (!(width > 0 && height > 0)) throw new Error("Width and Height must be positive");
  checkConstruction(construction);
  const steps = num("steps");
  checkRunWork(construction, steps);
  return {
    construction, steps,
    frame: { centerX: num("centerX"), centerY: num("centerY"), width, height },
    ink: {
      colors: q.colors as StateColors,
      fill: { kind: q.fill as FillKind, opacity: num("fillOpacity"), spacing: num("hatchSpacing"), weight: num("hatchWeight"), angle: num("hatchAngle") },
      cellMark: { kind: q.cellMark as MarkKind, size: num("cellMarkSize"), weight: num("cellMarkWeight") },
      fronts: { kinds: q.fronts as FrontKinds, color: q.frontColor as FrontColor, material: q.frontMaterial as "ink" | "stitch" | "beads", weight: num("frontWeight"), spacing: num("frontSpacing"),
        smoothing: num("smoothing"), echoes: num("echoes"), echoSpacing: num("echoSpacing") },
      coreMark: { kind: q.coreMark as MarkKind, size: num("coreSize"), weight: num("coreWeight"), reach: num("coreReach") },
      walls: q.obstacleDraw as "dark" | "light" | "hidden",
    },
  };
}
