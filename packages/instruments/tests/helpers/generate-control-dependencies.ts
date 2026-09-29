/**
 * Write the measured conditions from an audit report into `src/control-dependencies.ts`.
 *
 *   npx tsx tests/helpers/generate-control-dependencies.ts <report.json>
 *
 * Only proposals that survived the audit's numeric-refutation pass are written. The result is
 * deterministic (instruments and controls sorted), so a re-run on the same report changes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { InstrumentAudit } from "./audit-controls.ts";

const report = JSON.parse(readFileSync(process.argv[2], "utf8")) as InstrumentAudit[];
const target = fileURLToPath(new URL("../../src/control-dependencies.ts", import.meta.url));
const lines: string[] = ["export const controlDependencies: Readonly<Record<string, Readonly<Record<string, ControlCondition>>>> = {"];
let controls = 0;
for (const entry of [...report].sort((a, b) => a.id.localeCompare(b.id))) {
  const keys = Object.keys(entry.proposals).sort();
  if (keys.length === 0) continue;
  lines.push(`  ${JSON.stringify(entry.id)}: {`);
  for (const key of keys) {
    const condition = entry.proposals[key];
    const body = Object.keys(condition).sort().map((driver) => `${JSON.stringify(driver)}: ${JSON.stringify(condition[driver])}`).join(", ");
    lines.push(`    ${JSON.stringify(key)}: { ${body} },`);
    controls++;
  }
  lines.push("  },");
}
lines.push("};");
const source = readFileSync(target, "utf8");
const begin = source.indexOf("// BEGIN GENERATED"), end = source.indexOf("// END GENERATED");
if (begin < 0 || end < 0) throw new Error("generation markers not found");
const beginLine = source.indexOf("\n", begin) + 1;
writeFileSync(target, source.slice(0, beginLine) + lines.join("\n") + "\n" + source.slice(end));
console.log(`wrote ${controls} conditions for ${report.filter((entry) => Object.keys(entry.proposals).length).length} instruments`);
