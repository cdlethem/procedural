/**
 * Run records for the prompt coordinator. The coordinator owns retries, budgets and
 * cancellation; a model cannot raise its own limits because every charge passes here.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDirectories, fail, LIMITS, RUN_ROOT } from "./core";
import type { CandidateScope } from "../studio-document";

export type RunState = "running" | "succeeded" | "failed" | "cancelled";
export type RunStep = {
  at: string;
  kind: "model" | "tool" | "note";
  name: string;
  detail: string;
  ok: boolean;
};
export type RunRecord = {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  state: RunState;
  prompt: string;
  scope: CandidateScope;
  selectedLayerId: string | null;
  baseDocumentHash: string;
  target: "p5js" | "processing-java";
  model: string;
  bindingSnapshotHash: string;
  chargedRenders: number;
  repairTurns: number;
  toolCalls: number;
  promptTokens: number;
  completionTokens: number;
  steps: RunStep[];
  candidateId: string | null;
  message: string;
  controlSummary: string[];
  unmet: string[];
  cancelRequested: boolean;
};

const runPath = (id: string): string => join(RUN_ROOT, `${id}.json`);
export const newRunId = (): string => `run-${randomUUID()}`;
export function saveRun(run: RunRecord): RunRecord {
  ensureDirectories();
  const path = runPath(run.id),
    temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(run, null, 2)}\n`);
  renameSync(temporary, path);
  return run;
}
export function loadRun(id: string): RunRecord {
  if (!/^run-[0-9a-f-]{36}$/.test(id)) fail("request", "UNKNOWN_HANDLE", `Unusable run handle: ${id}`);
  const path = runPath(id);
  if (!existsSync(path)) fail("request", "UNKNOWN_HANDLE", `Unknown run: ${id}`);
  return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
}
/** Charges one render against the run budget before a job is spawned. */
export function chargeRun(id: string): RunRecord {
  const run = loadRun(id);
  if (run.chargedRenders >= LIMITS.maxRendersPerRun)
    fail(
      "budget",
      "BUDGET_EXHAUSTED",
      `This run has spent its ${LIMITS.maxRendersPerRun} candidate renders`,
      { location: "renderBudget" },
    );
  return saveRun({ ...run, chargedRenders: run.chargedRenders + 1 });
}
export function appendStep(id: string, step: Omit<RunStep, "at">): RunRecord {
  const run = loadRun(id);
  return saveRun({
    ...run,
    toolCalls: step.kind === "tool" ? run.toolCalls + 1 : run.toolCalls,
    steps: [...run.steps, { at: new Date().toISOString(), ...step }].slice(-120),
  });
}
export function requestCancel(id: string): RunRecord {
  const run = loadRun(id);
  return saveRun({ ...run, cancelRequested: true });
}
