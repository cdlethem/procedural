/**
 * Content-addressed artifact storage plus candidate, job and apply records.
 * Artifacts are immutable: a source revision creates a new hash. Manifests carry the
 * replay metadata a later render or export must reproduce. Nothing here executes code.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, posix } from "node:path";
import { randomUUID } from "node:crypto";
import {
  APPLY_ROOT,
  ARTIFACT_ROOT,
  CANDIDATE_ROOT,
  ensureDirectories,
  fail,
  JOB_ROOT,
  LIMITS,
  sha256,
} from "./core";
import type { Diagnostic } from "./core";
import { canonicalJson } from "../studio-document";
import type {
  CandidateScope,
  ControlValue,
  SourceLanguage,
  StudioDocumentV3,
} from "../studio-document";

export type ArtifactKind = "source" | "image" | "recipe" | "bundle";
export type ArtifactFile = { path: string; sha256: string; bytes: number };
export type ControlDeclaration = {
  key: string;
  label: string;
  description: string;
  type: "number" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  value: ControlValue;
};
export type ArtifactManifest = {
  contentHash: string;
  kind: ArtifactKind;
  schemaVersion: 1;
  language: SourceLanguage | null;
  entrypoint: string | null;
  fileHashes: ArtifactFile[];
  dependencyHashes: ArtifactFile[];
  operationIdsAndVersions: { id: string; version: string; usage: "declared" | "verified" }[];
  runtimeHash: string;
  assetHashes: ArtifactFile[];
  licenseReferences: string[];
  canvas: { width: number; height: number; pixelDensity: number };
  renderer: string;
  randomSeed: number;
  noiseSeed: number;
  frameContext: { tick: number; policy: "logical-ticks" };
  replayPolicy: "clean-setup-logical-ticks" | "immutable-raster";
  controls: ControlDeclaration[];
  customAlgorithms: string[];
  /** Rendered images bind their exact render inputs; source artifacts carry null. */
  inputsHash: string | null;
  createdAt: string;
};
export type SourceArtifactInput = {
  language: SourceLanguage;
  entrypoint: string;
  files: { path: string; text: string }[];
  controls: ControlDeclaration[];
  dependencyHashes: ArtifactFile[];
  operationIdsAndVersions: ArtifactManifest["operationIdsAndVersions"];
  runtimeHash: string;
  renderer: string;
  randomSeed: number;
  noiseSeed: number;
  tick: number;
  licenseReferences: string[];
  customAlgorithms: string[];
};
export type ImageArtifactInput = {
  bytes: Uint8Array;
  renderer: string;
  randomSeed: number;
  noiseSeed: number;
  tick: number;
  dependencyHashes: ArtifactFile[];
  operationIdsAndVersions: ArtifactManifest["operationIdsAndVersions"];
  runtimeHash: string;
  licenseReferences: string[];
  inputsHash: string;
};
export type CandidateRecord = {
  id: string;
  requestId: string;
  createdAt: string;
  baseDocumentHash: string;
  scope: CandidateScope;
  selectedLayerId: string | null;
  bindingSnapshotHash: string;
  resultingDocument: StudioDocumentV3;
  artifacts: string[];
  intentPredicates: string[];
  assumptions: string[];
  provenance: {
    origin: "web-harness" | "mcp-client";
    runId: string | null;
    model: string | null;
    toolCalls: number;
    references: string[];
  };
  previewJobId: string | null;
  validation: { diagnostics: Diagnostic[]; validatedAt: string } | null;
};
export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type JobRecord = {
  id: string;
  kind: "p5-render" | "java-render";
  candidateId: string;
  layerId: string;
  state: JobState;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  chargedRenders: number;
  runId: string | null;
  pid: number | null;
  progress: string;
  diagnostics: Diagnostic[];
  imageArtifactHash: string | null;
  manifestHash: string | null;
  workDirectory: string;
  limits: { renderSeconds: number; compileSeconds: number; heapMegabytes: number };
};

const atomicWrite = (path: string, body: string): void => {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, body);
  renameSync(temporary, path);
};
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const ARTIFACT_PATH = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export const artifactDirectory = (hash: string): string => join(ARTIFACT_ROOT, hash);
export const artifactExists = (hash: string): boolean =>
  existsSync(join(artifactDirectory(hash), "manifest.json"));

function manifestIdentity(body: Omit<ArtifactManifest, "contentHash" | "createdAt">): string {
  return sha256(canonicalJson(body));
}
function persist(manifest: ArtifactManifest, write: (directory: string) => void): ArtifactManifest {
  ensureDirectories();
  const directory = artifactDirectory(manifest.contentHash);
  if (!existsSync(join(directory, "manifest.json"))) {
    mkdirSync(join(directory, "files"), { recursive: true });
    write(directory);
    atomicWrite(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return readManifest(manifest.contentHash);
}
/** Immutable source revision: rejects path escapes, oversized files and duplicate paths. */
export function writeSourceArtifact(input: SourceArtifactInput): ArtifactManifest {
  if (input.files.length < 1 || input.files.length > LIMITS.maxSourceFiles)
    fail(
      "schema",
      "MALFORMED_REQUEST",
      `A source artifact holds 1 to ${LIMITS.maxSourceFiles} files`,
      { location: "files" },
    );
  const seen = new Set<string>();
  let total = 0;
  const files: ArtifactFile[] = input.files.map((file) => {
    if (!ARTIFACT_PATH.test(file.path) || posix.normalize(file.path) !== file.path)
      fail("schema", "MALFORMED_REQUEST", `Unusable artifact file name: ${file.path}`, {
        location: `files.${file.path}`,
      });
    if (seen.has(file.path))
      fail("schema", "MALFORMED_REQUEST", `Duplicate artifact file: ${file.path}`, {
        location: `files.${file.path}`,
      });
    seen.add(file.path);
    const bytes = Buffer.byteLength(file.text, "utf8");
    total += bytes;
    return { path: file.path, sha256: sha256(file.text), bytes };
  });
  if (total > LIMITS.maxSourceBytes)
    fail("budget", "RESOURCE_EXHAUSTED", `Source artifacts are limited to ${LIMITS.maxSourceBytes} bytes`, {
      location: "files",
    });
  if (!seen.has(input.entrypoint))
    fail("schema", "MALFORMED_REQUEST", `Entrypoint ${input.entrypoint} is not among the files`, {
      location: "entrypoint",
    });
  const body = {
    kind: "source" as const,
    schemaVersion: 1 as const,
    language: input.language,
    entrypoint: input.entrypoint,
    fileHashes: files,
    dependencyHashes: input.dependencyHashes,
    operationIdsAndVersions: input.operationIdsAndVersions,
    runtimeHash: input.runtimeHash,
    assetHashes: [],
    licenseReferences: input.licenseReferences,
    canvas: {
      width: LIMITS.canvasWidth,
      height: LIMITS.canvasHeight,
      pixelDensity: LIMITS.pixelDensity,
    },
    renderer: input.renderer,
    randomSeed: input.randomSeed,
    noiseSeed: input.noiseSeed,
    frameContext: { tick: input.tick, policy: "logical-ticks" as const },
    replayPolicy: "clean-setup-logical-ticks" as const,
    controls: input.controls,
    inputsHash: null,
    customAlgorithms: input.customAlgorithms,
  };
  const manifest: ArtifactManifest = {
    contentHash: manifestIdentity(body),
    createdAt: new Date().toISOString(),
    ...body,
  };
  return persist(manifest, (directory) => {
    for (const file of input.files)
      writeFileSync(join(directory, "files", file.path), file.text, { mode: 0o444 });
  });
}
/** Rendered straight-alpha PNG: the image bytes are the artifact identity. */
export function writeImageArtifact(input: ImageArtifactInput): ArtifactManifest {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > LIMITS.maxRenderBytes)
    fail("render", "RESOURCE_EXHAUSTED", "Rendered image is empty or exceeds the output limit");
  const signature = Buffer.from(input.bytes.subarray(0, 8)).toString("hex");
  if (signature !== "89504e470d0a1a0a")
    fail("render", "RUNTIME_FAILURE", "Rendered output is not a PNG image");
  const body = {
    kind: "image" as const,
    schemaVersion: 1 as const,
    language: null,
    entrypoint: null,
    fileHashes: [
      { path: "image.png", sha256: sha256(input.bytes), bytes: input.bytes.byteLength },
    ],
    dependencyHashes: input.dependencyHashes,
    operationIdsAndVersions: input.operationIdsAndVersions,
    runtimeHash: input.runtimeHash,
    assetHashes: [],
    licenseReferences: input.licenseReferences,
    canvas: {
      width: LIMITS.canvasWidth,
      height: LIMITS.canvasHeight,
      pixelDensity: LIMITS.pixelDensity,
    },
    renderer: input.renderer,
    randomSeed: input.randomSeed,
    noiseSeed: input.noiseSeed,
    frameContext: { tick: input.tick, policy: "logical-ticks" as const },
    replayPolicy: "immutable-raster" as const,
    controls: [],
    inputsHash: input.inputsHash,
    customAlgorithms: [],
  };
  const manifest: ArtifactManifest = {
    contentHash: sha256(input.bytes),
    createdAt: new Date().toISOString(),
    ...body,
  };
  return persist(manifest, (directory) =>
    writeFileSync(join(directory, "image.png"), input.bytes, { mode: 0o444 }),
  );
}
export function readManifest(hash: string): ArtifactManifest {
  const path = join(artifactDirectory(hash), "manifest.json");
  if (!existsSync(path))
    fail("binding", "MISSING_ASSET", `Artifact ${hash} is not stored`, { location: hash });
  const parsed = readJson(path);
  if (!parsed || typeof parsed !== "object" || !("contentHash" in parsed))
    fail("binding", "MISSING_ASSET", `Artifact ${hash} has no usable manifest`);
  return parsed as ArtifactManifest;
}
/** Verifies stored bytes against the manifest before any decode or execution. */
export function verifyArtifact(hash: string): ArtifactManifest {
  const manifest = readManifest(hash),
    directory = artifactDirectory(hash);
  for (const file of manifest.fileHashes) {
    const path = manifest.kind === "image" ? join(directory, "image.png") : join(directory, "files", file.path),
      stats = existsSync(path) ? statSync(path) : null;
    if (!stats || !stats.isFile() || stats.size !== file.bytes)
      fail("binding", "MISSING_ASSET", `Artifact ${hash} is missing ${file.path}`);
    if (sha256(readFileSync(path)) !== file.sha256)
      fail("binding", "MISSING_ASSET", `Artifact ${hash} file ${file.path} changed on disk`);
  }
  return manifest;
}
export function artifactFilePath(hash: string, path: string): string {
  const manifest = readManifest(hash);
  if (manifest.kind === "image") {
    if (path !== "image.png")
      fail("request", "UNKNOWN_HANDLE", `Image artifact ${hash} only holds image.png`);
    return join(artifactDirectory(hash), "image.png");
  }
  if (!manifest.fileHashes.some((file) => file.path === path))
    fail("request", "UNKNOWN_HANDLE", `Artifact ${hash} does not hold ${path}`);
  return join(artifactDirectory(hash), "files", path);
}
export const readArtifactBytes = (hash: string, path: string): Buffer =>
  readFileSync(artifactFilePath(hash, path));

export function saveCandidate(candidate: CandidateRecord): CandidateRecord {
  ensureDirectories();
  atomicWrite(
    join(CANDIDATE_ROOT, `${candidate.id}.json`),
    `${JSON.stringify(candidate, null, 2)}\n`,
  );
  return candidate;
}
export function loadCandidate(id: string): CandidateRecord {
  if (!/^cand-[0-9a-f-]{36}$/.test(id))
    fail("request", "UNKNOWN_HANDLE", `Unusable candidate handle: ${id}`);
  const path = join(CANDIDATE_ROOT, `${id}.json`);
  if (!existsSync(path)) fail("request", "UNKNOWN_HANDLE", `Unknown candidate: ${id}`);
  return readJson(path) as CandidateRecord;
}
export const newCandidateId = (): string => `cand-${randomUUID()}`;
export const newJobId = (): string => `job-${randomUUID()}`;

export function saveJob(job: JobRecord): JobRecord {
  ensureDirectories();
  atomicWrite(join(JOB_ROOT, `${job.id}.json`), `${JSON.stringify(job, null, 2)}\n`);
  return job;
}
export function loadJob(id: string): JobRecord {
  if (!/^job-[0-9a-f-]{36}$/.test(id))
    fail("request", "UNKNOWN_HANDLE", `Unusable job handle: ${id}`);
  const path = join(JOB_ROOT, `${id}.json`);
  if (!existsSync(path)) fail("request", "UNKNOWN_HANDLE", `Unknown job: ${id}`);
  return readJson(path) as JobRecord;
}
/** Only this service's own job records count; runner fixtures share the directory. */
export const activeJobs = (): JobRecord[] =>
  existsSync(JOB_ROOT)
    ? readdirSync(JOB_ROOT)
        .filter((name) => /^job-[0-9a-f-]{36}\.json$/.test(name))
        .map((name) => readJson(join(JOB_ROOT, name)) as JobRecord)
        .filter(
          (job) =>
            typeof job.id === "string" && (job.state === "queued" || job.state === "running"),
        )
    : [];

export type ApplyRecord = {
  idempotencyKey: string;
  candidateId: string;
  revisionHash: string;
  appliedAt: string;
  undoDocumentHash: string;
};
export function saveApply(record: ApplyRecord): ApplyRecord {
  ensureDirectories();
  atomicWrite(
    join(APPLY_ROOT, `${sha256(record.idempotencyKey)}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  return record;
}
export function loadApply(key: string): ApplyRecord | null {
  const path = join(APPLY_ROOT, `${sha256(key)}.json`);
  return existsSync(path) ? (readJson(path) as ApplyRecord) : null;
}
