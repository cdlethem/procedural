import { componentSeed } from "./core.js";
import { domainContains, planarDomain, type PlanarRegionData } from "./domains.js";
import { CHEMOTAXIS_ARENA, CHEMOTAXIS_LIMITS, type ChemotaxisEmitter } from "./chemotaxis.js";

/**
 * Bundled inputs of Chemotactic Trails: where the emitters sit and which barrier the colony meets.
 * Both are constructions from scalar controls, so an instrument persists numbers and a choice, never
 * geometry. The direct API takes any emitters and any resolved planar regions instead
 * (`ChemotaxisConstruction`); a host binding a user's own barrier region is future work.
 */
export const emitterLayouts = ["ring", "line", "scatter"] as const;
export type EmitterLayout = (typeof emitterLayouts)[number];
export const barrierKinds = ["none", "wall", "enclosure", "island", "pillars"] as const;
export type BarrierKind = (typeof barrierKinds)[number];

const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / 0x1_0000_0000;
const radians = Math.PI / 180;
/** Largest emitter coordinate: `checkChemotaxis` admits `[0, 640)`. */
const ARENA_LIMIT = CHEMOTAXIS_ARENA - 1e-6;

export interface EmitterLayoutOptions {
  layout: EmitterLayout;
  /** Emitters; a single one sits at the center whatever the layout. */
  count: number;
  /** Agents born at each emitter. */
  agents: number;
  centerX: number;
  centerY: number;
  /** Ring radius, line half length or scatter radius, canvas units. */
  radius: number;
  /** Rotation of a ring or line, degrees. */
  angle: number;
  /**
   * Strength falls linearly from 1 at the first emitter to `1 - taper` at the last (0: all equal), so the
   * emitters compete unequally for the field.
   */
  taper: number;
  seed: number;
  /** Scatter draws again (up to 40 times, from the same stream) while its position is blocked; ring and line positions are fixed by the controls. */
  blocked?: (x: number, y: number) => boolean;
}

/**
 * Emitters on a ring (evenly, the first at `angle`), along a line through the center (evenly from one end
 * to the other) or scattered in a disc (emitter `k` from its own stream, so raising `count` keeps the earlier ones).
 */
export function emitterLayout(o: EmitterLayoutOptions): ChemotaxisEmitter[] {
  if (!Number.isInteger(o.count) || o.count < 0 || o.count > CHEMOTAXIS_LIMITS.maxEmitters) throw new Error(`Emitters must be an integer from 0 to ${CHEMOTAXIS_LIMITS.maxEmitters}`);
  if (!(o.taper >= 0 && o.taper <= 1)) throw new Error("Strength taper must be from 0 to 1");
  if (!(o.radius >= 0)) throw new Error("Layout radius must be at least 0");
  const out: ChemotaxisEmitter[] = [];
  for (let k = 0; k < o.count; k++) {
    let x = o.centerX, y = o.centerY;
    if (o.count > 1) {
      if (o.layout === "ring") {
        const a = o.angle * radians + 2 * Math.PI * k / o.count;
        x += o.radius * Math.cos(a); y += o.radius * Math.sin(a);
      } else if (o.layout === "line") {
        const along = o.radius * (2 * k / (o.count - 1) - 1), a = o.angle * radians;
        x += along * Math.cos(a); y += along * Math.sin(a);
      } else if (k > 0 || o.blocked?.(x, y)) {
        // The first emitter is the center unless a barrier covers it; the rest scatter uniformly over the disc. Attempt 0 is the plain
        // draw, so a layout that never meets the barrier is the same whether or not one is given.
        const id = `emitter:${k}`;
        for (let attempt = 0; attempt < 40; attempt++) {
          const tag = attempt === 0 ? "" : `#${attempt}`;
          const r = o.radius * Math.sqrt(unit(o.seed, id, `radius${tag}`)), a = 2 * Math.PI * unit(o.seed, id, `angle${tag}`);
          x = o.centerX + r * Math.cos(a); y = o.centerY + r * Math.sin(a);
          if (!o.blocked?.(x, y)) break;
          if (attempt === 39) throw new Error(`Emitter ${k + 1} found no clear place in the scatter disc; raise Layout radius or lower the barrier size`);
        }
      }
    }
    // Emitters live inside the arena: a ring or line that reaches past the canvas edge, or a center dragged to 640, is held at the edge.
    x = Math.min(ARENA_LIMIT, Math.max(0, x)); y = Math.min(ARENA_LIMIT, Math.max(0, y));
    out.push({ x, y, agents: o.agents, strength: o.count > 1 ? 1 - o.taper * k / (o.count - 1) : 1 });
  }
  return out;
}

export interface BarrierOptions {
  kind: BarrierKind;
  centerX: number;
  centerY: number;
  /** Wall half length, enclosure or island radius, or pillar radius, canvas units. */
  size: number;
  /** Width of the opening in a wall or enclosure, canvas units. */
  gap: number;
  /** Pillars to place. */
  pillars: number;
  /** Cells per side of the field; walls are made thicker than two cells and than the fastest agent step. */
  grid: number;
  seed: number;
  /** Discs that pillars keep clear of (emitters with their spawn radius). */
  avoid: readonly { x: number; y: number; radius: number }[];
}

/** Barrier wall thickness: over the fastest step and over two field cells, so a move cannot jump it. */
export const barrierThickness = (grid: number): number => Math.max(14, 2 * CHEMOTAXIS_ARENA / grid + 1);

const disc = (x: number, y: number, r: number, id: string): PlanarRegionData =>
  ({ id, outer: Array.from({ length: 40 }, (_, i) => [x + r * Math.cos(2 * Math.PI * i / 40), y + r * Math.sin(2 * Math.PI * i / 40)] as [number, number]) });

/** Resolved barrier regions (plain planar data) for a bundled barrier; `[]` for `none`. */
export function bundledBarrier(o: BarrierOptions): PlanarRegionData[] {
  if (o.kind === "none") return [];
  if (!(o.size > 0)) throw new Error("Barrier size must be above 0");
  const t = barrierThickness(o.grid), { centerX: cx, centerY: cy, size, gap } = o;
  if (o.kind === "wall") {
    if (!(gap >= 0) || gap / 2 >= size) throw new Error("Barrier gap must be from 0 to less than twice the barrier size, or there is no wall; use Barrier: none");
    const rect = (id: string, top: number, bottom: number): PlanarRegionData => ({ id, outer: [[cx - t / 2, top], [cx + t / 2, top], [cx + t / 2, bottom], [cx - t / 2, bottom]] });
    return [rect("wall:top", cy - size, cy - gap / 2), rect("wall:bottom", cy + gap / 2, cy + size)];
  }
  if (o.kind === "island") return [disc(cx, cy, size, "island")];
  if (o.kind === "enclosure") {
    if (size <= t + 1) throw new Error(`Barrier size must exceed ${t + 1} (the wall thickness) for an enclosure`);
    if (!(gap >= 0) || gap / 2 >= size) throw new Error("Barrier gap must be from 0 to less than twice the barrier size");
    const open = Math.asin(Math.min(1, gap / 2 / size));
    const steps = Math.max(8, Math.ceil((2 * Math.PI - 2 * open) / (Math.PI / 30)));
    const arc = (r: number, from: number, to: number): [number, number][] =>
      Array.from({ length: steps + 1 }, (_, i) => { const a = from + (to - from) * i / steps; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
    const outer = arc(size, open, 2 * Math.PI - open), inner = arc(size - t, 2 * Math.PI - open, open);
    return [{ id: "enclosure", outer: [...outer, ...inner] }];
  }
  // Pillars: deterministic rejection sampling; a request that cannot be met is an error, not fewer pillars.
  if (!Number.isInteger(o.pillars) || o.pillars < 0 || o.pillars > 60) throw new Error("Pillars must be an integer from 0 to 60");
  const margin = size + t, placed: { x: number; y: number }[] = [];
  const limit = 60 * Math.max(1, o.pillars);
  for (let attempt = 0; placed.length < o.pillars && attempt < limit; attempt++) {
    const id = `pillar:${attempt}`;
    const x = margin + unit(o.seed, id, "x") * (CHEMOTAXIS_ARENA - 2 * margin), y = margin + unit(o.seed, id, "y") * (CHEMOTAXIS_ARENA - 2 * margin);
    if (o.avoid.some((a) => Math.hypot(a.x - x, a.y - y) < a.radius + size + 24)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 2 * size + 24)) continue;
    placed.push({ x, y });
  }
  if (placed.length < o.pillars) throw new Error(`Only ${placed.length} of ${o.pillars} pillars fit clear of the emitters; lower Pillars or the barrier size`);
  return placed.map((p, i) => disc(p.x, p.y, size, `pillar:${i}`));
}

/** Whether a point's field cell is a wall cell of these barrier regions (the cell's centre lies in a region), as the colony sees it. */
export function barrierBlocks(barrier: readonly PlanarRegionData[], grid: number): (x: number, y: number) => boolean {
  if (barrier.length === 0) return () => false;
  const domain = planarDomain(barrier as PlanarRegionData[], { id: "chemotaxis-barrier" }), cell = CHEMOTAXIS_ARENA / grid;
  const centre = (v: number) => (Math.min(grid - 1, Math.max(0, Math.floor(v / cell))) + 0.5) * cell;
  return (x, y) => domainContains(domain, centre(x), centre(y));
}

/** The scalar controls that place the colony and its barrier (see `chemotacticTrailsComposition`). */
export interface ColonyControls {
  layout: EmitterLayout; emitters: number; agents: number; centerX: number; centerY: number; layoutRadius: number; layoutAngle: number; strengthTaper: number;
  spawnRadius: number; grid: number; barrier: BarrierKind; barrierSize: number; barrierGap: number; pillarRadius: number; pillars: number;
}

/**
 * Emitters and barrier regions for scalar controls. Wall, enclosure and island barriers come first and
 * scatter emitters avoid them; pillars come last and avoid the emitters. An emitter inside the barrier is an
 * error naming the controls. `placePillars: false` leaves pillars out (they are the only seed-dependent
 * failure, so admission checks skip them).
 */
export function colonyGeometry(q: ColonyControls, seed: number, placePillars = true): { emitters: ChemotaxisEmitter[]; barrier: PlanarRegionData[] } {
  const solid = q.barrier === "pillars" ? [] : bundledBarrier({ kind: q.barrier, centerX: q.centerX, centerY: q.centerY, size: q.barrierSize, gap: q.barrierGap, pillars: 0, grid: q.grid, seed, avoid: [] });
  const blocked = barrierBlocks(solid, q.grid);
  const emitters = emitterLayout({ layout: q.layout, count: q.emitters, agents: q.agents, centerX: q.centerX, centerY: q.centerY, radius: q.layoutRadius, angle: q.layoutAngle, taper: q.strengthTaper, seed, blocked });
  emitters.forEach((e, k) => {
    if (blocked(e.x, e.y)) throw new Error(`Emitter ${k + 1} lies inside the barrier; move the emitters (Center X/Y, Layout radius) or the barrier`);
  });
  if (q.barrier !== "pillars") return { emitters, barrier: solid };
  const barrier = placePillars ? bundledBarrier({ kind: "pillars", centerX: q.centerX, centerY: q.centerY, size: q.pillarRadius, gap: 0, pillars: q.pillars, grid: q.grid, seed, avoid: emitters.map((e) => ({ x: e.x, y: e.y, radius: q.spawnRadius })) }) : [];
  return { emitters, barrier };
}
