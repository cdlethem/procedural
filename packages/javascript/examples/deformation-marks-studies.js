import { radialPull2D } from "../src/radial-pull.js";
import { sequentialDiscProjection2D } from "../src/disc-projection.js";

const SIDE = 640;
const SAMPLES = 96;
const TAU = 2 * Math.PI;
const MAX_WORK = 16_000;

export const deformationMarksSettings = {
  "pull-marks": { defaults: { sourceMode: "rows", pathCount: 28, jitter: 0, influenceCount: 2,
    centerX1: 245, centerY1: 280, radius1: 225, power1: 1.3,
    centerX2: 410, centerY2: 380, radius2: 185, power2: 1.8, weight: 1.3 } },
  "projection-marks": { defaults: { sourceMode: "rows", pathCount: 24, jitter: 0, influenceCount: 2,
    centerX1: 230, centerY1: 250, radius1: 160,
    centerX2: 410, centerY2: 350, radius2: 110, strength: .75, weight: 1.2 } },
};

const number = (params, key) => Number(params[key]);
const within = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

export function validateDeformationMarks(params, pull) {
  if (!["rows", "columns", "spokes"].includes(params.sourceMode) ||
      !Number.isInteger(number(params, "pathCount")) || !within(number(params, "pathCount"), 4, 80) ||
      !Number.isInteger(number(params, "influenceCount")) || !within(number(params, "influenceCount"), 1, 2) ||
      !within(number(params, "jitter"), 0, 40) || !within(number(params, "weight"), .1, 12) ||
      number(params, "pathCount") * SAMPLES * number(params, "influenceCount") > MAX_WORK)
    throw Error("Invalid path or influence work settings");
  for (let i = 1; i <= number(params, "influenceCount"); i += 1) {
    if (!within(number(params, `centerX${i}`), 0, SIDE) ||
        !within(number(params, `centerY${i}`), 0, SIDE) ||
        !within(number(params, `radius${i}`), 10, 450) ||
        (pull && !within(number(params, `power${i}`), .2, 6)))
      throw Error(`Invalid influence ${i} geometry`);
  }
  if (!pull && !within(number(params, "strength"), 0, 1)) throw Error("Invalid projection strength");
}

// Matches the Studio's seeded sample schedule, independent of p5's random state.
function rng(seed) {
  let state = seed >>> 0;
  return () => ((state = (state + 0x6d2b79f5) >>> 0),
    (Math.imul(state ^ (state >>> 15), 1 | state) ^
      Math.imul(state ^ (state >>> 7), 61 | state) ^ state) >>> 0) / 4294967296;
}

export function deformationSourcePaths(seed, mode, count, jitter) {
  const random = rng(seed), paths = [];
  for (let path = 0; path < count; path += 1) {
    const points = [], across = count === 1 ? .5 : path / (count - 1);
    const angle = -Math.PI / 2 + path * TAU / count;
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const t = sample / (SAMPLES - 1), offset = (random() - .5) * jitter;
      if (mode === "rows") points.push(40 + t * 560, 48 + across * 544 + offset);
      else if (mode === "columns") points.push(48 + across * 544 + offset, 40 + t * 560);
      else {
        const r = 20 + 330 * t;
        points.push(320 + Math.cos(angle) * r - Math.sin(angle) * offset,
          320 + Math.sin(angle) * r + Math.cos(angle) * offset);
      }
    }
    paths.push(points);
  }
  return paths;
}

function drawPaths(p, paths, palette, weight) {
  p.noFill();
  p.strokeCap(p.ROUND);
  for (let path = 0; path < paths.length; path += 1) {
    const c = palette[path % palette.length] >>> 0;
    p.stroke((c >>> 16) & 255, (c >>> 8) & 255, c & 255);
    p.strokeWeight(weight);
    p.beginShape();
    for (let i = 0; i < paths[path].length; i += 2) p.vertex(paths[path][i], paths[path][i + 1]);
    p.endShape();
  }
}

/** Native p5 drawing of the same modern study inputs as the Studio layer. */
export function drawPullMarks(p, { params, seed, palette }) {
  validateDeformationMarks(params, true);
  const influences = [];
  for (let i = 1; i <= params.influenceCount; i += 1)
    influences.push([params[`centerX${i}`], params[`centerY${i}`], params[`radius${i}`], params[`power${i}`]]);
  const field = radialPull2D({ influences });
  const paths = deformationSourcePaths(seed, params.sourceMode, params.pathCount, params.jitter);
  const point = [0, 0];
  const output = paths.map(source => {
    const drawn = [];
    for (let i = 0; i < source.length; i += 2) {
      field.transformInto(source[i], source[i + 1], point);
      drawn.push(point[0], point[1]);
    }
    return drawn;
  });
  drawPaths(p, output, palette, params.weight);
  return output;
}

/** Ordered disc projection, retaining independent source paths and 96 samples each. */
export function drawProjectionMarks(p, { params, seed, palette }) {
  validateDeformationMarks(params, false);
  const discs = [];
  for (let i = 1; i <= params.influenceCount; i += 1)
    discs.push([params[`centerX${i}`], params[`centerY${i}`], params[`radius${i}`]]);
  const paths = deformationSourcePaths(seed, params.sourceMode, params.pathCount, params.jitter);
  const points = paths.flatMap(path => {
    const pairs = [];
    for (let i = 0; i < path.length; i += 2) pairs.push([path[i], path[i + 1]]);
    return pairs;
  });
  const result = sequentialDiscProjection2D({ points, discs, strength: params.strength,
    maxTests: points.length * discs.length }).points();
  const output = [];
  for (let path = 0; path < params.pathCount; path += 1) {
    const drawn = [];
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const index = 2 * (path * SAMPLES + sample);
      drawn.push(result[index], result[index + 1]);
    }
    output.push(drawn);
  }
  drawPaths(p, output, palette, params.weight);
  return output;
}
