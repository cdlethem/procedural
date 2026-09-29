/**
 * Measure which controls matter under which selections.
 *
 * For each instrument the discrete controls (select and boolean) are the "drivers". The audit draws
 * the instrument under combinations of driver values (all of them when there are few, a fixed
 * sample otherwise), and under each one changes every other control to a few different valid
 * values. A control whose change never alters the drawing is *irrelevant* in that combination.
 * If irrelevance depends only on one or two drivers and the relevant combinations form a product
 * set, that is a `visibleWhen` condition. Controls that are irrelevant everywhere sampled, or whose
 * pattern is not a product set, are reported for manual judgment instead of being guessed.
 *
 *   npx tsx tests/helpers/audit-controls.ts [--out report.json] [--workers 16] [id ...]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInstrument, definition, definitions, validateParameters, visibleParameters } from "../../dist/index.js";
import type { InstrumentDefinition, InstrumentInput, Parameter } from "../../dist/index.js";
import { drawFingerprint } from "./draw-fingerprint.ts";

type Values = InstrumentInput["params"];
type Scalar = string | number | boolean;
type Condition = Record<string, Scalar[]>;
export type InstrumentAudit = {
  id: string; drivers: string[]; contexts: number; exhaustive: boolean; probes: number; skipped: number;
  /** Conditions the measurement supports, as `visibleWhen` objects. */
  proposals: Record<string, Condition>;
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
  base: Values, random: () => number, force?: (values: Values) => void): Values | undefined {
  const defaults = createInstrument(id);
  let checks = 0;
  for (let trial = 0; trial < 160 && checks < 16; trial++) {
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
    proposals: {}, dead: [], disjunctive: [], numeric: [], unknown: [], violations: [], alwaysRelevant: 0, controls: item.parameters.length };
  const usable: { values: Values; base: string }[] = [];
  for (const values of list) {
    try { validateParameters(id, values); usable.push({ values, base: drawFingerprint({ ...defaults, params: values }) }); }
    catch { audit.skipped++; }
  }
  audit.contexts = usable.length;
  if (usable.length === 0) return audit;
  const controls = item.parameters.filter((parameter) => parameter.type !== "text");
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
  for (const parameter of item.parameters) {
    const proposal = audit.proposals[parameter.key];
    if (!proposal && !parameter.visibleWhen) continue;
    const hidden = proposal
      ? (values: Values) => !Object.entries(proposal).every(([key, allowed]) => allowed.includes(values[key] as Scalar))
      : (values: Values) => !visibleParameters(id, values).some((visible) => visible.key === parameter.key);
    // Boundary trials: flip one named driver out of its allowed values, keep the rest satisfied.
    const force = proposal ? (values: Values) => {
      const keys = Object.keys(proposal), flip = keys[Math.floor(stream() * keys.length)];
      const outside = valuesOf(item.parameters.find((entry) => entry.key === flip)!).filter((value) => !proposal[flip].includes(value));
      values[flip] = outside[Math.floor(stream() * outside.length)];
      for (const key of keys) if (key !== flip) values[key] = proposal[key][Math.floor(stream() * proposal[key].length)];
    } : undefined;
    const counterexample = refuteHidden(id, item, parameter, hidden, defaults.params, stream, force);
    if (!counterexample) continue;
    if (proposal) { delete audit.proposals[parameter.key]; audit.numeric.push(parameter.key); }
    else audit.violations.push({ key: parameter.key, context: counterexample });
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
        reports.push(JSON.parse(buffer.slice(0, newline)) as InstrumentAudit); buffer = buffer.slice(newline + 1);
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
    withProposals: reports.filter((r) => Object.keys(r.proposals).length).length, sampled: reports.filter((r) => !r.exhaustive).length }, null, 1));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
