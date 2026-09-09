#!/usr/bin/env node
/** Deterministic presentation metadata derived from catalog contracts and JS exports. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), ".."), root = resolve(app, "../..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const validations = readdirSync(join(root, "catalog/validation"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => readJson(join(root, "catalog/validation", name)));
const packageBindings = await import(pathToFileURL(join(root, "packages/javascript/src/index.js")).href);
const bindings = {
  "annular-solid-3d": ["annular-mesh", "annularSolid3D"], "bilinear-raster-remap": ["raster-remap", "bilinearRasterRemap2D"], "binary-cell-partition-2d": ["binary-cell-partition", "binaryCellPartition2D"], "clip-segments-simple-polygon-2d": ["segment-clip", "clipSegmentsSimplePolygon2D"], "closed-spline-2d": ["closed-spline", "closedSpline2D"], "cyclic-palette": ["cyclic-palette", "cyclicPalette"], "delaunay-2d": ["delaunay", "delaunay2D"], "gradient-noise-2d-01": ["gradient-noise-2d-01", "gradientNoise2D01"], "gradient-noise-3d-01": ["gradient-noise-3d-01", "gradientNoise3D01"], "gradient-path": ["gradient-path", "gradientPath2D"], "masked-source-over": ["masked-source-over", "maskedSourceOver2D"], "nearest-segment-contact-2d": ["nearest-segment-contact", "nearestSegmentContact2D"], "noise-band-path": ["noise-band-path", "noiseBandPath2D"], "occupied-lattice-paths-2d": ["occupied-lattice-paths", "occupiedLatticePaths2D"], "ordered-circle-filter": ["circle-placements", "orderedCircleFilter2D"], "ordered-convex-polygon-filter-2d": ["convex-polygon-placements", "orderedConvexPolygonFilter2D"], "radial-profile-surface": ["radial-profile", "RadialProfile3D"], "radial-pull-2d": ["radial-pull", "radialPull2D"], "raster-crossfade": ["raster-crossfade", "rasterCrossfade2D"], "regular-grid": ["regular-grid", "regularGrid"], "retained-rectangle-cuts-2d": ["retained-rectangle-cuts", "retainedRectangleCuts2D"], "seeded-circle-placement": ["circle-placements", "seededCirclePlacement2D"], "seeded-endpoint-branches": ["branch-tree", "seededEndpointBranches2D"], "seeded-line-pool-2d": ["line-pool", "seededLinePool2D"], "seeded-quadrant-partition": ["quadrant-partition", "seededQuadrantPartition2D"], "seeded-triangle-points": ["triangle-points", "seededTrianglePoints2D"], "separable-blur-2d": ["separable-blur", "separableBlur2D"], "sequential-disc-projection-2d": ["disc-projection", "sequentialDiscProjection2D"], "stop-ramp": ["stop-ramp", "stopRamp"], "target-springs-2d": ["target-springs", "targetSprings2D"], "triangle-coordinate-map": ["triangle-points", "mapTriangleCoordinates2D"],
};
const entries = readdirSync(join(root, "catalog/operations"))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const catalogPath = join(root, "catalog/operations", name);
    const catalog = readJson(catalogPath);
    const validation = validations.find((entry) => entry.operation?.id === catalog.id);
    const stem = name.slice(0, -5), binding = bindings[stem];
    if (binding && typeof packageBindings[binding[1]] !== "function")
      throw Error(`JavaScript binding drift: ${catalog.id} expects ${binding[1]} from package index`);
    if (binding && !readFileSync(join(root, "packages/javascript/src", `${binding[0]}.js`), "utf8").includes(binding[1]))
      throw Error(`JavaScript module drift: ${catalog.id} expects ${binding[1]} in ${binding[0]}.js`);
    return {
      id: catalog.id, version: catalog.version, role: catalog.role, description: catalog.description,
      input: catalog.input_schema, query: catalog.query_schema ?? catalog.access_schema, queryOutput: catalog.query_output_schema ?? catalog.point_schema, output: catalog.output_schema,
      errors: catalog.errors ?? {}, errorOrder: catalog.error_order ?? [], behavior: catalog.behavior ?? {},
      provenance: (catalog.provenance ?? []).map(({ candidate_id }) => ({ candidate: candidate_id, sketch: candidate_id.split("#")[0] })),
      javascript: binding ? { exports: [binding[1]], module: `packages/javascript/src/${binding[0]}.js`, package: "@procedurals/javascript" } : null,
      support: Object.entries(validation?.targets ?? {}).map(([target, value]) => ({
        target,
        core: value.core?.status ?? "unvalidated",
        native: value.native?.status ?? "unvalidated",
        technique: value.technique?.status ?? "unvalidated",
      })),
      sha256: createHash("sha256").update(readFileSync(catalogPath)).digest("hex"),
    };
  });
const payload = JSON.stringify({ schemaVersion: 1, operations: entries }, null, 2) + "\n";
const output = join(app, "lib/generated-api.json");
if (process.argv.includes("--check")) {
  if (!existsSync(output) || readFileSync(output, "utf8") !== payload)
    throw Error("API metadata drift. Run node scripts/generate-api.mjs.");
  console.log(`API metadata current: ${entries.length} operations.`);
} else {
  writeFileSync(output, payload);
  console.log(`Generated API metadata for ${entries.length} operations.`);
}
