/**
 * Learn a `visibleWhen` condition (alternatives, numeric thresholds) from measured relevance.
 *
 * The audit labels sampled configurations "the control mattered here" or "it did not". This turns
 * those labels into a disjunction of conjunctions over select/boolean values and number
 * thresholds, then locates every threshold on the real drawing, not on the sample midpoints, by
 * bisecting the control's relevance along the driver. It only reports what it can place exactly:
 * the literal is a verified-irrelevant value at a round number, so the condition may show a
 * control marginally too long (never more than 1/4096 of the driver's range) and cannot hide one
 * the measurement showed matters. Everything else is left to the caller as "not expressible".
 */
import type { Parameter, VisibilityCondition, VisibleWhen } from "../../dist/index.js";

export type Scalar = string | number | boolean;
export type Values = Record<string, Scalar>;
export type Sample = { values: Values; relevant: boolean };
/** Measured relevance at one configuration: true, false, or undefined when it cannot be measured (invalid, untestable). */
export type Oracle = (values: Values) => boolean | undefined;

/** A conjunction: discrete drivers take one of a set of values; numeric drivers lie strictly above `lower` and/or below `upper`. */
export type Cube = { discrete: Map<string, Set<Scalar>>; lower: Map<string, number>; upper: Map<string, number> };

const MAX_LITERALS = 4, MAX_CUBES = 5, RESTARTS = 12;

export const legalValues = (driver: Parameter): Scalar[] => driver.type === "boolean" ? [false, true] : (driver.options ?? []).map((option) => option.value);
export const isInteger = (driver: Parameter): boolean => driver.integer ?? driver.step === 1;
export const hardRange = (driver: Parameter): { low: number; high: number } => ({ low: driver.hardMin ?? driver.min!, high: driver.hardMax ?? driver.max! });

export function covers(cube: Cube, values: Values): boolean {
  for (const [key, allowed] of cube.discrete) if (!allowed.has(values[key])) return false;
  for (const [key, bound] of cube.lower) if (!((values[key] as number) > bound)) return false;
  for (const [key, bound] of cube.upper) if (!((values[key] as number) < bound)) return false;
  return true;
}
const literalCount = (cube: Cube): number => cube.discrete.size + cube.lower.size + cube.upper.size;
const cloneCube = (cube: Cube): Cube => ({ discrete: new Map([...cube.discrete].map(([key, set]) => [key, new Set(set)])), lower: new Map(cube.lower), upper: new Map(cube.upper) });

/**
 * Merge cubes that differ in the values of a single select/boolean driver (same drivers, same
 * numeric bounds): their union is exactly the cube with that driver's value sets united.
 */
function merge(cubes: Cube[]): void {
  const signature = (cube: Cube) => JSON.stringify([[...cube.discrete.keys()].sort(), [...cube.lower].sort(), [...cube.upper].sort()]);
  for (let merged = true; merged;) {
    merged = false;
    for (let a = 0; a < cubes.length && !merged; a++) for (let b = a + 1; b < cubes.length && !merged; b++) {
      if (signature(cubes[a]) !== signature(cubes[b])) continue;
      const differing = [...cubes[a].discrete.keys()].filter((key) => {
        const left = cubes[a].discrete.get(key)!, right = cubes[b].discrete.get(key)!;
        return left.size !== right.size || [...left].some((value) => !right.has(value));
      });
      if (differing.length > 1) continue;
      for (const key of differing) for (const value of cubes[b].discrete.get(key)!) cubes[a].discrete.get(key)!.add(value);
      cubes.splice(b, 1);
      merged = true;
    }
  }
}

/**
 * Cover every positive sample with cubes that contain no negative sample. One attempt grows each
 * cube from a seed positive by the literal that excludes the most negatives (ties: the one that
 * keeps the most uncovered positives), widens its value sets as far as the negatives allow, then
 * drops any literal that is not needed. Several attempts start from different seeds and the
 * shortest cover wins. Undefined when the labels cannot be explained by a few short conjunctions.
 */
export function learnCubes(samples: readonly Sample[], discrete: readonly Parameter[], numeric: readonly Parameter[], why?: (message: string) => void, tolerance = 0.1): Cube[] | undefined {
  const positives = samples.filter((sample) => sample.relevant), negatives = samples.filter((sample) => !sample.relevant);
  if (positives.length === 0 || negatives.length === 0) return undefined;
  const midpoints = new Map<string, number[]>();
  for (const driver of numeric) {
    const seen = [...new Set(samples.map((sample) => sample.values[driver.key] as number))].sort((a, b) => a - b);
    midpoints.set(driver.key, seen.slice(1).map((value, index) => (seen[index] + value) / 2));
  }
  // Over-showing is safe (a shown control that does not matter breaks nothing), so a cube may cover a few
  // negatives: relevance is chaotic in the numbers (a tiny drawing changes nothing), and refutation, not
  // an exact fit to noisy labels, decides whether the hidden region is really irrelevant.
  const allowed = Math.floor(tolerance * negatives.length);
  const size = (cover: readonly Cube[]) => cover.reduce((sum, cube) => sum + literalCount(cube), 0);
  const attempt = (order: readonly Sample[], report?: (message: string) => void): Cube[] | undefined => {
    const cubes: Cube[] = [];
    let uncovered = order;
    while (uncovered.length > 0) {
      const seed = uncovered[0].values;
      let cube: Cube = { discrete: new Map(), lower: new Map(), upper: new Map() };
      let live = negatives;
      while (live.length > allowed) {
        const choice: { excluded: number; keeps: number; apply: () => void }[] = [];
        const offer = (excluded: number, keeps: number, apply: () => void) => {
          if (excluded > 0 && (choice.length === 0 || excluded > choice[0].excluded || (excluded === choice[0].excluded && keeps > choice[0].keeps))) choice[0] = { excluded, keeps, apply };
        };
        for (const driver of discrete) {
          if (cube.discrete.has(driver.key)) continue;
          offer(live.filter((sample) => sample.values[driver.key] !== seed[driver.key]).length,
            uncovered.filter((sample) => sample.values[driver.key] === seed[driver.key]).length,
            () => { cube.discrete.set(driver.key, new Set([seed[driver.key]])); });
        }
        for (const driver of numeric) {
          const seedValue = seed[driver.key] as number, thresholds = midpoints.get(driver.key)!;
          const value = (sample: Sample) => sample.values[driver.key] as number;
          if (!cube.lower.has(driver.key)) {
            let top = 0, chosen = 0;
            for (const threshold of thresholds) {
              if (threshold >= seedValue) break;
              const excluded = live.filter((sample) => !(value(sample) > threshold)).length;
              if (excluded > top) { top = excluded; chosen = threshold; }
            }
            if (top > 0) offer(top, uncovered.filter((sample) => value(sample) > chosen).length, () => { cube.lower.set(driver.key, chosen); });
          }
          if (!cube.upper.has(driver.key)) {
            let top = 0, chosen = 0;
            for (let index = thresholds.length - 1; index >= 0; index--) {
              const threshold = thresholds[index];
              if (threshold <= seedValue) break;
              const excluded = live.filter((sample) => !(value(sample) < threshold)).length;
              if (excluded > top) { top = excluded; chosen = threshold; }
            }
            if (top > 0) offer(top, uncovered.filter((sample) => value(sample) < chosen).length, () => { cube.upper.set(driver.key, chosen); });
          }
        }
        if (choice.length === 0) { // a negative sample is indistinguishable from the seed
          const twin = live[0].values;
          report?.(`negative twin of a positive: ${JSON.stringify(Object.fromEntries(Object.keys(seed).filter((key) => seed[key] !== twin[key]).map((key) => [key, [seed[key], twin[key]]])))}`);
          return undefined;
        }
        choice[0].apply();
        live = live.filter((sample) => covers(cube, sample.values));
        if (literalCount(cube) > MAX_LITERALS) { report?.(`more than ${MAX_LITERALS} literals: ${JSON.stringify([...cube.discrete.keys(), ...cube.lower.keys(), ...cube.upper.keys()])}`); return undefined; }
      }
      // Widen value sets to every value no negative sample contradicts.
      for (const driver of discrete) {
        const allowedValues = cube.discrete.get(driver.key);
        if (!allowedValues) continue;
        for (const value of legalValues(driver)) {
          if (allowedValues.has(value)) continue;
          allowedValues.add(value);
          if (negatives.filter((sample) => covers(cube, sample.values)).length > allowed) allowedValues.delete(value);
        }
      }
      // Drop any literal the negatives do not need.
      const trimmed = (drop: (candidate: Cube) => void): void => {
        const candidate = cloneCube(cube);
        drop(candidate);
        if (negatives.filter((sample) => covers(candidate, sample.values)).length <= allowed) cube = candidate;
      };
      for (const key of [...cube.discrete.keys()]) trimmed((candidate) => candidate.discrete.delete(key));
      for (const key of [...cube.lower.keys()]) trimmed((candidate) => candidate.lower.delete(key));
      for (const key of [...cube.upper.keys()]) trimmed((candidate) => candidate.upper.delete(key));
      for (const driver of discrete) if (cube.discrete.get(driver.key)?.size === legalValues(driver).length) cube.discrete.delete(driver.key);
      if (literalCount(cube) === 0) return undefined;
      cubes.push(cube);
      uncovered = uncovered.filter((sample) => !covers(cube, sample.values));
      if (cubes.length > MAX_CUBES) { report?.(`more than ${MAX_CUBES} alternatives`); return undefined; }
    }
    // A cube whose positives are all covered by the others adds nothing.
    for (let index = cubes.length - 1; index >= 0 && cubes.length > 1; index--) {
      const others = cubes.filter((_, other) => other !== index);
      if (positives.every((sample) => others.some((cube) => covers(cube, sample.values)))) cubes.splice(index, 1);
    }
    merge(cubes);
    const leaked = negatives.filter((sample) => cubes.some((cube) => covers(cube, sample.values))).length;
    if (leaked > Math.ceil(0.35 * negatives.length)) { report?.(`the cover still shows ${leaked} of ${negatives.length} negatives`); return undefined; }
    return cubes;
  };
  let best: Cube[] | undefined;
  let state = 12345;
  for (let round = 0; round < RESTARTS; round++) {
    const order = [...positives];
    if (round > 0) for (let index = order.length - 1; index > 0; index--) { // deterministic shuffle
      state = (Math.imul(state, 1103515245) + 12345) >>> 0;
      const other = state % (index + 1);
      [order[index], order[other]] = [order[other], order[index]];
    }
    const result = attempt(order, round === 0 ? why : undefined);
    if (result && (!best || result.length < best.length || (result.length === best.length && size(result) < size(best)))) best = result;
  }
  return best;
}

/**
 * Find where the control stops mattering as `driver` moves away from a value at which it matters,
 * holding everything else in `base`. Returns a round, verified-irrelevant literal `L` such that the
 * control matters only strictly beyond it (above `L` for a lower bound, below `L` for an upper one).
 */
function locate(oracle: Oracle, base: Values, driver: Parameter, side: "lower" | "upper"): number | undefined {
  const { low, high } = hardRange(driver), integer = isInteger(driver);
  const at = (value: number) => oracle({ ...base, [driver.key]: value });
  let relevant = base[driver.key] as number;
  let irrelevant = side === "lower" ? (integer ? Math.ceil(low) : low) : (integer ? Math.floor(high) : high);
  if (at(relevant) !== true || at(irrelevant) !== false) return undefined;
  const resolution = (high - low) / 4096;
  while (integer ? Math.abs(relevant - irrelevant) > 1 : Math.abs(relevant - irrelevant) > resolution) {
    const midpoint = (relevant + irrelevant) / 2;
    const mid = integer ? (irrelevant < relevant ? Math.floor(midpoint) : Math.ceil(midpoint)) : Math.round(midpoint * 1e9) / 1e9;
    const result = at(mid);
    if (result === undefined) return undefined;
    if (result) relevant = mid; else irrelevant = mid;
  }
  if (integer) return irrelevant;
  for (let decimals = 0; decimals <= 4; decimals++) {
    const scale = 10 ** decimals;
    const rounded = (side === "lower" ? Math.ceil(irrelevant * scale - 1e-9) : Math.floor(irrelevant * scale + 1e-9)) / scale;
    const inside = side === "lower" ? rounded >= irrelevant && rounded < relevant : rounded <= irrelevant && rounded > relevant;
    if (inside && (rounded === irrelevant || at(rounded) === false)) return rounded;
  }
  return Math.round(irrelevant * 1e4) / 1e4 === irrelevant ? irrelevant : undefined;
}

/**
 * Replace every sampled threshold by its located literal. Undefined when a threshold cannot be
 * located (relevance is not a clean function of that driver from any seed inside the cube) or
 * when the located cubes no longer separate the training samples.
 */
export function refineCubes(cubes: readonly Cube[], samples: readonly Sample[], numeric: readonly Parameter[], oracle: Oracle): Cube[] | undefined {
  const refined: Cube[] = [];
  for (const cube of cubes) {
    const next = cloneCube(cube);
    const seeds = samples.filter((sample) => sample.relevant && covers(cube, sample.values));
    for (const [key, map, side] of [...[...cube.lower.keys()].map((key) => [key, next.lower, "lower"] as const), ...[...cube.upper.keys()].map((key) => [key, next.upper, "upper"] as const)]) {
      const driver = numeric.find((entry) => entry.key === key)!;
      let literal: number | undefined;
      for (const seed of seeds.slice(0, 3)) { literal = locate(oracle, seed.values, driver, side); if (literal !== undefined) break; }
      // A threshold that cannot be placed exactly is dropped, which only widens the cube (over-shows).
      if (literal === undefined) map.delete(key); else map.set(key, literal);
    }
    if (next.discrete.size + next.lower.size + next.upper.size === 0) return undefined;
    refined.push(next);
  }
  for (const sample of samples) if (sample.relevant && !refined.some((cube) => covers(cube, sample.values))) return undefined;
  return refined;
}

/** The learned cubes as a `visibleWhen` value: one object for one cube, an array of alternatives otherwise. */
export function cubesToCondition(cubes: readonly Cube[], drivers: readonly Parameter[]): VisibleWhen | undefined {
  const alternatives: VisibilityCondition[] = [];
  for (const cube of cubes) {
    const alternative: VisibilityCondition = {};
    for (const driver of drivers) {
      const allowed = cube.discrete.get(driver.key);
      if (allowed) {
        const listed = legalValues(driver).filter((value) => allowed.has(value));
        if (listed.length < legalValues(driver).length) alternative[driver.key] = listed;
      }
      const lower = cube.lower.get(driver.key), upper = cube.upper.get(driver.key);
      if (lower !== undefined || upper !== undefined) {
        const integer = isInteger(driver);
        alternative[driver.key] = {
          ...(lower === undefined ? {} : integer ? { gte: lower + 1 } : { gt: lower }),
          ...(upper === undefined ? {} : integer ? { lte: upper - 1 } : { lt: upper }),
        };
      }
    }
    if (Object.keys(alternative).length === 0) return undefined;
    alternatives.push(alternative);
  }
  if (alternatives.length === 0) return undefined;
  alternatives.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return alternatives.length === 1 ? alternatives[0] : alternatives;
}

const holds = (entry: VisibilityCondition[string], value: unknown): boolean => {
  if (Array.isArray(entry)) return entry.includes(value as never);
  const comparison = entry as Record<string, number>;
  return typeof value === "number" && (comparison.lt === undefined || value < comparison.lt) && (comparison.lte === undefined || value <= comparison.lte)
    && (comparison.gt === undefined || value > comparison.gt) && (comparison.gte === undefined || value >= comparison.gte)
    && (comparison.eq === undefined || value === comparison.eq) && (comparison.ne === undefined || value !== comparison.ne);
};

/** Values worth trying for a driver against an entry: its options, or a number's range ends and the neighbourhood of each literal. */
function pool(driver: Parameter, entry: VisibilityCondition[string], random: () => number): Scalar[] {
  if (driver.type !== "number") return legalValues(driver);
  const { low, high } = hardRange(driver), integer = isInteger(driver), span = high - low;
  const literals = Object.values(entry as Record<string, number>);
  const raw = [low, high, low + span * random(), ...literals.flatMap((literal) => [literal, literal - span * 1e-3, literal + span * 1e-3, literal - 1, literal + 1])];
  return [...new Set(raw.map((value) => Math.min(high, Math.max(low, integer ? Math.round(value) : Math.round(value * 1e6) / 1e6))))];
}

/**
 * Move `values` to the edge of the hidden region: in each alternative one driver is set to a value
 * its entry rejects while the alternative's other drivers are set to values they accept, so the
 * alternative fails for exactly that one reason. Numeric drivers are pushed to the range ends and
 * just either side of each literal, which is where a mislocated threshold would show.
 */
export function violate(condition: VisibleWhen, parameters: readonly Parameter[], values: Values, random: () => number): void {
  const alternatives = Array.isArray(condition) ? condition as readonly VisibilityCondition[] : [condition as VisibilityCondition];
  for (const alternative of alternatives) {
    const keys = Object.keys(alternative), broken = keys[Math.floor(random() * keys.length)];
    for (const key of keys) {
      const driver = parameters.find((parameter) => parameter.key === key)!, entry = alternative[key];
      const choices = pool(driver, entry, random).filter((value) => holds(entry, value) === (key !== broken));
      if (choices.length > 0) values[key] = choices[Math.floor(random() * choices.length)];
    }
  }
}

/** Move `values` inside one random alternative of a condition: every driver it names takes a value its entry accepts. */
export function satisfy(condition: VisibleWhen, parameters: readonly Parameter[], values: Values, random: () => number): void {
  const alternatives = Array.isArray(condition) ? condition as readonly VisibilityCondition[] : [condition as VisibilityCondition];
  const alternative = alternatives[Math.floor(random() * alternatives.length)];
  for (const key of Object.keys(alternative)) {
    const driver = parameters.find((parameter) => parameter.key === key)!, entry = alternative[key];
    const choices = pool(driver, entry, random).filter((value) => holds(entry, value));
    if (choices.length > 0) values[key] = choices[Math.floor(random() * choices.length)];
  }
}
