/**
 * Export bundles. Editable source, control values, licenses, dependency hashes and the
 * render manifest travel together. Mixed compositions export their document plus
 * per-layer sources and replay inputs; a portable single-sketch export is unsupported
 * until a compositor exporter exists, and a preview PNG is never labelled editable source.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITS, WORK_ROOT, ensureDirectories, fail, sha256, snapshotHash, REPO_ROOT } from "./core";
import { readManifest, verifyArtifact } from "./store";
import type { ArtifactManifest } from "./store";
import { canonicalJson } from "../studio-document";
import type { DocumentLayer, StudioDocumentV3 } from "../studio-document";

const EXPORT_ROOT = join(WORK_ROOT, "exports");
export type ExportFormat =
  | "document-json"
  | "p5-standalone-html"
  | "processing-java-tabs"
  | "studio-bundle";
export type BundleEntry = { path: string; bytes: number; sha256: string; note: string };
export type ExportResult = {
  format: string;
  bundleHandle: string;
  entries: BundleEntry[];
  compatibility: { layerId: string; kind: string; supported: boolean; note: string }[];
  notes: string[];
  bytes: number;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();
const crc32 = (data: Uint8Array): number => {
  let value = 0xffffffff;
  for (const byte of data) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
/** Deterministic store-only ZIP: fixed timestamps, no compression, no external tools. */
function zip(files: { path: string; body: Buffer }[]): Buffer {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8"),
      checksum = crc32(file.body),
      local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.body.length, 18);
    local.writeUInt32LE(file.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, file.body);
    const entry = Buffer.alloc(46 + name.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(file.body.length, 20);
    entry.writeUInt32LE(file.body.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    name.copy(entry, 46);
    central.push(entry);
    offset += local.length + file.body.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, directory, end]);
}

const P5_SCAFFOLD = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Procedurals studio layer export</title>
    <script type="importmap">
      { "imports": { "procedurals": "./pkg/index.js" } }
    </script>
    <script src="./p5.min.js"></script>
    <style>body { margin: 0; background: BACKGROUND; }</style>
  </head>
  <body>
    <script type="module">
      import { setup as layerSetup, render as layerRender } from "./ENTRYPOINT";
      const controls = CONTROLS;
      new p5((p) => {
        p.setup = () => {
          p.createCanvas(WIDTH, HEIGHT);
          p.pixelDensity(1);
          p.noLoop();
          p.clear();
          p.randomSeed(RANDOM_SEED);
          p.noiseSeed(NOISE_SEED);
          const context = { controls, tick: 1, ticks: TICKS, width: WIDTH, height: HEIGHT,
            randomSeed: RANDOM_SEED, noiseSeed: NOISE_SEED };
          if (layerSetup) layerSetup(p, context);
          for (let tick = 1; tick <= TICKS; tick += 1) layerRender(p, { ...context, tick });
        };
      }, document.body);
    </script>
  </body>
</html>
`;
const JAVA_README = `Processing Java layer export
============================

Open this folder in the Processing 4 IDE. The layer hooks are the frozen studio contract:

    void setupLayer(PGraphics g, LayerControls controls)      // optional
    void renderFrame(PGraphics g, LayerControls controls, int tick)

Drawing targets the supplied offscreen surface. LayerControls.java reproduces the control
values recorded in controls.json; edit either the values or the layer source. The studio
host renders this layer offscreen with an explicitly declared transparent or opaque
background, so a sketch that expects a display window needs adaptation.
`;

function packageFiles(): { path: string; body: Buffer }[] {
  const root = join(REPO_ROOT, "packages/javascript/src"),
    collected: { path: string; body: Buffer }[] = [],
    walk = (relative: string): void => {
      const absolute = join(root, relative);
      for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        const next = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".js"))
          collected.push({ path: `pkg/${next}`, body: readFileSync(join(root, next)) });
      }
    };
  walk("");
  return collected;
}
function layerControlsJava(values: Record<string, unknown>): string {
  const numbers = Object.entries(values).filter(([, value]) => typeof value === "number"),
    flags = Object.entries(values).filter(([, value]) => typeof value === "boolean"),
    options = Object.entries(values).filter(([, value]) => typeof value === "string");
  const entry = (pairs: [string, unknown][], render: (value: unknown) => string): string =>
    pairs.map(([key, value]) => `    if (key.equals("${key}")) return ${render(value)};`).join("\n");
  return `/** Exported control values recorded with this layer revision. */
public class LayerControls {
  public float number(String key) {
${entry(numbers, (value) => `${Number(value)}f`)}
    throw new IllegalArgumentException("unknown numeric control: " + key);
  }
  public boolean flag(String key) {
${entry(flags, (value) => String(value))}
    throw new IllegalArgumentException("unknown boolean control: " + key);
  }
  public String option(String key) {
${entry(options, (value) => JSON.stringify(String(value)))}
    throw new IllegalArgumentException("unknown option control: " + key);
  }
}
`;
}

export function exportBundle(document: StudioDocumentV3, format: string): ExportResult {
  if (
    format !== "document-json" &&
    format !== "p5-standalone-html" &&
    format !== "processing-java-tabs" &&
    format !== "studio-bundle"
  )
    fail(
      "capability",
      "UNSUPPORTED_CAPABILITY",
      `Unknown export format ${format}; portable single-sketch export is unsupported until a compositor exporter exists`,
      { location: "format" },
    );
  ensureDirectories();
  mkdirSync(EXPORT_ROOT, { recursive: true });
  const files: { path: string; body: Buffer; note: string }[] = [],
    compatibility: ExportResult["compatibility"] = [],
    notes: string[] = [],
    manifests: Record<string, ArtifactManifest> = {};
  files.push({
    path: "document.json",
    body: Buffer.from(`${JSON.stringify(document, null, 2)}\n`),
    note: "studio-v3 document with artifact references",
  });
  const sourceLayers = document.layers.filter(
    (layer): layer is Extract<DocumentLayer, { kind: "source" }> => layer.kind === "source",
  );
  for (const layer of document.layers) {
    if (layer.kind === "workflow") {
      compatibility.push({
        layerId: layer.id,
        kind: "workflow",
        supported: format === "document-json" || format === "studio-bundle",
        note: `Workflow ${layer.content.technique} exports as validated settings; it renders through the studio renderer, not as standalone source.`,
      });
      continue;
    }
    if (layer.kind === "recipe") {
      compatibility.push({
        layerId: layer.id,
        kind: "recipe",
        supported: false,
        note: "Recipe layers have no admitted executor, so no runnable export is produced.",
      });
      continue;
    }
    const manifest = verifyArtifact(layer.content.sourceArtifactHash);
    manifests[layer.id] = manifest;
    const wanted =
      format === "studio-bundle" ||
      (format === "p5-standalone-html" && layer.content.language === "p5js") ||
      (format === "processing-java-tabs" && layer.content.language === "processing-java");
    compatibility.push({
      layerId: layer.id,
      kind: `source:${layer.content.language}`,
      supported: wanted,
      note: wanted
        ? `Editable ${layer.content.language} source with its recorded control values, seeds and tick.`
        : `Layer language ${layer.content.language} is outside the ${format} export.`,
    });
    if (!wanted) continue;
    const directory = format === "studio-bundle" ? `layers/${layer.id}/` : "";
    for (const file of manifest.fileHashes)
      files.push({
        path: `${directory}${file.path}`,
        body: readFileSync(
          join(REPO_ROOT, ".work/harness/artifacts", manifest.contentHash, "files", file.path),
        ),
        note: "editable layer source",
      });
    files.push({
      path: `${directory}controls.json`,
      body: Buffer.from(
        `${JSON.stringify(
          {
            controls: layer.content.controls,
            declarations: manifest.controls,
            randomSeed: layer.content.randomSeed,
            noiseSeed: layer.content.noiseSeed,
            tick: layer.content.tick,
            background: layer.content.background,
            runnerProfile: layer.content.runnerProfile,
          },
          null,
          2,
        )}\n`,
      ),
      note: "control values and replay inputs",
    });
    files.push({
      path: `${directory}render-manifest.json`,
      body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
      note: "artifact manifest: dependency hashes, operations, seeds, replay policy",
    });
    if (layer.content.previewArtifactHash) {
      const preview = readManifest(layer.content.previewArtifactHash);
      files.push({
        path: `${directory}preview.png`,
        body: readFileSync(
          join(REPO_ROOT, ".work/harness/artifacts", preview.contentHash, "image.png"),
        ),
        note: "rendered preview raster; not an editable export",
      });
      files.push({
        path: `${directory}preview-manifest.json`,
        body: Buffer.from(`${JSON.stringify(preview, null, 2)}\n`),
        note: "render manifest for the preview raster",
      });
    }
    if (layer.content.language === "p5js") {
      files.push({
        path: `${directory}index.html`,
        body: Buffer.from(
          P5_SCAFFOLD.replace(/ENTRYPOINT/g, layer.content.entrypoint)
            .replace(/CONTROLS/g, JSON.stringify(layer.content.controls))
            .replace(/BACKGROUND/g, layer.content.background === "opaque" ? document.background : "transparent")
            .replace(/RANDOM_SEED/g, String(layer.content.randomSeed))
            .replace(/NOISE_SEED/g, String(layer.content.noiseSeed))
            .replace(/TICKS/g, String(layer.content.tick))
            .replace(/WIDTH/g, String(document.width))
            .replace(/HEIGHT/g, String(document.height)),
        ),
        note: "standalone pinned p5 scaffold",
      });
      files.push({
        path: `${directory}p5.min.js`,
        body: readFileSync(join(REPO_ROOT, "apps/web/node_modules/p5/lib/p5.min.js")),
        note: "pinned p5 runtime dependency",
      });
      for (const entry of packageFiles())
        files.push({ path: `${directory}${entry.path}`, body: entry.body, note: "pinned project package module" });
    } else {
      files.push({
        path: `${directory}LayerControls.java`,
        body: Buffer.from(layerControlsJava(layer.content.controls)),
        note: "exported control values as the frozen LayerControls contract",
      });
      files.push({ path: `${directory}README.md`, body: Buffer.from(JAVA_README), note: "editing instructions" });
    }
  }
  files.push({
    path: "LICENSES.md",
    body: Buffer.from(
      `# Licenses and dependencies\n\n- Project operations: @procedurals/javascript, local reviewed artifact.\n- p5.js runtime: LGPL-2.1, pinned copy from apps/web/node_modules/p5.\n- Processing 4.5.6 core: LGPL-2.1, pinned toolchain copy (not redistributed in this bundle).\n${sourceLayers
        .flatMap((layer) => manifests[layer.id]?.licenseReferences ?? [])
        .map((reference) => `- Declared by a layer: ${reference}\n`)
        .join("")}`,
    ),
    note: "license references collected from layer manifests",
  });
  if (format === "processing-java-tabs" && !sourceLayers.some((layer) => layer.content.language === "processing-java"))
    notes.push("No Processing Java source layer is present; only the document and licenses were exported.");
  if (document.layers.length > 1)
    notes.push(
      "Mixed compositions export the document plus per-layer sources and replay inputs; a single portable sketch that reproduces the whole stack is unsupported.",
    );
  notes.push("A preview PNG is a rendered raster, never an editable Processing or p5 export.");
  const archive = zip(files.map((file) => ({ path: file.path, body: file.body }))),
    digest = sha256(archive);
  if (archive.length > LIMITS.maxRenderBytes * 8)
    fail("budget", "RESOURCE_EXHAUSTED", "The export bundle exceeds its size budget");
  const path = join(EXPORT_ROOT, `${digest}.zip`);
  if (!existsSync(path)) writeFileSync(path, archive);
  writeFileSync(
    join(EXPORT_ROOT, `${digest}.json`),
    `${JSON.stringify(
      {
        format,
        snapshotHash: snapshotHash(),
        documentHash: sha256(canonicalJson(document)),
        entries: files.map((file) => ({ path: file.path, bytes: file.body.length, note: file.note })),
        compatibility,
        notes,
      },
      null,
      2,
    )}\n`,
  );
  return {
    format,
    bundleHandle: digest,
    entries: files.map((file) => ({
      path: file.path,
      bytes: file.body.length,
      sha256: sha256(file.body),
      note: file.note,
    })),
    compatibility,
    notes,
    bytes: archive.length,
  };
}
export const exportPath = (handle: string): string | null => {
  if (!/^[0-9a-f]{64}$/.test(handle)) return null;
  const path = join(EXPORT_ROOT, `${handle}.zip`);
  return existsSync(path) ? path : null;
};
