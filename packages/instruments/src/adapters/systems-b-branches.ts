import { parallelTokenRewrite, tokenTurtle2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";

const MAX_TOTAL_TOKENS = 100_000;
const MAX_TOTAL_SEGMENTS = 18_000;
const FRAME = 640;
type Query = Layer["params"];
type BranchCanvas = {
  noFill(): void;
  noStroke(): void;
  stroke(red: number, green: number, blue: number, alpha: number): void;
  fill(red: number, green: number, blue: number, alpha: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
type Command = { token: string; kind: "DRAW"; distance: number }
  | { token: string; kind: "TURN"; angle: number }
  | { token: string; kind: "PUSH" | "POP" };
const number = (query: Query, key: string): number => query[key] as number;
const within = (query: Query, key: string, low: number, high: number, integer = false): boolean => {
  const value = query[key];
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high &&
    (!integer || Number.isInteger(value));
};

/** Count before rewriting: limits both intermediate generations and the final turtle traversal. */
export function validateBranchSentences(query: Query): void {
  if (!within(query, "iterations", 1, 12, true) || !within(query, "branchCount", 1, 8, true) ||
      !within(query, "specimens", 1, 24, true) || !within(query, "step", .1, 160) ||
      !within(query, "angle", -180, 180) || !within(query, "branchBias", -180, 180) ||
      !within(query, "contraction", .1, 1.5) || !within(query, "angularDisorder", 0, 180) ||
      !within(query, "lengthDisorder", 0, .95) || !within(query, "heading", -1080, 1080) ||
      !within(query, "centerX", -1, 2) || !within(query, "centerY", -1, 2) ||
      !within(query, "spreadX", 0, 1000) || !within(query, "spreadY", 0, 1000) ||
      !within(query, "weight", .1, 20) || !within(query, "taper", 0, 2) ||
      !within(query, "branchSurvival", 0, 1) || !within(query, "tipSpread", 0, 4) ||
      typeof query.tips !== "boolean") throw Error("Invalid branching grammar settings");
  const count = number(query, "branchCount"), specimens = number(query, "specimens");
  let active = 1, segments = 0, internal = 0;
  for (let generation = 0; generation < number(query, "iterations"); generation++) {
    segments += active;
    if (generation + 1 < number(query, "iterations")) internal += active;
    const tokens = segments + 3 * count * internal +
      (generation + 1 < number(query, "iterations") ? active * count : 0);
    if (tokens * specimens > MAX_TOTAL_TOKENS || segments * specimens > MAX_TOTAL_SEGMENTS)
      throw Error("Branching grammar exceeds joint token/segment specimen budget");
    active *= count;
  }
}
function branchTokens(query: Query): string[] {
  const depth = number(query, "iterations"), count = number(query, "branchCount");
  const rules: { symbol: string; replacement: string[] }[] = [];
  for (let generation = 0; generation < depth; generation++) {
    const replacement = [`D${generation}`];
    if (generation + 1 < depth) for (let child = 0; child < count; child++)
      replacement.push("[", `T${generation}-${child}`, `N${generation + 1}`, "]");
    rules.push({ symbol: `N${generation}`, replacement });
  }
  // All intermediate strings grow monotonically; preflight counted the largest above.
  return parallelTokenRewrite({ axiom: ["N0"], rules, iterations: depth,
    maxTokens: MAX_TOTAL_TOKENS, maxWork: MAX_TOTAL_TOKENS * (depth * 3 + 4) }).tokens;
}

const rgba = (color: number): [number, number, number] => {
  const packed = color >>> 0;
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
};

export function drawBranchSentences(p: BranchCanvas, layer: Layer): void {
  const query = layer.params;
  validateBranchSentences(query);
  const tokens = branchTokens(query), commands: Command[] = [
    { token: "[", kind: "PUSH" }, { token: "]", kind: "POP" },
  ];
  const strokes: { command: Command & { kind: "DRAW" }; baseLength: number }[] = [];
  const turns: { command: Command & { kind: "TURN" }; angle: number }[] = [];
  const count = number(query, "branchCount"), angle = number(query, "angle"), bias = number(query, "branchBias");
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token[0] === "D") {
      const depth = Number(token.slice(1)), command: Command & { kind: "DRAW" } = {
        token: `d${index}`, kind: "DRAW", distance: number(query, "step") * Math.pow(number(query, "contraction"), depth),
      };
      tokens[index] = command.token;
      commands.push(command);
      strokes.push({ command, baseLength: command.distance });
    } else if (token[0] === "T") {
      const [generation, child] = token.slice(1).split("-").map(Number);
      const opening = 1 + (number(query, "tipSpread") - 1) *
        generation / Math.max(1, number(query, "iterations") - 2);
      const base = (count === 1 ? 0 : 2 * child / (count - 1) - 1) * angle * opening + bias;
      const command: Command & { kind: "TURN" } = { token: `t${index}`, kind: "TURN", angle: base * Math.PI / 180 };
      tokens[index] = command.token;
      commands.push(command);
      turns.push({ command, angle: base });
    }
  }
  const random = new JavaRandom(layer.seed);
  const strokeColors = layer.palette.map(rgba);
  const weight = number(query, "weight"), taper = number(query, "taper");
  const depthWeights = Array.from({ length: number(query, "iterations") }, (_, depth) => weight * Math.pow(taper, depth));
  const selected: string[] = [];
  p.noFill();
  for (let specimen = 0; specimen < number(query, "specimens"); specimen++) {
    const shiftX = random.nextDouble() - .5, shiftY = random.nextDouble() - .5;
    for (const stroke of strokes)
      stroke.command.distance = stroke.baseLength *
        (1 + (random.nextDouble() * 2 - 1) * number(query, "lengthDisorder"));
    for (const turn of turns)
      turn.command.angle = (turn.angle + (random.nextDouble() * 2 - 1) * number(query, "angularDisorder")) * Math.PI / 180;
    // Sample every possible fork, even inside a rejected subtree. Changing survival
    // therefore removes complete branches without moving the surviving geometry.
    selected.length = 0;
    let skippedDepth = 0;
    for (const token of tokens) {
      if (token === "[") {
        const grows = random.nextDouble() < number(query, "branchSurvival");
        if (skippedDepth > 0) { skippedDepth++; continue; }
        if (!grows) { skippedDepth = 1; continue; }
      } else if (skippedDepth > 0) {
        if (token === "]") skippedDepth--;
        continue;
      }
      selected.push(token);
    }
    const result = tokenTurtle2D({ tokens: selected, commands,
      start: { position: [FRAME * number(query, "centerX") + shiftX * number(query, "spreadX"),
        FRAME * number(query, "centerY") + shiftY * number(query, "spreadY")],
      heading: number(query, "heading") * Math.PI / 180 }, unknown: "ERROR",
      maxSegments: strokes.length, maxStackDepth: number(query, "iterations"),
      maxWork: commands.length + 3 * tokens.length });
    for (let i = 0; i < result.segments.length; i++) {
      const segment = result.segments[i], depth = result.depths[i];
      if (depthWeights[depth] === 0) continue;
      const [red, green, blue] = strokeColors[depth % strokeColors.length];
      p.stroke(red, green, blue, 215);
      p.strokeWeight(depthWeights[depth]);
      p.line(segment[0], segment[1], segment[2], segment[3]);
    }
    if (query.tips) {
      p.noStroke();
      for (let i = 0; i < result.segments.length; i++) {
        const depth = result.depths[i], tipWeight = depthWeights[depth];
        if (tipWeight === 0 || (i + 1 < result.segments.length && result.depths[i + 1] > depth)) continue;
        const segment = result.segments[i], [red, green, blue] = strokeColors[depth % strokeColors.length];
        p.fill(red, green, blue, 215);
        p.circle(segment[2], segment[3], tipWeight * 2.5);
      }
    }
  }
}
