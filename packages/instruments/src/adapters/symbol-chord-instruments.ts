import { chaikinPolyline2D, resamplePolyline2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer } from "../types.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type GlyphStroke = { points: Point[]; closed: boolean };
type Glyph = GlyphStroke[];
type Source = { points: Point[]; closed: boolean };
type Canvas = {
  CLOSE: unknown;
  noFill(): void;
  stroke(r: number, g: number, b: number, alpha: number): void;
  strokeWeight(weight: number): void;
  beginShape(): void;
  vertex(x: number, y: number): void;
  endShape(mode?: unknown): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
};
const TAU = Math.PI * 2;
const angle = (degrees: number) => degrees * Math.PI / 180;
const n = (q: Params, key: string): number => q[key] as number;
function number(q: Params, key: string, min: number, max: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v)))
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return v;
}
function option(q: Params, key: string, values: readonly string[]): void {
  if (typeof q[key] !== "string" || !values.includes(q[key])) throw new Error(`${key} must be one of ${values.join(", ")}`);
}
const asemicParameters = [
  numeric("dictionarySize", "Dictionary size", "Reusable distinct glyph motifs; this is not an alphabet.", 2, 14, 1, { hardMin: 1, hardMax: 32, integer: true }),
  numeric("strokesPerGlyph", "Strokes per glyph", "Independent open or closed paths in each reusable motif.", 1, 3, 1, { hardMin: 1, hardMax: 5, integer: true }),
  numeric("knotsPerStroke", "Knots per stroke", "Control joints of each smoothed path.", 3, 7, 1, { hardMin: 3, hardMax: 12, integer: true }),
  numeric("loopCharacter", "Loop character", "Chance for a stroke to close around its control geometry.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("bend", "Bend character", "Deviation of the generated control joints inside each glyph.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("regularity", "Motif regularity", "Chance of choosing the same dictionary entry at the same word/glyph slot across rows.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("rows", "Rows", "Rows of word-like arrangements; one gives a local line.", 1, 8, 1, { hardMin: 1, hardMax: 16, integer: true }),
  numeric("wordsPerRow", "Words per row", "Groups of glyphs, separated by word spacing.", 1, 8, 1, { hardMin: 1, hardMax: 16, integer: true }),
  numeric("glyphsPerWord", "Glyphs per word", "Repeated dictionary selections in each group.", 1, 8, 1, { hardMin: 1, hardMax: 16, integer: true }),
  numeric("glyphWidth", "Glyph X scale", "Width of the reusable normalized path at placement.", 6, 45, 1, { hardMin: 0, hardMax: 500 }),
  numeric("glyphHeight", "Glyph Y scale", "Height of the reusable normalized path at placement.", 6, 52, 1, { hardMin: 0, hardMax: 500 }),
  numeric("glyphSpacing", "Glyph spacing", "Distance between adjacent glyph centers within a word.", 7, 42, 1, { hardMin: 0, hardMax: 700 }),
  numeric("wordSpacing", "Word spacing", "Additional gap between word groups.", 0, 55, 1, { hardMin: 0, hardMax: 700 }),
  numeric("rowSpacing", "Row spacing", "Distance between row centers.", 10, 75, 1, { hardMin: 0, hardMax: 700 }),
  numeric("centerX", "Source center X", "Center of the local arrangement, without fitting to the canvas.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("centerY", "Source center Y", "Center of the local arrangement.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("direction", "Line direction", "Direction of words in degrees; rows grow perpendicular to it.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("layoutDisorder", "Layout disorder", "Independent seeded jitter of each placement, as a fraction of glyph spacing.", 0, 1, .05, { hardMin: 0, hardMax: 2 }),
  numeric("weight", "Stroke weight", "Independent material weight; zero leaves a blank layer.", 0, 5, .25, { hardMin: 0, hardMax: 50 }),
];
const chordParameters = [
  choice("shapeA", "Source A shape", "Ellipse, lobed closed loop or open arc.", ["ellipse", "lobed", "arc"]),
  choice("shapeB", "Source B shape", "Independently shaped second curve.", ["ellipse", "lobed", "arc"]),
  ...(["A", "B"] as const).flatMap(label => [
    numeric(`center${label}X`, `${label} center X`, "Local source center, independent of the other curve.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
    numeric(`center${label}Y`, `${label} center Y`, "Local source center, independent of the other curve.", 0, 720, 1, { hardMin: -4000, hardMax: 4000 }),
    numeric(`radius${label}X`, `${label} X radius`, "Source extent in its own horizontal direction.", 4, 250, 1, { hardMin: .1, hardMax: 1600 }),
    numeric(`radius${label}Y`, `${label} Y radius`, "Source extent in its own vertical direction.", 4, 250, 1, { hardMin: .1, hardMax: 1600 }),
    numeric(`phase${label}`, `${label} phase`, "Starting angular position of the source curve.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
    numeric(`rotation${label}`, `${label} rotation`, "Rotation of this curve around its own center.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
    numeric(`lobes${label}`, `${label} lobes`, "Lobe frequency when this source is lobed.", 2, 9, 1, { hardMin: 1, hardMax: 16, integer: true }),
    numeric(`lobeDepth${label}`, `${label} lobe depth`, "Relative radial modulation when lobed.", 0, .6, .02, { hardMin: 0, hardMax: .9 }),
    numeric(`arcSweep${label}`, `${label} arc sweep`, "Angular span when this source is an open arc.", 30, 330, 1, { hardMin: 1, hardMax: 360 }),
  ]),
  numeric("samples", "Arc-length samples", "Equal-distance sites on each source, not equal angular steps.", 16, 360, 1, { hardMin: 2, hardMax: 900, integer: true }),
  numeric("stride", "Mapping stride", "Index multiplier for the destination samples; integer stride makes periodic bundles.", 0, 12, 1, { hardMin: -900, hardMax: 900, integer: true }),
  numeric("mapPhase", "Mapping phase", "Destination offset measured in sample indices.", -300, 300, 1, { hardMin: -900, hardMax: 900 }),
  numeric("modulation", "Mapping modulation", "Sinusoidal offset in destination sample indices; zero preserves pure modular mapping.", 0, 50, .5, { hardMin: 0, hardMax: 900 }),
  numeric("modulationWaves", "Mapping waves", "Number of sinusoidal cycles around the source sequence.", 0, 8, 1, { hardMin: 0, hardMax: 24, integer: true }),
  numeric("retainedFraction", "Retained connections", "Seeded independent omission probability; zero draws no chords.", 0, 1, .05, { hardMin: 0, hardMax: 1 }),
  numeric("endpointDisorder", "Endpoint disorder", "Seeded endpoint perturbation in local canvas units; zero preserves the ordered geometry.", 0, 16, .5, { hardMin: 0, hardMax: 100 }),
  numeric("weight", "Chord weight", "Independent connection stroke weight.", 0, 4, .25, { hardMin: 0, hardMax: 50 }),
  toggle("showGuides", "Show source guides", "Draw the two source curves independently of the chords; off by default."),
  numeric("guideWeight", "Guide weight", "Weight of the optional source curves, independent of chord weight.", 0, 3, .25, { hardMin: 0, hardMax: 50 }),
];
const asemicGroups: ControlGroup[] = [
  { label: "Dictionary", stage: "form", controls: ["dictionarySize", "strokesPerGlyph", "knotsPerStroke", "loopCharacter", "bend"] },
  { label: "Arrangement", stage: "form", controls: ["rows", "wordsPerRow", "glyphsPerWord", "regularity",
    { label: "Spacing", controls: ["glyphSpacing", "wordSpacing", "rowSpacing"], proportional: true },
    "layoutDisorder"] },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "direction"] },
  { label: "Glyph ink", stage: "material", controls: [{ label: "Size", controls: ["glyphWidth", "glyphHeight"], proportional: true }, "weight"] },
];
/** The two chord sources are configured identically, so they share one group builder. */
const chordSourceGroup = (label: "A" | "B"): ControlGroup => ({ label: `Source ${label}`, stage: "form", controls: [
  { label: "Shape", controls: [`shape${label}`, `lobes${label}`, `lobeDepth${label}`, `arcSweep${label}`] },
  { label: "Placement", controls: [`center${label}X`, `center${label}Y`,
    { label: "Size", controls: [`radius${label}X`, `radius${label}Y`], proportional: true },
    `rotation${label}`, `phase${label}`] }] });
const chordGroups: ControlGroup[] = [
  chordSourceGroup("A"),
  chordSourceGroup("B"),
  { label: "Mapping", stage: "process", controls: ["samples", "stride", "mapPhase", "modulation", "modulationWaves"] },
  { label: "Disorder", stage: "process", controls: ["retainedFraction", "endpointDisorder"] },
  { label: "Drawing", stage: "material", controls: ["showGuides", { label: "Line weights", controls: ["weight", "guideWeight"], proportional: true }] },
];
const asemicDefaults = { dictionarySize: 9, strokesPerGlyph: 2, knotsPerStroke: 5,
  loopCharacter: .32, bend: .65, regularity: .65, rows: 4, wordsPerRow: 5, glyphsPerWord: 5,
  glyphWidth: 19, glyphHeight: 31, glyphSpacing: 19, wordSpacing: 17, rowSpacing: 57,
  centerX: 320, centerY: 320, direction: 0, layoutDisorder: .15, weight: 1.3 };
const chordDefaults = { shapeA: "ellipse", shapeB: "ellipse", centerAX: 285, centerAY: 360,
  radiusAX: 155, radiusAY: 115, phaseA: 0, rotationA: -22, lobesA: 5, lobeDepthA: .28, arcSweepA: 240,
  centerBX: 445, centerBY: 360, radiusBX: 125, radiusBY: 170, phaseB: 0, rotationB: 28,
  lobesB: 4, lobeDepthB: .3, arcSweepB: 240, samples: 160, stride: 3, mapPhase: 0,
  modulation: 0, modulationWaves: 2, retainedFraction: 1, endpointDisorder: 0,
  weight: .8, showGuides: false, guideWeight: .8 };
export const symbolChordDefinitions: StudioDefinition[] = [
  { id: "asemic-lines", title: "Asemic lines", description: "Seed a reusable abstract spline dictionary, then arrange its paths into editable line-like rhythms without asserting a writing system.",
  procedure: "Build a dictionary of nine abstract glyphs, each two strokes of knots smoothed by Chaikin subdivision. Set them out in four rows of words, reusing the same glyphs with loose spacing and jitter, with no text, baseline or writing system behind them.",
    parameters: asemicParameters, controlGroups: asemicGroups, defaults: asemicDefaults, validate: validateAsemic },
  { id: "chord-looms", title: "Chord looms", description: "Arc-length samples on two independent curves joined by modular, optionally modulated index mapping.",
  procedure: "Sample two ellipses by arc length, 160 points each. Join sample i of the first to sample 3i of the second, modulo the count, with a straight chord, and draw only these chords so the string-art envelope appears without the source curves.",
    parameters: chordParameters, controlGroups: chordGroups, defaults: chordDefaults, validate: validateChords },
];
export function validateAsemic(q: Params): void {
  const dictionary = number(q, "dictionarySize", 1, 32, true);
  const strokes = number(q, "strokesPerGlyph", 1, 5, true);
  const knots = number(q, "knotsPerStroke", 3, 12, true);
  const rows = number(q, "rows", 1, 16, true);
  const words = number(q, "wordsPerRow", 1, 16, true);
  const glyphs = number(q, "glyphsPerWord", 1, 16, true);
  for (const [key, min, max] of [["loopCharacter", 0, 1], ["bend", 0, 1], ["regularity", 0, 1],
    ["glyphWidth", 0, 500], ["glyphHeight", 0, 500], ["glyphSpacing", 0, 700],
    ["wordSpacing", 0, 700], ["rowSpacing", 0, 700], ["centerX", -4000, 4000],
    ["centerY", -4000, 4000], ["direction", -3600, 3600], ["layoutDisorder", 0, 2],
    ["weight", 0, 50]] as const) number(q, key, min, max);
  // Two Chaikin passes yield 4 vertices per knot. Bound dictionary construction AND repetition before either happens.
  if ((dictionary + rows * words * glyphs) * strokes * knots * 4 > 160_000)
    throw new Error("Asemic dictionary and placement exceed the 160000-vertex work budget");
}
export function validateChords(q: Params): void {
  option(q, "shapeA", ["ellipse", "lobed", "arc"]);
  option(q, "shapeB", ["ellipse", "lobed", "arc"]);
  for (const label of ["A", "B"]) {
    for (const key of [`center${label}X`, `center${label}Y`]) number(q, key, -4000, 4000);
    for (const key of [`radius${label}X`, `radius${label}Y`]) number(q, key, .1, 1600);
    for (const key of [`phase${label}`, `rotation${label}`]) number(q, key, -3600, 3600);
    number(q, `lobes${label}`, 1, 16, true);
    number(q, `lobeDepth${label}`, 0, .9);
    number(q, `arcSweep${label}`, 1, 360);
  }
  const count = number(q, "samples", 2, 900, true);
  number(q, "stride", -900, 900, true);
  for (const [key, min, max] of [["mapPhase", -900, 900], ["modulation", 0, 900],
    ["retainedFraction", 0, 1], ["endpointDisorder", 0, 100], ["weight", 0, 50],
    ["guideWeight", 0, 50]] as const) number(q, key, min, max);
  number(q, "modulationWaves", 0, 24, true);
  if (typeof q.showGuides !== "boolean") throw new Error("showGuides must be boolean");
  // Two 97-joint curves, two arc-length passes, one mapping pass, and at most two source guides.
  if (2 * (97 + count) + count + (q.showGuides ? 2 * count : 0) > 4_500)
    throw new Error("Chord sampling and drawing exceed the 4500-site work budget");
}
const dictionaryCache = new Map<string, Glyph[]>();
function dictionaryKey(q: Params, seed: number): string {
  return JSON.stringify([seed, q.dictionarySize, q.strokesPerGlyph, q.knotsPerStroke, q.loopCharacter, q.bend]);
}
/** Normalized authored source paths; neither layout nor material controls enter this cache key. */
export function glyphDictionary(q: Params, seed: number): Glyph[] {
  validateAsemic(q);
  const key = dictionaryKey(q, seed);
  const hit = dictionaryCache.get(key);
  if (hit) { dictionaryCache.delete(key); dictionaryCache.set(key, hit); return hit; }
  const random = new JavaRandom((seed ^ 0x7ac43d29) >>> 0);
  const result: Glyph[] = [];
  for (let g = 0; g < n(q, "dictionarySize"); g++) {
    const paths: Glyph = [];
    for (let s = 0; s < n(q, "strokesPerGlyph"); s++) {
      const closed = random.nextDouble() < n(q, "loopCharacter");
      const joints: Point[] = [];
      const centerX = (random.nextDouble() - .5) * .45;
      const centerY = (random.nextDouble() - .5) * .45;
      const bend = n(q, "bend");
      const lean = (random.nextDouble() - .5) * .8;
      for (let k = 0; k < n(q, "knotsPerStroke"); k++) {
        const t = k / (n(q, "knotsPerStroke") - (closed ? 0 : 1));
        if (closed) {
          const theta = TAU * t;
          const radius = .24 + random.nextDouble() * .14 + (random.nextDouble() - .5) * bend * .24;
          joints.push([centerX + Math.cos(theta) * radius, centerY + Math.sin(theta) * radius]);
        } else {
          joints.push([t - .5 + centerX + (random.nextDouble() - .5) * bend * .26,
            centerY + lean * (t - .5) + (random.nextDouble() - .5) * bend * .85]);
        }
      }
      paths.push({ closed, points: chaikinPolyline2D({ points: joints, closed, iterations: 2,
        maxWork: joints.length * 7 }).points as Point[] });
    }
    result.push(paths);
  }
  dictionaryCache.set(key, result);
  if (dictionaryCache.size > 8) dictionaryCache.delete(dictionaryCache.keys().next().value!);
  return result;
}
export type GlyphPlacement = { glyph: number; x: number; y: number; row: number };
/** Dictionary selection and location jitter use separate RNG streams; changing spacing never redraws a glyph. */
export function asemicPlacements(q: Params, seed: number): GlyphPlacement[] {
  validateAsemic(q);
  const selection = new JavaRandom((seed ^ 0x4f13b5cd) >>> 0);
  const location = new JavaRandom((seed ^ 0x192c4fe1) >>> 0);
  const rows = n(q, "rows"), words = n(q, "wordsPerRow"), glyphs = n(q, "glyphsPerWord");
  const slots = words * glyphs;
  const motif = Array.from({ length: slots }, () => selection.nextInt(n(q, "dictionarySize")));
  const span = (slots - 1) * n(q, "glyphSpacing") + (words - 1) * n(q, "wordSpacing");
  const direction = angle(n(q, "direction"));
  const cos = Math.cos(direction), sin = Math.sin(direction);
  const result: GlyphPlacement[] = [];
  for (let row = 0; row < rows; row++) for (let word = 0; word < words; word++) for (let glyph = 0; glyph < glyphs; glyph++) {
    const slot = word * glyphs + glyph;
    const selected = selection.nextDouble() < n(q, "regularity") ? motif[slot] : selection.nextInt(n(q, "dictionarySize"));
    const shift = n(q, "layoutDisorder") * n(q, "glyphSpacing");
    const u = slot * n(q, "glyphSpacing") + word * n(q, "wordSpacing") - span / 2 + (location.nextDouble() - .5) * 2 * shift;
    const v = (row - (rows - 1) / 2) * n(q, "rowSpacing") + (location.nextDouble() - .5) * 2 * shift;
    result.push({ glyph: selected, x: n(q, "centerX") + u * cos - v * sin,
      y: n(q, "centerY") + u * sin + v * cos, row });
  }
  return result;
}
function rawCurve(q: Params, label: "A" | "B"): Source {
  const shape = q[`shape${label}`];
  const closed = shape !== "arc";
  const points: Point[] = [];
  const phi = angle(n(q, `phase${label}`));
  const turn = angle(n(q, `rotation${label}`));
  const cos = Math.cos(turn), sin = Math.sin(turn);
  for (let i = 0; i <= 96; i++) {
    if (closed && i === 96) break;
    const theta = phi + (closed ? TAU : angle(n(q, `arcSweep${label}`))) * i / 96;
    const radius = shape === "lobed" ? 1 + n(q, `lobeDepth${label}`) * Math.cos(n(q, `lobes${label}`) * (theta - phi)) : 1;
    const x = n(q, `radius${label}X`) * radius * Math.cos(theta);
    const y = n(q, `radius${label}Y`) * radius * Math.sin(theta);
    points.push([n(q, `center${label}X`) + x * cos - y * sin,
      n(q, `center${label}Y`) + x * sin + y * cos]);
  }
  return { points, closed };
}
/** Both curves are sampled by the accepted core arc-length operation. */
export function chordSources(q: Params): [Source, Source] {
  validateChords(q);
  return (["A", "B"] as const).map(label => {
    const source = rawCurve(q, label);
    return { closed: source.closed, points: resamplePolyline2D({ points: source.points,
      closed: source.closed, count: n(q, "samples"), maxWork: source.points.length + n(q, "samples") }).points as Point[] };
  }) as [Source, Source];
}
export type Chord = { index: number; destinationIndex: number; from: Point; to: Point };
/** Modulo mapping wraps even an open destination curve; every endpoint remains a sampled site. */
export function chordConnections(q: Params, seed: number, sources: [Source, Source] = chordSources(q)): Chord[] {
  validateChords(q);
  const count = n(q, "samples");
  const result: Chord[] = [];
  if (n(q, "retainedFraction") === 0) return result;
  const omit = new JavaRandom((seed ^ 0x629bab17) >>> 0);
  const disorder = n(q, "endpointDisorder");
  const jitter = disorder > 0 ? new JavaRandom((seed ^ 0x743addb3) >>> 0) : undefined;
  const modulation = n(q, "modulation");
  for (let i = 0; i < count; i++) {
    const retained = omit.nextDouble() < n(q, "retainedFraction");
    const noiseX = jitter ? (jitter.nextDouble() * 2 - 1) * disorder : 0;
    const noiseY = jitter ? (jitter.nextDouble() * 2 - 1) * disorder : 0;
    const noiseBX = jitter ? (jitter.nextDouble() * 2 - 1) * disorder : 0;
    const noiseBY = jitter ? (jitter.nextDouble() * 2 - 1) * disorder : 0;
    if (!retained) continue;
    const mapped = i * n(q, "stride") + n(q, "mapPhase") +
      (modulation ? modulation * Math.sin(TAU * i * n(q, "modulationWaves") / count) : 0);
    const destinationIndex = ((Math.round(mapped) % count) + count) % count;
    const destination = sources[1].points[destinationIndex];
    const from: Point = [sources[0].points[i][0] + noiseX, sources[0].points[i][1] + noiseY];
    const to: Point = [destination[0] + noiseBX, destination[1] + noiseBY];
    result.push({ index: i, destinationIndex, from, to });
  }
  return result;
}
export function drawSymbolChord(p: Canvas, layer: Layer): void {
  const q = layer.params;
  const rgb = channels(layer.palette[0] ?? 0x222222);
  p.noFill();
  if (layer.technique === "asemic-lines") {
    validateAsemic(q);
    if (n(q, "weight") === 0 || n(q, "glyphWidth") === 0 || n(q, "glyphHeight") === 0) return;
    const dictionary = glyphDictionary(q, layer.seed);
    const placements = asemicPlacements(q, layer.seed);
    p.stroke(...rgb, 220);
    p.strokeWeight(n(q, "weight"));
    const direction = angle(n(q, "direction")), cos = Math.cos(direction), sin = Math.sin(direction);
    for (const place of placements) for (const stroke of dictionary[place.glyph]) {
      p.beginShape();
      for (const [x, y] of stroke.points) {
        const u = x * n(q, "glyphWidth"), v = y * n(q, "glyphHeight");
        p.vertex(place.x + u * cos - v * sin, place.y + u * sin + v * cos);
      }
      p.endShape(stroke.closed ? p.CLOSE : undefined);
    }
    return;
  }
  if (layer.technique !== "chord-looms") throw new Error(`Unsupported symbol/chord study: ${layer.technique}`);
  validateChords(q);
  if ((n(q, "weight") === 0 || n(q, "retainedFraction") === 0) &&
    (!q.showGuides || n(q, "guideWeight") === 0)) return;
  const sources = chordSources(q);
  if (n(q, "weight") > 0 && n(q, "retainedFraction") > 0) {
    p.stroke(...rgb, 145);
    p.strokeWeight(n(q, "weight"));
    for (const chord of chordConnections(q, layer.seed, sources))
      p.line(chord.from[0], chord.from[1], chord.to[0], chord.to[1]);
  }
  if (q.showGuides && n(q, "guideWeight") > 0) {
    p.stroke(...channels(layer.palette[1] ?? layer.palette[0] ?? 0x222222), 210);
    p.strokeWeight(n(q, "guideWeight"));
    for (const source of sources) {
      p.beginShape();
      for (const [x, y] of source.points) p.vertex(x, y);
      p.endShape(source.closed ? p.CLOSE : undefined);
    }
  }
}
