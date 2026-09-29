import { componentSeed } from "./core.js";
import { createControlSequence } from "./control-sequence.js";
import type { ControlSequence } from "./control-sequence.js";

/**
 * Bundled deterministic control sequences for Sand Deposition. None is a captured performance: each is a
 * fixed closed-form motion of a few control points, sampled at irregular keyframes (spacing jittered by up
 * to 30% of the mean, the first and last exact), so the reconstruction in `spline-family.ts` is exercised
 * exactly as a host-supplied sequence would exercise it.
 *
 * THE SEED IS THE TAKE. Every seed performs the same idea differently through four stable draws
 * (`componentSeed(seed, id, "take")`): wave count, amplitude, phase and direction. Different seeds are
 * different structures (a curtain drawn down or up, a rope whipped left or right, a blob with two, three
 * or four lobes), not a reshuffle of noise.
 *
 * - `curtain`  open, 9 controls, 4.2 s: a wavy line lowered (or raised) across the canvas while its waves travel.
 * - `whip`     open, 7 controls, 3.6 s: a rope hung from a pivot whipped sideways, each joint lagging the one above.
 * - `bloom`    closed, 8 controls, 5.0 s: a lobed loop that opens from a small knot while its lobes turn.
 * - `unfurl`   open, 10 controls, 4.4 s: a tight coil unrolling into a long S with staggered starts.
 * - `fold`     open, 8 controls, 3.8 s: a straight sheet collapsing into an accordion and relaxing again.
 */

export const bundledControlSequenceIds = ["curtain", "whip", "bloom", "unfurl", "fold"] as const;
export type BundledControlSequenceId = (typeof bundledControlSequenceIds)[number];

export interface BundledSequenceInfo { title: string; description: string; duration: number; controls: number; closed: boolean }
export const bundledControlSequenceInfo: Record<BundledControlSequenceId, BundledSequenceInfo> = {
  curtain: { title: "Curtain", description: "A wavy line lowered or raised across the canvas while its waves travel along it.", duration: 4200, controls: 9, closed: false },
  whip: { title: "Whip", description: "A rope hung from a pivot and whipped sideways; each joint lags the one above it.", duration: 3600, controls: 7, closed: false },
  bloom: { title: "Bloom", description: "A lobed closed loop that opens from a small knot while its lobes turn.", duration: 5000, controls: 8, closed: true },
  unfurl: { title: "Unfurl", description: "A tight coil unrolling into a long S, each control starting a little later than the last.", duration: 4400, controls: 10, closed: false },
  fold: { title: "Fold", description: "A straight sheet collapsing into an accordion of sharp pleats and relaxing again.", duration: 3800, controls: 8, closed: false },
};

type Take = readonly [wave: number, amplitude: number, phase: number, direction: number];
type Motion = (tn: number, i: number, n: number, take: Take) => readonly [number, number];

const TAU = Math.PI * 2;
const smooth = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, w: number): number => a + (b - a) * w;

const motions: Record<BundledControlSequenceId, Motion> = {
  curtain(tn, i, n, [wave, amplitude, phase, direction]) {
    const s = i / (n - 1), sweep = smooth(tn), down = direction > 0.5;
    const edge = down ? 120 + 330 * sweep : 450 - 330 * sweep;
    const x = 70 + 500 * s + 14 * Math.sin(TAU * (1.1 * tn + 0.9 * s + phase));
    const y = edge + (40 + 45 * amplitude) * Math.sin(TAU * ((1.2 + 1.6 * wave) * s - 0.9 * tn + phase)) + (phase - 0.5) * 0.4 * (x - 320);
    return [x, y];
  },
  whip(tn, i, n, [wave, amplitude, phase, direction]) {
    const px = 320 + (wave - 0.5) * 80, py = 70 + phase * 30, sign = direction > 0.5 ? 1 : -1;
    const reach = 20 + 62 * i, share = 0.35 + 0.65 * i / (n - 1);
    const theta = sign * share * (0.7 + 0.25 * amplitude) * (1 - 0.35 * tn) * Math.sin(TAU * 1.15 * tn - 0.75 * i + phase * 2);
    return [px + reach * Math.sin(theta), py + reach * Math.cos(theta)];
  },
  bloom(tn, i, n, [wave, amplitude, phase, direction]) {
    const lobes = 2 + Math.floor(wave * 2.999), open = 70 + 150 * smooth(tn * 1.15);
    const radius = open * (1 + (0.22 + 0.2 * amplitude) * Math.sin(TAU * (1.3 * tn + lobes * i / n) + phase * TAU));
    const angle = TAU * i / n + 0.6 * Math.sin(TAU * 0.5 * tn + 0.4 * i) + (direction - 0.5) * TAU * 0.8 * tn;
    return [320 + radius * Math.cos(angle), 320 + radius * Math.sin(angle)];
  },
  unfurl(tn, i, n, [wave, amplitude, phase, direction]) {
    const s = i / (n - 1), angle = 0.9 * i + phase * TAU, radius = 14 + 11 * i;
    const coil: readonly [number, number] = [320 + radius * Math.cos(angle), 330 + radius * Math.sin(angle)];
    const sign = direction > 0.5 ? 1 : -1;
    const flat: readonly [number, number] = [70 + 500 * s, 330 + sign * (100 + 60 * amplitude) * Math.sin(TAU * (0.8 + 0.5 * wave) * s + phase * 2)];
    const w = smooth((tn - 0.05 * i * (0.8 + 0.4 * wave)) / 0.55);
    return [mix(coil[0], flat[0], w), mix(coil[1], flat[1], w)];
  },
  fold(tn, i, n, [wave, amplitude, phase, direction]) {
    // The sheet lies along a diagonal; pleats displace alternate controls along its normal.
    const angle = Math.PI / 4 + (phase - 0.5), flip = direction > 0.5 ? 1 : -1;
    const ux = Math.cos(angle), uy = flip * Math.sin(angle), s = i / (n - 1), bell = Math.sin(Math.PI * tn) ** 1.2;
    const along = (s - 0.5) * (1 - (0.5 + 0.15 * wave) * bell) * 560;
    const pleat = (i % 2 === 0 ? 1 : -1) * (85 + 60 * amplitude) * bell * (0.7 + 0.3 * Math.sin(TAU * (0.7 * tn + 0.3 * i)));
    return [320 + along * ux - pleat * uy, 320 + along * uy + pleat * ux];
  },
};

const cache = new Map<string, ControlSequence>();

/** The bundled sequence performed by this seed. Cached; every call with the same arguments returns the same value. */
export function bundledControlSequence(id: BundledControlSequenceId, seed: number): ControlSequence {
  const info = bundledControlSequenceInfo[id];
  if (!info) throw new Error(`Unknown bundled control sequence: ${String(id)}`);
  const key = `${id}|${seed}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const take = ["wave", "amplitude", "phase", "direction"].map((purpose) => componentSeed(seed, id, `take:${purpose}`) / 0x1_0000_0000) as unknown as Take;
  const keyframes = 46, mean = info.duration / (keyframes - 1);
  const t: number[] = [], controls: (readonly [number, number])[][] = [];
  for (let k = 0; k < keyframes; k++) {
    const jitter = k === 0 || k === keyframes - 1 ? 0 : (componentSeed(seed, id, `time:${k}`) / 0x1_0000_0000 - 0.5) * 0.6 * mean;
    const time = k === keyframes - 1 ? info.duration : k * mean + jitter;
    t.push(time);
    const row: (readonly [number, number])[] = [];
    for (let i = 0; i < info.controls; i++) row.push(motions[id](time / info.duration, i, info.controls, take));
    controls.push(row);
  }
  const sequence = createControlSequence({ id: `${id}:${seed}`, closed: info.closed, t, controls });
  cache.set(key, sequence);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  return sequence;
}
