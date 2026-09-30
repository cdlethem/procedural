/**
 * Measure which controls matter under which selections.
 *
 * For each instrument the discrete controls (select and boolean) are the "drivers". The audit draws
 * the instrument under combinations of driver values (all of them when there are few, a fixed
 * sample otherwise), and under each one changes every other control to a few different valid
 * values. A control whose change never alters the drawing is *irrelevant* in that combination.
 * If irrelevance depends only on one or two drivers and the relevant combinations form a product
 * set, that is a `visibleWhen` condition.
 *
 * Controls that are left (irrelevant everywhere sampled at default numbers, a disjunction, or
 * dependent on a number) go through a second stage (`audit-learn.ts`): configurations with the
 * numbers moved around are labelled by whether changing the control changes the drawing, a
 * disjunction of conjunctions over select/boolean values and number thresholds is fitted, every
 * threshold is located on the real drawing by bisection, and the result is written as a proposal
 * only if `validateVisibility` accepts it, effective visibility still shows the control everywhere
 * it mattered, and randomized refutation aimed at each alternative's boundary finds no hidden
 * configuration where the control changes the drawing. Anything else stays reported, not guessed.
 *
 *   npx tsx tests/helpers/audit-controls.ts [--out report.json] [--workers 16] [id ...]
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInstrument, definition, definitions, validateParameters, validateVisibility, visibleParameters } from "../../dist/index.js";
import type { InstrumentDefinition, InstrumentInput, Parameter, VisibleWhen } from "../../dist/index.js";
import { visibleParameters as visibleOf } from "../../dist/visibility.js";
import { drawFingerprint } from "./draw-fingerprint.ts";
import { cubesToCondition, learnCubes, refineCubes, satisfy, violate, type Sample } from "./audit-learn.ts";

type Values = InstrumentInput["params"];
type Scalar = string | number | boolean;
type Condition = Record<string, Scalar[]>;
export type InstrumentAudit = {
  id: string; drivers: string[]; contexts: number; exhaustive: boolean; probes: number; skipped: number;
  /** Conditions the measurement supports, as `visibleWhen` values (an object, or an array of alternatives). */
  proposals: Record<string, VisibleWhen>;
  /** The proposals found by the second stage (alternatives and/or number thresholds); the rest are plain conjunctions. */
  learned: string[];
  /** Irrelevant in every sampled context; only trustworthy when `exhaustive`, and never a numeric-disable case. */
  dead: string[];
  /** Relevance is a function of the discrete selections but is a disjunction, not a product (needs OR). */
  disjunctive: string[];
  /** Relevance is not decided by the discrete selections alone (e.g. a numeric amount of zero disables it). */
  numeric: string[];
  unknown: string[];
  violations: { key: string; context: Values }[]; alwaysRelevant: number; controls: number;
};

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const valuesOf = (driver: Parameter): Scalar[] => driver.type === "boolean" ? [false, true] : (driver.options ?? []).map((option) => option.value);

/** A few valid alternative values for a control, distinct from its current one. */
function candidates(parameter: Parameter, current: Scalar): Scalar[] {
  if (parameter.type === "boolean") return [!current];
  if (parameter.type === "select") return valuesOf(parameter).filter((value) => value !== current).slice(0, 4);
  if (parameter.type !== "number") return [];
  const low = parameter.hardMin ?? parameter.min!, high = parameter.hardMax ?? parameter.max!;
  const sliderLow = parameter.min ?? low, sliderHigh = parameter.max ?? high;
  const step = parameter.integer || parameter.step === 1 ? 1 : (parameter.step ?? 0);
  const snap = (value: number) => {
    const rounded = step > 0 ? Math.round(value / step) * step : value;
    return Math.min(high, Math.max(low, Math.round(rounded * 1e6) / 1e6));
  };
  const picks = [sliderLow + (sliderHigh - sliderLow) * .2, sliderLow + (sliderHigh - sliderLow) * .55, sliderHigh].map(snap);
  return [...new Set(picks)].filter((value) => value !== current);
}

/** Greedy pairwise cover: every pair of values of every two drivers appears in some context. */
function pairwise(sizes: number[], random: () => number): number[][] {
  const missing = new Set<string>();
  for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++)
    for (let x = 0; x < sizes[a]; x++) for (let y = 0; y < sizes[b]; y++) missing.add(`${a}:${x}|${b}:${y}`);
  const covers = (vector: number[]) => {
    const keys: string[] = [];
    for (let a = 0; a < sizes.length; a++) for (let b = a + 1; b < sizes.length; b++) keys.push(`${a}:${vector[a]}|${b}:${vector[b]}`);
    return keys;
  };
  const chosen: number[][] = [];
  while (missing.size > 0) {
    let best: number[] = [], gain = -1;
    for (let attempt = 0; attempt < 300; attempt++) {
      const vector = sizes.map((size) => Math.floor(random() * size));
      const value = covers(vector).filter((key) => missing.has(key)).length;
      if (value > gain) { gain = value; best = vector; }
    }
    covers(best).forEach((key) => missing.delete(key));
    chosen.push(best);
  }
  return chosen;
}

function contextsFor(item: InstrumentDefinition, drivers: Parameter[], limit: number, seed: number): { list: Values[]; exhaustive: boolean } {
  const base = createInstrument(item.id).params;
  const sizes = drivers.map((driver) => valuesOf(driver).length);
  const total = sizes.reduce((product, size) => product * size, 1);
  const build = (indexes: number[]): Values => {
    const values = { ...base };
    drivers.forEach((driver, index) => { values[driver.key] = valuesOf(driver)[indexes[index]]; });
    return values;
  };
  if (total <= limit) {
    const list: Values[] = [];
    const walk = (position: number, indexes: number[]) => {
      if (position === drivers.length) { list.push(build(indexes)); return; }
      for (let value = 0; value < sizes[position]; value++) walk(position + 1, [...indexes, value]);
    };
    walk(0, []);
    return { list, exhaustive: true };
  }
  const seen = new Set<string>(), list: Values[] = [];
  const add = (values: Values) => { const key = JSON.stringify(values); if (!seen.has(key)) { seen.add(key); list.push(values); } };
  const random = rng(seed);
  add(base);
  pairwise(sizes, random).forEach((vector) => add(build(vector)));
  drivers.forEach((driver) => valuesOf(driver).forEach((value) => add({ ...base, [driver.key]: value })));
  return { list: list.slice(0, Math.max(limit, 30)), exhaustive: false };
}

/** Find the smallest driver subset whose values decide relevance, as a product-set condition. */
function infer(key: string, drivers: Parameter[], contexts: Values[], relevant: boolean[], exhaustive: boolean):
  { condition?: Condition; kind?: "disjunctive" | "numeric" } {
  const others = drivers.filter((driver) => driver.key !== key);
  const subsets: Parameter[][] = others.map((driver) => [driver]);
  for (let a = 0; a < others.length; a++) for (let b = a + 1; b < others.length; b++) subsets.push([others[a], others[b]]);
  // Three-driver conditions are only trusted when every combination was measured.
  if (exhaustive && others.length <= 7) for (let a = 0; a < others.length; a++) for (let b = a + 1; b < others.length; b++)
    for (let c = b + 1; c < others.length; c++) subsets.push([others[a], others[b], others[c]]);
  const decides = (subset: Parameter[]) => {
    const groups = new Map<string, boolean>();
    for (let index = 0; index < contexts.length; index++) {
      const projection = JSON.stringify(subset.map((driver) => contexts[index][driver.key]));
      const previous = groups.get(projection);
      if (previous === undefined) groups.set(projection, relevant[index]);
      else if (previous !== relevant[index]) return undefined;
    }
    return groups;
  };
  for (const subset of subsets) {
    const groups = decides(subset);
    if (!groups) continue;
    const relevantProjections = [...groups].filter(([, value]) => value).map(([projection]) => JSON.parse(projection) as Scalar[]);
    const allowed = subset.map((_, column) => [...new Set(relevantProjections.map((projection) => projection[column]))]);
    // Product-set check: every observed combination of the allowed values must be relevant, and no other.
    const product = [...groups].every(([projection, value]) => {
      const parts = JSON.parse(projection) as Scalar[];
      return value === parts.every((part, column) => allowed[column].includes(part));
    });
    if (!product) continue;
    const condition: Condition = {};
    subset.forEach((driver, column) => {
      const legal = valuesOf(driver);
      const ordered = legal.filter((value) => allowed[column].includes(value));
      if (ordered.length < legal.length) condition[driver.key] = ordered;
    });
    if (Object.keys(condition).length > 0) return { condition };
  }
  return { kind: decides(others) ? "disjunctive" : "numeric" };
}

/** A random valid-looking configuration: discrete choices anywhere, numerics often moved off their defaults. */
function randomValues(item: InstrumentDefinition, base: Values, random: () => number): Values {
  const values = { ...base };
  for (const parameter of item.parameters) {
    if (parameter.type === "boolean") values[parameter.key] = random() < .5;
    else if (parameter.type === "select") { const pool = valuesOf(parameter); values[parameter.key] = pool[Math.floor(random() * pool.length)]; }
    else if (parameter.type === "number" && random() < .6) {
      const low = parameter.hardMin ?? parameter.min!, high = parameter.hardMax ?? parameter.max!;
      const sliderLow = parameter.min ?? low, sliderHigh = parameter.max ?? high;
      const step = parameter.integer || parameter.step === 1 ? 1 : (parameter.step ?? 0);
      const raw = sliderLow + (sliderHigh - sliderLow) * random();
      const snapped = step > 0 ? Math.round(raw / step) * step : raw;
      values[parameter.key] = Math.min(high, Math.max(low, Math.round(snapped * 1e6) / 1e6));
    }
  }
  return values;
}

/** Look for a configuration inside the hidden region where changing the control changes the drawing. */
function refuteHidden(id: string, item: InstrumentDefinition, parameter: Parameter, isHidden: (values: Values) => boolean,
  base: Values, random: () => number, force?: (values: Values) => void, budget = { trials: 160, checks: 16 }): Values | undefined {
  const defaults = createInstrument(id);
  let checks = 0;
  for (let trial = 0; trial < budget.trials && checks < budget.checks; trial++) {
    const values = randomValues(item, base, random);
    if (force && trial % 3 !== 0) force(values); // two thirds of trials sit on the condition's boundary
    if (!isHidden(values)) continue;
    let reference: string;
    try { validateParameters(id, values); reference = drawFingerprint({ ...defaults, params: values }); } catch { continue; }
    let tested = false;
    for (const candidate of candidates(parameter, values[parameter.key] as Scalar).slice(0, 2)) {
      const params = { ...values, [parameter.key]: candidate };
      try { validateParameters(id, params); } catch { continue; }
      tested = true;
      try { if (drawFingerprint({ ...defaults, params }) !== reference) return values; } catch { return values; }
    }
    if (tested) checks++;
  }
  return undefined;
}

/** The definition with proposed conditions attached to the controls that have none. */
function patched(item: InstrumentDefinition, proposals: Record<string, VisibleWhen>): InstrumentDefinition {
  return { ...item, parameters: item.parameters.map((parameter) => proposals[parameter.key] && !parameter.visibleWhen ? { ...parameter, visibleWhen: proposals[parameter.key] } : parameter) };
}

/** Configurations for learning: discrete choices anywhere, each number at its default, an end of its slider, or a random point. */
function sampleValues(item: InstrumentDefinition, base: Values, random: () => number): Values {
  const values = randomValues(item, base, random);
  for (const parameter of item.parameters) {
    if (parameter.type !== "number") continue;
    const low = parameter.hardMin ?? parameter.min!, high = parameter.hardMax ?? parameter.max!;
    const sliderLow = parameter.min ?? low, sliderHigh = parameter.max ?? high;
    const pick = random();
    if (pick < .25) values[parameter.key] = base[parameter.key];
    else if (pick < .45) values[parameter.key] = sliderLow;
    else if (pick < .65) values[parameter.key] = sliderHigh;
    else if (pick < .68) values[parameter.key] = high;
    else if (pick < .7) values[parameter.key] = low;
  }
  return values;
}

export function auditInstrument(id: string): InstrumentAudit {
  const item = definition(id);
  const drivers = item.parameters.filter((parameter) => (parameter.type === "select" && (parameter.options?.length ?? 0) >= 2) || parameter.type === "boolean");
  const defaults = createInstrument(id);
  const start = performance.now();
  drawFingerprint(defaults);
  const drawMs = Math.max(1, performance.now() - start);
  const limit = drawMs > 200 ? 6 : drawMs > 60 ? 12 : 40;
  const { list, exhaustive } = contextsFor(item, drivers, limit, [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7));
  const audit: InstrumentAudit = { id, drivers: drivers.map((driver) => driver.key), contexts: 0, exhaustive, probes: 0, skipped: 0,
    proposals: {}, learned: [], dead: [], disjunctive: [], numeric: [], unknown: [], violations: [], alwaysRelevant: 0, controls: item.parameters.length };
  const usable: { values: Values; base: string }[] = [];
  for (const values of list) {
    try { validateParameters(id, values); usable.push({ values, base: drawFingerprint({ ...defaults, params: values }) }); }
    catch { audit.skipped++; }
  }
  audit.contexts = usable.length;
  if (usable.length === 0) return audit;
  const controls = item.parameters.filter((parameter) => parameter.type !== "text");
  const relevance = new Map<string, boolean[]>();
  for (const parameter of controls) {
    const relevant: boolean[] = [], known: boolean[] = [];
    for (const { values, base } of usable) {
      let changed = false, tested = 0;
      for (const candidate of candidates(parameter, values[parameter.key] as Scalar)) {
        const params = { ...values, [parameter.key]: candidate };
        try { validateParameters(id, params); } catch { audit.skipped++; continue; }
        audit.probes++;
        try { if (drawFingerprint({ ...defaults, params }) !== base) { changed = true; break; } tested++; }
        catch { changed = true; break; } // A draw that fails under this change is not "irrelevant".
      }
      relevant.push(changed); known.push(changed || tested > 0);
    }
    if (known.every((flag) => !flag)) { audit.unknown.push(parameter.key); continue; }
    // Contexts where nothing could be tested count as relevant, so a condition never hides a control on no evidence.
    const treated = relevant.map((flag, index) => flag || !known[index]);
    relevance.set(parameter.key, treated);
    // An existing condition must never hide a control that matters.
    treated.forEach((flag, index) => {
      if (flag && !visibleParameters(id, usable[index].values).some((visible) => visible.key === parameter.key))
        audit.violations.push({ key: parameter.key, context: usable[index].values });
    });
    if (treated.every(Boolean)) { audit.alwaysRelevant++; continue; }
    if (treated.every((flag) => !flag)) { audit.dead.push(parameter.key); continue; }
    if (parameter.visibleWhen) continue; // Already declared inline; only the violation check applies.
    const inferred = infer(parameter.key, drivers, usable.map((entry) => entry.values), treated, exhaustive);
    if (inferred.condition) audit.proposals[parameter.key] = inferred.condition;
    else if (inferred.kind === "disjunctive") audit.disjunctive.push(parameter.key);
    else audit.numeric.push(parameter.key);
  }
  // Refutation: numerics were held at their defaults above, so try every hidden region again with
  // randomized numeric settings. A control that ever matters there was wrongly judged irrelevant.
  const stream = rng([...id].reduce((hash, char) => (hash * 33 + char.charCodeAt(0)) >>> 0, 5));
  const budget = drawMs > 200 ? { trials: 60, checks: 6 } : { trials: 160, checks: 16 };
  const refute = (parameter: Parameter, trials = budget): Values | undefined => {
    const condition = audit.proposals[parameter.key] ?? parameter.visibleWhen;
    if (!condition) return undefined;
    const view = patched(item, audit.proposals);
    // Effective visibility: a proposal whose driver another proposal hides is judged as the host would show it.
    const hidden = (values: Values) => !visibleOf(view, values).some((visible) => visible.key === parameter.key);
    return refuteHidden(id, item, parameter, hidden, defaults.params, stream, (values) => violate(condition, item.parameters, values, stream), trials);
  };
  for (const parameter of item.parameters) {
    if (!audit.proposals[parameter.key] && !parameter.visibleWhen) continue;
    const counterexample = refute(parameter);
    if (!counterexample) continue;
    if (audit.proposals[parameter.key]) { delete audit.proposals[parameter.key]; audit.numeric.push(parameter.key); }
    else audit.violations.push({ key: parameter.key, context: counterexample });
  }
  // Learning: controls whose relevance is a disjunction or depends on a number. Sample configurations
  // with the numbers moved around, label each by whether changing the control changes the drawing, fit
  // alternatives and thresholds, locate every threshold on the real drawing, then validate and refute.
  const trace = process.env.AUDIT_TRACE === "1";
  const only = process.env.AUDIT_ONLY?.split(",");
  const pending = [...audit.dead, ...audit.disjunctive, ...audit.numeric].filter((key) => !item.parameters.find((parameter) => parameter.key === key)!.visibleWhen && (!only || only.includes(key)));
  if (pending.length === 0) return audit;
  const cache = new Map<string, string>();
  const fingerprint = (values: Values): string => {
    const key = JSON.stringify(values);
    let hash = cache.get(key);
    if (hash === undefined) {
      try { validateParameters(id, values); } catch { cache.set(key, "!invalid"); return "!invalid"; }
      try { hash = drawFingerprint({ ...defaults, params: values }); } catch { hash = "!threw"; }
      cache.set(key, hash);
    }
    return hash;
  };
  const oracleFor = (parameter: Parameter) => (values: Values): boolean | undefined => {
    const base = fingerprint(values);
    if (base.startsWith("!")) return undefined;
    let tested = false;
    for (const candidate of candidates(parameter, values[parameter.key] as Scalar).slice(0, 3)) {
      const hash = fingerprint({ ...values, [parameter.key]: candidate });
      if (hash === "!invalid") continue;
      if (hash === "!threw" || hash !== base) return true;
      tested = true;
    }
    return tested ? false : undefined;
  };
  const sampler = rng([...id].reduce((hash, char) => (hash * 37 + char.charCodeAt(0)) >>> 0, 13));
  const count = drawMs > 200 ? 10 : drawMs > 60 ? 24 : 48;
  const samples: Values[] = [];
  for (let index = 0; index < count * 3 && samples.length < count; index++) {
    const values = sampleValues(item, defaults.params, sampler);
    if (!fingerprint(values).startsWith("!")) samples.push(values);
  }
  const numericDrivers = item.parameters.filter((parameter) => parameter.type === "number");
  const training = new Map<string, Sample[]>();
  for (const key of pending) {
    const parameter = item.parameters.find((entry) => entry.key === key)!, oracle = oracleFor(parameter);
    const set: Sample[] = (relevance.get(key) ?? []).map((relevant, index) => ({ values: usable[index].values, relevant }));
    for (const values of samples) { const relevant = oracle(values); if (relevant !== undefined) set.push({ values, relevant }); }
    // One-at-a-time moves off the defaults: a gate such as "grains > 0" shows up when a number leaves the
    // value that disables the control, which random configurations rarely isolate.
    for (const driver of [...drivers, ...numericDrivers]) {
      if (driver.key === key) continue;
      const moves = driver.type === "number" ? [driver.min ?? driver.hardMin!, driver.max ?? driver.hardMax!] : valuesOf(driver);
      for (const move of moves) {
        if (move === defaults.params[driver.key]) continue;
        const values = { ...defaults.params, [driver.key]: move };
        const relevant = oracle(values);
        if (relevant !== undefined) set.push({ values, relevant });
      }
    }
    training.set(key, set);
  }
  for (const key of pending) {
    const parameter = item.parameters.find((entry) => entry.key === key)!, set = training.get(key)!;
    const oracle = oracleFor(parameter);
    // Which drivers can flip the control's relevance? Move each one alone from a configuration and see
    // whether relevance changes; only those can be part of an explanation.
    const flipsFrom = (base: Sample): string[] => {
      const moved: string[] = [];
      for (const driver of [...drivers, ...numericDrivers]) {
        if (driver.key === key) continue;
        const alternatives = driver.type === "number"
          ? [driver.min ?? driver.hardMin!, driver.max ?? driver.hardMax!].filter((value) => value !== base.values[driver.key])
          : [valuesOf(driver).filter((value) => value !== base.values[driver.key])[Math.floor(sampler() * (valuesOf(driver).length - 1))]];
        for (const alternative of alternatives) {
          const result = oracle({ ...base.values, [driver.key]: alternative });
          if (result !== undefined && result !== base.relevant) { moved.push(driver.key); break; }
        }
      }
      return moved;
    };
    const flips = new Map<string, number>();
    const positives = set.filter((sample) => sample.relevant), negatives = set.filter((sample) => !sample.relevant);
    const bases = [...positives.filter((_, index) => index % Math.max(1, Math.ceil(positives.length / 5)) === 0).slice(0, 5),
      ...negatives.filter((_, index) => index % Math.max(1, Math.ceil(negatives.length / 5)) === 0).slice(0, 5)];
    for (const base of bases) for (const moved of flipsFrom(base)) flips.set(moved, (flips.get(moved) ?? 0) + 1);
    // Relevance also flickers with the numbers (a tiny drawing changes nothing), so a driver only counts
    // when moving it flips relevance from a fair share of the starting points.
    const influential = new Set([...flips].filter(([, count]) => count >= Math.max(2, Math.ceil(bases.length * .25))).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([driver]) => driver));
    if (trace) console.error(`  ${key}: flips ${JSON.stringify([...flips])} -> ${JSON.stringify([...influential])}`);
    if (influential.size === 0) continue;
    const note = trace ? (message: string) => console.error(`  ${key}: ${message}`) : undefined;
    // A counterexample (a hidden configuration where the control matters, or a context where a dependent
    // control needs this one shown) becomes a new positive sample and the fit is retried.
    for (let attempt = 0; attempt < 4; attempt++) {
      const discreteDrivers = drivers.filter((driver) => influential.has(driver.key)), numbers = numericDrivers.filter((driver) => influential.has(driver.key));
      if (process.env.AUDIT_DUMP) writeFileSync(`${process.env.AUDIT_DUMP}/${id}.${key}.json`, JSON.stringify({ set, discrete: discreteDrivers.map((d) => d.key), numbers: numbers.map((d) => d.key) }));
      // Selections alone are the simpler and more common explanation, so numbers are only tried when they cannot explain it.
      const learn = () => learnCubes(set, discreteDrivers, [], note) ?? learnCubes(set, discreteDrivers, numbers, note);
      let cubes = learn();
      // Probe just outside and just inside the current guess, add what the drawing says, and refit
      // until the probes agree with the guess (or it cannot be explained).
      for (let round = 0; cubes && round < 4; round++) {
        const guess = cubesToCondition(cubes, [...discreteDrivers, ...numbers]);
        if (!guess) break;
        const view = patched(item, { ...audit.proposals, [key]: guess });
        let mismatch = false;
        for (let trial = 0; trial < 24; trial++) {
          const values = sampleValues(item, defaults.params, sampler);
          if (trial % 2 === 0) violate(guess, item.parameters, values, sampler); else satisfy(guess, item.parameters, values, sampler);
          const relevant = oracle(values);
          if (relevant === undefined) continue;
          set.push({ values, relevant });
          // Only a control that matters where the guess hides it is a miss; showing one that does not matter is safe.
          if (relevant && !visibleOf(view, values).some((visible) => visible.key === key)) mismatch = true;
        }
        if (trace) console.error(`  ${key}: round ${round} ${mismatch ? "mismatch" : "agrees"} ${JSON.stringify(guess)}`);
        if (!mismatch) break;
        cubes = learn();
      }
      const refined = cubes && refineCubes(cubes, set, numbers, oracle);
      let condition = refined && cubesToCondition(refined, [...discreteDrivers, ...numbers]);
      if (trace) console.error(`${id}.${key}: ${set.filter((s) => s.relevant).length}+/${set.filter((s) => !s.relevant).length}- cubes=${cubes ? cubes.length : "none"} refined=${refined ? "yes" : "no"} condition=${JSON.stringify(condition)}`);
      // The validator's own verdict decides: drop what it calls redundant or duplicate, refuse anything else it rejects.
      for (let fix = 0; condition && fix < 8; fix++) {
        try { validateVisibility(patched(item, { ...audit.proposals, [key]: condition })); break; }
        catch (error) {
          const found = /visibleWhen\[(\d+)\] is redundant|alternatives \[\d+\] and \[(\d+)\] are identical/.exec(String(error));
          if (!found || !Array.isArray(condition)) { condition = undefined; break; }
          const rest = condition.filter((_, index) => index !== Number(found[1] ?? found[2]));
          condition = rest.length === 1 ? rest[0] : rest;
        }
      }
      if (!condition) { if (trace) console.error(`  ${key}: not expressible`); break; }
      audit.proposals[key] = condition;
      const view = patched(item, audit.proposals);
      // Effective visibility must still show every control everywhere it was measured to matter: a
      // dependent control that matters needs this one shown, so that context is a positive sample here.
      const needed: Values[] = [];
      for (const [other, flags] of relevance) flags.forEach((flag, index) => { if (flag && !visibleOf(view, usable[index].values).some((visible) => visible.key === other)) needed.push(usable[index].values); });
      for (const [other, samplesOf] of training) if (other !== key) for (const sample of samplesOf) if (sample.relevant && !visibleOf(view, sample.values).some((visible) => visible.key === other)) needed.push(sample.values);
      if (needed.length > 0) {
        delete audit.proposals[key];
        if (trace) console.error(`  ${key}: hides a control that matters in ${needed.length} contexts`);
        for (const values of needed.slice(0, 6)) set.push({ values, relevant: true });
        continue;
      }
      const counter = refute(parameter, { trials: budget.trials * 2, checks: budget.checks * 2 });
      if (counter) {
        delete audit.proposals[key];
        if (trace) console.error(`  ${key}: refuted at ${JSON.stringify(counter)}`);
        const base = { values: counter, relevant: true };
        set.push(base);
        // The driver that made the control matter there may not have been among the influential ones.
        for (const moved of flipsFrom(base)) influential.add(moved);
        continue;
      }
      audit.learned.push(key);
      for (const list of [audit.dead, audit.disjunctive, audit.numeric]) { const at = list.indexOf(key); if (at >= 0) list.splice(at, 1); }
      break;
    }
  }
  return audit;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--child") {
    for (const id of args.slice(1)) process.stdout.write(`${JSON.stringify(auditInstrument(id))}\n`);
    return;
  }
  let out = ".work/control-audit/report.json", workers = 16;
  const ids: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--out") out = args[++index];
    else if (args[index] === "--workers") workers = Number(args[++index]);
    else ids.push(args[index]);
  }
  const targets = ids.length ? ids : definitions.map((item) => item.id);
  const chunks = Array.from({ length: Math.min(workers, targets.length) }, (_, index) => targets.filter((_, position) => position % Math.min(workers, targets.length) === index));
  const reports: InstrumentAudit[] = [];
  await Promise.all(chunks.map((chunk) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", process.argv[1], "--child", ...chunk], { stdio: ["ignore", "pipe", "inherit"] });
    let buffer = "";
    child.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
        const line = buffer.slice(0, newline);
        appendFileSync(`${out}.jsonl`, `${line}\n`); // each finished instrument survives an interrupted run
        reports.push(JSON.parse(line) as InstrumentAudit); buffer = buffer.slice(newline + 1);
      }
    });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`audit worker exited ${code}`)));
  })));
  reports.sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(reports, null, 1));
  const sum = (pick: (report: InstrumentAudit) => number) => reports.reduce((total, report) => total + pick(report), 0);
  console.log(JSON.stringify({ instruments: reports.length, controls: sum((r) => r.controls), probes: sum((r) => r.probes),
    proposals: sum((r) => Object.keys(r.proposals).length), dead: sum((r) => r.dead.length), disjunctive: sum((r) => r.disjunctive.length),
    numeric: sum((r) => r.numeric.length), unknown: sum((r) => r.unknown.length), violations: sum((r) => r.violations.length),
    learned: sum((r) => r.learned.length), withProposals: reports.filter((r) => Object.keys(r.proposals).length).length, sampled: reports.filter((r) => !r.exhaustive).length }, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
