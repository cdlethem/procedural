#!/usr/bin/env node
/** Deterministic catalog/docs consumer. No operation defaults or acceptance are authored here. */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  cpSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sketchSources } from "./sketch-source.mjs";
const app = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  root = resolve(app, "../..");
const read = (p) => readFileSync(join(root, p), "utf8");
const hash = (p) =>
  createHash("sha256")
    .update(readFileSync(join(root, p)))
    .digest("hex");
// Authored workflow membership, not a second operation parameter/support registry.
const definitions = [
  [
    "field-marks",
    "Fields & paths",
    ["regular-grid", "gradient-noise-2d-01", "cyclic-palette"],
  ],
  [
    "path-marks",
    "Fields & paths",
    ["regular-grid", "gradient-noise-2d-01", "gradient-path", "cyclic-palette"],
  ],
  [
    "placement-marks",
    "Shapes & space",
    ["seeded-circle-placement", "ordered-circle-filter"],
  ],
  [
    "lattice-marks",
    "Fields & paths",
    ["occupied-lattice-paths-2d", "cyclic-palette"],
  ],
  ["band-marks", "Fields & paths", ["noise-band-path"]],
  [
    "branch-marks",
    "Fields & paths",
    ["seeded-endpoint-branches", "seeded-circle-placement"],
  ],
  ["cut-branch-marks", "Fields & paths", ["seeded-line-pool-2d"]],
  ["loop-marks", "Shapes & space", ["closed-spline-2d"]],
  ["region-marks", "Layouts", ["seeded-quadrant-partition", "regular-grid"]],
  ["panel-marks", "Layouts", ["binary-cell-partition-2d"]],
  ["cut-marks", "Layouts", ["retained-rectangle-cuts-2d"]],
  ["polygon-marks", "Shapes & space", ["ordered-convex-polygon-filter-2d"]],
  [
    "facet-marks",
    "Shapes & space",
    [
      "delaunay-2d",
      "seeded-quadrant-partition",
      "seeded-triangle-points",
      "cyclic-palette",
    ],
  ],
  [
    "grain-marks",
    "Shapes & space",
    [
      "seeded-triangle-points",
      "triangle-coordinate-map",
      "seeded-quadrant-partition",
    ],
  ],
  [
    "pull-marks",
    "Transforms",
    ["radial-pull-2d", "closed-spline-2d", "cyclic-palette"],
  ],
  ["projection-marks", "Transforms", ["sequential-disc-projection-2d"]],
  [
    "path-clip-marks",
    "Transforms",
    [
      "gradient-noise-2d-01",
      "gradient-path",
      "clip-segments-simple-polygon-2d",
    ],
  ],
  ["ramp-marks", "Color & raster", ["stop-ramp"]],
  [
    "warp-marks",
    "Color & raster",
    ["bilinear-raster-remap", "gradient-noise-2d-01", "cyclic-palette"],
  ],
  [
    "blur-marks",
    "Color & raster",
    ["separable-blur-2d", "raster-crossfade", "masked-source-over"],
  ],
  ["profile-marks", "3D forms", ["radial-profile-surface", "cyclic-palette"]],
  ["annular-marks", "3D forms", ["annular-solid-3d"]],
  [
    "depth-marks",
    "3D forms",
    [
      "gradient-noise-3d-01",
      "radial-profile-surface",
      "regular-grid",
      "cyclic-palette",
    ],
  ],
  [
    "spring-marks",
    "Motion",
    ["target-springs-2d", "delaunay-2d", "regular-grid"],
  ],
];
const slugs = new Set(definitions.map((d) => d[0]));
// Reviewed p5 completion includes editable native examples without studio adapters.
// Keep their membership explicit so an unreviewed addition still fails generation.
const nativeOnlySlugs = new Set([
  "body-marks", "city-marks", "clip-marks", "contact-marks", "glyph-marks",
  "image-field-marks", "landscape-marks", "layer-marks", "mask-marks",
  "masked-partition-marks", "placement-image-marks", "pointer-marks", "relief-marks",
]);
const sources = sketchSources(root);
const browserGuidePath = "apps/web/content/browser-guides.json";
const browserGuides = existsSync(join(root, browserGuidePath))
  ? JSON.parse(read(browserGuidePath)) : {};
// These compositions expose the operations actually called by the live web adapter.
// Original native examples have their own separately recorded composition membership.
const webOperations = {
  "path-marks": ["regular-grid", "gradient-noise-2d-01", "gradient-path"],
  "region-marks": ["seeded-quadrant-partition"],
  "cut-marks": ["retained-rectangle-cuts-2d", "gradient-noise-2d-01"],
  "polygon-marks": ["ordered-convex-polygon-filter-2d", "seeded-triangle-points"],
  "facet-marks": ["delaunay-2d", "seeded-triangle-points"],
  "pull-marks": ["radial-pull-2d"],
  "path-clip-marks": ["clip-segments-simple-polygon-2d"],
  "warp-marks": ["bilinear-raster-remap", "gradient-noise-3d-01"],
  "blur-marks": ["separable-blur-2d"],
  "profile-marks": ["radial-profile-surface"],
  "depth-marks": ["gradient-noise-3d-01", "radial-profile-surface"],
  "spring-marks": ["target-springs-2d"],
};
const dirs = readdirSync(join(root, "packages/javascript/examples"), {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
if (
  dirs.length !== slugs.size + nativeOnlySlugs.size ||
  dirs.some((d) => !slugs.has(d) && !nativeOnlySlugs.has(d)) ||
  [...slugs, ...nativeOnlySlugs].some((slug) => !dirs.includes(slug))
)
  throw Error(
    "Workflow membership drift: review new/missing example before regenerating",
  );
const attestations = readdirSync(join(root, "catalog/validation"))
  .filter((n) => n.endsWith(".json"))
  .map((n) => ({
    path: `catalog/validation/${n}`,
    data: JSON.parse(read(`catalog/validation/${n}`)),
  }));
const techniques = definitions.map(([slug, category, contracts], index) => {
  const sourcePath = `packages/javascript/examples/${slug}/README.md`;
  const guidePath = existsSync(join(root, `docs/${slug}.md`))
    ? `docs/${slug}.md`
    : `apps/web/content/${slug}.md`;
  let markdown = browserGuides[slug] ?? read(guidePath);
  // Adapt the existing artist copy to browser controls, with no raw-file navigation.
  markdown = markdown.replace(
    /\[Install the Java library\][\s\S]*?(?:Save a copy before editing\.|save a copy\.)\s*/g,
    "",
  );
  markdown = markdown.replace(/^## Controls\s*\n[\s\S]*?(?=^## |$(?![\s\S]))/gm, "");
  markdown = markdown.replace(/^\| Key \|[^\n]*\n(?:\|[^\n]*\n)+/gm, "");
  markdown = markdown.replace(/\[([^\]]+)\]\(\.\.\/catalog\/operations\/([^)]*)\.json\)/g, "[$1](/api-reference/$2)");
  markdown = markdown.replace(
    /\[([^\]]+)\]\(([^):]+\.md)(#[^)]*)?\)/g,
    (_, label, target, anchor = "") => {
      const name = target.replace(/^.*\//, "").replace(/\.md$/, "");
      return slugs.has(name) ? `[${label}](/techniques/${name}${anchor})` : label;
    },
  );
  markdown = markdown.replace(/\]\(\/api-reference\/([a-z0-9-]+)\)/g, (_, stem) => {
    const catalogPath = `catalog/operations/${stem}.json`;
    if (!existsSync(join(root, catalogPath))) throw Error(`Unknown operation link: ${stem}`);
    return `](/api-reference/${JSON.parse(read(catalogPath)).id})`;
  });
  const description = markdown
    .replace(/^# .*\n+/, "")
    .split(/\n\s*\n/)[0]
    .replace(/\n/g, " ")
    .replace(/`/g, "");
  const operations = (webOperations[slug] ?? contracts).map((name) => {
    const catalogPath = `catalog/operations/${name}.json`,
      c = JSON.parse(read(catalogPath));
    const attestation = attestations.find((a) => a.data.operation?.id === c.id);
    if (!attestation) throw Error(`Missing attestation for ${c.id}`);
    if (
      attestation.data.operation.version !== c.version ||
      attestation.data.operation.catalog_sha256 !== hash(catalogPath)
    )
      throw Error(`Stale binding ${c.id}`);
    const target = attestation.data.targets?.p5js;
    return {
      id: c.id,
      version: c.version,
      description: c.description,
      catalogPath,
      sha256: hash(catalogPath),
      support: {
        core: target?.core?.status ?? "unvalidated",
        native: target?.native?.status ?? "unvalidated",
        technique: target?.technique?.status ?? "unvalidated",
      },
      attestationPath: attestation.path,
      attestationSha256: hash(attestation.path),
    };
  });
  return {
    slug,
    title: slug
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    description,
    category,
    markdown,
    sourcePath,
    guidePath,
    guideSha256: hash(guidePath),
    ...(browserGuides[slug] ? { browserGuidePath, browserGuideSha256: hash(browserGuidePath) } : {}),
    exampleUrl: `/native/examples/${slug}/index.html`,
    ...sources.get(slug),
    operations,
    studio: true,
  };
});
const bindings = techniques
  .filter((t) => t.studio)
  .map((t) => ({
    technique: t.slug,
    operations: t.operations.map((o) => ({
      id: o.id,
      version: o.version,
      sha256: o.sha256,
    })),
  }));
const studioBinding = {
  version: "studio-v3",
  catalogSha256: createHash("sha256")
    .update(JSON.stringify(bindings))
    .digest("hex"),
  techniques: bindings,
};
const payload =
  JSON.stringify({ schemaVersion: 1, studioBinding, techniques }, null, 2) +
  "\n";
const output = join(app, "lib/generated-gallery.json");
if (process.argv.includes("--check")) {
  if (!existsSync(output) || readFileSync(output, "utf8") !== payload)
    throw Error("Gallery metadata drift. Run npm run generate.");
  console.log(`Gallery metadata current: ${techniques.length} workflows.`);
} else {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, payload);
  const pub = join(app, "public");
  mkdirSync(pub, { recursive: true });
  for (const name of ["src", "examples"])
    cpSync(join(root, "packages/javascript", name), join(pub, "native", name), {
      recursive: true,
    });
  // Presentation-only adaptation: p5's inline dimensions otherwise overflow phones.
  // The drawing buffer and all original operation/example sources remain unchanged.
  for (const { slug } of techniques) {
    const html = join(pub, "native/examples", slug, "index.html");
    writeFileSync(
      html,
      readFileSync(html, "utf8").replace(
        "</head>",
        "<style>canvas{max-width:100%!important;height:auto!important}main{min-width:0;overflow-wrap:anywhere}</style></head>",
      ),
    );
  }
  // This retired generated directory held raw documentation downloads.
  rmSync(join(pub, "source"), { recursive: true, force: true });
  for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
    cpSync(join(root, name), join(pub, "native", name));
  const p5 = join(app, "node_modules/p5/lib/p5.min.js");
  if (!existsSync(p5))
    throw Error("Install web dependencies first (p5 runtime missing).");
  cpSync(p5, join(pub, "p5.js"));
  cpSync(
    join(app, "node_modules/p5/license.txt"),
    join(pub, "native/P5-LICENSE.txt"),
  );
  console.log(
    `Generated ${techniques.length} workflows and local native assets.`,
  );
}
