/**
 * Render jobs. The service never executes generated code in this process: it writes a
 * frozen job spec and spawns `tools/harness/queue_render.py`, which queues for the
 * shared machine render lease and runs the disposable runner under OS limits. Job
 * states are queued/running/succeeded/failed/cancelled; cancellation kills the tree and
 * never publishes a partial preview.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  activeJobs,
  loadCandidate,
  loadJob,
  newJobId,
  readManifest,
  saveCandidate,
  saveJob,
  verifyArtifact,
  writeImageArtifact,
} from "./store";
import type { CandidateRecord, JobRecord } from "./store";
import {
  ensureDirectories,
  fail,
  JOB_ROOT,
  LIMITS,
  REPO_ROOT,
  requireRoute,
  sha256,
  snapshotHash,
} from "./core";
import type { Diagnostic } from "./core";
import { renderInputsHash, routeForLayer, validateCandidate } from "./candidates";
import type { SourceContent } from "../studio-document";
import { loadRun, chargeRun } from "./runs";

export const MAX_CONCURRENT_JOBS = 2;
export type RunnerProgress = { state: "queued" | "running"; note: string };
export type RunnerResult = {
  status: "succeeded" | "failed";
  stage: "compile" | "render";
  code?: string;
  message?: string;
  imagePath?: string;
  imageSha256?: string;
  imageBytes?: number;
  runtimeHash: string;
  dependencyHashes: { path: string; sha256: string; bytes: number }[];
  diagnostics: string[];
  deniedRequests: string[];
  /** Lowest alpha channel value in the rendered raster, 0-255. */
  minAlpha: number;
  startedAt: string;
  finishedAt: string;
};

const jobFile = (id: string, suffix: string): string => join(JOB_ROOT, `${id}.${suffix}`);
const readJsonFile = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Submits one validated candidate layer for rendering with an explicit frame context. */
export function submitRender(
  candidateId: string,
  layerId: string,
  tick: number,
  runId: string | null,
): JobRecord {
  const candidate = loadCandidate(candidateId),
    layer = candidate.resultingDocument.layers.find((entry) => entry.id === layerId);
  if (!layer) fail("request", "UNKNOWN_HANDLE", `Candidate has no layer ${layerId}`);
  if (layer!.kind !== "source")
    fail(
      "capability",
      "UNSUPPORTED_CAPABILITY",
      `Layer ${layerId} is a ${layer!.kind} layer; only source layers use the render service`,
      { location: `layers.${layerId}` },
    );
  const content: SourceContent = layer!.kind === "source" ? layer!.content : fail(
    "capability",
    "UNSUPPORTED_CAPABILITY",
    `Layer ${layerId} is not a source layer`,
  );
  if (tick !== content.tick)
    fail("request", "MALFORMED_REQUEST", `Frame context tick ${tick} differs from the layer tick ${content.tick}`, {
      location: "frameContext.tick",
    });
  const route = routeForLayer(layer!),
    capability = requireRoute(route);
  if (!capability.available)
    fail("capability", "UNSUPPORTED_CAPABILITY", `${route}: ${capability.reason}`, {
      location: `layers.${layerId}`,
    });
  const report = validateCandidate(candidateId);
  const blocking = report.diagnostics.filter((item) => item.stage !== "render");
  if (blocking.length) fail(blocking[0].stage, blocking[0].code, blocking[0].message, blocking[0]);
  // Reconcile first: a job whose supervisor died must not hold a render slot forever.
  const inFlight = activeJobs()
    .map((entry) => jobStatus(entry.id))
    .filter((entry) => entry.state === "queued" || entry.state === "running");
  if (inFlight.length >= MAX_CONCURRENT_JOBS)
    fail("budget", "RESOURCE_EXHAUSTED", `At most ${MAX_CONCURRENT_JOBS} render jobs may be in flight`, {
      retryable: true,
    });
  if (runId) chargeRun(runId);
  const manifest = verifyArtifact(content.sourceArtifactHash);
  ensureDirectories();
  const id = newJobId(),
    workDirectory = jobFile(id, "work");
  mkdirSync(workDirectory, { recursive: true });
  const spec = {
    jobSpecVersion: 1,
    jobId: id,
    kind: content.language === "p5js" ? "p5-render" : "java-render",
    candidateId,
    layerId,
    language: content.language,
    runnerProfile: content.runnerProfile,
    entrypoint: content.entrypoint,
    background: content.background,
    sourceDirectory: join(REPO_ROOT, ".work/harness/artifacts", content.sourceArtifactHash, "files"),
    sourceFiles: manifest.fileHashes,
    controls: content.controls,
    controlDeclarations: manifest.controls,
    randomSeed: content.randomSeed,
    noiseSeed: content.noiseSeed,
    tick: content.tick,
    canvas: {
      width: LIMITS.canvasWidth,
      height: LIMITS.canvasHeight,
      pixelDensity: LIMITS.pixelDensity,
    },
    limits: {
      renderSeconds: LIMITS.maxRenderSeconds,
      compileSeconds: LIMITS.maxCompileSeconds,
      heapMegabytes: LIMITS.maxHeapMegabytes,
      outputBytes: LIMITS.maxRenderBytes,
      queueSeconds: 240,
    },
    workDirectory,
    outputPath: join(workDirectory, "frame.png"),
    resultPath: jobFile(id, "runner.json"),
    progressPath: jobFile(id, "progress.json"),
    packageIndex: join(REPO_ROOT, "packages/javascript/src/index.js"),
    p5Bundle: join(REPO_ROOT, "apps/web/node_modules/p5/lib/p5.min.js"),
  };
  writeFileSync(jobFile(id, "spec.json"), `${JSON.stringify(spec, null, 2)}\n`);
  const runner =
    spec.kind === "p5-render" ? "tools/harness/run_p5_layer.mjs" : "tools/harness/run_java_layer.py";
  const child = spawn(
    "python3",
    [join(REPO_ROOT, "tools/harness/queue_render.py"), "--job", jobFile(id, "spec.json"), "--runner", runner],
    { cwd: REPO_ROOT, detached: true, stdio: ["ignore", "ignore", "ignore"] },
  );
  child.unref();
  return saveJob({
    id,
    kind: spec.kind === "p5-render" ? "p5-render" : "java-render",
    candidateId,
    layerId,
    state: "queued",
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    chargedRenders: 1,
    runId,
    pid: child.pid ?? null,
    progress: "queued for the shared native render lease",
    diagnostics: [],
    imageArtifactHash: null,
    manifestHash: null,
    workDirectory,
    limits: {
      renderSeconds: LIMITS.maxRenderSeconds,
      compileSeconds: LIMITS.maxCompileSeconds,
      heapMegabytes: LIMITS.maxHeapMegabytes,
    },
  });
}

const alive = (pid: number | null): boolean => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** Reads runner output, publishes the image artifact once, and reports the job state. */
export function jobStatus(id: string): JobRecord {
  const job = loadJob(id);
  if (job.state === "succeeded" || job.state === "failed" || job.state === "cancelled") return job;
  const progressPath = jobFile(id, "progress.json"),
    resultPath = jobFile(id, "runner.json");
  let next: JobRecord = job;
  if (existsSync(progressPath)) {
    const progress = readJsonFile(progressPath);
    if (progress && typeof progress === "object" && "state" in progress && "note" in progress) {
      const state = progress.state,
        note = progress.note;
      next = {
        ...next,
        state: state === "running" ? "running" : next.state,
        startedAt: state === "running" ? (next.startedAt ?? new Date().toISOString()) : next.startedAt,
        progress: typeof note === "string" ? note.slice(0, 240) : next.progress,
      };
    }
  }
  if (!existsSync(resultPath)) {
    if (!alive(job.pid))
      return saveJob({
        ...next,
        state: "failed",
        finishedAt: new Date().toISOString(),
        diagnostics: [
          {
            stage: "render",
            code: "RUNTIME_FAILURE",
            message: "The render process exited without publishing a result",
            retryable: true,
          },
        ],
      });
    return saveJob(next);
  }
  return saveJob(finalize(next, readJsonFile(resultPath)));
}
function diagnosticFrom(result: RunnerResult): Diagnostic {
  const code = result.code ?? "RUNTIME_FAILURE";
  const known: Record<string, Diagnostic["code"]> = {
    COMPILE_FAILURE: "COMPILE_FAILURE",
    RUNTIME_FAILURE: "RUNTIME_FAILURE",
    RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED",
    MISSING_ASSET: "MISSING_ASSET",
    UNSUPPORTED_CAPABILITY: "UNSUPPORTED_CAPABILITY",
    JOB_CANCELLED: "JOB_CANCELLED",
  };
  return {
    stage: result.stage === "compile" ? "compile" : "render",
    code: known[code] ?? "RUNTIME_FAILURE",
    message: `${result.message ?? "The runner reported a failure"}${
      result.diagnostics.length ? ` | ${result.diagnostics.slice(0, 4).join(" | ")}` : ""
    }`.slice(0, 2000),
    retryable: code === "RESOURCE_EXHAUSTED",
  };
}
function finalize(job: JobRecord, parsed: unknown): JobRecord {
  if (!parsed || typeof parsed !== "object" || !("status" in parsed))
    return {
      ...job,
      state: "failed",
      finishedAt: new Date().toISOString(),
      diagnostics: [
        {
          stage: "render",
          code: "RUNTIME_FAILURE",
          message: "The runner wrote an unusable result record",
          retryable: true,
        },
      ],
    };
  const result = parsed as RunnerResult;
  if (result.status !== "succeeded")
    return {
      ...job,
      state: "failed",
      finishedAt: result.finishedAt ?? new Date().toISOString(),
      progress: "runner reported a failure",
      diagnostics: [diagnosticFrom(result)],
    };
  if (!result.imagePath || !existsSync(result.imagePath))
    return {
      ...job,
      state: "failed",
      finishedAt: new Date().toISOString(),
      diagnostics: [
        {
          stage: "render",
          code: "RUNTIME_FAILURE",
          message: "The runner reported success without a rendered image",
          retryable: true,
        },
      ],
    };
  const bytes = readFileSync(result.imagePath);
  if (result.imageSha256 && sha256(bytes) !== result.imageSha256)
    return {
      ...job,
      state: "failed",
      finishedAt: new Date().toISOString(),
      diagnostics: [
        {
          stage: "render",
          code: "RUNTIME_FAILURE",
          message: "The rendered image does not match its reported digest",
          retryable: true,
        },
      ],
    };
  const candidate = loadCandidate(job.candidateId),
    layer = candidate.resultingDocument.layers.find((entry) => entry.id === job.layerId);
  if (!layer || layer.kind !== "source")
    return {
      ...job,
      state: "failed",
      finishedAt: new Date().toISOString(),
      diagnostics: [
        {
          stage: "render",
          code: "UNKNOWN_HANDLE",
          message: "The candidate layer disappeared before publication",
          retryable: false,
        },
      ],
    };
  if (layer.content.background === "opaque" && result.minAlpha < 255)
    return {
      ...job,
      state: "failed",
      finishedAt: new Date().toISOString(),
      diagnostics: [
        {
          stage: "render",
          code: "RUNTIME_FAILURE",
          message: `Layer ${job.layerId} declares an opaque surface but the render left alpha ${result.minAlpha}`,
          location: `layers.${job.layerId}.background`,
          retryable: false,
        },
      ],
    };
  const manifest = writeImageArtifact({
    bytes,
    renderer: layer.content.runnerProfile,
    randomSeed: layer.content.randomSeed,
    noiseSeed: layer.content.noiseSeed,
    tick: layer.content.tick,
    dependencyHashes: result.dependencyHashes,
    operationIdsAndVersions: readManifest(layer.content.sourceArtifactHash).operationIdsAndVersions,
    runtimeHash: result.runtimeHash,
    licenseReferences: readManifest(layer.content.sourceArtifactHash).licenseReferences,
    inputsHash: renderInputsHash(layer.content),
  });
  publishPreview(candidate, job.layerId, manifest.contentHash, job.id);
  return {
    ...job,
    state: "succeeded",
    startedAt: job.startedAt ?? result.startedAt,
    finishedAt: result.finishedAt ?? new Date().toISOString(),
    progress: "rendered",
    imageArtifactHash: manifest.contentHash,
    manifestHash: sha256(JSON.stringify(manifest)),
    diagnostics: [],
  };
}
function publishPreview(
  candidate: CandidateRecord,
  layerId: string,
  imageHash: string,
  jobId: string,
): void {
  saveCandidate({
    ...candidate,
    previewJobId: jobId,
    resultingDocument: {
      ...candidate.resultingDocument,
      layers: candidate.resultingDocument.layers.map((layer) =>
        layer.id === layerId && layer.kind === "source"
          ? { ...layer, content: { ...layer.content, previewArtifactHash: imageHash } }
          : layer,
      ),
    },
  });
}
/** Terminates the queue supervisor's process group; no partial output is published. */
export function cancelJob(id: string): JobRecord {
  const job = loadJob(id);
  if (job.state === "succeeded" || job.state === "failed" || job.state === "cancelled") return job;
  if (job.pid)
    try {
      process.kill(-job.pid, "SIGTERM");
    } catch {
      /* the supervisor already exited; the state below records the outcome */
    }
  return saveJob({
    ...job,
    state: "cancelled",
    finishedAt: new Date().toISOString(),
    progress: "cancelled",
    diagnostics: [
      {
        stage: "render",
        code: "JOB_CANCELLED",
        message: "The render job was cancelled; no preview was published",
        retryable: true,
      },
    ],
  });
}
export const runBudget = (runId: string): { spent: number; total: number } => {
  const run = loadRun(runId);
  return { spent: run.chargedRenders, total: LIMITS.maxRendersPerRun };
};
export const currentSnapshotHash = snapshotHash;
