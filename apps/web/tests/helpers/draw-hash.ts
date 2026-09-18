/** Test helper: prints styled/geometry hashes for a dynamics layer draw.
 *  Modes:
 *    direct    <technique> <paramsJson>  — synchronous draw on a cold cache
 *    prepared  <technique> <paramsJson>  — cooperative preparation, then draw
 *  Run: npx tsx tests/helpers/draw-hash.ts <mode> <technique> <paramsJson>
 */
import { externalDynamicsDefinitions, externalDynamicsPalette, prepareExternalDynamics } from "../../lib/adapters/external-dynamics";
import type { Layer } from "../../lib/studio-types";
import { drawDynamics } from "./draw-recorder";

const [mode, technique, paramsJson] = process.argv.slice(2);
if (!mode || !technique || !paramsJson) {
  console.error("usage: draw-hash.ts <direct|prepared> <technique> <paramsJson>");
  process.exit(2);
}
const definition = externalDynamicsDefinitions.find((item) => item.id === technique);
if (!definition) throw new Error(`unknown technique ${technique}`);
const layer: Layer = {
  id: `layer-${technique}`,
  technique,
  visible: true,
  opacity: 1,
  seed: 42,
  palette: externalDynamicsPalette(technique)!,
  cutEdits: [],
  transform: { x: 320, y: 320, scale: 1, rotation: 0 },
  params: { ...definition.defaults, ...JSON.parse(paramsJson) },
};

async function main(): Promise<void> {
  if (mode === "prepared") await prepareExternalDynamics(layer, () => false);
  const drawing = drawDynamics(layer);
  console.log(JSON.stringify({ styled: drawing.styled, geometry: drawing.geometry }));
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
