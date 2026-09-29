import { dataTable } from "./data-table.js";
import type { DataTable, DataTableInput } from "./data-table.js";

/**
 * Bundled relationship samples: small, fixed and deterministic, so the instrument works with no asset
 * store. Each is a pair of owned tables: a node table (`group` category, `x`/`y` map position in the
 * unit square) and an edge table (`from`/`to` categorical over the node ids, `flow` measure). They are
 * illustrative samples produced once by the fixed integer-hash recipe below (no randomness, no
 * platform-dependent arithmetic beyond rounding), not measurements from a real source.
 *
 * Every sample has exactly six groups so a control that names a group by position works with any
 * sample. An edge table holds one row per unordered pair of nodes (a graph is simple): where two
 * places exchange flow in both directions the row records the net flow's direction.
 */
export interface RelationSample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** True when each edge's `from → to` is meaningful (a flow). */
  readonly directed: boolean;
  readonly nodes: DataTable;
  readonly edges: DataTable;
  /** Unit of the `flow` column, for keys and captions. */
  readonly unit: string;
}

/** Column names shared by every bundled sample. */
export const relationColumns = { group: "group", x: "x", y: "y", from: "from", to: "to", flow: "flow" } as const;

/** Uniform [0, 1) value from two integers and a salt; pure integer mixing. */
function mix(a: number, b: number, salt: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + salt * 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 0x1_0000_0000;
}
const round3 = (value: number) => Math.round(value * 1000) / 1000;

interface Recipe {
  readonly id: string; readonly title: string; readonly description: string; readonly directed: boolean; readonly unit: string;
  readonly groups: readonly string[];
  readonly sizes: readonly number[];
  /** Group centres in the unit square and the radius the group's nodes are scattered within. */
  readonly centres: readonly (readonly [number, number])[];
  readonly spread: number;
  readonly prefix: readonly string[];
  /** Chance of an edge between two nodes of groups a and b (a === b for within-group). */
  readonly chance: (a: number, b: number) => number;
  /** Flow of an edge from a uniform draw and the two node indices. */
  readonly flow: (draw: number, a: number, b: number) => number;
  readonly salt: number;
}

function build(recipe: Recipe): RelationSample {
  const ids: string[] = [], group: string[] = [], groupOf: number[] = [], x: number[] = [], y: number[] = [];
  recipe.groups.forEach((name, g) => {
    for (let k = 0; k < recipe.sizes[g]; k++) {
      const n = ids.length;
      ids.push(`${recipe.prefix[g]}${k + 1}`); group.push(name); groupOf.push(g);
      const angle = (k + mix(g, k, recipe.salt) * .6) / recipe.sizes[g] * 2 * Math.PI;
      const radius = recipe.spread * (.35 + .65 * mix(n, g, recipe.salt + 1));
      x.push(round3(recipe.centres[g][0] + radius * Math.cos(angle)));
      y.push(round3(recipe.centres[g][1] + radius * Math.sin(angle)));
    }
  });
  const edgeIds: string[] = [], from: string[] = [], to: string[] = [], flow: number[] = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    if (mix(a, b, recipe.salt + 2) >= recipe.chance(groupOf[a], groupOf[b])) continue;
    const value = recipe.flow(mix(a, b, recipe.salt + 3), a, b);
    // Net flow direction for directed samples; undirected samples keep table order.
    const forward = !recipe.directed || mix(a, b, recipe.salt + 4) < .5;
    const [u, v] = forward ? [a, b] : [b, a];
    edgeIds.push(`${ids[u]}${recipe.directed ? ">" : "-"}${ids[v]}`); from.push(ids[u]); to.push(ids[v]); flow.push(value);
  }
  const nodeInput: DataTableInput = { id: `${recipe.id}-nodes`, title: `${recipe.title} places`, rowIds: ids, columns: [
    { name: "group", kind: "categorical", categories: recipe.groups, values: group },
    { name: "x", kind: "continuous", unit: "map units", values: x },
    { name: "y", kind: "continuous", unit: "map units", values: y },
  ] };
  const edgeInput: DataTableInput = { id: `${recipe.id}-edges`, title: `${recipe.title} flows`, rowIds: edgeIds, columns: [
    { name: "from", kind: "categorical", categories: ids, values: from },
    { name: "to", kind: "categorical", categories: ids, values: to },
    { name: "flow", kind: "continuous", unit: recipe.unit, values: flow },
  ] };
  return Object.freeze({ id: recipe.id, title: recipe.title, description: recipe.description, directed: recipe.directed,
    nodes: dataTable(nodeInput), edges: dataTable(edgeInput), unit: recipe.unit });
}

const ring = (count: number, radius: number, cx = .5, cy = .5, phase = -Math.PI / 2): (readonly [number, number])[] =>
  Array.from({ length: count }, (_, i) => [round3(cx + radius * Math.cos(phase + i * 2 * Math.PI / count)), round3(cy + radius * Math.sin(phase + i * 2 * Math.PI / count))] as const);

const recipes: readonly Recipe[] = [
  {
    id: "ferries", title: "Island ferries", directed: true, unit: "passengers / week", salt: 11,
    description: "Thirty ports on six islands; most sailings stay within an island, a few strong lines cross between neighbouring islands.",
    groups: ["Amber", "Birch", "Cinder", "Dune", "Ember", "Fjord"], prefix: ["am", "bi", "ci", "du", "em", "fj"],
    sizes: [5, 4, 6, 5, 5, 5],
    centres: [[.2, .28], [.5, .14], [.82, .3], [.8, .72], [.48, .86], [.17, .7]], spread: .11,
    chance: (a, b) => a === b ? .62 : (Math.abs(a - b) === 1 || Math.abs(a - b) === 5) ? .2 : .06,
    flow: (draw, a, b) => Math.round(40 + 960 * draw * draw * draw + 6 * ((a * 7 + b * 3) % 5)),
  },
  {
    id: "commuters", title: "Commuter districts", directed: true, unit: "commuters / day", salt: 29,
    description: "Forty-eight zones in six districts; net daily flows are heavy inside a district and follow the ring road between neighbours.",
    groups: ["North", "Harbour", "Mill", "South", "Heath", "Quarter"], prefix: ["no", "ha", "mi", "so", "he", "qu"],
    sizes: [8, 8, 8, 8, 8, 8], centres: ring(6, .32), spread: .13,
    chance: (a, b) => a === b ? .5 : (Math.abs(a - b) === 1 || Math.abs(a - b) === 5) ? .17 : .08,
    flow: (draw, a, b) => Math.round(30 + 1470 * draw ** 4 + 4 * ((a + b) % 7)),
  },
  {
    id: "citations", title: "Field citations", directed: false, unit: "shared citations", salt: 47,
    description: "Sixty papers in six fields; citations gather inside a field and thin out toward neighbouring fields.",
    groups: ["Optics", "Acoustics", "Materials", "Fluids", "Signals", "Geometry"], prefix: ["op", "ac", "ma", "fl", "si", "ge"],
    sizes: [10, 10, 10, 10, 10, 10], centres: ring(6, .3), spread: .12,
    chance: (a, b) => a === b ? .3 : (Math.abs(a - b) === 1 || Math.abs(a - b) === 5) ? .055 : .012,
    flow: (draw) => 1 + Math.floor(8 * draw * draw),
  },
];

export const relationSampleIds: readonly string[] = recipes.map((recipe) => recipe.id);
const cache = new Map<string, RelationSample>();
/** The frozen bundled sample, or an error naming the available ids. */
export function relationSample(id: string): RelationSample {
  let sample = cache.get(id);
  if (!sample) {
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) throw new Error(`Unknown relationship sample "${id}"; available: ${relationSampleIds.join(", ")}`);
    sample = build(recipe);
    cache.set(id, sample);
  }
  return sample;
}
/** Titles in id order, for control labels. */
export const relationSampleTitles: readonly (readonly [id: string, title: string])[] = recipes.map((recipe) => [recipe.id, recipe.title] as const);
/** Group names of a bundled sample, in declared order (every sample has six). */
export const relationGroupNames: readonly (readonly string[])[] = recipes.map((recipe) => recipe.groups);
