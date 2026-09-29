import { componentSeed } from "./core.js";
import { DEFAULT_FLATNESS, MIN_PERIOD, patternFunction } from "./patterns.js";
import { latticeSites, memoized, partitionRegions } from "./sources.js";
import { clipToSupport, resolveSupport } from "./support.js";
import type { Ring, Support } from "./support.js";
import { clipRingToRect, keyholeRings, typeLine, CAP_HEIGHT } from "./type-text.js";
import type { TextSource, TypeLine } from "./type-text.js";
import type { Path, Point, Region } from "./types.js";

/**
 * Modular typographic rhythm: repeated phrase fragments seen through a grid of modules whose
 * windows on the type are locally displaced, stretched, turned or replaced by screens and colour.
 *
 *   text → TYPE FIELD (repeated lines) ─┐
 *   slicing (lattice cells | binary partition) → MODULES → per-module transform → clip → geometry
 *   correlated lattice field (displacement, stretch, zoom, omission, pinning) ──┘
 *
 * THE TYPE FIELD is the plane the modules look at. Field coordinates ARE canvas coordinates, so a
 * module with no treatment shows exactly the piece of the poster that lies under it and the
 * whole layout reads as one continuous typeset sheet. Row `r` (any integer, negative included)
 * sets `rowLine(r) = lines[⌊mod(r, n·rowsPerLine) / rowsPerLine⌋]` with its cap band centred in
 * a row pitch of `leading × size` canvas units counted from the top of the module area; the line
 * repeats along the row with period `inkWidth + gap × size`, and row `r` slides by
 * `r × phase` periods (a stagger, not a per-row random). `size` is the CAP HEIGHT in canvas
 * units. Field content depends on the text; nothing else does.
 *
 * MODULES depend on construction options and NEVER on the text: `typeRhythmLayout` is cached by
 * its options, so changing the phrase, the type size or any appearance choice returns the very
 * same layout object with the same module ids, bounds, kinds, tones and transforms. Module ids
 * are the slicing source's: `lat:<col>:<row>` for grid cells (the Ordered Disorder lattice ids)
 * and `region:<i>` for binary-partition leaves; a slicing change may rename modules, nothing else.
 *
 * SLICING. `grid` uses the lattice cells themselves as modules; `partition` uses
 * `partitionRegions` leaves. Both tile the module area (the composition rectangle minus the
 * optional anchor strip) exactly. `gutter` insets every module by gutter/2 on each side to form
 * its CLIP rectangle; a module whose clip would be under 1 unit is published as `blank`.
 *
 * CORRELATED FIELD. `latticeSites` over the module area (Ordered Disorder's field, unchanged) is
 * sampled once per module (its own cell for a grid, the cell containing its centre for a
 * partition). With the lattice run at displacement 1, rotation 1 and scale 1 its channels are
 * clean values in [−1, 1] already attenuated by the focal falloff: shift = (position − origin) /
 * cell, `turnChannel` = angle, `growChannel` = scale − 1; `kept` is false where the omission
 * threshold `blank` omits it and `anchor` is true for pinned sites, which keep exact neutral
 * alignment. Then
 *
 *   displacement = (shiftX · displacement · width, shiftY · displacement · height)   (module size)
 *   stretch      = (2^(zoom·grow + stretch·turn), 2^(zoom·grow))                     (x, y scale)
 *
 * Every value is a pure function of the module's cell, so neighbours vary smoothly across the
 * correlation length and each seed is a different arrangement.
 *
 * KINDS are decided per module from independent stable draws of its own seed
 * (`componentSeed(seed, id, purpose)`), never from draw order. Blank comes from the correlated
 * omission (blank modules cluster); then `screens` then `flats` are fractions of the remaining
 * modules; the rest carry text, and `turned` of those are turned a quarter turn (direction
 * stable per module). Raising one share only converts modules to that kind, never rearranges the
 * others. `tone` (palette index) marks structure: 0 plain text, 1 turned text, 2 screens, 1 or 3
 * flats.
 *
 * TRANSFORM ORDER, applied to field point q to give a canvas point p of module m (centre c):
 *   1. field point → window: subtract the module's field displacement D (q − c − D);
 *   2. stretch S = diag(sx, sy) about c;
 *   3. quarter turn R (clockwise on the canvas) about c;
 *   4. p = c + R·S·(q − c − D); local point = p − clip origin;
 *   5. CLIP to the module's clip rectangle, last, in the canvas frame.
 * Stretching before turning means a turned module's x-stretch runs along the canvas y axis.
 * The inverse maps the clip rectangle back to a field window so only instances that can reach
 * it are generated.
 *
 * SCREENS live in the same field. A screen is the grating {q : n·q = k·period} of field angle
 * α (`screen.angle` plus the module's `screenStep · 45°`), mapped through the same transform, so
 * it keeps the field's line index k in its id and lines align across neighbouring neutral modules.
 * The mapped period is period/|R·S⁻¹·n| and must stay at least MIN_PERIOD; a coupled settings
 * error names it. Lines and glyph masks are clipped with the existing `clipToSupport`.
 *
 * OUTPUT (all frozen, cached by construction, geometry in each module's LOCAL frame with its
 * clip rectangle at [0,w]×[0,h], matching `inside`): `ModuleType.instances` are the source mapping
 * (row, repeat, line) of every glyph run that reaches the module; `rings` the transformed
 * unclipped glyph rings that reach the clip rectangle; `fill` the same rings clipped for filling.
 *
 * BOUNDS. Modules ≤ MAX_TYPE_MODULES; per module ≤ MAX_MODULE_INSTANCES glyph runs and
 * MAX_MODULE_VERTICES vertices; all text modules together ≤ MAX_TYPE_VERTICES vertices; a lattice
 * mask ≤ 4000 rings (the support limit). Exceeding any bound throws an Error naming it; nothing
 * is thinned. Failure also on invalid options. Coordinates: canvas units; angles: degrees in
 * options, radians in frames.
 */
export const MAX_TYPE_MODULES = 600;
export const MAX_MODULE_INSTANCES = 2_000;
export const MAX_MODULE_VERTICES = 150_000;
export const MAX_TYPE_VERTICES = 1_000_000;
const U32 = 0x1_0000_0000;
const RADIANS = Math.PI / 180;

export type TypeModuleKind = "text" | "screen" | "flat" | "blank";
export type ScreenAngles = "aligned" | "crossed" | "fanned";

export interface TypeLayoutOptions {
  seed: number;
  /** Composition rectangle (canvas units), including the anchor strip. */
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  /** Where the legible anchor caption sits; `none` gives the whole rectangle to modules. */
  anchorSide: "none" | "top" | "bottom";
  /** Thickness of the anchor strip. Ignored when `anchorSide` is `none`. */
  anchorHeight: number;
  slicing: "grid" | "partition";
  /** Lattice cells for a grid; the partition's own grid and the correlated field resolution otherwise. */
  columns: number;
  rows: number;
  /** Partition cuts, axis policy and bias (used only by `partition`). */
  cuts: number;
  axis: "LONGEST" | "RANDOM";
  bias: number;
  /** Clear space between neighbouring modules. */
  gutter: number;
  /** Correlation length of the disruption field, in cells. */
  correlation: number;
  /** Peak content displacement as a fraction of the module's own size. */
  displacement: number;
  /** Peak horizontal stretch, in octaves (factor 2^±stretch). */
  stretch: number;
  /** Peak uniform size change of the type inside a module, in octaves. */
  zoom: number;
  focalX: number;
  focalY: number;
  /** Disruption is strongest here and fades to nothing at this radius; 0 disrupts everywhere. */
  focalRadius: number;
  /** Stable fraction of modules held in exact alignment with the field. */
  pinned: number;
  /** Correlated fraction of modules left empty. */
  blank: number;
  /** Fraction of text modules turned a quarter turn. */
  turned: number;
  /** Fraction of non-blank modules carrying a screen. */
  screens: number;
  /** Fraction of the remaining modules that are flat colour. */
  flats: number;
  /** How screen angles vary: all equal, 0°/90°, or multiples of 45°, chosen per module. */
  screenAngles: ScreenAngles;
}

export interface TypeModuleSource {
  readonly slicing: "grid" | "partition";
  /** The lattice site whose correlated values this module carries. */
  readonly site: string;
  readonly col: number;
  readonly row: number;
  /** Field channels in [−1, 1] before the amounts are applied. */
  readonly shift: Point;
  readonly turnChannel: number;
  readonly growChannel: number;
}

export interface TypeModule {
  readonly id: string;
  readonly seed: number;
  /** World-space [left, top, right, bottom] of the whole slice. */
  readonly bounds: readonly [number, number, number, number];
  /** The clip rectangle as a `Region` (same id and seed): bounds inset by gutter/2. */
  readonly clip: Region;
  readonly kind: TypeModuleKind;
  readonly tone: number;
  readonly pinned: boolean;
  /** Quarter turns, clockwise on the canvas. */
  readonly turn: -1 | 0 | 1;
  /** Field point at the module centre is centre + displacement. */
  readonly displacement: Point;
  /** (x, y) linear scale of the field inside the module. */
  readonly stretch: Point;
  /** Screen angle offset in 45° steps (0–3). */
  readonly screenStep: number;
  readonly source: TypeModuleSource;
}

export interface TypeLayout {
  /** World-space [left, top, right, bottom] of the whole composition. */
  readonly region: readonly [number, number, number, number];
  /** The rectangle the modules tile; the type field's rows are counted from its top-left. */
  readonly area: readonly [number, number, number, number];
  /** The anchor strip, disjoint from every module; null when there is none. */
  readonly anchor: readonly [number, number, number, number] | null;
  readonly modules: readonly TypeModule[];
}

function finite(label: string, value: number, min: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} must be finite and in [${min}, ${max}]`);
}
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const point = (x: number, y: number): Point => Object.freeze([x, y] as const);
const box = (l: number, t: number, r: number, b: number) => Object.freeze([l, t, r, b] as const);

const layoutCache = new Map<string, TypeLayout>();

/** Validate the construction options; never mutates or reads the text. */
function checkLayout(o: TypeLayoutOptions): void {
  if (!Number.isSafeInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff) throw new Error("Type layout seed must be a uint32 integer");
  finite("Layout center x", o.centerX, -1e5, 1e5); finite("Layout center y", o.centerY, -1e5, 1e5);
  finite("Layout width", o.width, 16, 1000); finite("Layout height", o.height, 16, 1000);
  if (o.anchorSide !== "none" && o.anchorSide !== "top" && o.anchorSide !== "bottom") throw new Error("Anchor side must be none, top or bottom");
  finite("Anchor height", o.anchorHeight, 0, 1000);
  if (o.slicing !== "grid" && o.slicing !== "partition") throw new Error("Slicing must be grid or partition");
  for (const [label, value] of [["Columns", o.columns], ["Rows", o.rows]] as const)
    if (!Number.isInteger(value) || value < 2 || value > 24) throw new Error(`${label} must be an integer in [2, 24]`);
  if (!Number.isInteger(o.cuts) || o.cuts < 0 || o.cuts > 400) throw new Error("Cuts must be an integer in [0, 400]");
  if (o.axis !== "LONGEST" && o.axis !== "RANDOM") throw new Error("Axis must be LONGEST or RANDOM");
  finite("Bias", o.bias, -1, 1); finite("Gutter", o.gutter, 0, 200);
  finite("Correlation", o.correlation, 1, 64); finite("Displacement", o.displacement, 0, 2);
  finite("Stretch", o.stretch, 0, 2); finite("Zoom", o.zoom, 0, 1.5);
  finite("Focal x", o.focalX, -1e5, 1e5); finite("Focal y", o.focalY, -1e5, 1e5); finite("Focal radius", o.focalRadius, 0, 4096);
  for (const [label, value] of [["Pinned", o.pinned], ["Blank", o.blank], ["Turned", o.turned], ["Screens", o.screens], ["Flats", o.flats]] as const)
    finite(label, value, 0, 1);
  if (o.screenAngles !== "aligned" && o.screenAngles !== "crossed" && o.screenAngles !== "fanned") throw new Error("Screen angles must be aligned, crossed or fanned");
}

/** The frozen module layout for these options; the text is not an input. */
export function typeRhythmLayout(options: TypeLayoutOptions): TypeLayout {
  checkLayout(options);
  // Options that a slicing mode ignores must not split the cache.
  const o = options.slicing === "grid" ? { ...options, cuts: 0, axis: "LONGEST" as const, bias: 0 } : options;
  const anchorHeight = o.anchorSide === "none" ? 0 : o.anchorHeight;
  return memoized(layoutCache, JSON.stringify({ ...o, anchorHeight }), () => build(o, anchorHeight));
}

function build(o: TypeLayoutOptions, anchorHeight: number): TypeLayout {
  const left = o.centerX - o.width / 2, top = o.centerY - o.height / 2, right = left + o.width, bottom = top + o.height;
  if (o.height - anchorHeight < 16) throw new Error(`Modules need at least 16 units of height; the anchor strip leaves ${o.height - anchorHeight}`);
  const areaTop = o.anchorSide === "top" ? top + anchorHeight : top;
  const areaBottom = o.anchorSide === "bottom" ? bottom - anchorHeight : bottom;
  const area = box(left, areaTop, right, areaBottom);
  const anchor = o.anchorSide === "none" ? null : o.anchorSide === "top" ? box(left, top, right, top + anchorHeight) : box(left, bottom - anchorHeight, right, bottom);
  const areaW = right - left, areaH = areaBottom - areaTop, areaX = (left + right) / 2, areaY = (areaTop + areaBottom) / 2;
  const sites = latticeSites({ seed: componentSeed(o.seed, "type-rhythm", "field"), columns: o.columns, rows: o.rows,
    width: areaW, height: areaH, centerX: areaX, centerY: areaY, correlation: o.correlation, displacement: 1, rotation: 1, scale: 1,
    omission: o.blank, anchors: o.pinned, focalX: o.focalX, focalY: o.focalY, focalRadius: o.focalRadius, retention: 1 });
  const cellW = areaW / o.columns, cellH = areaH / o.rows;
  const cells: Array<{ id: string; bounds: readonly [number, number, number, number]; col: number; row: number }> = [];
  if (o.slicing === "grid") {
    for (let row = 0; row < o.rows; row++) for (let col = 0; col < o.columns; col++) {
      const [ox, oy] = sites[row * o.columns + col].origin;
      cells.push({ id: sites[row * o.columns + col].id, bounds: box(ox - cellW / 2, oy - cellH / 2, ox + cellW / 2, oy + cellH / 2), col, row });
    }
  } else {
    for (const region of partitionRegions({ seed: componentSeed(o.seed, "type-rhythm", "partition"), width: areaW, height: areaH,
      centerX: areaX, centerY: areaY, columns: o.columns, rows: o.rows, attempts: o.cuts, axis: o.axis, bias: o.bias })) {
      const col = Math.min(o.columns - 1, Math.max(0, Math.floor(((region.bounds[0] + region.bounds[2]) / 2 - left) / cellW)));
      const row = Math.min(o.rows - 1, Math.max(0, Math.floor(((region.bounds[1] + region.bounds[3]) / 2 - areaTop) / cellH)));
      cells.push({ id: region.id, bounds: box(...region.bounds), col, row });
    }
  }
  if (cells.length > MAX_TYPE_MODULES) throw new Error(`Layout has ${cells.length} modules; limit ${MAX_TYPE_MODULES}`);
  const modules = cells.map((cell): TypeModule => {
    const site = sites[cell.row * o.columns + cell.col];
    const [l, t, r, b] = cell.bounds, mw = r - l, mh = b - t;
    const seed = componentSeed(o.seed, cell.id, "module");
    const shiftX = (site.position[0] - site.origin[0]) / cellW, shiftY = (site.position[1] - site.origin[1]) / cellH;
    const turnChannel = site.angle, growChannel = site.scale - 1;
    const half = o.gutter / 2, collapsed = mw - o.gutter < 1 || mh - o.gutter < 1;
    const kind: TypeModuleKind = collapsed || !site.kept ? "blank"
      : unit(seed, cell.id, "screen") < o.screens ? "screen" : unit(seed, cell.id, "flat") < o.flats ? "flat" : "text";
    const turn = kind === "text" && unit(seed, cell.id, "turn") < o.turned ? (unit(seed, cell.id, "turnDirection") < .5 ? -1 : 1) : 0;
    const tone = kind === "text" ? (turn === 0 ? 0 : 1) : kind === "screen" ? 2 : kind === "flat" ? (unit(seed, cell.id, "flatTone") < .5 ? 1 : 3) : 0;
    const screenStep = o.screenAngles === "aligned" ? 0 : o.screenAngles === "crossed"
      ? 2 * Math.floor(unit(seed, cell.id, "screenAngle") * 2) : Math.floor(unit(seed, cell.id, "screenAngle") * 4);
    const clipBounds = collapsed ? box(l, t, r, b) : box(l + half, t + half, r - half, b - half);
    return Object.freeze({
      id: cell.id, seed, bounds: cell.bounds, clip: Object.freeze({ id: cell.id, seed, bounds: clipBounds }), kind, tone,
      pinned: site.anchor, turn: turn as -1 | 0 | 1,
      displacement: point(shiftX * o.displacement * mw, shiftY * o.displacement * mh),
      stretch: point(2 ** (o.zoom * growChannel + o.stretch * turnChannel), 2 ** (o.zoom * growChannel)),
      screenStep, source: Object.freeze({ slicing: o.slicing, site: site.id, col: cell.col, row: cell.row,
        shift: point(shiftX, shiftY), turnChannel, growChannel }),
    });
  });
  return Object.freeze({ region: box(left, top, right, bottom), area, anchor, modules: Object.freeze(modules) });
}

// --- The type field ------------------------------------------------------------------------

export interface TypeFieldOptions {
  /** Cap height in canvas units. */
  size: number;
  /** Row pitch as a multiple of `size`. */
  leading: number;
  /** Space between repeats of a line, as a multiple of `size`. */
  gap: number;
  /** Consecutive rows that repeat the same line before the next line starts. */
  rowsPerLine: number;
  /** Row stagger: each row slides this many periods further than the one above. */
  phase: number;
}

export interface TypeField {
  readonly text: TextSource;
  readonly options: TypeFieldOptions;
  /** Canvas units per font unit: size / CAP_HEIGHT. */
  readonly scale: number;
  /** Row pitch in canvas units. */
  readonly pitch: number;
  readonly lines: readonly TypeLine[];
  /** Ink width of each line, canvas units. */
  readonly widths: readonly number[];
  /** Repeat period of each line: ink width + gap × size. */
  readonly periods: readonly number[];
  readonly key: string;
}

const fieldCache = new Map<string, TypeField>();
export function typeField(text: TextSource, options: TypeFieldOptions): TypeField {
  finite("Type size", options.size, 4, 600); finite("Leading", options.leading, .5, 4); finite("Repeat gap", options.gap, 0, 8);
  if (!Number.isInteger(options.rowsPerLine) || options.rowsPerLine < 1 || options.rowsPerLine > 8) throw new Error("Rows per line must be an integer in [1, 8]");
  finite("Phase", options.phase, -2, 2);
  // `key` names the geometry (lines and options); the field object also carries the whole text, so it is cached by both.
  const key = JSON.stringify([text.lines, options]);
  return memoized(fieldCache, JSON.stringify([text.id, text.anchor, key]), () => {
    const scale = options.size / CAP_HEIGHT;
    const lines = text.lines.map(typeLine);
    const widths = lines.map((line) => (line.right - line.left) * scale);
    return Object.freeze({ text, options: Object.freeze({ ...options }), scale, pitch: options.leading * options.size,
      lines: Object.freeze(lines), widths: Object.freeze(widths),
      periods: Object.freeze(widths.map((width) => width + options.gap * options.size)), key });
  });
}

/** Index into `field.lines` of row `r` (any integer). */
export function rowLine(field: TypeField, r: number): number {
  const span = field.lines.length * field.options.rowsPerLine;
  return Math.floor((((r % span) + span) % span) / field.options.rowsPerLine);
}
/** Canvas baseline of row `r`: the cap band is centred in its pitch. */
export function rowBaseline(field: TypeField, area: TypeLayout["area"], r: number): number {
  return area[1] + r * field.pitch + (field.pitch + field.options.size) / 2;
}
/** Canvas x of the left ink edge of repeat `k` of row `r`. */
export function repeatLeft(field: TypeField, area: TypeLayout["area"], r: number, k: number): number {
  const period = field.periods[rowLine(field, r)];
  return area[0] + k * period + r * field.options.phase * period;
}

// --- Module transform ----------------------------------------------------------------------

/** The linear part of a module's transform, p − c = M (q − c − D), and its inverse. */
export interface ModuleFrame {
  readonly cx: number;
  readonly cy: number;
  readonly dx: number;
  readonly dy: number;
  /** M = [[a, b], [c, d]] = R·S. */
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  /** M⁻¹ = [[ia, ib], [ic, id]]. */
  readonly ia: number;
  readonly ib: number;
  readonly ic: number;
  readonly id: number;
}
export function moduleFrame(module: TypeModule): ModuleFrame {
  const [sx, sy] = module.stretch, turn = module.turn, cos = turn === 0 ? 1 : 0, sin = turn;
  finite("Module stretch x", sx, 1e-3, 1e3); finite("Module stretch y", sy, 1e-3, 1e3);
  const a = cos * sx, b = -sin * sy, c = sin * sx, d = cos * sy, det = sx * sy;
  return { cx: (module.bounds[0] + module.bounds[2]) / 2, cy: (module.bounds[1] + module.bounds[3]) / 2,
    dx: module.displacement[0], dy: module.displacement[1], a, b, c, d, ia: d / det, ib: -b / det, ic: -c / det, id: a / det };
}
/** Map a field point into the module's LOCAL frame (clip origin at 0,0). */
export function fieldToLocal(frame: ModuleFrame, module: TypeModule, qx: number, qy: number): Point {
  const ux = qx - frame.cx - frame.dx, uy = qy - frame.cy - frame.dy;
  return point(frame.cx + frame.a * ux + frame.b * uy - module.clip.bounds[0], frame.cy + frame.c * ux + frame.d * uy - module.clip.bounds[1]);
}

// --- Module type geometry ------------------------------------------------------------------

export interface TypeInstance {
  /** `<row>:<repeat>`. */
  readonly id: string;
  readonly row: number;
  readonly repeat: number;
  /** Index into `TypeField.lines`. */
  readonly line: number;
}
export interface ModuleType {
  readonly id: string;
  /** Source mapping: every glyph run (line repeat) whose ink can reach the module. */
  readonly instances: readonly TypeInstance[];
  /** Transformed rings in the local frame, unclipped, only those that reach [0,w]×[0,h]. */
  readonly rings: readonly Ring[];
  /** The same rings clipped to [0,w]×[0,h] and merged into keyholed polygons (`keyholeRings`), for filling. */
  readonly fill: readonly Ring[];
  readonly vertices: number;
}

const typeCache = new WeakMap<TypeModule, Map<string, ModuleType>>();

/** Text geometry of one module; cached per module object and field, so an appearance edit reuses it. */
export function moduleType(layout: Pick<TypeLayout, "area">, field: TypeField, module: TypeModule): ModuleType {
  let byField = typeCache.get(module);
  if (!byField) { byField = new Map(); typeCache.set(module, byField); }
  const key = `${field.key}|${layout.area.join(",")}`;
  return memoized(byField, key, () => buildType(layout, field, module));
}

function buildType(layout: Pick<TypeLayout, "area">, field: TypeField, module: TypeModule): ModuleType {
  const [cl, ct, cr, cb] = module.clip.bounds, w = cr - cl, h = cb - ct;
  const frame = moduleFrame(module);
  const { cx, cy, dx, dy, a, b, c, d, ia, ib, ic, id: idd } = frame;
  let qxMin = Infinity, qxMax = -Infinity, qyMin = Infinity, qyMax = -Infinity;
  for (const [px, py] of [[cl, ct], [cr, ct], [cr, cb], [cl, cb]]) {
    const qx = cx + dx + ia * (px - cx) + ib * (py - cy), qy = cy + dy + ic * (px - cx) + idd * (py - cy);
    qxMin = Math.min(qxMin, qx); qxMax = Math.max(qxMax, qx); qyMin = Math.min(qyMin, qy); qyMax = Math.max(qyMax, qy);
  }
  const area = layout.area, s = field.scale, pitch = field.pitch;
  const firstRow = Math.floor((qyMin - area[1]) / pitch) - 1, lastRow = Math.ceil((qyMax - area[1]) / pitch) + 1;
  if (lastRow - firstRow > MAX_MODULE_INSTANCES) throw new Error(`Module ${module.id} spans ${lastRow - firstRow} type rows; limit ${MAX_MODULE_INSTANCES}. Increase the type size`);
  const instances: TypeInstance[] = [], rings: Ring[] = [], clippedRings: Ring[] = [];
  let vertices = 0;
  for (let r = firstRow; r <= lastRow; r++) {
    const li = rowLine(field, r), line = field.lines[li], base = rowBaseline(field, area, r);
    if (base + line.bottom * s < qyMin || base + line.top * s > qyMax) continue;
    const period = field.periods[li], inkW = field.widths[li], shift = repeatLeft(field, area, r, 0);
    const kMin = Math.ceil((qxMin - inkW - shift) / period), kMax = Math.floor((qxMax - shift) / period);
    if (kMax - kMin + 1 + instances.length > MAX_MODULE_INSTANCES)
      throw new Error(`Module ${module.id} needs more than ${MAX_MODULE_INSTANCES} glyph runs. Increase the type size or the repeat gap`);
    for (let k = kMin; k <= kMax; k++) {
      const left = repeatLeft(field, area, r, k);
      instances.push(Object.freeze({ id: `${r}:${k}`, row: r, repeat: k, line: li }));
      for (const ring of line.rings) {
        const out: Point[] = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [gx, gy] of ring) {
          const ux = left + (gx - line.left) * s - cx - dx, uy = base + gy * s - cy - dy;
          const x = cx + a * ux + b * uy - cl, y = cy + c * ux + d * uy - ct;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          out.push(point(x, y));
        }
        if (maxX < 0 || minX > w || maxY < 0 || minY > h) continue;
        vertices += out.length;
        if (vertices > MAX_MODULE_VERTICES) throw new Error(`Module ${module.id} needs more than ${MAX_MODULE_VERTICES} vertices. Increase the type size`);
        const kept = Object.freeze(out);
        rings.push(kept);
        const clipped = clipRingToRect(kept, w, h);
        if (clipped) clippedRings.push(clipped);
      }
    }
  }
  return Object.freeze({ id: module.id, instances: Object.freeze(instances), rings: Object.freeze(rings), fill: Object.freeze(keyholeRings(clippedRings)), vertices });
}

export interface TypeContent {
  /** Geometry of the text modules, in layout order. */
  readonly modules: readonly ModuleType[];
  readonly vertices: number;
}
const contentCache = new WeakMap<TypeLayout, Map<string, TypeContent>>();

/** Every text module's geometry. Total vertices are bounded by MAX_TYPE_VERTICES. */
export function typeContent(layout: TypeLayout, field: TypeField, cancelled?: () => boolean): TypeContent {
  let byField = contentCache.get(layout);
  if (!byField) { byField = new Map(); contentCache.set(layout, byField); }
  return memoized(byField, field.key, () => {
    const modules: ModuleType[] = [];
    let vertices = 0;
    for (const module of layout.modules) {
      if (module.kind !== "text") continue;
      if (cancelled?.()) throw new Error("Composition cancelled");
      const type = moduleType(layout, field, module);
      vertices += type.vertices;
      if (vertices > MAX_TYPE_VERTICES) throw new Error(`Type needs more than ${MAX_TYPE_VERTICES} vertices across modules. Increase the type size or use fewer modules`);
      modules.push(type);
    }
    return Object.freeze({ modules: Object.freeze(modules), vertices });
  });
}

// --- Screens and lined type ----------------------------------------------------------------

export interface TypeScreenSpec {
  /** Field period of the grating, canvas units (before the module's stretch). */
  period: number;
  /** Field angle in degrees; each module adds screenStep × 45°. */
  angle: number;
}

interface ScreenFrame { x: number; y: number; angle: number; period: number; phase: number; reach: number }
/** The module's mapped grating frame; see SCREENS in the header. */
export function screenFrame(module: TypeModule, spec: TypeScreenSpec): ScreenFrame {
  finite("Screen period", spec.period, MIN_PERIOD, 1e4); finite("Screen angle", spec.angle, -3600, 3600);
  const f = moduleFrame(module), [sx, sy] = module.stretch;
  const alpha = (spec.angle + 45 * module.screenStep) * RADIANS, nx = -Math.sin(alpha), ny = Math.cos(alpha);
  // ∇f = R S⁻¹ n: R is the module's quarter turn; the mapped spacing is period / |∇f|.
  const vx = nx / sx, vy = ny / sy, cos = module.turn === 0 ? 1 : 0, sin = module.turn;
  const gx = cos * vx - sin * vy, gy = sin * vx + cos * vy, length = Math.hypot(gx, gy);
  const period = spec.period / length;
  if (period < MIN_PERIOD)
    throw new Error(`Screen period ${spec.period} is stretched to ${period.toFixed(2)} in module ${module.id}, below the ${MIN_PERIOD}-unit minimum. Raise the period or lower stretch and zoom`);
  const [cl, ct, cr, cb] = module.clip.bounds;
  return { x: f.cx - cl, y: f.cy - ct, angle: Math.atan2(-gx / length, gy / length), period,
    phase: -(nx * (f.cx + f.dx) + ny * (f.cy + f.dy)) / spec.period, reach: Math.hypot(cr - cl, cb - ct) / 2 };
}

function localSupport(module: TypeModule, rings?: readonly Ring[]): Support {
  const [cl, ct, cr, cb] = module.clip.bounds, w = cr - cl, h = cb - ct;
  return resolveSupport({ footprint: { shape: "rectangle", centerX: w / 2, centerY: h / 2, width: w, height: h },
    ...(rings ? { mask: { source: { kind: "paths" as const, rings }, invert: false } } : {}) }, DEFAULT_FLATNESS);
}

function screenPaths(module: TypeModule, spec: TypeScreenSpec, support: Support): readonly Path[] {
  const frame = screenFrame(module, spec);
  const elements = patternFunction({ kind: "grating", period: frame.period, chirp: 0 })({ x: frame.x, y: frame.y,
    angle: frame.angle, reach: frame.reach, phase: frame.phase, flatness: DEFAULT_FLATNESS });
  const paths: Path[] = [], budget = { work: 0 };
  elements.strokes.forEach((stroke, level) => {
    clipToSupport(stroke.points, false, support, budget).pieces.forEach((piece, part) => {
      const id = `${module.id}/${stroke.id}#${part}`;
      paths.push(Object.freeze({ id, seed: componentSeed(module.seed, id, "path"), points: Object.freeze(piece), closed: false, level,
        levelFraction: elements.strokes.length > 1 ? level / (elements.strokes.length - 1) : 0, tone: module.tone }));
    });
  });
  return Object.freeze(paths);
}

const screenCache = new WeakMap<TypeModule, Map<string, readonly Path[]>>();
/** The module's screen lines, clipped to its clip rectangle, in its local frame. Ids: `<module>/line:<k>#<part>`, k the field line index. */
export function moduleScreen(module: TypeModule, spec: TypeScreenSpec): readonly Path[] {
  let bySpec = screenCache.get(module);
  if (!bySpec) { bySpec = new Map(); screenCache.set(module, bySpec); }
  return memoized(bySpec, JSON.stringify(spec), () => screenPaths(module, spec, localSupport(module)));
}

const lineCache = new WeakMap<ModuleType, Map<string, readonly Path[]>>();
/** Text made of the module's screen lines: the grating clipped to the glyph interiors (nonzero rule). Ids: `<module>/line:<k>#<part>`. */
export function moduleLined(module: TypeModule, type: ModuleType, spec: TypeScreenSpec): readonly Path[] {
  if (type.rings.length === 0) return Object.freeze([]);
  let bySpec = lineCache.get(type);
  if (!bySpec) { bySpec = new Map(); lineCache.set(type, bySpec); }
  return memoized(bySpec, JSON.stringify([module.id, module.screenStep, spec]), () => {
    // The glyph mask is a plate support, whose own limits (rings, vertices) do not know the module.
    try { return screenPaths(module, spec, localSupport(module, type.rings)); }
    catch (error) { throw new Error(`Lined type in module ${module.id}: ${(error as Error).message}`); }
  });
}

const outlineCache = new WeakMap<ModuleType, readonly Path[]>();
/** Glyph outlines clipped as polylines to the module: `<module>/ring:<i>#<part>`, i the index into `type.rings`. */
export function moduleOutline(module: TypeModule, type: ModuleType): readonly Path[] {
  const hit = outlineCache.get(type);
  if (hit) return hit;
  const support = localSupport(module), budget = { work: 0 }, paths: Path[] = [];
  type.rings.forEach((ring, index) => {
    const clipped = clipToSupport(ring, true, support, budget);
    clipped.pieces.forEach((piece, part) => {
      const id = `${module.id}/ring:${index}#${part}`;
      paths.push(Object.freeze({ id, seed: componentSeed(module.seed, id, "path"), points: Object.freeze(piece), closed: clipped.closed,
        level: 0, levelFraction: 0, tone: module.tone }));
    });
  });
  const result = Object.freeze(paths);
  outlineCache.set(type, result);
  return result;
}

// --- Anchor --------------------------------------------------------------------------------

export interface TypeAnchor {
  readonly text: string;
  /** Position is the strip's centre, scale font units → canvas, angle 0; tone 0. */
  readonly site: { readonly id: string; readonly seed: number; readonly position: Point; readonly angle: number; readonly scale: number; readonly tone: number };
  /** Font-unit rings and the ink centre to subtract before scaling. */
  readonly rings: readonly Ring[];
  readonly center: Point;
  /** World-space ink bounds: always inside the strip. */
  readonly bounds: readonly [number, number, number, number];
}

const anchorCache = new Map<string, TypeAnchor | null>();
/** The caption set once, unstretched and uncropped, fitted to the strip with a small margin; it is never a module. */
export function typeAnchor(layout: TypeLayout, text: TextSource, seed: number): TypeAnchor | null {
  const strip = layout.anchor;
  if (!strip) return null;
  return memoized(anchorCache, JSON.stringify([strip, text.anchor, seed]), () => {
    const line = typeLine(text.anchor);
    const width = strip[2] - strip[0], height = strip[3] - strip[1];
    const inkW = line.right - line.left, inkH = line.bottom - line.top;
    const scale = Math.min((width * .94) / inkW, (height * .68) / inkH);
    const center: Point = point((line.left + line.right) / 2, (line.top + line.bottom) / 2);
    const cx = (strip[0] + strip[2]) / 2, cy = (strip[1] + strip[3]) / 2;
    return Object.freeze({ text: text.anchor, rings: Object.freeze(keyholeRings(line.rings)), center,
      site: Object.freeze({ id: "anchor", seed: componentSeed(seed, "anchor", "site"), position: point(cx, cy), angle: 0, scale, tone: 0 }),
      bounds: box(cx - inkW * scale / 2, cy - inkH * scale / 2, cx + inkW * scale / 2, cy + inkH * scale / 2) });
  });
}
