import { memoized } from "./sources.js";
import { wallpaperSites } from "./sources.js";
import { typeLine } from "./type-text.js";
import type { Point } from "./types.js";

/**
 * Bundled source geometry for the inversion orbit: straight edges, whole circles and oriented
 * anchor sites, all inside one disc (`bound`) so the pieces an inversion moves are finite.
 *
 * INPUT CONTRACT. A source is chosen by a validated `kind` and a small integer `density`; the
 * glyph is one of the bundled outlines of the licensed outline font (`GLYPHS`, unshaped Latin,
 * as in `typeLine`). Nothing is fetched or randomized. Binding a user's own outline, wallpaper
 * or point set is host work: any `Source` value built by hand goes straight into `orbitImages`.
 *
 * OUTPUT. Frozen `chains` (polylines of straight edges, closed or open), `circles` (whole
 * circles; `disc` marks the ones a fill may treat as a region) and `sites` (position, axis
 * angle in radians, signed scale where negative mirrors, and `extent`, the natural size of a
 * mark in canvas units). Ids are stable for the same construction. Coordinates are canvas
 * units: the unit shape is scaled by `size`, turned by `turn` degrees (clockwise on screen, as
 * the canvas is y-down) and moved to (x, y).
 *
 * Failure: an unknown kind or glyph, nonpositive size or a density outside 2–8 throws.
 */
export const SOURCE_KINDS = ["rings", "net", "grid", "glyph", "wallpaper"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const GLYPHS = ["R", "k", "G", "a", "2", "&"] as const;

export interface SourceOptions {
  kind: SourceKind;
  /** Rings, net circles, grid lines per direction or wallpaper cells across the diameter. */
  density: number;
  glyph: string;
  /** Radius of the bounding disc, canvas units. */
  size: number;
  x: number;
  y: number;
  /** Degrees. */
  turn: number;
}

export interface SourceChain { readonly id: string; readonly points: readonly Point[]; readonly closed: boolean }
export interface SourceCircle { readonly id: string; readonly cx: number; readonly cy: number; readonly r: number; readonly disc: boolean }
export interface SourceSite {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scale: number;
  readonly extent: number;
  readonly tone?: number;
}
export interface Source {
  readonly chains: readonly SourceChain[];
  readonly circles: readonly SourceCircle[];
  readonly sites: readonly SourceSite[];
  readonly bound: { readonly cx: number; readonly cy: number; readonly r: number };
}

const cache = new Map<string, Source>();
const TAU = 2 * Math.PI;

function unit(options: SourceOptions): { chains: { id: string; points: Point[]; closed: boolean }[]; circles: { id: string; r: number }[];
  sites: { id: string; x: number; y: number; angle: number; scale: number; extent: number; tone?: number }[] } {
  const K = options.density;
  const chains: { id: string; points: Point[]; closed: boolean }[] = [];
  const circles: { id: string; r: number }[] = [];
  const sites: { id: string; x: number; y: number; angle: number; scale: number; extent: number; tone?: number }[] = [];
  const chord = (id: string, horizontal: boolean, c: number) => {
    const h = Math.sqrt(Math.max(0, 1 - c * c));
    chains.push({ id, closed: false, points: horizontal ? [[-h, c], [h, c]] : [[c, -h], [c, h]] });
  };
  if (options.kind === "rings") {
    for (let j = 1; j <= K; j++) circles.push({ id: `ring:${j}`, r: j / K });
    for (let i = 0; i < 8; i++) {
      const theta = TAU * i / 8;
      sites.push({ id: `site:${i}`, x: (1 - 0.5 / K) * Math.cos(theta), y: (1 - 0.5 / K) * Math.sin(theta), angle: theta + Math.PI / 2, scale: 1, extent: 0.7 / K + 0.1 });
    }
  } else if (options.kind === "net") {
    for (let j = 1; j <= K; j++) circles.push({ id: `ring:${j}`, r: j / K });
    for (let i = 0; i < 2 * K; i++) {
      const theta = TAU * i / (2 * K);
      chains.push({ id: `spoke:${i}`, closed: false, points: [[0, 0], [Math.cos(theta), Math.sin(theta)]] });
      const mid = TAU * (i + 0.5) / (2 * K), radius = 1 - 0.5 / K;
      sites.push({ id: `site:${i}`, x: radius * Math.cos(mid), y: radius * Math.sin(mid), angle: mid, scale: 1, extent: Math.min(0.9 / K, Math.PI * radius / K * 0.8) });
    }
  } else if (options.kind === "grid") {
    const pitch = 2 / (K + 1);
    for (let i = 1; i <= K; i++) { chord(`row:${i}`, true, -1 + i * pitch); chord(`column:${i}`, false, -1 + i * pitch); }
    circles.push({ id: "rim", r: 1 });
    for (let i = 1; i <= K; i++) for (let j = 1; j <= K; j++) {
      const x = -1 + i * pitch, y = -1 + j * pitch;
      if (Math.hypot(x, y) <= 0.97) sites.push({ id: `site:${i}:${j}`, x, y, angle: 0, scale: 1, extent: pitch * 0.7 });
    }
  } else if (options.kind === "glyph") {
    const line = typeLine(options.glyph);
    const mx = (line.left + line.right) / 2, my = (line.top + line.bottom) / 2;
    let far = 0;
    for (const ring of line.rings) for (const [x, y] of ring) far = Math.max(far, Math.hypot(x - mx, y - my));
    line.rings.forEach((ring, index) => {
      chains.push({ id: `outline:${index}`, closed: true, points: ring.map(([x, y]): Point => [(x - mx) / far, (y - my) / far]) });
    });
    sites.push({ id: "site:centre", x: 0, y: 0, angle: 0, scale: 1, extent: 0.5 });
    const outer = chains[0].points, stride = Math.max(1, Math.round(outer.length / 8));
    for (let i = 0; i < outer.length; i += stride) {
      const next = outer[(i + 1) % outer.length];
      sites.push({ id: `site:${i}`, x: outer[i][0], y: outer[i][1], angle: Math.atan2(next[1] - outer[i][1], next[0] - outer[i][0]), scale: 1, extent: 0.22 });
    }
  } else {
    const pitch = 2 / K, half = 200;
    for (let i = -K; i <= K; i++) {
      const c = i * pitch;
      if (Math.abs(c) < 1) { chord(`row:${i}`, true, c); chord(`column:${i}`, false, c); }
    }
    circles.push({ id: "rim", r: 1 });
    for (const site of wallpaperSites({ seed: 0, group: "p4g", cellWidth: pitch * half, cellHeight: pitch * half, centerX: 0, centerY: 0,
      width: 2 * half, height: 2 * half, motifOffsetX: 0.2, motifOffsetY: 0.12, margin: 0, breakAmount: 0, breakDensity: 0 })) {
      const x = site.position[0] / half, y = site.position[1] / half;
      if (Math.hypot(x, y) <= 0.97) sites.push({ id: site.id, x, y, angle: site.angle, scale: site.scale, extent: pitch * 0.5, tone: site.tone });
    }
  }
  return { chains, circles, sites };
}

/** The bundled source, placed and frozen. Cached by construction only. */
export function sourceGeometry(options: SourceOptions): Source {
  const { kind, density, glyph, size, x, y, turn } = options;
  if (!(SOURCE_KINDS as readonly string[]).includes(kind)) throw new Error(`Unknown source: ${String(kind)}`);
  if (!Number.isInteger(density) || density < 2 || density > 8) throw new Error("Source density must be an integer in [2, 8]");
  if (kind === "glyph" && !(GLYPHS as readonly string[]).includes(glyph)) throw new Error(`Unknown glyph: ${String(glyph)}`);
  if (!Number.isFinite(size) || size <= 0) throw new Error("Source size must be positive and finite");
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(turn)) throw new Error("Source position and turn must be finite");
  return memoized(cache, JSON.stringify([kind, density, kind === "glyph" ? glyph : "", size, x, y, turn]), () => {
    const raw = unit(options), tau = turn * Math.PI / 180, c = Math.cos(tau), s = Math.sin(tau);
    const place = (px: number, py: number): Point => Object.freeze([x + size * (c * px - s * py), y + size * (s * px + c * py)] as const);
    return Object.freeze({
      chains: Object.freeze(raw.chains.map((chain) => Object.freeze({ id: chain.id, closed: chain.closed, points: Object.freeze(chain.points.map(([px, py]) => place(px, py))) }))),
      circles: Object.freeze(raw.circles.map((circle) => {
        const [cx, cy] = place(0, 0);
        return Object.freeze({ id: circle.id, cx, cy, r: circle.r * size, disc: true });
      })),
      sites: Object.freeze(raw.sites.map((site) => {
        const [sx, sy] = place(site.x, site.y);
        return Object.freeze({ id: site.id, x: sx, y: sy, angle: site.angle + tau, scale: site.scale, extent: site.extent * size, tone: site.tone });
      })),
      bound: Object.freeze({ cx: x, cy: y, r: size }),
    });
  });
}
