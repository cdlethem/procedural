import { componentSeed } from "./core.js";
import { createFrameStack } from "./frame-stack.js";
import type { FrameStack } from "./frame-stack.js";
import { createRaster } from "./raster.js";
import type { Raster } from "./raster.js";

/**
 * Bundled moving scenes: deterministic, seeded, closed-form stand-ins for a host's decoded video
 * frames, so the slit study works without any host-owned asset. Each scene is a function of position
 * (u, v in [0, 1], y down) and a phase in [0, 1] over the scene's duration; frame k of T samples the
 * phase k / (T - 1) and is timestamped `duration * k / (T - 1)` seconds. Frames are 128 x 128 8-bit sRGB
 * RGB without alpha, built only from IEEE arithmetic, `Math.sqrt`, `Math.floor`, `Math.imul` and a
 * polynomial sine (no `Math.sin`), so bytes and hashes are identical on every JavaScript engine.
 * Nothing here is video; the seed re-tints and rearranges a scene, it does not add noise.
 *
 * | id | duration | subject | what a slit through it shows |
 * |---|---|---|---|
 * | `walkers` | 8 s | three figures crossing a street at different speeds, one against the flow | each figure's profile stretched in time, legs as a ripple, the still street as long streaks |
 * | `sunrise` | 12 s | a sun rising over hills and a lake, drifting clouds, sky from night to day | the sky's colour history and the sun's arc as a disc-shaped bulge |
 * | `orbits` | 10 s | five coloured bodies on circular orbits round a star (whole turns, so it loops) | interlaced sine traces |
 * | `windmill` | 4 s | four blades turning on a tower (two turns, so it loops) | a braid of crossing blade shadows |
 */
export const bundledSequenceIds = ["walkers", "sunrise", "orbits", "windmill"] as const;
export type BundledSequenceId = (typeof bundledSequenceIds)[number];

export const bundledSequenceInfo: Readonly<Record<BundledSequenceId, { title: string; duration: number; character: string }>> = Object.freeze({
  walkers: { title: "Walkers", duration: 8, character: "three figures crossing a street at different speeds" },
  sunrise: { title: "Sunrise", duration: 12, character: "a sun rising over hills and a lake, sky from night to day" },
  orbits: { title: "Orbits", duration: 10, character: "five bodies orbiting a star; loops" },
  windmill: { title: "Windmill", duration: 4, character: "four blades turning on a tower; loops" },
});

export const BUNDLED_SEQUENCE_FRAMES = Object.freeze({ min: 2, max: 240, default: 48 });
/** Side of every bundled frame in pixels. */
export const BUNDLED_SEQUENCE_SIZE = 128;

type Color = readonly [number, number, number];
type Pixel = (u: number, v: number, out: number[]) => void;
type Scene = (phase: number) => Pixel;

const U32 = 0x1_0000_0000;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mixColor = (a: Color, b: Color, t: number): Color => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const unit = (seed: number, id: string, purpose: string): number => componentSeed(seed, id, purpose) / U32;
const over = (base: number[], color: Color, alpha: number): void => {
  base[0] = mix(base[0], color[0], alpha); base[1] = mix(base[1], color[1], alpha); base[2] = mix(base[2], color[2], alpha);
};

/** sin(2 pi x) for x in turns, by range reduction and a degree-11 Taylor polynomial (error below 1e-7). */
export function sinTurns(x: number): number {
  let t = x - Math.floor(x);
  if (t > 0.5) t -= 1;
  if (t > 0.25) t = 0.5 - t; else if (t < -0.25) t = -0.5 - t;
  const a = t * 6.283185307179586, a2 = a * a;
  return a * (1 - a2 / 6 * (1 - a2 / 20 * (1 - a2 / 42 * (1 - a2 / 72 * (1 - a2 / 110)))));
}
export const cosTurns = (x: number): number => sinTurns(x + 0.25);

const cellHash = (ix: number, iy: number, key: number): number => {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(key | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / U32;
};

/** Feathered coverage of an axis-aligned ellipse: 1 inside, 0 outside, smooth across `feather` of the normalized radius. */
const ellipse = (u: number, v: number, cx: number, cy: number, rx: number, ry: number, feather = 0.12): number => {
  const dx = (u - cx) / rx, dy = (v - cy) / ry, r = Math.sqrt(dx * dx + dy * dy);
  return 1 - smooth(1 - feather, 1, r);
};

const fract = (x: number): number => x - Math.floor(x);

const CLOTHES: readonly Color[] = [[0.78, 0.2, 0.16], [0.16, 0.36, 0.72], [0.9, 0.7, 0.14], [0.14, 0.55, 0.42], [0.55, 0.22, 0.6], [0.92, 0.5, 0.2], [0.1, 0.1, 0.12], [0.85, 0.85, 0.8]];
const SKIN: readonly Color[] = [[0.93, 0.76, 0.62], [0.78, 0.56, 0.42], [0.55, 0.36, 0.26], [0.97, 0.84, 0.72]];

function walkers(seed: number): Scene {
  const key = componentSeed(seed, "walkers", "street") | 0;
  const blocks: { x0: number; x1: number; top: number; color: Color; windows: number }[] = [];
  for (let i = 0, x = 0; x < 1.05; i++) {
    const width = 0.09 + 0.11 * unit(seed, `block:${i}`, "width"), shade = 0.32 + 0.28 * unit(seed, `block:${i}`, "shade");
    const warm = unit(seed, `block:${i}`, "warm");
    blocks.push({ x0: x, x1: x + width, top: 0.62 - (0.2 + 0.2 * unit(seed, `block:${i}`, "height")),
      color: [shade + 0.12 * warm, shade + 0.03, shade - 0.1 * warm + 0.06], windows: i });
    x += width;
  }
  const clothes = Math.floor(unit(seed, "walkers", "clothes") * CLOTHES.length);
  const people = [0, 1, 2].map((i) => {
    const direction = i === 1 ? -1 : 1, id = `walker:${i}`;
    const travel = 1 + 0.1 * unit(seed, id, "travel"), crossing = [0.2, 0.52, 0.82][i] + 0.06 * (unit(seed, id, "crossing") - 0.5);
    return { direction, feet: [0.86, 0.75, 0.95][i] + 0.02 * (unit(seed, id, "feet") - 0.5), height: [0.46, 0.36, 0.52][i],
      start: 0.5 - direction * travel * crossing, travel, steps: [14, 10, 16][i] + Math.floor(4 * unit(seed, id, "steps")),
      body: CLOTHES[(clothes + 3 * i) % CLOTHES.length], legs: CLOTHES[(clothes + 3 * i + 5) % CLOTHES.length],
      skin: SKIN[Math.floor(unit(seed, id, "skin") * SKIN.length)] };
  }).sort((a, b) => a.feet - b.feet);
  const skyTop: Color = [0.55 + 0.1 * unit(seed, "sky", "r"), 0.74, 0.92], skyLow: Color = [0.95, 0.92, 0.83];
  return (phase) => {
    const placed = people.map((p) => ({ ...p, x: p.start + p.direction * p.travel * phase, gait: p.steps * phase }));
    return (u, v, out) => {
      if (v < 0.62) {
        const s = mixColor(skyTop, skyLow, smooth(0, 0.62, v));
        out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
        for (const b of blocks) if (u >= b.x0 && u < b.x1 && v > b.top) {
          out[0] = b.color[0]; out[1] = b.color[1]; out[2] = b.color[2];
          const wx = fract((u - b.x0) * 38), wy = fract((v - b.top) * 34);
          if (wx > 0.25 && wx < 0.75 && wy > 0.3 && wy < 0.75 && v < 0.6) {
            const lit = cellHash(Math.floor((u - b.x0) * 38), Math.floor((v - b.top) * 34), key + b.windows) > 0.55;
            over(out, lit ? [0.98, 0.86, 0.5] : [0.16, 0.2, 0.26], 0.9);
          }
        }
      } else {
        const g = 0.42 - 0.12 * smooth(0.62, 1, v);
        out[0] = g; out[1] = g; out[2] = g + 0.02;
        if (v > 0.61 && v < 0.63) over(out, [0.75, 0.74, 0.7], 0.8);
        if (Math.abs(v - 0.7) < 0.007 && fract(u * 7) < 0.5) over(out, [0.92, 0.85, 0.5], 0.85);
      }
      for (const p of placed) {
        const h = p.height, fx = p.x, fv = p.feet;
        if (Math.abs(u - fx) > h * 0.5 || v > fv + 0.05 * h || v < fv - h * 1.05) continue;
        over(out, [0.05, 0.05, 0.06], 0.32 * ellipse(u, v, fx, fv, h * 0.22, h * 0.035));
        const swing = 0.11 * h * sinTurns(p.gait);
        over(out, p.legs, ellipse(u, v, fx + swing, fv - 0.24 * h, h * 0.045, h * 0.24, 0.3));
        over(out, p.legs, ellipse(u, v, fx - swing, fv - 0.24 * h, h * 0.045, h * 0.24, 0.3));
        over(out, p.body, ellipse(u, v, fx, fv - 0.6 * h, h * 0.15, h * 0.21, 0.2));
        over(out, p.skin, ellipse(u, v, fx, fv - 0.88 * h, h * 0.085, h * 0.095, 0.25));
      }
    };
  };
}

const NIGHT: Color = [0.04, 0.06, 0.16], DAWN: Color = [0.93, 0.48, 0.3], DAY: Color = [0.42, 0.7, 0.96];
function sunrise(seed: number): Scene {
  const ridge = (id: string, level: number, amplitude: number) => {
    const p1 = unit(seed, id, "p1"), p2 = unit(seed, id, "p2"), p3 = unit(seed, id, "p3");
    return (u: number): number => level + amplitude * (0.55 * sinTurns(u * 0.9 + p1) + 0.3 * sinTurns(u * 2.3 + p2) + 0.15 * sinTurns(u * 5.7 + p3));
  };
  const far = ridge("far", 0.555, 0.05), near = ridge("near", 0.6, 0.045);
  const clouds = [0, 1, 2, 3].map((i) => ({ x: unit(seed, `cloud:${i}`, "x"), y: 0.12 + 0.28 * unit(seed, `cloud:${i}`, "y"),
    speed: 0.18 + 0.3 * unit(seed, `cloud:${i}`, "speed"), size: 0.07 + 0.06 * unit(seed, `cloud:${i}`, "size") }));
  const skyAt = (phase: number, v: number): Color => {
    const base = phase < 0.4 ? mixColor(NIGHT, DAWN, smooth(0, 0.4, phase)) : mixColor(DAWN, DAY, smooth(0.4, 1, phase));
    const zenith = mixColor(NIGHT, DAY, smooth(0.05, 0.8, phase));
    return mixColor(zenith, base, smooth(0, 0.62, v));
  };
  const HORIZON = 0.62;
  return (phase) => {
    const sunX = 0.15 + 0.7 * phase, sunY = 0.72 - 0.62 * sinTurns(0.25 * phase);
    const glow = 0.85 - 0.45 * phase, day = smooth(0.35, 0.9, phase);
    const dark: Color = [0.07, 0.11, 0.1], farColor = mixColor([0.1, 0.14, 0.22], [0.36, 0.5, 0.5], day), nearColor = mixColor([0.04, 0.07, 0.08], [0.16, 0.34, 0.22], day);
    const sky = (u: number, v: number, out: number[]): void => {
      const s = skyAt(phase, v);
      out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
      const dx = u - sunX, dy = v - sunY, d2 = dx * dx + dy * dy;
      over(out, [1, 0.72, 0.4], clamp01(glow / (1 + d2 / 0.012)) * 0.75);
      over(out, [1, 0.96, 0.82], ellipse(u, v, sunX, sunY, 0.055, 0.055, 0.15));
      for (const c of clouds) {
        const cx = fract(c.x + c.speed * phase + 0.2) - 0.2;
        for (const shift of [0, 1]) {
          const x = cx + shift;
          const a = Math.max(ellipse(u, v, x, c.y, c.size * 1.4, c.size * 0.4, 0.5), ellipse(u, v, x - c.size * 0.5, c.y - c.size * 0.28, c.size * 0.7, c.size * 0.38, 0.5),
            ellipse(u, v, x + c.size * 0.55, c.y - c.size * 0.2, c.size * 0.8, c.size * 0.34, 0.5));
          if (a > 0) over(out, mixColor([0.3, 0.3, 0.45], mixColor([1, 0.8, 0.7], [1, 1, 1], day), smooth(0, 0.5, phase)), 0.85 * a);
        }
      }
    };
    return (u, v, out) => {
      if (v < HORIZON) {
        sky(u, v, out);
        if (v > far(u)) { out[0] = farColor[0]; out[1] = farColor[1]; out[2] = farColor[2]; }
        if (v > near(u)) { out[0] = nearColor[0]; out[1] = nearColor[1]; out[2] = nearColor[2]; }
        return;
      }
      const mirror = HORIZON - (v - HORIZON) * 0.85;
      sky(u, mirror, out);
      const ripple = sinTurns((v - HORIZON) * 42 - phase * 5 + 0.3 * sinTurns(u * 7)) * 0.5 + 0.5;
      over(out, dark, 0.32 + 0.22 * ripple * smooth(HORIZON, 1, v));
      if (v < HORIZON + 0.02) { const n = near(u); if (v < n + 0.09) over(out, nearColor, 0.9 * (1 - smooth(n, n + 0.09, v))); }
    };
  };
}

const PLANETS: readonly { radius: number; turns: number; size: number; color: Color }[] = [
  { radius: 0.12, turns: 5, size: 0.028, color: [0.95, 0.5, 0.3] },
  { radius: 0.2, turns: -3, size: 0.036, color: [0.4, 0.75, 0.95] },
  { radius: 0.28, turns: 2, size: 0.04, color: [0.95, 0.85, 0.4] },
  { radius: 0.36, turns: -1, size: 0.05, color: [0.7, 0.5, 0.9] },
  { radius: 0.44, turns: 4, size: 0.03, color: [0.5, 0.9, 0.6] },
];
function orbits(seed: number): Scene {
  const phases = PLANETS.map((_, i) => unit(seed, `planet:${i}`, "phase"));
  const rotate = Math.floor(unit(seed, "planets", "assignment") * PLANETS.length);
  return (phase) => {
    const bodies = PLANETS.map((p, i) => {
      const angle = phases[i] + p.turns * phase;
      return { x: 0.5 + p.radius * cosTurns(angle), y: 0.5 + p.radius * sinTurns(angle), size: p.size, color: PLANETS[(i + rotate) % PLANETS.length].color };
    });
    return (u, v, out) => {
      const dx = u - 0.5, dy = v - 0.5, d = Math.sqrt(dx * dx + dy * dy);
      const base = 0.05 + 0.1 * (1 - smooth(0, 0.7, d));
      out[0] = base * 0.7; out[1] = base * 0.85; out[2] = base * 1.5;
      for (const p of PLANETS) over(out, [0.6, 0.7, 0.9], 0.28 * (1 - smooth(0.0015, 0.004, Math.abs(d - p.radius))));
      over(out, [1, 0.85, 0.5], ellipse(u, v, 0.5, 0.5, 0.055, 0.055, 0.4));
      over(out, [1, 0.6, 0.25], 0.35 * (1 - smooth(0.05, 0.11, d)));
      for (const b of bodies) if (Math.abs(u - b.x) < b.size * 1.3 && Math.abs(v - b.y) < b.size * 1.3) over(out, b.color, ellipse(u, v, b.x, b.y, b.size, b.size, 0.18));
    };
  };
}

function windmill(seed: number): Scene {
  const start = unit(seed, "blades", "start"), skyTint = unit(seed, "sky", "tint");
  const cloth: readonly Color[] = [CLOTHES[Math.floor(unit(seed, "blades", "a") * CLOTHES.length)], [0.95, 0.93, 0.86]];
  const HUB_X = 0.5, HUB_Y = 0.4;
  return (phase) => {
    const turn = start + 2 * phase, cos = [0, 1, 2, 3].map((k) => cosTurns(turn + k / 4)), sin = [0, 1, 2, 3].map((k) => sinTurns(turn + k / 4));
    return (u, v, out) => {
      const s = mixColor([0.4 + 0.15 * skyTint, 0.62, 0.9], [0.92, 0.9, 0.82], smooth(0, 0.85, v));
      out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
      const ground = 0.85 + 0.015 * sinTurns(u * 3 + 0.2);
      if (v > ground) { out[0] = 0.3; out[1] = 0.5; out[2] = 0.26; }
      const tx = Math.abs(u - HUB_X), half = mix(0.028, 0.065, smooth(HUB_Y, ground, v));
      if (v > HUB_Y && v < ground && tx < half) {
        const brick = cellHash(Math.floor((u - HUB_X + 0.1) * 40), Math.floor(v * 46), 7) * 0.08;
        out[0] = 0.62 + brick; out[1] = 0.36 + brick; out[2] = 0.28 + brick;
      }
      const dx = u - HUB_X, dy = v - HUB_Y;
      if (dx * dx + dy * dy < 0.4 * 0.4) for (let k = 0; k < 4; k++) {
        const lx = dx * cos[k] + dy * sin[k], ly = -dx * sin[k] + dy * cos[k];
        if (lx > 0.03 && lx < 0.36) {
          const half = 0.012 + 0.03 * smooth(0.03, 0.36, lx);
          if (Math.abs(ly) < half) { const c = cloth[k & 1]; out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; if (Math.abs(ly) > half - 0.006 || lx < 0.05) over(out, [0.22, 0.14, 0.1], 0.85); }
        }
      }
      over(out, [0.2, 0.14, 0.1], ellipse(u, v, HUB_X, HUB_Y, 0.03, 0.03, 0.2));
    };
  };
}

const scenes: Record<BundledSequenceId, (seed: number) => Scene> = { walkers, sunrise, orbits, windmill };

function frameOf(scene: Scene, phase: number, label: string): Raster {
  const size = BUNDLED_SEQUENCE_SIZE, data = new Uint8Array(size * size * 3), pixel = scene(phase), color = [0, 0, 0];
  for (let j = 0, at = 0; j < size; j++) for (let i = 0; i < size; i++, at += 3) {
    pixel((i + 0.5) / size, (j + 0.5) / size, color);
    data[at] = Math.round(clamp01(color[0]) * 255); data[at + 1] = Math.round(clamp01(color[1]) * 255); data[at + 2] = Math.round(clamp01(color[2]) * 255);
  }
  return createRaster({ width: size, height: size, channels: 3, format: "u8", colorSpace: "srgb", alpha: "none", data, label });
}

const cache = new Map<string, FrameStack>();
const CACHE_SIZE = 6;

/**
 * A bundled frame sequence (`frames` frames of 128 x 128 sRGB, evenly spaced over the scene's duration).
 * Immutable and cached by (id, seed, frames). More frames make the motion finer, they do not lengthen it.
 */
export function bundledFrameStack(id: BundledSequenceId, seed: number, frames: number = BUNDLED_SEQUENCE_FRAMES.default): FrameStack {
  if (!(bundledSequenceIds as readonly string[]).includes(id)) throw new Error(`Unknown bundled sequence: ${String(id)}`);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Bundled sequence seed must be a uint32 integer");
  if (!Number.isInteger(frames) || frames < BUNDLED_SEQUENCE_FRAMES.min || frames > BUNDLED_SEQUENCE_FRAMES.max)
    throw new Error(`Bundled sequence frames must be an integer in [${BUNDLED_SEQUENCE_FRAMES.min}, ${BUNDLED_SEQUENCE_FRAMES.max}] (got ${String(frames)}); change Frames`);
  const key = `${id}|${seed}|${frames}`, hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const scene = scenes[id](seed), { duration } = bundledSequenceInfo[id];
  const rasters: Raster[] = [], times: number[] = [];
  for (let k = 0; k < frames; k++) {
    const phase = k / (frames - 1);
    rasters.push(frameOf(scene, phase, `${id}:${seed}:${k}`));
    times.push(duration * phase);
  }
  const stack = createFrameStack({ id: `${id}:${seed}`, times, frames: rasters });
  cache.set(key, stack);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return stack;
}
