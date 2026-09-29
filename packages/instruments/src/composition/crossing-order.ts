import { componentSeed } from "./core.js";
import type { Crossing, CrossingSet, CrossingSide } from "./crossings.js";

/**
 * Over/under assignment for a `CrossingSet`: which of the two strands of each crossing passes over.
 *
 * RULES (`CrossingOrderOptions.rule`)
 *  - `alternate`: along every path the crossings alternate over, under, over, ... (cyclically for a
 *    closed path). This is a system of parity constraints between crossings, solved exactly
 *    (union-find with parity). Every connected component of crossings has exactly two consistent
 *    assignments; which one is decided per component by a seeded coin drawn from the component's
 *    smallest crossing id (`componentSeed(seed, id, "phase")`), so it never depends on traversal
 *    order, filtering or appearance. Where the constraints are contradictory (a closed path with an
 *    odd number of crossing occurrences, typically an open strand entering a loop), the
 *    contradictory constraints are reported as `unavoidable` breaks and the rest are still met;
 *    which of the equivalent edges is dropped is fixed by (path order, arc length).
 *  - `seeded`: each crossing is an independent coin, `componentSeed(seed, crossing.id, "over")`.
 *  - `rank`: the strand with the higher rank is over. Ranks are per path index (default: the path
 *    index, so later paths lie over earlier ones). Equal ranks (including a path crossing itself)
 *    are decided by the seeded coin.
 * Then `flips` (crossing ids whose over/under is reversed: the explicit exceptions) and `invert`
 * (reverses every crossing: the mirror weave) are applied. An unknown id in `flips` is an error.
 *
 * OUTPUT. `over[i]` is 0 when the crossing's `first` side is over, 1 when `second` is.
 * `breaks` lists every pair of consecutive occurrences along a path with the same state, with a
 * cause: `exception` (a flipped crossing is involved), `unavoidable` (alternate rule, contradictory
 * constraints) or `rule` (the rule does not alternate). Under the alternate rule with no flips,
 * the breaks are exactly `unavoidable`. `feasible` is true when alternation is achievable
 * everywhere, whatever the rule or flips.
 *
 * Results are frozen and cached on the identity of the `CrossingSet` and the options; ids come from
 * the crossings, so an appearance edit cannot rename or reorder anything here.
 */
export type OverRule = "alternate" | "seeded" | "rank";
export interface CrossingOrderOptions {
  rule: OverRule;
  seed: number;
  /** Per path index; higher goes over. Only used by the `rank` rule. */
  ranks?: readonly number[];
  /** Crossing ids to reverse after the rule. */
  flips?: readonly string[];
  invert?: boolean;
}
export interface Occurrence {
  readonly crossing: number;
  /** 0: the crossing's `first` side, 1: its `second` side. */
  readonly side: 0 | 1;
  readonly s: number;
}
export interface AlternationBreak {
  readonly path: number;
  readonly pathId: string;
  readonly before: string;
  readonly after: string;
  readonly cause: "exception" | "unavoidable" | "rule";
}
export interface CrossingOrder {
  readonly rule: OverRule;
  readonly over: readonly (0 | 1)[];
  /** Crossing indices in path order along each path (arc length, then crossing index). */
  readonly occurrences: readonly (readonly Occurrence[])[];
  readonly breaks: readonly AlternationBreak[];
  readonly unavoidable: readonly { readonly path: number; readonly pathId: string; readonly before: string; readonly after: string }[];
  readonly feasible: boolean;
  /** Indices of the flipped crossings. */
  readonly flipped: readonly number[];
}

const cache = new WeakMap<CrossingSet, Map<string, CrossingOrder>>();
const U32 = 0x1_0000_0000;
const coin = (seed: number, id: string, purpose: string) => componentSeed(seed, id, purpose) / U32 < 0.5 ? 1 : 0;

/** Path-ordered occurrences of the crossings along every path. */
function occurrencesOf(set: CrossingSet): Occurrence[][] {
  const lists: Occurrence[][] = set.paths.map(() => []);
  for (const crossing of set.crossings) {
    lists[crossing.first.path].push({ crossing: crossing.index, side: 0, s: crossing.first.s });
    lists[crossing.second.path].push({ crossing: crossing.index, side: 1, s: crossing.second.s });
  }
  for (const list of lists) list.sort((a, b) => a.s - b.s || a.crossing - b.crossing || a.side - b.side);
  return lists;
}

/** The two strands of a crossing as (over, under). */
export function strandRoles(order: CrossingOrder, crossing: Crossing): { over: CrossingSide; under: CrossingSide } {
  return order.over[crossing.index] === 0 ? { over: crossing.first, under: crossing.second } : { over: crossing.second, under: crossing.first };
}

export function orderCrossings(set: CrossingSet, options: CrossingOrderOptions): CrossingOrder {
  const { rule, seed, ranks, flips = [], invert = false } = options;
  if (rule !== "alternate" && rule !== "seeded" && rule !== "rank") throw new Error(`Unknown crossing rule: ${String(rule)}`);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Crossing order seed must be a uint32 integer");
  if (ranks && ranks.length !== set.paths.length) throw new Error(`ranks needs one entry per path (${set.paths.length}), got ${ranks.length}`);
  const key = JSON.stringify([rule, seed, rule === "rank" ? ranks ?? null : null, [...flips].sort(), invert]);
  let byKey = cache.get(set);
  const hit = byKey?.get(key);
  if (hit) return hit;

  const { crossings } = set, count = crossings.length;
  const lists = occurrencesOf(set);
  // Parity union-find over crossings: parity[i] = x_i xor x_parent(i), x_i = 1 when `first` is over.
  const parent = Int32Array.from({ length: count }, (_, i) => i), parity = new Uint8Array(count);
  const find = (i: number): number => {
    let root = i, toRoot = 0;
    while (parent[root] !== root) { toRoot ^= parity[root]; root = parent[root]; }
    // Point every node on the way directly at the root, keeping its parity to it.
    for (let node = i, known = toRoot; node !== root && parent[node] !== root;) {
      const next = parent[node], step = parity[node];
      parent[node] = root; parity[node] = known; known ^= step; node = next;
    }
    return root;
  };
  const unavoidable: { path: number; pathId: string; before: string; after: string }[] = [];
  for (let p = 0; p < lists.length; p++) {
    const list = lists[p], closed = set.paths[p].closed;
    const edges = closed ? list.length : list.length - 1;
    for (let k = 0; k < edges; k++) {
      const a = list[k], b = list[(k + 1) % list.length];
      // over(o) = x xor side; consecutive occurrences must differ.
      const want = 1 ^ a.side ^ b.side;
      const ra = find(a.crossing), rb = find(b.crossing);
      if (ra === rb) {
        if ((parity[a.crossing] ^ parity[b.crossing]) !== want)
          unavoidable.push({ path: p, pathId: set.paths[p].id, before: crossings[a.crossing].id, after: crossings[b.crossing].id });
      } else {
        parent[ra] = rb;
        parity[ra] = parity[a.crossing] ^ parity[b.crossing] ^ want;
      }
    }
  }
  const over: (0 | 1)[] = new Array(count);
  const phase = new Map<number, number>();
  if (rule === "alternate") {
    const smallest = new Map<number, string>();
    for (let i = 0; i < count; i++) {
      const root = find(i), id = crossings[i].id, known = smallest.get(root);
      if (known === undefined || id < known) smallest.set(root, id);
    }
    for (const [root, id] of smallest) phase.set(root, coin(seed, id, "phase"));
  }
  for (let i = 0; i < count; i++) {
    const crossing = crossings[i];
    let firstOver: number;
    if (rule === "alternate") { const root = find(i); firstOver = parity[i] ^ phase.get(root)!; }
    else if (rule === "seeded") firstOver = coin(seed, crossing.id, "over");
    else {
      const ra = ranks ? ranks[crossing.first.path] : crossing.first.path, rb = ranks ? ranks[crossing.second.path] : crossing.second.path;
      firstOver = ra > rb ? 1 : ra < rb ? 0 : coin(seed, crossing.id, "over");
    }
    over[i] = firstOver ? 0 : 1;
  }
  const flipIds = new Map(crossings.map((crossing) => [crossing.id, crossing.index]));
  const flipped: number[] = [];
  for (const id of new Set(flips)) {
    const index = flipIds.get(id);
    if (index === undefined) throw new Error(`Unknown crossing id in flips: ${id}`);
    flipped.push(index);
    over[index] = over[index] === 0 ? 1 : 0;
  }
  flipped.sort((a, b) => a - b);
  if (invert) for (let i = 0; i < count; i++) over[i] = over[i] === 0 ? 1 : 0;

  const isFlipped = new Set(flipped), breaks: AlternationBreak[] = [];
  for (let p = 0; p < lists.length; p++) {
    const list = lists[p], closed = set.paths[p].closed;
    const pairs = closed ? list.length : list.length - 1;
    for (let k = 0; k < pairs; k++) {
      const a = list[k], b = list[(k + 1) % list.length];
      const stateA = over[a.crossing] === a.side ? 1 : 0, stateB = over[b.crossing] === b.side ? 1 : 0;
      if (stateA !== stateB) continue;
      const cause = isFlipped.has(a.crossing) || isFlipped.has(b.crossing) ? "exception" : rule === "alternate" ? "unavoidable" : "rule";
      breaks.push(Object.freeze({ path: p, pathId: set.paths[p].id, before: crossings[a.crossing].id, after: crossings[b.crossing].id, cause }));
    }
  }
  const result: CrossingOrder = Object.freeze({
    rule, over: Object.freeze(over), occurrences: Object.freeze(lists.map((list) => Object.freeze(list.map((o) => Object.freeze(o))))),
    breaks: Object.freeze(breaks), unavoidable: Object.freeze(unavoidable.map((u) => Object.freeze(u))),
    feasible: unavoidable.length === 0, flipped: Object.freeze(flipped),
  });
  if (!byKey) cache.set(set, byKey = new Map());
  if (byKey.size >= 6) byKey.delete(byKey.keys().next().value!);
  byKey.set(key, result);
  return result;
}
