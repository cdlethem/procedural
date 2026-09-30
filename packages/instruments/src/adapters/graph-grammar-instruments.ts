import { parallelTokenRewrite, seededDepthFirstSpanningTree, tokenTurtle2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { ControlGroup, Layer, Parameter } from "../types.js";
import { choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Canvas = {
  noStroke(): void; noFill(): void;
  stroke(r: number, g: number, b: number, a: number): void;
  fill(r: number, g: number, b: number, a: number): void;
  strokeWeight(weight: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  circle(x: number, y: number, diameter: number): void;
};
const number = (q: Params, key: string): number => q[key] as number;

const TREE_SITE_BUDGET = 8_000;
const TREE_WORK_BUDGET = 1_000_000;
const GRAMMAR_TOKEN_BUDGET = 20_000;
const GRAMMAR_WORK_BUDGET = 120_000;
const alphabet: Record<string, true> = { F: true, G: true, X: true, Y: true, "+": true, "-": true, "[": true, "]": true };
const color = (layer: Layer, index: number): [number, number, number] => {
  const packed = layer.palette[index % layer.palette.length] >>> 0;
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255];
};
function stroke(p: Canvas, layer: Layer, index: number, alpha = 220): void { p.stroke(...color(layer, index), alpha); }
function fill(p: Canvas, layer: Layer, index: number, alpha = 220): void { p.fill(...color(layer, index), alpha); }
function checked(q: Params, key: string, min: number, max: number, integer = false): number {
  const v = q[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v)))
    throw Error(`${key} must be ${integer ? "an integer" : "a finite number"} in [${min}, ${max}]`);
  return v;
}
function bool(q: Params, key: string): void { if (typeof q[key] !== "boolean") throw Error(`${key} must be boolean`); }
function select(q: Params, key: string, options: readonly string[]): void {
  if (typeof q[key] !== "string" || !options.includes(q[key])) throw Error(`${key} must be one of ${options.join(", ")}`);
}
const latticeParameters: Parameter[] = [
  numeric("columns", "Columns", "Horizontal source sites.", 3, 35, 1, { hardMin: 1, hardMax: 120, integer: true }),
  numeric("rows", "Rows", "Vertical source sites.", 3, 35, 1, { hardMin: 1, hardMax: 120, integer: true }),
  numeric("spacing", "Cell spacing", "Distance between adjacent local source sites; no fit to page.", 4, 35, 1, { hardMin: .1, hardMax: 500 }),
  numeric("centerX", "Center X", "Source center on the 640-unit canvas.", 0, 640, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("centerY", "Center Y", "Source center on the 640-unit canvas.", 0, 640, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("orientation", "Orientation", "Rotation of the graph around its local center, degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  choice("shape", "Region", "Keep sites within a rectangle, disc, or annulus.", ["rectangle", "disc", "annulus"]),
  numeric("innerRadius", "Annulus hole", "Excluded inner radius as a fraction of disc radius.", 0, .9, .01, { hardMin: 0, hardMax: .99 }),
  numeric("blocked", "Blocked sites", "Seeded fraction of eligible sites removed before graph traversal.", 0, .7, .01, { hardMin: 0, hardMax: 1 }),
  numeric("rootX", "Root X", "Preferred traversal root, normalized across the full lattice.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("rootY", "Root Y", "Preferred traversal root, normalized across the full lattice.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("minDepth", "First depth", "Retain only edges and sites discovered at or beyond this depth.", 0, 250, 1, { hardMin: 0, hardMax: TREE_SITE_BUDGET, integer: true }),
  numeric("maxDepth", "Last depth", "Retain only edges and sites up to this depth.", 0, 600, 1, { hardMin: 0, hardMax: TREE_SITE_BUDGET, integer: true }),
  numeric("branchRetention", "Branch retention", "Seeded fraction of DFS edges retained as visible fragments.", 0, 1, .01, { hardMin: 0, hardMax: 1 }),
  numeric("weight", "Edge weight", "Stroke width; zero hides traversal edges.", 0, 8, .1, { hardMin: 0, hardMax: 40 }),
  toggle("nodes", "Site marks", "Show discovered sites independently of edge visibility."),
  numeric("dotSize", "Dot diameter", "Diameter of site marks; zero hides them.", 0, 12, .1, { hardMin: 0, hardMax: 60 }),
];
const grammarParameters = (depthKey: "iterations" | "depth"): Parameter[] => [
  text("axiom", "Axiom", "Initial token string, alphabet F G X Y + - [ ].", 128),
  text("ruleF", "F production", "Parallel replacement for drawing symbol F.", 128),
  text("ruleG", "G production", "Parallel replacement for drawing symbol G.", 128),
  text("ruleX", "X production", "Parallel replacement for silent variable X.", 128),
  text("ruleY", "Y production", "Parallel replacement for silent variable Y.", 128),
  numeric(depthKey, "Rewrite generations", "Complete simultaneous production passes.", 0, 7, 1, { hardMin: 0, hardMax: 12, integer: true }),
  numeric("step", "F step", "Distance drawn by F; no automatic fit.", .5, 40, .5, { hardMin: .01, hardMax: 500 }),
  numeric("contraction", "G/F ratio", "G draws this fraction of the F step; F and G remain independently editable rules.", .1, 1.5, .05, { hardMin: .01, hardMax: 4 }),
  numeric("angle", "Turn angle", "Signed + turn in degrees; - turns the opposite way.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("startX", "Start X", "Turtle start X in canvas units.", 0, 640, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("startY", "Start Y", "Turtle start Y in canvas units.", 0, 640, 1, { hardMin: -4000, hardMax: 4000 }),
  numeric("heading", "Heading", "Initial turtle heading in degrees.", -180, 180, 1, { hardMin: -3600, hardMax: 3600 }),
  numeric("weight", "Path weight", "Zero hides the path without changing the rewritten geometry.", 0, 6, .1, { hardMin: 0, hardMax: 40 }),
  toggle("nodes", "Endpoint marks", "Paint segment endpoints independently of path strokes."),
  numeric("dotSize", "Dot diameter", "Endpoint diameter.", 0, 9, .1, { hardMin: 0, hardMax: 40 }),
  toggle("ticks", "Midpoint ticks", "Short normal marks along every turtle segment."),
  numeric("tickLength", "Tick length", "Midpoint-mark extent.", 0, 12, .1, { hardMin: 0, hardMax: 80 }),
];
const latticeGroups: ControlGroup[] = [
  { label: "Lattice", stage: "form", controls: ["columns", "rows"], proportional: true },
  { label: "Placement", stage: "frame", controls: ["centerX", "centerY", "spacing", "orientation"] },
  { label: "Region", stage: "form", controls: ["shape", "innerRadius", "blocked"] },
  { label: "Traversal", stage: "process", controls: [
    { label: "Root", controls: ["rootX", "rootY"] },
    { label: "Depth range", controls: ["minDepth", "maxDepth"] },
    "branchRetention"] },
  { label: "Drawing", stage: "material", controls: ["weight", { label: "Site marks", controls: ["nodes", "dotSize"] }] },
];
const grammarGroups = (depthKey: "iterations" | "depth"): ControlGroup[] => [
  { label: "Grammar", stage: "form", controls: ["axiom", { label: "Productions", controls: ["ruleF", "ruleG", "ruleX", "ruleY"] }, depthKey] },
  { label: "Turtle", stage: "form", controls: ["step", "contraction", "angle"] },
  { label: "Placement", stage: "frame", controls: ["startX", "startY", "heading"] },
  { label: "Drawing", stage: "material", controls: ["weight",
    { label: "Endpoint marks", controls: ["nodes", "dotSize"] },
    { label: "Midpoint ticks", controls: ["ticks", "tickLength"] }] },
];
const commonTree = {spacing: 19,
  centerX: 320,
  centerY: 320,
  orientation: 0,
  shape: "rectangle",
  innerRadius: .5,
  blocked: 0,
  rootX: .5,
  rootY: .5,
  minDepth: 0,
  maxDepth: TREE_SITE_BUDGET,
  branchRetention: 1,
  nodes: true,
  dotSize: 3};
const commonGrammar = {ruleF: "F",
  ruleG: "G",
  ruleX: "X",
  ruleY: "Y",
  contraction: .7,
  startX: 190,
  startY: 190,
  heading: 0,
  weight: 1.4,
  nodes: false,
  dotSize: 2.5,
  ticks: false,
  tickLength: 4};
export const graphGrammarInstrumentDefinitions: StudioDefinition[] = [
  { id: "maze-gardens", title: "Maze gardens", description: "Seeded DFS maze fragments over a locally shaped and optionally disconnected lattice.",
  procedure: "A dense grid has a few seeded cells blocked, then a random depth-first walk carves a spanning tree through each connected patch. The tree's edges are drawn as corridors, twisting into a maze with a single path between any two points.",
    parameters: latticeParameters, controlGroups: latticeGroups, defaults: { ...commonTree, columns: 16, rows: 16, weight: 3 },
    validate: q => validateGraphGrammarInstrument("maze-gardens", q) },
  { id: "branching-networks", title: "Branching networks", description: "Seeded DFS forest with site and edge depth filtering over an editable local region.",
  procedure: "A sparse grid has some cells knocked out, and a random depth-first walk spans each surviving patch with a tree. Thin edges and small dots trace the branches, and nothing is ever bridged across a hole.",
    parameters: latticeParameters, controlGroups: latticeGroups, defaults: { ...commonTree, columns: 13, rows: 13, weight: 2, spacing: 24, nodes: false },
    validate: q => validateGraphGrammarInstrument("branching-networks", q) },
  { id: "woven-grammar", title: "Woven grammar", description: "Editable X/Y productions weave deterministic paths through a token turtle, without page fitting.",
  procedure: "A short word is rewritten again and again by folding rules, each generation replacing every symbol at once. A turtle then walks the final string, drawing a step for F and turning a right angle at every sign, and the folds weave the path back across itself.",
    parameters: grammarParameters("iterations"), controlGroups: grammarGroups("iterations"), defaults: { ...commonGrammar, axiom: "X", ruleX: "+YF-XFX-FY+", ruleY: "-XF+YFY+FX-", iterations: 5, step: 9, angle: 90 },
    validate: q => validateGraphGrammarInstrument("woven-grammar", q) },
  { id: "recursive-tiles", title: "Recursive tiles", description: "Editable F/G productions construct folded local paths; brackets also permit branches.",
  procedure: "A short word is rewritten generation after generation, every F and G replaced by its rule at once. A turtle then walks the result, drawing a segment for each letter and turning at each sign, so the tile repeats inside itself.",
    parameters: grammarParameters("depth"), controlGroups: grammarGroups("depth"), defaults: { ...commonGrammar, axiom: "F", ruleF: "F+G-F-G-F", depth: 4, step: 16, angle: 90, startX: 320, startY: 320 },
    validate: q => validateGraphGrammarInstrument("recursive-tiles", q) },
  { id: "turtle-canopies", title: "Turtle canopies", description: "Editable fork productions grow local turtle canopies with independent path and endpoint material.",
  procedure: "Each F is rewritten as a stem with a branch to each side, again and again, so every generation sprouts smaller twigs. A turtle walks the final string, drawing steps, turning at the signs and returning to each fork, and the tree fills out into a canopy.",
    parameters: grammarParameters("depth"), controlGroups: grammarGroups("depth"), defaults: { ...commonGrammar, axiom: "F", ruleF: "F[+F][-F]F", depth: 4, step: 20, angle: 25, startX: 320, startY: 500, heading: -90 },
    validate: q => validateGraphGrammarInstrument("turtle-canopies", q) },
];

type Summary = { length: number; delta: number; min: number; max: number; draws: number };
const empty = (): Summary => ({ length: 0, delta: 0, min: 0, max: 0, draws: 0 });
function append(a: Summary, b: Summary): Summary {
  return { length: a.length + b.length, delta: a.delta + b.delta,
    min: Math.min(a.min, a.delta + b.min), max: Math.max(a.max, a.delta + b.max), draws: a.draws + b.draws };
}
function tokens(q: Params, key: string): string[] {
  const value = q[key];
  if (typeof value !== "string" || (key === "axiom" && value.length === 0) || value.length > 128 || [...value].some(char => !alphabet[char]))
    throw Error(`${key} must contain at most 128 tokens from F G X Y + - [ ]; the axiom cannot be empty`);
  return [...value];
}
function grammar(q: Params, depthKey: "iterations" | "depth"): { axiom: string[]; rules: { symbol: string; replacement: string[] }[]; generations: number; maximum: number } {
  const generations = checked(q, depthKey, 0, 12, true);
  for (const [key, min, max] of [["step", .01, 500], ["contraction", .01, 4], ["angle", -3600, 3600],
    ["startX", -4000, 4000], ["startY", -4000, 4000], ["heading", -3600, 3600], ["weight", 0, 40],
    ["dotSize", 0, 40], ["tickLength", 0, 80]] as const) checked(q, key, min, max);
  bool(q, "nodes"); bool(q, "ticks");
  const axiom = tokens(q, "axiom");
  const rules = (["F", "G", "X", "Y"] as const).map(symbol => ({ symbol, replacement: tokens(q, `rule${symbol}`) }));
  const single: Record<string, Summary> = {};
  for (const symbol of Object.keys(alphabet)) single[symbol] = { length: 1, delta: symbol === "[" ? 1 : symbol === "]" ? -1 : 0,
    min: symbol === "]" ? -1 : 0, max: symbol === "[" ? 1 : 0, draws: symbol === "F" || symbol === "G" ? 1 : 0 };
  let expansion = single;
  let total = 0, maximum = 0;
  for (let generation = 0; generation <= generations; generation++) {
    let result = empty();
    for (const token of axiom) result = append(result, expansion[token]);
    total += result.length;
    maximum = Math.max(maximum, result.length);
    if (maximum > GRAMMAR_TOKEN_BUDGET || total * 3 + maximum * 4 > GRAMMAR_WORK_BUDGET || result.draws > GRAMMAR_TOKEN_BUDGET)
      throw Error("Grammar expansion/turtle exceeds joint token and work budget");
    if (generation === generations) {
      if (result.min < 0 || result.delta !== 0) throw Error("Expanded grammar has unmatched brackets");
      if (result.max > 128) throw Error("Expanded grammar exceeds turtle stack budget");
      break;
    }
    const next = { ...expansion };
    for (const rule of rules) {
      let summary = empty();
      for (const token of rule.replacement) summary = append(summary, expansion[token]);
      next[rule.symbol] = summary;
    }
    expansion = next;
  }
  return { axiom, rules, generations, maximum };
}
function validateLattice(q: Params): void {
  const columns = checked(q, "columns", 1, 120, true), rows = checked(q, "rows", 1, 120, true);
  if (columns * rows > TREE_SITE_BUDGET || columns * rows * 24 > TREE_WORK_BUDGET)
    throw Error("Graph sites/edges/traversal exceed joint work budget");
  for (const [key, min, max] of [["spacing", .1, 500], ["centerX", -4000, 4000], ["centerY", -4000, 4000],
    ["orientation", -3600, 3600], ["innerRadius", 0, .99], ["blocked", 0, 1], ["rootX", 0, 1], ["rootY", 0, 1],
    ["branchRetention", 0, 1], ["weight", 0, 40], ["dotSize", 0, 60]] as const) checked(q, key, min, max);
  const min = checked(q, "minDepth", 0, TREE_SITE_BUDGET, true), max = checked(q, "maxDepth", 0, TREE_SITE_BUDGET, true);
  if (min > max) throw Error("Depth interval must have first depth <= last depth");
  select(q, "shape", ["rectangle", "disc", "annulus"]); bool(q, "nodes");
}
export function validateGraphGrammarInstrument(id: string, q: Params): void {
  
  if (id === "maze-gardens" || id === "branching-networks") validateLattice(q);
  else if (id === "woven-grammar" || id === "recursive-tiles" || id === "turtle-canopies") grammar(q, id === "woven-grammar" ? "iterations" : "depth");
  else throw Error(`Unknown graph/grammar instrument ${id}`);
}

type Forest = { vertices: number[]; parents: number[]; depths: number[]; edges: [number, number][]; component: number }[];
export function graphForest(q: Params, seed: number): Forest {
  validateLattice(q);
  const columns = number(q, "columns"), rows = number(q, "rows"), count = columns * rows;
  const retained = new Uint8Array(count);
  const random = new JavaRandom(seed);
  for (let i = 0; i < count; i++) {
    const x = i % columns, y = Math.floor(i / columns);
    const nx = columns === 1 ? 0 : (2 * x / (columns - 1) - 1);
    const ny = rows === 1 ? 0 : (2 * y / (rows - 1) - 1);
    const radius = Math.hypot(nx, ny);
    const inside = q.shape === "rectangle" || radius <= 1 && (q.shape !== "annulus" || radius >= number(q, "innerRadius"));
    retained[i] = Number(inside && random.nextDouble() >= number(q, "blocked"));
  }
  if (!retained.some(Boolean)) throw Error("Disconnected source has no retained sites");
  const seen = new Uint8Array(count), components: number[][] = [];
  for (let i = 0; i < count; i++) {
    if (!retained[i] || seen[i]) continue;
    const queue = [i]; seen[i] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const vertex = queue[cursor], x = vertex % columns, y = Math.floor(vertex / columns);
      for (let direction = 0; direction < 4; direction++) {
        if (direction === 0 && x === 0 || direction === 1 && x + 1 === columns ||
          direction === 2 && y === 0 || direction === 3 && y + 1 === rows) continue;
        const neighbor = vertex + (direction === 0 ? -1 : direction === 1 ? 1 : direction === 2 ? -columns : columns);
        if (!retained[neighbor] || seen[neighbor]) continue;
        seen[neighbor] = 1; queue.push(neighbor);
      }
    }
    queue.sort((a, b) => a - b); components.push(queue);
  }
  const preferred = (a: number, b: number): number => {
    const distance = (v: number) => {
      const dx = (columns === 1 ? .5 : v % columns / (columns - 1)) - number(q, "rootX");
      const dy = (rows === 1 ? .5 : Math.floor(v / columns) / (rows - 1)) - number(q, "rootY");
      return dx * dx + dy * dy;
    };
    return distance(a) - distance(b) || a - b;
  };
  let root = components[0][0];
  for (const component of components) for (const vertex of component)
    if (preferred(vertex, root) < 0) root = vertex;
  components.sort((a, b) => Number(b.includes(root)) - Number(a.includes(root)) || a[0] - b[0]);
  const local = new Int32Array(count).fill(-1);
  return components.map((vertices, component) => {
    for (let i = 0; i < vertices.length; i++) local[vertices[i]] = i;
    const edges: [number, number][] = [];
    for (const vertex of vertices) {
      const x = vertex % columns, a = local[vertex];
      if (x + 1 < columns && local[vertex + 1] >= 0) edges.push([a, local[vertex + 1]]);
      if (vertex + columns < count && local[vertex + columns] >= 0) edges.push([a, local[vertex + columns]]);
    }
    edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const chosenRoot = component === 0 ? root : vertices.reduce((best, current) => preferred(current, best) < 0 ? current : best);
    const result = seededDepthFirstSpanningTree({ vertexCount: vertices.length, edges,
      root: local[chosenRoot], rngState: (seed ^ Math.imul(vertices[0] + 1, 0x9e3779b9)) >>> 0,
      maxWork: TREE_WORK_BUDGET });
    for (const vertex of vertices) local[vertex] = -1;
    return { vertices, parents: result.parents, depths: result.depths, edges: result.edges as [number,number][], component };
  });
}
/** Canvas position of lattice vertex `vertex`: a rotated grid centered on (centerX, centerY) with per-axis spacing. */
export function latticeVertexPosition(vertex: number, columns: number, rows: number, spacingX: number, spacingY: number,
  centerX: number, centerY: number, orientationDegrees: number): Point {
  const rotation = orientationDegrees * Math.PI / 180, cos = Math.cos(rotation), sin = Math.sin(rotation);
  const x = (vertex % columns - (columns - 1) / 2) * spacingX;
  const y = (Math.floor(vertex / columns) - (rows - 1) / 2) * spacingY;
  return [centerX + x * cos - y * sin, centerY + x * sin + y * cos];
}
function drawForest(p: Canvas, layer: Layer): void {
  const q = layer.params, trees = graphForest(q, layer.seed), cols = number(q, "columns"), rows = number(q, "rows");
  const at = (vertex: number): Point => latticeVertexPosition(vertex, cols, rows, number(q, "spacing"), number(q, "spacing"),
    number(q, "centerX"), number(q, "centerY"), number(q, "orientation"));
  const random = new JavaRandom(layer.seed ^ 0x3f234ab2), weight = number(q, "weight"), dotSize = number(q, "dotSize");
  p.noFill();
  for (const tree of trees) {
    if (weight > 0) p.strokeWeight(weight);
    for (const [a, b] of tree.edges) {
      const child = tree.parents[b] === a ? b : a;
      const visible = random.nextDouble() < number(q, "branchRetention");
      const depth = tree.depths[child];
      if (!visible || depth < number(q, "minDepth") || depth > number(q, "maxDepth") || weight === 0) continue;
      const [x1, y1] = at(tree.vertices[a]), [x2, y2] = at(tree.vertices[b]);
      stroke(p, layer, depth + tree.component, 212); p.line(x1, y1, x2, y2);
    }
    if (q.nodes && dotSize > 0) {
      p.noStroke();
      for (let i = 0; i < tree.vertices.length; i++) {
        if (tree.depths[i] < number(q, "minDepth") || tree.depths[i] > number(q, "maxDepth")) continue;
        fill(p, layer, tree.depths[i] + tree.component, 225);
        p.circle(...at(tree.vertices[i]), dotSize);
      }
    }
  }
}
function drawGrammar(p: Canvas, layer: Layer): void {
  const q = layer.params, plan = grammar(q, layer.technique === "woven-grammar" ? "iterations" : "depth");
  const rewritten = parallelTokenRewrite({ axiom: plan.axiom, rules: plan.rules,
    iterations: plan.generations, maxTokens: GRAMMAR_TOKEN_BUDGET, maxWork: GRAMMAR_WORK_BUDGET }).tokens;
  const angle = number(q, "angle") * Math.PI / 180;
  const result = tokenTurtle2D({ tokens: rewritten, commands: [
    { token: "F", kind: "DRAW", distance: number(q, "step") },
    { token: "G", kind: "DRAW", distance: number(q, "step") * number(q, "contraction") },
    { token: "+", kind: "TURN", angle }, { token: "-", kind: "TURN", angle: -angle },
    { token: "[", kind: "PUSH" }, { token: "]", kind: "POP" },
  ], start: { position: [number(q, "startX"), number(q, "startY")], heading: number(q, "heading") * Math.PI / 180 },
    unknown: "IGNORE", maxSegments: GRAMMAR_TOKEN_BUDGET, maxStackDepth: 128, maxWork: GRAMMAR_WORK_BUDGET });
  const weight = number(q, "weight"), ticks = q.ticks && number(q, "tickLength") > 0;
  p.noFill();
  for (let i = 0; i < result.segments.length; i++) {
    const [x1, y1, x2, y2] = result.segments[i];
    if (weight > 0) {
      stroke(p, layer, result.depths[i] + Math.floor(i / 16), 220); p.strokeWeight(weight);
      p.line(x1, y1, x2, y2);
    }
    if (ticks) {
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length > 0) {
        const dx = (y1 - y2) / length * number(q, "tickLength") / 2;
        const dy = (x2 - x1) / length * number(q, "tickLength") / 2;
        stroke(p, layer, result.depths[i] + 1, 190); p.strokeWeight(Math.max(.4, weight * .55));
        p.line((x1 + x2) / 2 - dx, (y1 + y2) / 2 - dy, (x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy);
      }
    }
    if (q.nodes && number(q, "dotSize") > 0) {
      p.noStroke(); fill(p, layer, result.depths[i] + 1, 225); p.circle(x2, y2, number(q, "dotSize"));
    }
  }
}
export function drawGraphGrammarInstrument(p: Canvas, layer: Layer): void {
  if (layer.technique === "maze-gardens" || layer.technique === "branching-networks") drawForest(p, layer);
  else if (layer.technique === "woven-grammar" || layer.technique === "recursive-tiles" || layer.technique === "turtle-canopies") drawGrammar(p, layer);
  else throw Error(`Unknown graph/grammar instrument ${layer.technique}`);
}
