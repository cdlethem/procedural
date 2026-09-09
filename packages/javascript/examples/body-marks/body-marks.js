import { gradientNoise2D01 } from "../../src/gradient-noise-2d-01.js";
import { gradientPath2D } from "../../src/gradient-path.js";
import { regularGrid } from "../../src/regular-grid.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const HEAD_COUNT = 12;
const SPINE_STEPS = 24;
const STEP_DISTANCE = 4.0;
const FIELD_SCALE = 0.0035;
const HALF_WIDTH = 12.0;
export const COLORS = Object.freeze([0x173f5f, 0xaf5441, 0xe9c46a, 0x347969]);

function buildInitialHeads() {
  const layout = regularGrid({ origin: [160.0, 200.0], spacing: [110.0, 120.0], columns: 4, rows: 3 });
  if (layout.size !== HEAD_COUNT) throw new Error("authored head layout");
  const heads = new Float64Array(HEAD_COUNT * 2);
  const point = [0, 0];
  for (let head = 0; head < HEAD_COUNT; head += 1) {
    layout.pointInto(head, point, 0);
    heads[head * 2] = point[0];
    heads[head * 2 + 1] = point[1];
  }
  return heads;
}

/**
 * Editable seeded-field backward spine composition for BodyMarks: twelve retained
 * heads step forward one tick per animation frame while each spine retraces
 * backward from the new head, drawn as a tapered body or bare centerline.
 * Independently composed; layout, field, step length, taper, palette, and counts
 * here are authored piece settings, not GradientPath2D/GradientNoise2D01 defaults
 * or recommended operation ranges. See catalog/validation/gradient-noise-2d-01.json,
 * targets.processing-java.technique.
 */
class BodyComposition {
  #fieldConfig = { seed: 42 };
  #field = gradientNoise2D01({ seed: 42 });
  #palette = cyclicPalette({ colors: COLORS });
  #initialHeads = buildInitialHeads();
  #heads; #spines;
  #running = false;
  #centerlines = false;
  #taperExponent = 0.7;
  #tick = 0;

  constructor() {
    this.#resetState();
  }

  #trace(x, y, steps, angleBase) {
    return gradientPath2D({
      field: this.#fieldConfig, start: [x, y], steps, stepDistance: STEP_DISTANCE,
      fieldScale: FIELD_SCALE, fieldOffset: [0.0, 0.0], angleBase, angleScale: Math.PI * 2.0,
    });
  }

  #reconstructSpines(sourceHeads) {
    const spines = new Array(HEAD_COUNT);
    for (let head = 0; head < HEAD_COUNT; head += 1) {
      spines[head] = this.#trace(sourceHeads[head * 2], sourceHeads[head * 2 + 1], SPINE_STEPS, Math.PI);
    }
    return spines;
  }

  #resetState() {
    const resetHeads = this.#initialHeads.slice();
    this.#spines = this.#reconstructSpines(resetHeads);
    this.#heads = resetHeads;
    this.#tick = 0;
    this.#running = false;
    this.#centerlines = false;
    this.#taperExponent = 0.7;
  }

  /** One bounded logical tick constructs every candidate head and backward spine before commit. */
  advanceTick() {
    if (this.#tick === Number.MAX_SAFE_INTEGER) throw new Error("tick counter exhausted");
    const nextHeads = new Float64Array(this.#heads.length);
    const nextSpines = new Array(HEAD_COUNT);
    const point = [0, 0];
    for (let head = 0; head < HEAD_COUNT; head += 1) {
      const forward = this.#trace(this.#heads[head * 2], this.#heads[head * 2 + 1], 1, 0.0);
      forward.pointInto(1, point, 0);
      nextHeads[head * 2] = point[0];
      nextHeads[head * 2 + 1] = point[1];
      nextSpines[head] = this.#trace(nextHeads[head * 2], nextHeads[head * 2 + 1], SPINE_STEPS, Math.PI);
    }
    this.#heads = nextHeads;
    this.#spines = nextSpines;
    this.#tick += 1;
  }

  halfWidth(sample) {
    return Math.pow(1.0 - sample / (SPINE_STEPS - 1), this.#taperExponent) * HALF_WIDTH;
  }

  phaseFor(head) {
    return head * 0.17 + this.#field.sample(this.#heads[head * 2] * FIELD_SCALE, this.#heads[head * 2 + 1] * FIELD_SCALE) * 0.2;
  }

  get heads() { return this.#heads; }
  get spines() { return this.#spines; }
  get palette() { return this.#palette; }
  get running() { return this.#running; }
  get centerlines() { return this.#centerlines; }
  get taperExponent() { return this.#taperExponent; }
  get tick() { return this.#tick; }

  toggleRunning() { this.#running = !this.#running; }
  toggleCenterlines() { this.#centerlines = !this.#centerlines; }
  toggleTaper() { this.#taperExponent = this.#taperExponent === 0.7 ? 2.0 : 0.7; }
  reset() { this.#resetState(); }
}

export function createBodyMarks() {
  return new BodyComposition();
}
