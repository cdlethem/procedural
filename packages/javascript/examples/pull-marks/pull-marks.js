import { radialPull2D } from "../../src/radial-pull.js";
import { closedSpline2D } from "../../src/closed-spline.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const SIDE = 512;
export const COLORS = Object.freeze([0x173f5f, 0xaf5441, 0xe9c46a, 0x347969]);

function buildContours() {
  const base = [
    [80.0, 120.0], [220.0, 70.0], [390.0, 120.0],
    [430.0, 300.0], [320.0, 430.0], [120.0, 390.0],
  ];
  const loops = new Array(3);
  const contourInputs = new Array(3);
  for (let loopIndex = 0; loopIndex < 3; loopIndex += 1) {
    const scale = 0.62 + 0.19 * loopIndex;
    const controls = base.map(([x, y]) => [256.0 + (x - 256.0) * scale, 256.0 + (y - 256.0) * scale]);
    const loop = closedSpline2D({ controls, subdivisions: 32 });
    loops[loopIndex] = loop;
    const points = new Array(256);
    const sample = [0, 0, 0, 0];
    for (let i = 0; i < 256; i += 1) {
      loop.sampleParameterInto(i * loop.controlCount / 256.0, sample);
      points[i] = [sample[0], sample[1]];
    }
    contourInputs[loopIndex] = points;
  }
  return contourInputs;
}

function buildGridInputs() {
  const pathCount = 2 * Math.floor((SIDE - 1) / 16);
  const gridInputs = new Array(pathCount);
  let path = 0;
  for (let y = 16; y < SIDE; y += 16) {
    const length = SIDE / 2 - 8;
    const points = new Array(length);
    for (let i = 0; i < length; i += 1) points[i] = [16 + i * 2, y];
    gridInputs[path] = points;
    path += 1;
  }
  for (let x = 16; x < SIDE; x += 16) {
    const length = SIDE / 2 - 8;
    const points = new Array(length);
    for (let i = 0; i < length; i += 1) points[i] = [x, 16 + i * 2];
    gridInputs[path] = points;
    path += 1;
  }
  return gridInputs;
}

function transform(field, input) {
  const output = new Array(input.length);
  const target = [0, 0];
  for (let path = 0; path < input.length; path += 1) {
    const points = new Array(input[path].length);
    for (let i = 0; i < input[path].length; i += 1) {
      field.transformInto(input[path][i][0], input[path][i][1], target);
      points[i] = [target[0], target[1]];
    }
    output[path] = points;
  }
  return output;
}

/**
 * Editable radial-pull deformation field for PullMarks, transferring the same field
 * to a grid of straight scanlines and a set of retained closed-spline contours.
 * Independently composed from survey/out/2018/Generativos/curvespace/notes.md's radial
 * pull motivation. Radius, power, contour geometry, and grid spacing here are authored
 * piece settings, not RadialPull2D defaults or recommended operation ranges. See
 * catalog/validation/radial-pull-2d.json, targets.processing-java.technique.
 */
class PullComposition {
  #radius = 120.0;
  #power = 2.0;
  #alternate = false;
  #contoursMode = false;
  #palette = cyclicPalette({ colors: COLORS });
  #contourInputs = buildContours();
  #gridInputs = buildGridInputs();
  #field; #gridOutput; #contourOutput;

  constructor() {
    this.#rebuild();
  }

  #rebuild() {
    this.#field = radialPull2D({
      influences: [
        [200.0, 240.0, this.#radius, this.#power],
        [350.0, 320.0, this.#radius, this.#power],
      ],
    });
    this.#gridOutput = transform(this.#field, this.#gridInputs);
    this.#contourOutput = transform(this.#field, this.#contourInputs);
  }

  get radius() { return this.#radius; }
  get power() { return this.#power; }
  get alternate() { return this.#alternate; }
  get contoursMode() { return this.#contoursMode; }
  get palette() { return this.#palette; }
  get gridOutput() { return this.#gridOutput; }
  get contourOutput() { return this.#contourOutput; }

  toggleRadius() { this.#radius = this.#radius === 120.0 ? 180.0 : 120.0; this.#rebuild(); }
  togglePower() { this.#power = this.#power === 2.0 ? 0.5 : 2.0; this.#rebuild(); }
  toggleAlternate() { this.#alternate = !this.#alternate; }
  toggleContoursMode() { this.#contoursMode = !this.#contoursMode; }

  reset() {
    this.#radius = 120.0;
    this.#power = 2.0;
    this.#alternate = false;
    this.#contoursMode = false;
    this.#rebuild();
  }
}

export function createPullMarks() {
  return new PullComposition();
}
