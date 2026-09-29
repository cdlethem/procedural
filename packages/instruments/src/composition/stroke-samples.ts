import { componentSeed } from "./core.js";
import { memoized } from "./sources.js";
import { strokeSet } from "./strokes.js";
import type { StrokeData, StrokeSet } from "./strokes.js";

/**
 * Bundled stroke sets: deterministic stand-ins for a host's own resolved strokes, so Stroke
 * Relief works without any host-owned asset. Each is plain variable-width ribbons whose centerlines are
 * closed-form curves (cubic Béziers and a prolate trochoid), with a pressure envelope that gives
 * every stroke an attack, a body and a release: width and load both follow it. None is a
 * captured performance. (The dry-brush sources are not here: they are the existing bristle
 * producers' hairs, composed in `stroke-relief.ts`.)
 *
 * | id | strokes | what it shows |
 * |---|---|---|
 * | `crossing` | 4 long strokes + 2 to 4 dabs, unequal width and load | crossings where each overlap rule reads differently |
 * | `weave` | 4 to 6 wavy bands each way | 16 to 36 crossings: the deposition order decides every one |
 * | `fan` | 5 to 8 strokes from one corner | paint piling up where strokes start together |
 * | `whorl` | two looping strokes | a stroke crossing itself: a stroke never adds to itself |
 * | `swash` | three thick-thin calligraphic strokes | strongly varying width and load along a stroke |
 *
 * Every construction choice of a set is derived from the seed with `componentSeed(seed, id,
 * purpose)`: control-point jitter (up to 40 units), band offsets, wobble, the fan's corner, spread
 * and count, the loop phase. The seed is a different take, not a decoration. Points are spaced
 * about 2.5 canvas units apart along the curve (at most 4,000 per stroke). Ids are `<set>:<seed>`
 * and stroke ids `<set>:<seed>/<name>`, so they never depend on how many strokes precede them.
 */
export const bundledStrokeIds = ["crossing", "weave", "fan", "whorl", "swash"] as const;
export type BundledStrokeId = (typeof bundledStrokeIds)[number];

export const bundledStrokeInfo: Readonly<Record<BundledStrokeId, { title: string; description: string }>> = Object.freeze({
  crossing: { title: "Crossing strokes", description: "Four long strokes of unequal width and load, and a few dabs, crossing near the middle." },
  weave: { title: "Woven bands", description: "Wavy bands laid horizontally and then vertically: every crossing has an over and an under." },
  fan: { title: "Fan of strokes", description: "Strokes that leave one corner together and taper as they sweep across." },
  whorl: { title: "Looping whorl", description: "Two strokes that loop and cross themselves." },
  swash: { title: "Calligraphic swashes", description: "Three thick-thin strokes that swell and fade." },
});

const U32 = 0x1_0000_0000;
type P = readonly [number, number];
const SPACING = 2.5;
const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Attack, body, release: 0 at both ends, 1 through the body. */
const envelope = (t: number, attack: number, release: number): number => smoothstep(0, attack, t) * smoothstep(0, release, 1 - t);

const bezier = (p0: P, p1: P, p2: P, p3: P) => (t: number): P => {
  const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
};

interface Ribbon { id: string; curve: (t: number) => P; width: (t: number) => number; load: (t: number) => number; tone: number }
function ribbon(r: Ribbon): StrokeData {
  let length = 0, last = r.curve(0);
  for (let i = 1; i <= 64; i++) { const p = r.curve(i / 64); length += Math.hypot(p[0] - last[0], p[1] - last[1]); last = p; }
  const n = Math.min(4000, Math.max(12, Math.ceil(length / SPACING)));
  const points: P[] = [], widths: number[] = [], loads: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push(r.curve(t)); widths.push(Math.max(0, r.width(t))); loads.push(Math.min(1, Math.max(0, r.load(t))));
  }
  return { id: r.id, points, widths, loads, tone: r.tone };
}

/** Deterministic draws for one set: `draw(name, purpose)` in [0, 1), `jitter(name, purpose, amount)` in (-amount, amount). */
function draws(set: string, seed: number) {
  const draw = (name: string, purpose: string) => componentSeed(seed, `${set}:${seed}/${name}`, purpose) / U32;
  return { draw, jitter: (name: string, purpose: string, amount: number) => (draw(name, purpose) * 2 - 1) * amount };
}

function crossing(seed: number): StrokeData[] {
  const { draw, jitter } = draws("crossing", seed);
  const at = (name: string, i: number, x: number, y: number): P => [x + jitter(name, `x${i}`, 40), y + jitter(name, `y${i}`, 40)];
  const long = (name: string, points: [P, P, P, P], width: number, load: number, tone: number): StrokeData => {
    const [a, b, c, d] = points.map((p, i) => at(name, i, p[0], p[1]));
    const w = width * (0.85 + 0.3 * draw(name, "width"));
    return ribbon({ id: `crossing:${seed}/${name}`, curve: bezier(a, b, c, d), tone,
      width: (t) => w * (0.45 + 0.55 * envelope(t, 0.14, 0.3)), load: (t) => load * (0.55 + 0.45 * envelope(t, 0.1, 0.25)) });
  };
  const strokes = [
    long("a", [[70, 120], [230, 60], [360, 470], [570, 530]], 54, 0.95, 0),
    long("b", [[575, 105], [430, 190], [250, 420], [65, 520]], 50, 0.7, 1),
    long("c", [[45, 330], [200, 250], [430, 410], [595, 300]], 62, 0.5, 2),
    long("d", [[330, 45], [280, 200], [370, 430], [320, 600]], 36, 1, 3),
  ];
  const dabs = 2 + Math.floor(draw("dabs", "count") * 3);
  for (let k = 0; k < dabs; k++) {
    const name = `dab${k}`, x = 110 + 420 * draw(name, "x"), y = 110 + 420 * draw(name, "y"), a = draw(name, "angle") * Math.PI;
    const dx = Math.cos(a) * 38, dy = Math.sin(a) * 38;
    strokes.push(ribbon({ id: `crossing:${seed}/${name}`, tone: k % 4, curve: bezier([x - dx, y - dy], [x - dx / 3 + dy * 0.25, y - dy / 3 - dx * 0.25], [x + dx / 3 + dy * 0.25, y + dy / 3 - dx * 0.25], [x + dx, y + dy]),
      width: (t) => 40 * (0.5 + 0.5 * envelope(t, 0.3, 0.4)), load: () => 0.85 }));
  }
  return strokes;
}

function weave(seed: number): StrokeData[] {
  const { draw, jitter } = draws("weave", seed);
  const count = (axis: string) => 4 + Math.floor(draw(axis, "count") * 3);
  const strokes: StrokeData[] = [];
  for (const axis of ["row", "column"] as const) {
    const n = count(axis);
    for (let k = 0; k < n; k++) {
      const name = `${axis}${k}`, position = 90 + (460 * (k + 0.5)) / n + jitter(name, "offset", 14);
      const amplitude = 8 + 22 * draw(name, "amplitude"), cycles = 0.9 + 1.4 * draw(name, "cycles"), phase = draw(name, "phase") * Math.PI * 2;
      const width = (axis === "row" ? 36 : 32) * (0.85 + 0.3 * draw(name, "width")), load = 0.62 + 0.3 * draw(name, "load");
      const along = (t: number) => 40 + 560 * t, across = (t: number) => position + amplitude * Math.sin(cycles * Math.PI * 2 * t + phase);
      strokes.push(ribbon({ id: `weave:${seed}/${name}`, tone: axis === "row" ? 0 : 1,
        curve: (t) => axis === "row" ? [along(t), across(t)] : [across(t), along(t)],
        width: (t) => width * (0.55 + 0.45 * envelope(t, 0.12, 0.16)), load: (t) => load * (0.7 + 0.3 * envelope(t, 0.1, 0.2)) }));
    }
  }
  return strokes;
}

function fan(seed: number): StrokeData[] {
  const { draw, jitter } = draws("fan", seed);
  const corner = Math.floor(draw("pivot", "corner") * 4), cx = corner % 2 === 0 ? 96 : 544, cy = corner < 2 ? 96 : 544;
  const pivot: P = [cx + jitter("pivot", "x", 22), cy + jitter("pivot", "y", 22)];
  const heading = Math.atan2(320 - pivot[1], 320 - pivot[0]), spread = (0.9 + 0.5 * draw("pivot", "spread")) / 2;
  const n = 5 + Math.floor(draw("pivot", "count") * 4);
  const strokes: StrokeData[] = [];
  for (let k = 0; k < n; k++) {
    const name = `s${k}`, angle = heading + (n === 1 ? 0 : (k / (n - 1) * 2 - 1) * spread) + jitter(name, "angle", 0.05);
    const length = 360 + 200 * draw(name, "length"), bend = (k % 2 ? 1 : -1) * (0.18 + 0.25 * draw(name, "bend"));
    const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
    const at = (f: number, side: number): P => [pivot[0] + ux * length * f + nx * length * side, pivot[1] + uy * length * f + ny * length * side];
    strokes.push(ribbon({ id: `fan:${seed}/${name}`, tone: k % 3, curve: bezier(at(0, 0), at(0.33, bend * 0.6), at(0.66, bend), at(1, bend * 0.55)),
      width: (t) => (52 - 40 * t ** 0.8) * (0.8 + 0.4 * draw(name, "width")) * (0.6 + 0.4 * smoothstep(0, 0.06, t)),
      load: (t) => 0.95 - 0.5 * t ** 1.3 }));
  }
  return strokes;
}

function whorl(seed: number): StrokeData[] {
  const { draw, jitter } = draws("whorl", seed);
  const strokes: StrokeData[] = [];
  for (const [k, name] of ["main", "counter"].entries()) {
    const turns = 3 + draw(name, "turns") * 1.2, radius = (k === 0 ? 74 : 56) * (0.9 + 0.2 * draw(name, "radius")), phase = draw(name, "phase") * Math.PI * 2;
    const sign = k === 0 ? 1 : -1, x0 = k === 0 ? 100 : 540, y0 = (k === 0 ? 470 : 200) + jitter(name, "y", 30);
    const x1 = k === 0 ? 540 : 100, y1 = (k === 0 ? 210 : 460) + jitter(name, "y1", 30);
    const width = k === 0 ? 38 : 26, load = k === 0 ? 0.95 : 0.7;
    strokes.push(ribbon({ id: `whorl:${seed}/${name}`, tone: k,
      curve: (t) => [x0 + (x1 - x0) * t + radius * Math.cos(sign * turns * Math.PI * 2 * t + phase), y0 + (y1 - y0) * t + radius * Math.sin(sign * turns * Math.PI * 2 * t + phase)],
      width: (t) => width * (0.5 + 0.5 * envelope(t, 0.1, 0.2)), load: (t) => load * (0.6 + 0.4 * envelope(t, 0.08, 0.2)) }));
  }
  return strokes;
}

function swash(seed: number): StrokeData[] {
  const { draw, jitter } = draws("swash", seed);
  const strokes: StrokeData[] = [];
  for (let k = 0; k < 3; k++) {
    const name = `s${k}`, y = 130 + 190 * k + jitter(name, "y", 28), lean = jitter(name, "lean", 90);
    const p = (x: number, dy: number, i: number): P => [x + jitter(name, `x${i}`, 30), y + dy + jitter(name, `y${i}`, 34)];
    const peak = 0.35 + 0.3 * draw(name, "peak");
    strokes.push(ribbon({ id: `swash:${seed}/${name}`, tone: k, curve: bezier(p(50, 60 + lean * 0.3, 0), p(210, -190 - lean * 0.3, 1), p(430, 210 + lean * 0.4, 2), p(590, -50, 3)),
      width: (t) => 6 + 64 * envelope(t, peak, 1 - peak + 0.1) ** 0.8, load: (t) => 0.35 + 0.65 * envelope(t, peak, 1 - peak + 0.1) }));
  }
  return strokes;
}

const cache = new Map<string, StrokeSet>();
/** A bundled stroke set; its seed selects the take. Cached (6 sets). */
export function bundledStrokes(id: BundledStrokeId, seed: number): StrokeSet {
  if (!(bundledStrokeIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled stroke set: ${String(id)}`);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Stroke set seed must be a uint32 integer");
  return memoized(cache, `${id}:${seed}`, () => {
    const make = { crossing, weave, fan, whorl, swash }[id];
    return strokeSet({ id: `${id}:${seed}`, seed, strokes: make(seed) });
  });
}
