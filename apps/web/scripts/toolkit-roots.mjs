import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function resolveToolkitRoots(appRoot) {
  const javascriptRoot = dirname(fileURLToPath(import.meta.resolve("@procedurals/javascript/package.json")));
  const catalogRoot = dirname(fileURLToPath(import.meta.resolve("@procedurals/catalog/manifest.json")));
  const javascriptPackage = readJson(join(javascriptRoot, "package.json"));
  const catalogPackage = readJson(join(catalogRoot, "package.json"));
  const catalogManifest = readJson(join(catalogRoot, "manifest.json"));

  if (javascriptPackage.name !== "@procedurals/javascript" || catalogPackage.name !== "@procedurals/catalog")
    throw Error("Unexpected toolkit package identity");
  if (javascriptPackage.version !== catalogPackage.version || javascriptPackage.version !== catalogManifest.javascriptVersion)
    throw Error("Toolkit package version mismatch");
  if (!/^[0-9a-f]{40}$/.test(catalogManifest.sourceCommit))
    throw Error("Invalid toolkit source commit");
  const paths = catalogManifest.files.map((entry) => entry.path);
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort()) || new Set(paths).size !== paths.length)
    throw Error("Catalog manifest paths must be unique and sorted");
  for (const entry of catalogManifest.files) {
    const path = join(catalogRoot, entry.path);
    if (statSync(path).size !== entry.bytes || sha256(path) !== entry.sha256)
      throw Error(`Catalog package integrity mismatch: ${entry.path}`);
  }

  const physicalPath = (logicalPath) => {
    if (logicalPath.startsWith("apps/web/")) return join(appRoot, logicalPath.slice("apps/web/".length));
    if (logicalPath.startsWith("packages/javascript/")) return join(javascriptRoot, logicalPath.slice("packages/javascript/".length));
    if (logicalPath.startsWith("catalog/") || logicalPath.startsWith("docs/")) return join(catalogRoot, logicalPath);
    throw Error(`Unsupported logical toolkit path: ${logicalPath}`);
  };
  return { appRoot, javascriptRoot, catalogRoot, catalogManifest, javascriptPackage, physicalPath };
}
