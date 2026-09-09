import { gradientPath2D } from "../../src/gradient-path.js";
import { clipSegmentsSimplePolygon2D } from "../../src/segment-clip.js";

const PATH_COUNT = 6;
const PATH_STEPS = 160;
const STEP_DISTANCE = 4.0;
const FIELD_SCALE = 0.004;
const CLIP_WORK = 622144;
const CLIP_OUTPUT_LIMIT = 1920;
const STARTS = Object.freeze([
  [60.0, 140.0], [60.0, 212.0], [60.0, 284.0], [60.0, 356.0], [60.0, 428.0], [60.0, 500.0],
]);
export const PATH_COLORS = Object.freeze([0x285c76, 0xa84b5d, 0x537e50, 0x6d4c8f, 0xbd7b38, 0x357c81]);

function traceConfig(start) {
  return {
    field: { seed: 17 },
    start: [start[0], start[1]],
    steps: PATH_STEPS,
    stepDistance: STEP_DISTANCE,
    fieldScale: FIELD_SCALE,
    fieldOffset: [0, 0],
    angleBase: -Math.PI,
    angleScale: 2 * Math.PI,
  };
}

function buildPathsAndSources() {
  const traces = new Array(PATH_COUNT);
  const sources = [];
  const sourceToPath = [];
  for (let path = 0; path < PATH_COUNT; path += 1) {
    const trace = gradientPath2D(traceConfig(STARTS[path]));
    traces[path] = trace;
    let first = trace.pointAt(0);
    for (let step = 0; step < PATH_STEPS; step += 1) {
      const second = trace.pointAt(step + 1);
      // Ordinary drawing glue converts retained adjacent positions into clipping segments.
      sources.push([first[0], first[1], second[0], second[1]]);
      sourceToPath.push(path);
      first = second;
    }
  }
  return { traces, sources, sourceToPath };
}

function buildPolygon(shallowNotch) {
  const notchFloor = shallowNotch ? 430.0 : 200.0;
  return [
    [100.0, 100.0], [540.0, 100.0],
    [540.0, 540.0], [380.0, 540.0],
    [380.0, notchFloor], [260.0, notchFloor],
    [260.0, 540.0], [100.0, 540.0],
  ];
}

/**
 * Editable retained gradient-path composition study for PathClipMarks: six seeded
 * field traces converted into clipping segments, clipped against a caller-drawn
 * notched polygon whose notch depth can be reclipped independently of redraw.
 * Independently composed from survey/out/2014/Generativos/Forms/forms1/notes.md's
 * retained clipping dependency. Path count, field settings, and polygon geometry
 * here are authored piece settings, not GradientPath2D/SegmentClip2D defaults or
 * recommended operation ranges. See catalog/validation/segment-clip.json,
 * targets.processing-java.technique.
 */
class PathClipComposition {
  #sources; #sourceToPath;
  #polygon; #clipped;
  #shallowNotch = false;
  #alternateColors = false;
  #showUnclipped = false;
  #traceBuilds = 0;
  #clipBuilds = 0;

  constructor() {
    const built = buildPathsAndSources();
    this.#sources = built.sources;
    this.#sourceToPath = built.sourceToPath;
    this.#traceBuilds = 1;
    this.#rebuildClip();
  }

  #rebuildClip() {
    this.#polygon = buildPolygon(this.#shallowNotch);
    this.#clipped = clipSegmentsSimplePolygon2D({
      polygon: this.#polygon,
      segments: this.#sources,
      maxWork: CLIP_WORK,
      maxOutputSegments: CLIP_OUTPUT_LIMIT,
    });
    this.#clipBuilds += 1;
  }

  get sources() { return this.#sources; }
  get sourceToPath() { return this.#sourceToPath; }
  get polygon() { return this.#polygon; }
  get clipped() { return this.#clipped; }
  get shallowNotch() { return this.#shallowNotch; }
  get alternateColors() { return this.#alternateColors; }
  get showUnclipped() { return this.#showUnclipped; }
  get traceBuilds() { return this.#traceBuilds; }
  get clipBuilds() { return this.#clipBuilds; }

  toggleNotch() { this.#shallowNotch = !this.#shallowNotch; this.#rebuildClip(); }
  toggleAlternateColors() { this.#alternateColors = !this.#alternateColors; }
  toggleShowUnclipped() { this.#showUnclipped = !this.#showUnclipped; }

  reset() {
    const reclips = this.#shallowNotch;
    this.#shallowNotch = false;
    this.#alternateColors = false;
    this.#showUnclipped = false;
    if (reclips) this.#rebuildClip();
  }
}

export function createPathClipMarks() {
  return new PathClipComposition();
}
