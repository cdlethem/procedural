/**
 * Write the measured conditions from an audit report into `src/control-dependencies.ts`.
 *
 *   npx tsx tests/helpers/generate-control-dependencies.ts <report.json> [--inline out.json]
 *
 * Only proposals that survived the audit's validation, effective-visibility check and numeric
 * refutation are written. The audit only proposes conditions for controls that have none, so the
 * proposals are merged into the conditions the overlay already holds (a control named twice is an
 * error). Instruments whose adapters declare `visibleWhen` inline are not overlaid: their
 * proposals go to the `--inline` file for `apply-inline-conditions.ts`, so a control's condition
 * lives next to the control. The result is deterministic (instruments and controls sorted), so a
 * re-run on the same report changes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { definitions } from "../../dist/index.js";
import type { VisibilityCondition, VisibleWhen } from "../../dist/index.js";
import { controlDependencies } from "../../dist/control-dependencies.js";
import type { InstrumentAudit } from "./audit-controls.ts";

const entryText = (entry: VisibilityCondition[string]): string => Array.isArray(entry)
  ? JSON.stringify(entry)
  : `{ ${Object.keys(entry).sort().map((operator) => `${JSON.stringify(operator)}: ${JSON.stringify((entry as Record<string, number>)[operator])}`).join(", ")} }`;
const alternativeText = (alternative: VisibilityCondition): string =>
  `{ ${Object.keys(alternative).sort().map((driver) => `${JSON.stringify(driver)}: ${entryText(alternative[driver])}`).join(", ")} }`;
export const conditionText = (condition: VisibleWhen): string => Array.isArray(condition)
  ? `[${(condition as readonly VisibilityCondition[]).map(alternativeText).join(", ")}]` : alternativeText(condition as VisibilityCondition);

const args = process.argv.slice(2);
const reportPath = args[0], inlineOut = args.includes("--inline") ? args[args.indexOf("--inline") + 1] : undefined;
const report = JSON.parse(readFileSync(reportPath, "utf8")) as InstrumentAudit[];
const target = fileURLToPath(new URL("../../src/control-dependencies.ts", import.meta.url));

const inlineInstruments = new Set(definitions.filter((item) => item.parameters.some((parameter) => parameter.visibleWhen && !(controlDependencies[item.id] ?? {})[parameter.key])).map((item) => item.id));
const merged: Record<string, Record<string, VisibleWhen>> = {};
for (const [id, table] of Object.entries(controlDependencies)) merged[id] = { ...table };
const inline: Record<string, Record<string, VisibleWhen>> = {};
let added = 0;
for (const entry of report) {
  const keys = Object.keys(entry.proposals);
  if (keys.length === 0) continue;
  const into = inlineInstruments.has(entry.id) ? inline : merged;
  for (const key of keys) {
    if (into[entry.id]?.[key]) throw new Error(`${entry.id}.${key} already has a condition`);
    (into[entry.id] ??= {})[key] = entry.proposals[key];
    if (into === merged) added++;
  }
}
const lines: string[] = ["export const controlDependencies: Readonly<Record<string, Readonly<Record<string, ControlCondition>>>> = {"];
let controls = 0;
for (const id of Object.keys(merged).sort((a, b) => a.localeCompare(b))) {
  lines.push(`  ${JSON.stringify(id)}: {`);
  for (const key of Object.keys(merged[id]).sort()) { lines.push(`    ${JSON.stringify(key)}: ${conditionText(merged[id][key])},`); controls++; }
  lines.push("  },");
}
lines.push("};");
const source = readFileSync(target, "utf8");
const begin = source.indexOf("// BEGIN GENERATED"), end = source.indexOf("// END GENERATED");
if (begin < 0 || end < 0) throw new Error("generation markers not found");
const beginLine = source.indexOf("\n", begin) + 1;
writeFileSync(target, source.slice(0, beginLine) + lines.join("\n") + "\n" + source.slice(end));
if (inlineOut) writeFileSync(inlineOut, JSON.stringify(inline, null, 1));
console.log(`overlay: ${controls} conditions in ${Object.keys(merged).length} instruments (${added} new); inline proposals: ${Object.values(inline).reduce((total, table) => total + Object.keys(table).length, 0)} in ${Object.keys(inline).length} instruments`);
