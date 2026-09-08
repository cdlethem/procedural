import { seededCirclePlacement2D } from "../../src/circle-placements.js";
import { seededEndpointBranches2D } from "../../src/branch-tree.js";

/** Editable endpoint branches, independently composed as in the project-owned Java example.
 * Motivation: survey/out/2018/Generativos/arbolito3/notes.md and arbolito4/notes.md.
 * Rule schedules, root placement and the work bound are example choices, not public defaults
 * or measured recommended ranges. Forest placement does not separate branch canopies.
 */
export function createBranchComposition(seed, moreGenerations, narrowing, binary, wider, forest) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff ||
      typeof moreGenerations !== "boolean" || typeof narrowing !== "boolean" ||
      typeof binary !== "boolean" || typeof wider !== "boolean" || typeof forest !== "boolean")
    throw new Error("example seed and flags are invalid");
  const transitions = (forest ? 5 : 7) + (moreGenerations ? 1 : 0);
  const slots = binary ? 2 : 3;
  let generationBound = 1, perTreeBound = 1;
  for (let generation = 0; generation < transitions; generation += 1) {
    generationBound *= slots;
    perTreeBound += generationBound;
  }
  const maximumRoots = forest ? 10 : 1;
  if (perTreeBound * maximumRoots > 20_000) throw new Error("example exceeds 20000-segment work budget");
  const rules = makeRules(transitions, narrowing, binary, wider);
  const trees = [];
  if (forest) {
    const roots = seededCirclePlacement2D({ seed, attempts: maximumRoots,
      origin: [70, 220], extent: [500, 320], radiusRange: [30, 50], separationScale: 1 });
    const origin = new Float64Array(2);
    for (let index = 0; index < roots.size; index += 1) {
      roots.pointInto(index, origin, 0);
      trees.push(generate((seed + index) >>> 0, origin[0], origin[1], roots.radiusAt(index), rules, perTreeBound));
    }
  } else trees.push(generate(seed, 320, 590, 100, rules, perTreeBound));
  const owned = trees.slice();
  return Object.freeze({ size: owned.length,
    totalSegments: owned.reduce((total, tree) => total + tree.size, 0),
    treeAt(index) { return owned[index]; } });
}

function generate(seed, x, y, length, rules, maximum) {
  return seededEndpointBranches2D({ seed, root: { origin: [x, y], heading: -Math.PI / 2, length }, rules, maxSegments: maximum });
}

function makeRules(transitions, narrowing, binary, wider) {
  const rules = [];
  for (let generation = 0; generation < transitions; generation += 1) {
    const base = binary ? (wider ? 0.18 : 0.09) : (wider ? 0.9 : 0.5);
    const spread = narrowing ? base * (1 - 0.08 * generation) : base;
    const slots = [
      { probability: binary ? 0.8 : 0.7, turn: [-spread, -0.5 * spread] },
      { probability: binary ? 0.8 : 0.7, turn: [0.5 * spread, spread] },
    ];
    if (!binary) slots.push({ probability: 0.4, turn: [-0.2 * spread, 0.2 * spread] });
    rules.push({ lengthScale: [0.65, 0.85], slots });
  }
  return rules;
}
