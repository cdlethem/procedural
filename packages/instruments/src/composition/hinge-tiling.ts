import { componentSeed } from "./core.js";
import { memoized } from "./sources.js";
import { substitutionTiling } from "./tilings.js";

/*
 * Panel tilings: the flat state of an articulated sheet.
 *
 * Inputs   `PanelTilingOptions`: one bundled source (`square`, `triangle`, `brick` or `penrose`), its size,
 *          the seed and a `retention` share. Sources are generated, never fetched; a caller's own polygons go
 *          through `panelTiling({ source: "polygons", ... })` in code (see `PanelPolygonsInput`) and are not a
 *          persisted Studio input.
 * Outputs  A deeply frozen `PanelTiling`, cached by construction (never by palette or appearance):
 *          `panels` (id, class, ccw corners, centroid, area, seed), `hinges` (one per maximal shared segment of
 *          two panels: its ends, length, axis direction, the two panel indices) and `adjacency`.
 * Frame    The flat sheet lives in a y-up plane `(u, v)`, counter-clockwise positive, in EDGE UNITS: the shortest
 *          panel edge is 1 (brick: 1 x 2 bricks; Penrose: the rhombus edge). Folding maps `(u, v)` to world
 *          `(u, 0, -v)`, so the sheet lies flat with its front (+y) up and the picture's "up" is -z.
 * Identity Panel ids are the tiling's own: `q:c,r` (square), `t:c,r,u|d` (triangle), `b:r,i` (brick) and the
 *          substitution tile ids (`p:...`) for Penrose. Hinge ids are `h:<panel a>|<panel b>` with `a` sorted before
 *          `b` and, for a T-junction where one edge is shared by several panels, `#<n>` by position along the edge
 *          (Penrose reuses the tiling's edge ids). Changing size, retention or seed never renames a surviving id
 *          (a bigger grid keeps the ids of the old panels).
 * Retention `retention < 1` drops panels by `componentSeed(seed, id, "keep")` (independent per panel, so the set
 *          kept at a lower share is inside the set kept at a higher one); hinges of a dropped panel go with it.
 * Work     At most `MAX_PANELS` panels (measured, see docs/composition-hinged-panels.md); over it the call throws
 *          naming the control to reduce. Nothing truncates.
 */

export const MAX_PANELS = 4_000;
export const PANEL_SOURCES = ["square", "triangle", "brick", "penrose"] as const;
export type PanelSource = (typeof PANEL_SOURCES)[number];
export const PENROSE_PATCHES = ["sun", "decagon", "thick", "thin"] as const;
export type PanelPoint = readonly [number, number];

export interface PanelTilingOptions {
  readonly seed: number;
  readonly source: PanelSource;
  /** Grid sources: panels across (columns of cells; a triangle cell holds two triangles). 1 to 200. */
  readonly columns: number;
  readonly rows: number;
  /** Penrose: seed patch and substitution depth (0 to 8). */
  readonly patch: string;
  readonly depth: number;
  /** Share of panels kept, 0 < r <= 1. */
  readonly retention: number;
}

export interface Panel {
  readonly id: string;
  readonly seed: number;
  /** Position in `PanelTiling.panels`. */
  readonly index: number;
  /** Tile class: checker parity, up/down triangle, brick row parity, thin/thick rhombus. */
  readonly cls: number;
  /** Counter-clockwise corners `(u, v)`, 3 or 4 of them, convex. */
  readonly corners: readonly PanelPoint[];
  readonly centroid: PanelPoint;
  readonly area: number;
}
export interface Hinge {
  readonly id: string;
  readonly seed: number;
  readonly index: number;
  /** Panel indices, `panels[0]` sorted before `panels[1]` by id. */
  readonly panels: readonly [number, number];
  readonly a: PanelPoint;
  readonly b: PanelPoint;
  readonly length: number;
  readonly mid: PanelPoint;
  /** Direction of the axis in degrees, in [0, 180). */
  readonly axis: number;
}
export interface PanelTiling {
  readonly key: string;
  readonly source: string;
  readonly panels: readonly Panel[];
  readonly hinges: readonly Hinge[];
  /** For each panel, the hinge indices touching it, ascending. */
  readonly adjacency: readonly (readonly number[])[];
  readonly bounds: { readonly minU: number; readonly maxU: number; readonly minV: number; readonly maxV: number };
  /** Diagonal of `bounds`, the length the instrument scales to the canvas. */
  readonly diameter: number;
  /** Shortest panel edge (1 for bundled sources). */
  readonly edgeLength: number;
}

/** A caller's own flat polygons (code only): ids, ccw convex corners, and the hinge list. */
export interface PanelPolygonsInput {
  readonly seed: number;
  readonly id: string;
  readonly panels: readonly { readonly id: string; readonly corners: readonly PanelPoint[]; readonly cls?: number }[];
  readonly hinges: readonly { readonly id?: string; readonly panels: readonly [string, string]; readonly a: PanelPoint; readonly b: PanelPoint }[];
}

const U32 = 0x1_0000_0000;
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const H = Math.sqrt(3) / 2;
const EPS = 1e-9;
const cache = new Map<string, PanelTiling>();

interface RawPanel { readonly id: string; readonly cls: number; readonly corners: readonly PanelPoint[] }
interface RawHinge { readonly id: string; readonly a: string; readonly b: string; readonly p: PanelPoint; readonly q: PanelPoint }

function integer(label: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer in [${min}, ${max}] (got ${String(value)})`);
}

function area(corners: readonly PanelPoint[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) { const [x, y] = corners[i], [nx, ny] = corners[(i + 1) % corners.length]; sum += x * ny - nx * y; }
  return sum / 2;
}

/** Panels of a source, before retention and hinge finishing. */
function squares(columns: number, rows: number): { panels: RawPanel[]; hinges: RawHinge[] } {
  const panels: RawPanel[] = [], hinges: RawHinge[] = [];
  const id = (c: number, r: number) => `q:${c},${r}`;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    panels.push({ id: id(c, r), cls: (c + r) & 1, corners: [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]] });
    if (c + 1 < columns) hinges.push({ id: "", a: id(c, r), b: id(c + 1, r), p: [c + 1, r], q: [c + 1, r + 1] });
    if (r + 1 < rows) hinges.push({ id: "", a: id(c, r), b: id(c, r + 1), p: [c, r + 1], q: [c + 1, r + 1] });
  }
  return { panels, hinges };
}

function triangles(columns: number, rows: number): { panels: RawPanel[]; hinges: RawHinge[] } {
  const panels: RawPanel[] = [], hinges: RawHinge[] = [];
  const up = (c: number, r: number) => `t:${c},${r},u`, down = (c: number, r: number) => `t:${c},${r},d`;
  const x0 = (c: number, r: number) => c + r / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const x = x0(c, r), y = r * H;
    panels.push({ id: up(c, r), cls: 0, corners: [[x, y], [x + 1, y], [x + 0.5, y + H]] });
    panels.push({ id: down(c, r), cls: 1, corners: [[x + 1, y], [x + 1.5, y + H], [x + 0.5, y + H]] });
    // the up triangle's right edge is the down triangle's left edge
    hinges.push({ id: "", a: up(c, r), b: down(c, r), p: [x + 1, y], q: [x + 0.5, y + H] });
    // the down triangle's right edge is the next up triangle's left edge
    if (c + 1 < columns) hinges.push({ id: "", a: down(c, r), b: up(c + 1, r), p: [x + 1, y], q: [x + 1.5, y + H] });
    // the down triangle's top edge is the base of the up triangle one row higher
    if (r + 1 < rows) hinges.push({ id: "", a: down(c, r), b: up(c, r + 1), p: [x + 0.5, y + H], q: [x + 1.5, y + H] });
  }
  return { panels, hinges };
}

/** 2 x 1 bricks; odd rows are shifted by one brick edge, so each brick touches two above and two below. */
function bricks(columns: number, rows: number): { panels: RawPanel[]; hinges: RawHinge[] } {
  const panels: RawPanel[] = [], hinges: RawHinge[] = [];
  const id = (r: number, i: number) => `b:${r},${i}`;
  const left = (r: number, i: number) => 2 * i + (r & 1);
  for (let r = 0; r < rows; r++) for (let i = 0; i < columns; i++) {
    const x = left(r, i);
    panels.push({ id: id(r, i), cls: r & 1, corners: [[x, r], [x + 2, r], [x + 2, r + 1], [x, r + 1]] });
    if (i + 1 < columns) hinges.push({ id: "", a: id(r, i), b: id(r, i + 1), p: [x + 2, r], q: [x + 2, r + 1] });
    if (r + 1 < rows) for (let j = 0; j < columns; j++) {
      const lo = Math.max(x, left(r + 1, j)), hi = Math.min(x + 2, left(r + 1, j) + 2);
      if (hi - lo > EPS) hinges.push({ id: "", a: id(r, i), b: id(r + 1, j), p: [lo, r + 1], q: [hi, r + 1] });
    }
  }
  return { panels, hinges };
}

function penrose(options: PanelTilingOptions): { panels: RawPanel[]; hinges: RawHinge[] } {
  if (!(PENROSE_PATCHES as readonly string[]).includes(options.patch)) throw new Error(`Seed patch must be one of ${PENROSE_PATCHES.join(", ")} (got ${String(options.patch)})`);
  integer("Depth", options.depth, 0, 8);
  let tiling;
  try {
    tiling = substitutionTiling({ seed: options.seed, rule: "penrose-p3", patch: options.patch, depth: options.depth, centerX: 0, centerY: 0, radius: 100, rotation: 0,
      boundary: "whole", crop: "none", cropX: 0, cropY: 0, cropWidth: 0, cropHeight: 0 });
  } catch (error) {
    throw new Error(`Penrose panels: ${(error as Error).message}; reduce Depth`);
  }
  const k = 1 / tiling.edgeLength;
  // canvas y runs down: flip to the y-up frame and restore counter-clockwise order
  const flip = (p: readonly [number, number]): PanelPoint => [p[0] * k + 0, -p[1] * k + 0];
  const panels: RawPanel[] = tiling.tiles.map((tile) => {
    let corners = tile.points.map(flip);
    if (area(corners) < 0) corners = corners.reverse();
    return { id: tile.id, cls: tile.classIndex, corners };
  });
  const hinges: RawHinge[] = [];
  for (const edge of tiling.edges) if (edge.tiles[1] !== null) hinges.push({ id: edge.id, a: edge.tiles[0], b: edge.tiles[1], p: flip(edge.points[0]), q: flip(edge.points[1]) });
  return { panels, hinges };
}

function finish(key: string, source: string, seed: number, retention: number, raw: { panels: RawPanel[]; hinges: RawHinge[] }): PanelTiling {
  const kept = raw.panels.filter((panel) => retention >= 1 || unit(seed, panel.id, "keep") < retention);
  if (kept.length === 0) throw new Error("Panel retention leaves no panel: raise Panel retention");
  if (kept.length > MAX_PANELS) throw new Error(`Panel tiling has ${kept.length} panels; the limit is ${MAX_PANELS}. Reduce Columns and Rows (or Depth)`);
  const index = new Map(kept.map((panel, i) => [panel.id, i]));
  const panels: Panel[] = kept.map((panel, i) => {
    let corners = panel.corners;
    if (corners.length !== 3 && corners.length !== 4) throw new Error(`Panel "${panel.id}" has ${corners.length} corners; panels are triangles or convex quadrilaterals`);
    if (area(corners) <= 0) throw new Error(`Panel "${panel.id}" is not counter-clockwise or has no area`);
    const n = corners.length;
    let cx = 0, cy = 0;
    for (const [x, y] of corners) { cx += x; cy += y; }
    corners = corners.map(([x, y]) => Object.freeze([x + 0, y + 0] as const));
    return Object.freeze({ id: panel.id, seed: componentSeed(seed, panel.id, "panel"), index: i, cls: panel.cls, corners: Object.freeze(corners),
      centroid: Object.freeze([cx / n, cy / n] as const), area: area(corners) });
  });
  // Hinges: deterministic order by (first panel id, second panel id, position along the shared line); T-junction
  // segments between one panel pair keep their own numbered id.
  const found = raw.hinges.filter((h) => index.has(h.a) && index.has(h.b)).map((h) => {
    const [first, second] = h.a < h.b ? [h.a, h.b] : [h.b, h.a];
    return { ...h, a: first, b: second };
  }).sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : x.b < y.b ? -1 : x.b > y.b ? 1 : x.p[0] - y.p[0] || x.p[1] - y.p[1]));
  const seen = new Map<string, number>();
  const hinges: Hinge[] = found.map((h, i) => {
    const base = h.id !== "" && source === "penrose" ? h.id : `h:${h.a}|${h.b}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}#${count}`;
    const dx = h.q[0] - h.p[0], dy = h.q[1] - h.p[1], length = Math.hypot(dx, dy);
    if (!(length > EPS)) throw new Error(`Hinge "${id}" has no length`);
    let axis = Math.atan2(dy, dx) * 180 / Math.PI;
    axis = ((axis % 180) + 180) % 180;
    return Object.freeze({ id, seed: componentSeed(seed, id, "hinge"), index: i, panels: Object.freeze([index.get(h.a)!, index.get(h.b)!] as const),
      a: Object.freeze([h.p[0] + 0, h.p[1] + 0] as const), b: Object.freeze([h.q[0] + 0, h.q[1] + 0] as const), length,
      mid: Object.freeze([(h.p[0] + h.q[0]) / 2, (h.p[1] + h.q[1]) / 2] as const), axis: axis >= 180 - 1e-9 ? 0 : axis });
  });
  const adjacency: number[][] = panels.map(() => []);
  for (const h of hinges) { adjacency[h.panels[0]].push(h.index); adjacency[h.panels[1]].push(h.index); }
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, edge = Infinity;
  for (const panel of panels) for (let i = 0; i < panel.corners.length; i++) {
    const [x, y] = panel.corners[i], [nx, ny] = panel.corners[(i + 1) % panel.corners.length];
    minU = Math.min(minU, x); maxU = Math.max(maxU, x); minV = Math.min(minV, y); maxV = Math.max(maxV, y);
    edge = Math.min(edge, Math.hypot(nx - x, ny - y));
  }
  return Object.freeze({ key, source, panels: Object.freeze(panels), hinges: Object.freeze(hinges), adjacency: Object.freeze(adjacency.map((list) => Object.freeze(list))),
    bounds: Object.freeze({ minU, maxU, minV, maxV }), diameter: Math.hypot(maxU - minU, maxV - minV), edgeLength: edge });
}

/** The flat tiling of a bundled source (cached by construction). */
export function panelTiling(options: PanelTilingOptions): PanelTiling {
  const { seed, source, columns, rows, retention } = options;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Panel tiling seed must be a uint32 integer");
  if (!(PANEL_SOURCES as readonly string[]).includes(source)) throw new Error(`Panel source must be one of ${PANEL_SOURCES.join(", ")} (got ${String(source)})`);
  if (typeof retention !== "number" || !(retention > 0 && retention <= 1)) throw new Error(`Panel retention must be in (0, 1] (got ${String(retention)})`);
  const grid = source !== "penrose";
  if (grid) {
    integer("Columns", columns, 1, 200);
    integer("Rows", rows, 1, 200);
    const count = columns * rows * (source === "triangle" ? 2 : 1);
    if (count > MAX_PANELS) throw new Error(`${source} grid of ${columns} x ${rows} is ${count} panels; the limit is ${MAX_PANELS}. Reduce Columns and Rows`);
  }
  const key = JSON.stringify(grid ? [source, columns, rows, seed, retention] : [source, options.patch, options.depth, seed, retention]);
  return memoized(cache, key, () => finish(key, source, seed, retention, source === "square" ? squares(columns, rows) : source === "triangle" ? triangles(columns, rows) : source === "brick" ? bricks(columns, rows) : penrose(options)));
}

/** A caller's own polygons and hinges (code only; not a persisted input). Validated like a bundled source, not cached. */
export function panelTilingFromPolygons(input: PanelPolygonsInput): PanelTiling {
  const { seed, id } = input;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Panel tiling seed must be a uint32 integer");
  const ids = new Set<string>();
  for (const panel of input.panels) {
    if (ids.has(panel.id)) throw new Error(`Panel id "${panel.id}" is repeated`);
    ids.add(panel.id);
    for (const [x, y] of panel.corners) if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Panel "${panel.id}" has a non-finite corner`);
  }
  const raw = {
    panels: input.panels.map((panel): RawPanel => ({ id: panel.id, cls: panel.cls ?? 0, corners: panel.corners })),
    hinges: input.hinges.map((h): RawHinge => {
      for (const name of h.panels) if (!ids.has(name)) throw new Error(`Hinge names the unknown panel "${name}"`);
      return { id: h.id ?? "", a: h.panels[0], b: h.panels[1], p: h.a, q: h.b };
    }),
  };
  return finish(`polygons:${id}`, "polygons", seed, 1, raw);
}

export interface PanelEdgePiece {
  /** Panel index. */
  readonly panel: number;
  readonly a: PanelPoint;
  readonly b: PanelPoint;
}
const boundaryCache = new WeakMap<PanelTiling, readonly PanelEdgePiece[]>();

/**
 * The parts of panel edges that no hinge covers: the sheet's outline and the cuts left by omitted panels. A T-junction
 * edge partly covered by hinges contributes only its uncovered remainder. Ordered by panel, then edge, then position.
 */
export function panelBoundaryEdges(tiling: PanelTiling): readonly PanelEdgePiece[] {
  const hit = boundaryCache.get(tiling);
  if (hit) return hit;
  const out: PanelEdgePiece[] = [];
  for (const panel of tiling.panels) {
    const n = panel.corners.length;
    for (let k = 0; k < n; k++) {
      const [ax, ay] = panel.corners[k], [bx, by] = panel.corners[(k + 1) % n], dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      const covered: [number, number][] = [];
      for (const index of tiling.adjacency[panel.index]) {
        const h = tiling.hinges[index];
        const along = (p: PanelPoint) => ((p[0] - ax) * dx + (p[1] - ay) * dy) / (length * length);
        const off = (p: PanelPoint) => Math.abs((p[0] - ax) * dy - (p[1] - ay) * dx) / length;
        if (off(h.a) > EPS || off(h.b) > EPS) continue;
        const t0 = along(h.a), t1 = along(h.b);
        covered.push([Math.min(t0, t1), Math.max(t0, t1)]);
      }
      covered.sort((x, y) => x[0] - y[0]);
      let at = 0;
      const emit = (from: number, to: number): void => {
        if ((to - from) * length > EPS) out.push({ panel: panel.index, a: Object.freeze([ax + dx * from + 0, ay + dy * from + 0] as const), b: Object.freeze([ax + dx * to + 0, ay + dy * to + 0] as const) });
      };
      for (const [from, to] of covered) { if (from > at) emit(at, from); at = Math.max(at, to); }
      if (at < 1) emit(at, 1);
    }
  }
  const frozen = Object.freeze(out.map((piece) => Object.freeze(piece)));
  boundaryCache.set(tiling, frozen);
  return frozen;
}
