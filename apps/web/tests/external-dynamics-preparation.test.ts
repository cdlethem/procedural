import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
  externalDynamicsDefinitions,
  externalDynamicsPalette,
  externalDynamicsPreparable,
  prepareExternalDynamics,
  PreparationCancelledError,
} from "../lib/adapters/external-dynamics";
import type { Layer } from "../lib/studio-types";
import { drawDynamics } from "./helpers/draw-recorder";

const ROOT = new URL("..", import.meta.url);

const SHAPE = {
  "bridge-web": { ticks: 12, strain: 30, slant: -31, stride: 2 },
  "neighborhood-growth": { ticks: 30, chain: false, minLength: 30, step: 0.5, insert: 2, minNeighbors: 1, maxNeighbors: 3 },
  "elastic-loops": { ticks: 14, growth: 0.02, curl: -0.09, windX: 1, range: 60, strength: 12, structure: false },
  "dye-currents": { ticks: 20, injection: 0.12, viscosity: 0.03, projection: true, texture: false },
} as const;
// Distinct param sets so each test starts from a cold cache entry.
const CANCEL = {
  "bridge-web": { ticks: 12, strain: 30, slant: 29, stride: 2 },
  "neighborhood-growth": { ticks: 18, chain: false, minLength: 30, step: 0.5, insert: 1, minNeighbors: 1, maxNeighbors: 3 },
  "elastic-loops": { ticks: 14, growth: 0.02, curl: -0.09, windX: 0, range: 60, strength: 12, structure: false },
  "dye-currents": { ticks: 20, injection: 0.08, viscosity: 0.03, projection: true, texture: false },
} as const;

function layerFor(technique: string, params: Record<string, unknown>): Layer {
  const definition = externalDynamicsDefinitions.find((item) => item.id === technique)!;
  return {
    id: `layer-${technique}`,
    technique,
    visible: true,
    opacity: 1,
    seed: 42,
    palette: externalDynamicsPalette(technique)!,
    cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params: { ...definition.defaults, ...params } as Layer["params"],
  };
}

/** Independent cold-cache reference in a fresh process (separate module instance). */
async function reference(technique: string, params: Record<string, unknown>): Promise<{ styled: string; geometry: string }> {
  const child = spawn("npx", ["tsx", "tests/helpers/draw-hash.ts", "direct", technique, JSON.stringify(params)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const code = await new Promise<number>((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`reference draw failed (${code}): ${stderr}`);
  return JSON.parse(output.trim());
}

for (const [technique, params] of Object.entries(SHAPE)) {
  test(`${technique}: prepared draw equals independent cold draw, and preparation warms the cache`, async () => {
    const coldLayer = layerFor(technique, { ...params, ...(technique === "bridge-web" ? { slant: 31 } : { ticks: (params.ticks as number) + 4 }) });
    const coldStart = Date.now();
    drawDynamics(coldLayer);
    const coldMs = Date.now() - coldStart;

    const ref = await reference(technique, params);
    const preparedLayer = layerFor(technique, params);
    await prepareExternalDynamics(preparedLayer, () => false);
    const warmStart = Date.now();
    const warm = drawDynamics(preparedLayer);
    const warmMs = Date.now() - warmStart;
    assert.deepEqual({ styled: warm.styled, geometry: warm.geometry }, ref, "prepared draw matches the independent cold reference");
    assert.ok(coldMs > 300, `these params must make the cold draw the slow path, took ${coldMs}ms`);
    assert.ok(warmMs < 300, `post-preparation draw must be a cache hit, took ${warmMs}ms`);
  });

  test(`${technique}: cancelled preparation leaves the synchronous draw correct`, async () => {
    const cancelParams = CANCEL[technique as keyof typeof CANCEL];
    const ref = await reference(technique, cancelParams);
    const layer = layerFor(technique, cancelParams);
    let steps = 0;
    await assert.rejects(
      prepareExternalDynamics(layer, () => ++steps > 1),
      PreparationCancelledError,
      "preparation reports cancellation",
    );
    const afterCancel = drawDynamics(layer);
    assert.deepEqual({ styled: afterCancel.styled, geometry: afterCancel.geometry }, ref, "synchronous draw after cancellation matches the independent cold reference");
  });
}

test("preparable set is exactly the replayed-model studies", () => {
  assert.deepEqual(
    [...externalDynamicsPreparable].sort(),
    ["bridge-web", "dye-currents", "elastic-loops", "neighborhood-growth"],
  );
});
