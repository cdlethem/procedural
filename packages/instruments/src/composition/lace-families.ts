import { chaikinPolyline2D } from "@procedurals/javascript";
import { componentSeed } from "./core.js";
import { contourPaths, memoized } from "./sources.js";
import type { Path, Point } from "./types.js";

/**
 * Bundled deterministic path families for crossing-aware lace: ordinary `Path` values that any
 * crossing consumer accepts. Nothing here is a URL, an asset or a decoded file; a caller with its own
 * interlacing paths passes them straight to `findCrossings`.
 *
 * FRAME. Every family is built in a unit box [-1, 1]² and fitted to `frame` by an explicit affine
 * map: scale by width/2 and height/2 (an intentional stretch, not aspect-preserving), rotate by
 * `rotation` degrees, translate to the centre. Contour paths come from the existing `contourPaths`
 * producer directly in the frame. Units are canvas units and degrees.
 *
 * FAMILIES (`shape.kind`), all closed unless stated; ids never depend on appearance:
 *  - `knot` (`knot:<k>`): the closed-braid diagram of p strands with q twists,
 *    r(s) = 1 + depth·cos(q·s + φ), angle p·s. It has exactly q·(p−1) transversal crossings, and
 *    gcd(p, q) components (p = 2, q = 3 is the trefoil diagram; alternating p = 3, q = 2 is the
 *    figure-eight's). `detail` sets the vertices per strand-turn before smoothing.
 *  - `celtic` (`celtic:<orbit>`): a `columns` × `rows` cell grid; strands run at 45° through the
 *    midpoints of the cell edges and cross at every interior edge midpoint (2·columns·rows −
 *    columns − rows crossings), turning back at the frame edge. `breaks` blocks that fraction of the
 *    interior edges (chosen by a per-edge seeded rank, so raising it only blocks more): a blocked
 *    edge turns both strands instead of crossing, which reconnects the strands. With none blocked
 *    there are gcd(columns, rows) strands. The path vertices sit exactly on the crossings, so with no
 *    smoothing every crossing is a vertex meeting; blocked edges give tangent apex contacts.
 *  - `contours` (`a:…`, `b:…`, tones 0 and 1; open chains end on the frame): the level sets of two
 *    fields through `contourPaths`. Contours of one field never cross; two fields interlace. Field B
 *    has its own seed and `frequency × ratio`.
 *  - `loops` (`loop:<i>`, tone i mod 2): `count` closed loops with harmonic wobble, one per seeded
 *    cell of a 6 × 6 grid whose pitch is chosen so everything fits the unit box, radius `reach`
 *    cell pitches (so `reach` also rescales the layout; `count`, `openShare` never do); `openShare` opens that fraction (stably) into
 *    open arcs with free ends. Raising `count` or `openShare` never moves an existing loop.
 *
 * SMOOTHING is `smoothing` Chaikin corner cuts applied to every path (the existing
 * `chaikinPolyline2D`): ends and ids are kept, crossing positions move a little.
 *
 * WORK. Total vertices after smoothing must stay within `MAX_LACE_VERTICES`; the error names the
 * controls to lower. Results are frozen and cached by their construction.
 */
export interface LaceFrame { centerX: number; centerY: number; width: number; height: number; rotation: number }
export type LaceShape =
  | { kind: "knot"; strands: number; twists: number; depth: number; detail: number }
  | { kind: "celtic"; columns: number; rows: number; breaks: number }
  | { kind: "contours"; field: "noise" | "hills" | "waves" | "saddle"; fieldB: "noise" | "hills" | "waves" | "saddle";
      frequency: number; ratio: number; levels: number; levelStep: number; resolution: number }
  | { kind: "loops"; count: number; reach: number; wobble: number; openShare: number };
export interface LaceOptions { seed: number; frame: LaceFrame; smoothing: number; shape: LaceShape }

export const MAX_LACE_VERTICES = 60_000;
const cache = new Map<string, readonly Path[]>();
const TAU = 2 * Math.PI;
const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string) => componentSeed(seed, id, purpose) / U32;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function check(label: string, value: number, low: number, high: number, integer = false): void {
  if (!Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value)))
    throw new Error(`${label} must be ${integer ? "an integer" : "a number"} between ${low} and ${high}`);
}

function checkFrame(frame: LaceFrame): void {
  check("Center X", frame.centerX, -4000, 4000); check("Center Y", frame.centerY, -4000, 4000);
  check("Width", frame.width, 1, 4000); check("Height", frame.height, 1, 4000); check("Rotation", frame.rotation, -3600, 3600);
}

function raw(id: string, seed: number, points: Point[], closed: boolean, tone: number, level = 0, levelFraction = 0): Path {
  return { id, seed: componentSeed(seed, id, "path"), points, closed, level, levelFraction, tone };
}

/** Unit-box points into the frame. */
function place(paths: readonly Path[], frame: LaceFrame): Path[] {
  const angle = frame.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => {
    const u = x * frame.width / 2, v = y * frame.height / 2;
    return [frame.centerX + u * c - v * s, frame.centerY + u * s + v * c] as const;
  }) }));
}

function knot(seed: number, shape: Extract<LaceShape, { kind: "knot" }>): Path[] {
  const { strands: p, twists: q, depth, detail } = shape;
  check("Strands", p, 2, 9, true); check("Twists", q, 1, 12, true); check("Radial depth", depth, 0.05, 0.6); check("Detail", detail, 6, 120, true);
  const g = gcd(p, q), pp = p / g, qq = q / g, count = Math.max(24, Math.ceil(detail * Math.max(pp, qq)));
  const scale = 1 + depth;
  const paths: Path[] = [];
  for (let k = 0; k < g; k++) {
    const points: Point[] = [];
    for (let i = 0; i < count; i++) {
      const s = TAU * i / (count * g), r = (1 + depth * Math.cos(q * s + TAU * k / p)) / scale;
      points.push([r * Math.cos(p * s), r * Math.sin(p * s)]);
    }
    paths.push(raw(`knot:${k}`, seed, points, true, k));
  }
  return paths;
}

function celtic(seed: number, shape: Extract<LaceShape, { kind: "celtic" }>): Path[] {
  const { columns: m, rows: n, breaks } = shape;
  check("Columns", m, 1, 24, true); check("Rows", n, 1, 24, true); check("Blocked share", breaks, 0, 1);
  // Interior edges, ranked by an id-derived seed so a larger share only adds blocked edges.
  const edges: { id: string; x: number; y: number; vertical: boolean }[] = [];
  for (let i = 1; i < m; i++) for (let j = 0; j < n; j++) edges.push({ id: `v:${i}:${j}`, x: i, y: j + 0.5, vertical: true });
  for (let i = 0; i < m; i++) for (let j = 1; j < n; j++) edges.push({ id: `h:${i}:${j}`, x: i + 0.5, y: j, vertical: false });
  const ranked = edges.map((edge) => ({ edge, rank: componentSeed(seed, edge.id, "block") })).sort((a, b) => a.rank - b.rank || (a.edge.id < b.edge.id ? -1 : 1));
  const blocked = new Set(ranked.slice(0, Math.round(breaks * edges.length)).map(({ edge }) => `${edge.x},${edge.y}`));
  // Coordinates are doubled so every edge midpoint is an integer point with exactly one odd
  // coordinate (vertical edge: even x, odd y). A step is (±1, ±1); a strand turns back (mirrors
  // across the edge's own line) at the frame or at a blocked edge and otherwise goes straight.
  const M = 2 * m, N = 2 * n;
  const linkKey = (ax: number, ay: number, bx: number, by: number) => (ax < bx || (ax === bx && ay < by)) ? `${ax},${ay}>${bx},${by}` : `${bx},${by}>${ax},${ay}`;
  const turn = (x: number, y: number, dx: number, dy: number): [number, number] => {
    const stop = x === 0 || x === M || y === 0 || y === N || blocked.has(`${x / 2},${y / 2}`);
    if (!stop) return [dx, dy];
    return x % 2 === 0 ? [-dx, dy] : [dx, -dy];
  };
  const visited = new Set<string>(), paths: Path[] = [];
  for (let x = 0; x <= M; x++) for (let y = 0; y <= N; y++) {
    if ((x % 2 === 0) === (y % 2 === 0)) continue;
    for (const sdx of [1, -1]) for (const sdy of [1, -1]) {
      const nx = x + sdx, ny = y + sdy;
      if (nx < 0 || nx > M || ny < 0 || ny > N || visited.has(linkKey(x, y, nx, ny))) continue;
      const points: Point[] = [];
      let cx = x, cy = y, dx = sdx, dy = sdy;
      do {
        visited.add(linkKey(cx, cy, cx + dx, cy + dy));
        points.push([cx, cy]);
        cx += dx; cy += dy;
        [dx, dy] = turn(cx, cy, dx, dy);
        if (points.length > 8 * M * N) throw new Error("Celtic strand did not close; the turn rule is not a permutation of links");
      } while (cx !== x || cy !== y || dx !== sdx || dy !== sdy);
      const index = paths.length;
      paths.push(raw(`celtic:${index}`, seed, points.map(([px, py]) => [px / m - 1, py / n - 1] as Point), true, index));
    }
  }
  return paths;
}

function loops(seed: number, shape: Extract<LaceShape, { kind: "loops" }>): Path[] {
  const { count, reach, wobble, openShare } = shape;
  check("Loops", count, 1, 24, true); check("Reach", reach, 0.3, 3); check("Wobble", wobble, 0, 1); check("Open share", openShare, 0, 1);
  const cells = Array.from({ length: 36 }, (_, index) => ({ index, rank: componentSeed(seed, `cell:${index}`, "rank") }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  const paths: Path[] = [];
  // Cell pitch is chosen so the whole scatter, loop radius and jitter included, fits the unit box.
  const pitch = 1 / (2.85 + 1.2 * reach * (1 + 0.55 * wobble));
  for (let k = 0; k < count; k++) {
    const id = `loop:${k}`, cell = cells[k].index, col = cell % 6, row = Math.floor(cell / 6);
    const cx = (col - 2.5 + (unit(seed, id, "jx") - 0.5) * 0.7) * pitch, cy = (row - 2.5 + (unit(seed, id, "jy") - 0.5) * 0.7) * pitch;
    const radius = reach * pitch * (0.8 + 0.4 * unit(seed, id, "size"));
    const harmonics = [2, 3, 4].map((h) => ({ h, amplitude: wobble * unit(seed, id, `a${h}`) / h, phase: TAU * unit(seed, id, `p${h}`) }));
    const open = unit(seed, id, "open") < openShare;
    const gap = open ? (70 + 80 * unit(seed, id, "span")) * Math.PI / 180 : 0, start = TAU * unit(seed, id, "cut");
    const total = 96, points: Point[] = [];
    for (let i = 0; i < total; i++) {
      const theta = open ? start + gap + (TAU - gap) * i / (total - 1) : TAU * i / total;
      const r = radius * (1 + harmonics.reduce((sum, { h, amplitude, phase }) => sum + amplitude * Math.cos(h * theta + phase), 0));
      points.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
    }
    paths.push(raw(id, seed, points, !open, k % 2));
  }
  return paths;
}

function contours(seed: number, frame: LaceFrame, shape: Extract<LaceShape, { kind: "contours" }>): Path[] {
  const { field, fieldB, frequency, ratio, levels, levelStep, resolution } = shape;
  check("Frequency", frequency, 0.1, 20); check("Frequency ratio", ratio, 0.25, 4); check("Levels", levels, 1, 12, true);
  check("Level step", levelStep, 0.02, 1); check("Resolution", resolution, 12, 70, true);
  const unseeded = (source: string) => source === "waves" || source === "saddle";
  if (field === fieldB && unseeded(field) && ratio === 1)
    throw new Error(`Both fields are the identical ${field} field: their contours would coincide. Choose a different Second field or set Second frequency to something other than 1`);
  const base = { width: frame.width, height: frame.height, centerX: frame.centerX, centerY: frame.centerY, resolution, aspect: 1.15,
    hillCount: 6, hillRadius: 0.2, levelBase: -levelStep * (levels - 1) / 2, levelStep, levels, rotation: frame.rotation };
  const one = (label: "a" | "b", source: typeof field, sourceSeed: number, freq: number, tone: number) =>
    contourPaths({ ...base, seed: sourceSeed, source, frequency: freq }).map((path) => ({ ...path, id: `${label}:${path.id}`, seed: componentSeed(seed, `${label}:${path.id}`, "path"), tone }));
  return [...one("a", field, seed, frequency, 0), ...one("b", fieldB, componentSeed(seed, "field-b", "source"), frequency * ratio, 1)];
}

function smooth(paths: readonly Path[], passes: number): Path[] {
  check("Corner cuts", passes, 0, 5, true);
  let vertices = 0;
  for (const path of paths) vertices += path.points.length * 2 ** passes;
  if (vertices > MAX_LACE_VERTICES)
    throw new Error(`The lace would have ${vertices} vertices after smoothing; the limit is ${MAX_LACE_VERTICES}. Lower Corner cuts or the family's density (detail, strands, levels, resolution)`);
  if (passes === 0) return [...paths];
  return paths.map((path) => ({ ...path, points: chaikinPolyline2D({ points: path.points.map(([x, y]) => [x, y]), closed: path.closed, iterations: passes,
    maxWork: path.points.length * (2 ** (passes + 1) - 1) }).points as unknown as Point[] }));
}

/** Vertices after smoothing, from the controls alone; null for contours, whose size is known once the field is sampled. */
export function laceVertexEstimate(shape: LaceShape, smoothing: number): number | null {
  const factor = 2 ** smoothing;
  switch (shape.kind) {
    case "knot": { const g = gcd(shape.strands, shape.twists); return g * Math.max(24, Math.ceil(shape.detail * Math.max(shape.strands, shape.twists) / g)) * factor; }
    case "celtic": return 4 * shape.columns * shape.rows * factor;
    case "loops": return shape.count * 96 * factor;
    default: return null;
  }
}

const freezePath = (path: Path): Path => Object.freeze({ ...path, points: Object.freeze(path.points.map(([x, y]) => Object.freeze([x, y] as const))) });

/** The paths of one construction, frozen and cached; see the module comment for each family. */
export function lacePaths(options: LaceOptions): readonly Path[] {
  const { seed, frame, smoothing, shape } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Lace seed must be a uint32 integer");
  checkFrame(frame);
  // Only a seeded family reads the seed; the others must not split the cache.
  const seeded = shape.kind === "loops" || shape.kind === "contours" || (shape.kind === "celtic" && shape.breaks > 0);
  const key = JSON.stringify([seeded ? seed : 0, frame, smoothing, shape]);
  return memoized(cache, key, () => {
    const s = seeded ? seed : 0;
    let paths: Path[];
    switch (shape.kind) {
      case "knot": paths = place(knot(s, shape), frame); break;
      case "celtic": paths = place(celtic(s, shape), frame); break;
      case "loops": paths = place(loops(s, shape), frame); break;
      case "contours": paths = contours(s, frame, shape); break;
      default: throw new Error(`Unknown lace family: ${(shape as { kind: string }).kind}`);
    }
    return Object.freeze(smooth(paths, smoothing).map(freezePath));
  });
}
