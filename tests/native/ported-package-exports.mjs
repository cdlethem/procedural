#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const display = (file) => relative(ROOT, file).split(sep).join("/");
const fixture = (name) => join(ROOT, "fixtures/operations", name);

const OPERATIONS = [
  { module: "stop-ramp.js", operation: "stopRamp", error: "StopRampError", fixture: "stop-ramp.json", check(result, value) {
    assert.deepEqual(result.serialize(), value.serialized, value.id);
    const query = value.queries[0];
    assert.equal(result.sample(query.input), query.output, value.id + " first query");
  } },
  { module: "raster-remap.js", operation: "bilinearRasterRemap2D", error: "RasterRemapError", fixture: "bilinear-raster-remap.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
  { module: "target-springs.js", operation: "targetSprings2D", error: "SpringError", fixture: "target-springs-2d.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
  { module: "occupied-lattice-paths.js", operation: "occupiedLatticePaths2D", error: "LatticeError", fixture: "occupied-lattice-paths-2d.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
  { module: "delaunay.js", operation: "delaunay2D", error: "DelaunayError", fixture: "delaunay-2d.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
  { module: "closed-spline.js", operation: "closedSpline2D", error: "SplineError", fixture: "closed-spline-2d.json", check(result, value) {
    assert.deepEqual(result.serialize(), value.serialized, value.id);
    const query = value.queries[0];
    assert.deepEqual(result.sample(query.input), query.output, value.id + " first query");
  } },
  { module: "noise-band-path.js", operation: "noiseBandPath2D", error: "NoiseBandPathError", fixture: "noise-band-path.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
  { module: "line-pool.js", operation: "seededLinePool2D", error: "LinePoolError", fixture: "seeded-line-pool-2d.json", check(result, value) { assert.deepEqual(result.toValues(), value.output, value.id); } },
];

const ADDITIONAL_EXPORTS = [
  [
    "binary-cell-partition",
    {
      "binaryCellPartition2D": "binaryCellPartition2D",
      "BinaryPartitionError": "PartitionError"
    }
  ],
  [
    "retained-rectangle-cuts",
    {
      "retainedRectangleCuts2D": "retainedRectangleCuts2D",
      "RectangleCutError": "RectangleCutError",
      "RetainedRectangleCuts2D": "RetainedRectangleCuts2D"
    }
  ],
  [
    "raster-crossfade",
    {
      "rasterCrossfade2D": "rasterCrossfade2D",
      "RasterCrossfadeError": "RasterCrossfadeError"
    }
  ],
  [
    "masked-source-over",
    {
      "maskedSourceOver2D": "maskedSourceOver2D",
      "MaskedCompositeError": "MaskedCompositeError"
    }
  ],
  [
    "gradient-noise-3d-01",
    {
      "gradientNoise3D01": "gradientNoise3D01",
      "GradientNoise3D01Error": "GradientNoise3D01Error"
    }
  ],
  [
    "convex-polygon-placements",
    {
      "orderedConvexPolygonFilter2D": "orderedConvexPolygonFilter2D",
      "ConvexPlacementError": "PlacementError"
    }
  ],
  [
    "segment-clip",
    {
      "clipSegmentsSimplePolygon2D": "clipSegmentsSimplePolygon2D",
      "SegmentClipError": "SegmentClipError"
    }
  ],
  [
    "radial-pull",
    {
      "radialPull2D": "radialPull2D",
      "PullError": "PullError"
    }
  ],
  [
    "disc-projection",
    {
      "sequentialDiscProjection2D": "sequentialDiscProjection2D",
      "DiscProjectionError": "DiscProjectionError"
    }
  ],
  [
    "annular-mesh",
    {
      "annularSolid3D": "annularSolid3D",
      "AnnularMeshError": "MeshError",
      "AnnularFaceLimitError": "FaceLimitError",
      "AnnularMeshArithmeticError": "MeshArithmeticError"
    }
  ],
  [
    "separable-blur",
    {
      "separableBlur2D": "separableBlur2D",
      "SeparableBlurError": "SeparableBlurError"
    }
  ],
  [
    "nearest-segment-contact",
    {
      "nearestSegmentContact2D": "nearestSegmentContact2D",
      "ContactError": "ContactError"
    }
  ]
];

function files(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  }).sort();
}

function firstSuccess(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  const item = value.cases.find((candidate) => !candidate.error);
  if (!item) throw new Error("Fixture has no successful case: " + path);
  return item;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--installed-index" || args[2] !== "--output")
    throw new Error("Usage: --installed-index ABSOLUTE_SRC_INDEX --output FRESH_WORK_JSON");
  if (!isAbsolute(args[1])) throw new Error("--installed-index must be an absolute path");
  const index = realpathSync(args[1]);
  if (!statSync(index).isFile() || index !== join(dirname(index), "index.js"))
    throw new Error("--installed-index must name an installed src/index.js file");
  const output = resolve(args[3]);
  if (!output.startsWith(join(ROOT, ".work") + sep) || existsSync(output))
    throw new Error("--output must be a fresh JSON path under .work");
  return { index, output };
}

async function main() {
  const { index, output } = parseArgs();
  const installedSrc = dirname(index);
  const installedFiles = files(installedSrc).filter((path) => path.endsWith(".js"));
  const modulePaths = OPERATIONS.map(({ module }) => join(installedSrc, module));
  for (const path of modulePaths) if (!existsSync(path)) throw new Error("Installed module is missing: " + path);
  const fixturePaths = OPERATIONS.map(({ fixture: name }) => fixture(name));
  const runner = fileURLToPath(import.meta.url);
  const bound = [index, ...installedFiles, ...fixturePaths, runner];
  const hashes = () => Object.fromEntries(bound.map((path) => [path.startsWith(ROOT + sep) ? display(path) : path, sha(path)]));
  const before = hashes();

  const api = await import(pathToFileURL(index).href);
  const scenarios = [];
  for (const [module, exports] of ADDITIONAL_EXPORTS) {
    const direct = await import(pathToFileURL(join(installedSrc, module + '.js')).href);
    for (const [publicName, moduleName] of Object.entries(exports)) {
      assert.equal(typeof api[publicName], 'function', publicName + ' public export');
      assert.equal(api[publicName], direct[moduleName], publicName + ' installed identity');
    }
    scenarios.push({module: module + '.js', exports: Object.keys(exports)});
  }
  for (const entry of OPERATIONS) {
    const direct = await import(pathToFileURL(join(installedSrc, entry.module)).href);
    assert.equal(api[entry.operation], direct[entry.operation], entry.operation + " identity");
    assert.equal(api[entry.error], direct[entry.error], entry.error + " identity");
    const value = firstSuccess(fixture(entry.fixture));
    entry.check(api[entry.operation](value.input), value);
    scenarios.push({ operation: entry.operation, error: entry.error, module: entry.module, fixture: entry.fixture, case: value.id });
  }
  const after = hashes();
  assert.deepEqual(after, before, "bound inputs changed during smoke");
  mkdirSync(dirname(output), { recursive: true });
  const report = {
    status: "passed",
    scope: "Installed JavaScript package root-export identity plus one successful shared fixture per newly exported core operation; no native render, package publication, or acceptance claim.",
    installed_index: index,
    runtime: { node: process.version },
    input_sha256_before: before,
    input_sha256_after: after,
    scenarios,
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, output, scenarios: scenarios.length }));
}

main().catch((error) => { console.error(error?.stack ?? error); process.exitCode = 1; });
