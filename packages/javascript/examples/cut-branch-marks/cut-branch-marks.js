import { seededLinePool2D } from "../../src/line-pool.js";

/**
 * Example composition motivated by 2019/generativos/brotes; independently drawn here.
 * All mutable cutting is performed by the public seeded-line-pool-2d operation; this
 * module is only an editable seed-stroke policy. These constants (seed stroke
 * endpoints, attempt budgets, angle scales, palette) describe this piece, not public
 * defaults or recommended ranges.
 */
export const COLORS = Object.freeze([0xebebeb, 0xe9ca54, 0x749ab2, 0xeb4313]);
export const BACKGROUND_RGB = 0x0a0a15;
export const DEFAULT_SEED = 42;

/** Retained line pool for style-only colour edits; A/W/T/R/0 all rebuild. */
export function createCutBranchMarks(seed = DEFAULT_SEED, narrow = false, sparse = false, alternate = false) {
  const segment = alternate ? [180.0, 760.0, 760.0, 240.0] : [480.0, 850.0, 480.0, 200.0];
  const pool = seededLinePool2D({
    seed,
    segment,
    attempts: sparse ? 9000 : 90000,
    firstCutAngleScale: narrow ? 0.7 : 1.4,
    minCutLength: 4.0,
    maxSegments: 180001,
  });
  return Object.freeze({ seed, narrow, sparse, alternate, pool });
}

function segmentCommand(a, b, c, d, rgb, opacity8) {
  return { kind: "segment2", from: [a, b], to: [c, d], rgb, opacity8, width: 1, cap: "round" };
}

/** Yield one capped line segment per retained pool segment, in pool order. */
export function* cutBranchCommands(model, colorIndex) {
  const rgb = COLORS[colorIndex % COLORS.length];
  const scratch = [0, 0, 0, 0];
  for (let i = 0; i < model.pool.size; i += 1) {
    model.pool.segmentInto(i, scratch);
    if (scratch[0] === scratch[2] && scratch[1] === scratch[3]) continue;
    yield segmentCommand(scratch[0], scratch[1], scratch[2], scratch[3], rgb, 100);
  }
}
