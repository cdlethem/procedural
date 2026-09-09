/**
 * Target-specific API reference derived from the installed runtimes, so the entries always
 * match the runtime a layer will actually execute in: p5.js documentation comments come
 * from the installed p5 distribution, Processing signatures from `javap` over the pinned
 * `core.jar`. Official URLs are attribution links; no reference prose is redistributed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDirectories, fail, REFERENCE_ROOT, REPO_ROOT, sha256 } from "./core";

export type ReferenceEntry = {
  symbol: string;
  owner: string;
  signature: string;
  summary: string;
  url: string;
  caveat: string | null;
};
export type ReferenceIndex = {
  runtime: "p5js" | "processing-java";
  version: string;
  sourcePath: string;
  sourceSha256: string;
  builtAt: string;
  attribution: string;
  entries: ReferenceEntry[];
};

const P5_DISTRIBUTION = "apps/web/node_modules/p5/lib/p5.js";
const P5_PACKAGE = "apps/web/node_modules/p5/package.json";
const PROCESSING_CORE = ".work/toolchains/processing-4.5.6/core-4.5.6.jar";
const JDK = ".work/toolchains/jdk-17.0.20.1+1";
const PROCESSING_CLASSES = [
  "processing.core.PApplet",
  "processing.core.PGraphics",
  "processing.core.PVector",
  "processing.core.PImage",
  "processing.core.PShape",
  "processing.core.PConstants",
];
/** Runner-mediated capabilities: discovery may describe them, the layer runner denies them. */
const DENIED = [
  /^(load|save|create)(Strings|Bytes|Table|XML|JSON|Reader|Writer|Output|Input|Path|File)/,
  /^(select|save|load)(Input|Output|Folder|Frame)/,
  /^launch$/,
  /^exec$/,
  /^link$/,
  /^(mouse|key|touch)/i,
  /^(request|load)Image$/,
  /^loadFont$/,
  /^loadShader$/,
  /^(millis|second|minute|hour|day|month|year)$/,
  /^frameRate$/,
  /^exit$/,
  /^size$/,
  /^fullScreen$/,
];
const caveatFor = (symbol: string): string | null =>
  DENIED.some((pattern) => pattern.test(symbol))
    ? "The layer runner mediates assets and denies host side effects, live input and wall-clock time; this call returns an explicit unsupported result or is meaningless in a replayable static snapshot."
    : null;

function cachePath(runtime: string, digest: string): string {
  ensureDirectories();
  return join(REFERENCE_ROOT, `${runtime}-${digest.slice(0, 16)}.json`);
}
function cached(path: string): ReferenceIndex | null {
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (parsed && typeof parsed === "object" && "entries" in parsed && Array.isArray(parsed.entries))
    return parsed as ReferenceIndex;
  return null;
}
/** Parses `@method` documentation blocks out of the installed p5 distribution. */
function buildP5Index(): ReferenceIndex {
  const distributionPath = join(REPO_ROOT, P5_DISTRIBUTION);
  if (!existsSync(distributionPath))
    fail(
      "capability",
      "UNSUPPORTED_CAPABILITY",
      `The installed p5 distribution is missing at ${P5_DISTRIBUTION}; reference lookup needs the runtime it documents`,
    );
  const body = readFileSync(distributionPath, "utf8"),
    digest = sha256(body),
    path = cachePath("p5js", digest),
    reuse = cached(path);
  if (reuse) return reuse;
  const parsedPackage: unknown = JSON.parse(readFileSync(join(REPO_ROOT, P5_PACKAGE), "utf8"));
  let version = "unknown";
  if (parsedPackage && typeof parsedPackage === "object" && "version" in parsedPackage && typeof parsedPackage.version === "string")
    version = parsedPackage.version;
  const entries: ReferenceEntry[] = [];
  const blocks = body.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  for (const block of blocks) {
    const method = /@method\s+([A-Za-z_$][\w$]*)/.exec(block);
    if (!method) continue;
    const lines = block
      .split("\n")
      .map((line) => line.replace(/^\s*\/?\*+\/?/, "").trim())
      .filter((line) => line.length > 0);
    const prose: string[] = [];
    const parameters: string[] = [];
    let returns = "void";
    for (const line of lines) {
      if (line.startsWith("@param")) {
        const parsed = /@param\s*(?:\{([^}]*)\})?\s*(\[?[\w$.]+\]?)/.exec(line);
        if (parsed) parameters.push(`${parsed[2]}${parsed[1] ? `: ${parsed[1]}` : ""}`);
        continue;
      }
      if (line.startsWith("@return")) {
        const parsed = /@returns?\s*(?:\{([^}]*)\})?/.exec(line);
        if (parsed?.[1]) returns = parsed[1];
        continue;
      }
      if (line.startsWith("@")) continue;
      if (prose.join(" ").length < 240) prose.push(line.replace(/<[^>]+>/g, ""));
    }
    const owner = /@for\s+([\w$.]+)/.exec(block)?.[1] ?? "p5";
    const symbol = method[1];
    if (entries.some((entry) => entry.symbol === symbol && entry.owner === owner)) continue;
    entries.push({
      symbol,
      owner,
      signature: `${symbol}(${parameters.join(", ")}) -> ${returns}`,
      summary: prose.join(" ").slice(0, 240),
      url: `https://p5js.org/reference/p5/${symbol}/`,
      caveat: caveatFor(symbol),
    });
  }
  const index: ReferenceIndex = {
    runtime: "p5js",
    version,
    sourcePath: P5_DISTRIBUTION,
    sourceSha256: digest,
    builtAt: new Date().toISOString(),
    attribution:
      "Derived from the installed p5.js distribution (LGPL-2.1) documentation comments; official reference: https://p5js.org/reference/",
    entries: entries.sort((left, right) => left.symbol.localeCompare(right.symbol)),
  };
  writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}
/** Reads public signatures out of the pinned Processing core with the pinned JDK's javap. */
function buildProcessingIndex(): ReferenceIndex {
  const corePath = join(REPO_ROOT, PROCESSING_CORE),
    javap = join(REPO_ROOT, JDK, "bin/javap");
  if (!existsSync(corePath) || !existsSync(javap))
    fail(
      "capability",
      "UNSUPPORTED_CAPABILITY",
      "The pinned Processing core or JDK is missing; Processing reference lookup needs the installed runtime",
    );
  const digest = sha256(readFileSync(corePath)),
    path = cachePath("processing-java", digest),
    reuse = cached(path);
  if (reuse) return reuse;
  const output = execFileSync(javap, ["-public", "-classpath", corePath, ...PROCESSING_CLASSES], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const entries: ReferenceEntry[] = [];
  let owner = "processing.core";
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    const declaration = /^(?:public\s+)?(?:final\s+|abstract\s+)?class\s+([\w.$]+)/.exec(line);
    if (declaration) {
      owner = declaration[1];
      continue;
    }
    const member = /^public\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?([\w.$<>,\[\]? ]+?)\s+([\w$]+)\(([^)]*)\);$/.exec(
      line,
    );
    if (!member) continue;
    const [, returns, symbol, parameters] = member;
    const signature = `${symbol}(${parameters}) -> ${returns.trim()}`;
    if (entries.some((entry) => entry.owner === owner && entry.signature === signature)) continue;
    entries.push({
      symbol,
      owner,
      signature,
      summary: `Public ${owner} member of the pinned Processing 4.5.6 runtime.`,
      url: `https://processing.org/reference/${symbol}_.html`,
      caveat: caveatFor(symbol),
    });
  }
  const index: ReferenceIndex = {
    runtime: "processing-java",
    version: "4.5.6",
    sourcePath: PROCESSING_CORE,
    sourceSha256: digest,
    builtAt: new Date().toISOString(),
    attribution:
      "Signatures read with javap from the pinned Processing 4.5.6 core.jar; official reference: https://processing.org/reference/ and https://processing.org/reference/createGraphics_.html for offscreen surfaces",
    entries: entries.sort((left, right) => left.symbol.localeCompare(right.symbol)),
  };
  writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}
const indexes: Record<string, ReferenceIndex | undefined> = {};
export function referenceIndex(runtime: "p5js" | "processing-java"): ReferenceIndex {
  const existing = indexes[runtime];
  if (existing) return existing;
  const built = runtime === "p5js" ? buildP5Index() : buildProcessingIndex();
  indexes[runtime] = built;
  return built;
}
export type ReferenceLookup = {
  runtime: string;
  version: string;
  sourceSha256: string;
  attribution: string;
  query: string;
  entries: ReferenceEntry[];
  truncated: boolean;
};
/** Symbol or concept lookup, filtered to the installed runtime version. */
export function lookupReference(
  runtime: "p5js" | "processing-java",
  query: string,
  limit = 12,
): ReferenceLookup {
  const index = referenceIndex(runtime),
    needle = query.trim().toLowerCase();
  if (!needle) fail("request", "MALFORMED_REQUEST", "A reference lookup needs a symbol or concept");
  const exact = index.entries.filter((entry) => entry.symbol.toLowerCase() === needle),
    prefixed = index.entries.filter(
      (entry) => entry.symbol.toLowerCase().startsWith(needle) && !exact.includes(entry),
    ),
    related = index.entries.filter(
      (entry) =>
        !exact.includes(entry) &&
        !prefixed.includes(entry) &&
        (entry.symbol.toLowerCase().includes(needle) ||
          entry.summary.toLowerCase().includes(needle) ||
          entry.signature.toLowerCase().includes(needle)),
    ),
    ranked = [...exact, ...prefixed, ...related];
  return {
    runtime: index.runtime,
    version: index.version,
    sourceSha256: index.sourceSha256,
    attribution: index.attribution,
    query,
    entries: ranked.slice(0, limit),
    truncated: ranked.length > limit,
  };
}
