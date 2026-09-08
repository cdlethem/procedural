import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { FrameError, FrameState } from "../../packages/javascript/src/internal/drawing-state.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, "../../fixtures/drawing/fresh-raster-lifecycle.json"), "utf8"));
const results = [];
const nativeChecks = [];
let failures = 0;

function record(id, actual, expected, passed) {
  results.push({ id, actual, expected, passed });
  if (!passed) failures += 1;
}

function errorResult(action) {
  try {
    action();
    return null;
  } catch (error) {
    if (error instanceof FrameError) return { code: error.code, commandIndex: error.commandIndex };
    return { code: `UNEXPECTED:${error?.name ?? "unknown"}`, commandIndex: null };
  }
}

function sameValue(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length &&
      actual.every((value, index) => sameValue(value, expected[index]));
  }
  if (actual !== null && expected !== null && typeof actual === "object" && typeof expected === "object") {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return actualKeys.length === expectedKeys.length && actualKeys.every((key, index) =>
      key === expectedKeys[index] && sameValue(actual[key], expected[key]));
  }
  return Object.is(actual, expected);
}

function expandedCommands(step) {
  if (step.repeat) return Array.from({ length: step.repeat.count }, () => step.repeat.command);
  return step.commands;
}

function beginFailureFor(fault) {
  if (fault === "capability") return "UNSUPPORTED_CAPABILITY";
  if (fault === "acquisition" || fault === "readiness") return "RESOURCE_FAILURE";
  if (fault === "initialization") return "RENDER_FAILURE";
  return null;
}

function runCase(testCase) {
  const hooked = testCase.test_hook_initial_active_count !== undefined;
  const frame = hooked ? FrameState.forTestActive(fixture.environment, testCase.test_hook_initial_active_count) : new FrameState();
  const events = { acquired: hooked ? 1 : 0, released: 0, transferred: 0, native_command_attempts: 0 };
  let ownsLease = hooked;
  const steps = [];

  for (const step of testCase.steps) {
    let error = null;
    try {
      if (step.action === "begin") {
        const plan = frame.prepareBegin(step.environment ?? fixture.environment);
        const failure = beginFailureFor(step.fault);
        if (failure === "UNSUPPORTED_CAPABILITY" || failure === "RESOURCE_FAILURE" && step.fault === "acquisition") {
          frame.failBegin(plan, failure);
        } else {
          events.acquired += 1;
          ownsLease = true;
          if (failure !== null) frame.failBegin(plan, failure);
          else frame.activate(plan);
        }
      } else if (step.action === "batch") {
        const plan = frame.prepareBatch(expandedCommands(step));
        let failed = false;
        for (const slot of plan.slots) {
          if (slot.command.outcome === "noop") continue;
          events.native_command_attempts += 1;
          if (step.fault?.native_command_offset === slot.sourceOffset) {
            frame.failBatch(plan, slot.sourceOffset);
            failed = true;
            break;
          }
        }
        if (!failed) frame.commitBatch(plan);
      } else if (step.action === "end") {
        const token = frame.prepareEnd();
        if (step.fault === "finalization") frame.failEnd(token);
        else {
          frame.completeEnd(token);
          ownsLease = false;
          events.transferred += 1;
        }
      } else if (step.action === "abort") {
        frame.abort();
      } else {
        throw new Error(`unknown action ${step.action}`);
      }
    } catch (caught) {
      error = caught instanceof FrameError ? { code: caught.code, commandIndex: caught.commandIndex } :
        { code: `UNEXPECTED:${caught?.name ?? "unknown"}`, commandIndex: null };
    }

    if (frame.state === "aborted" && ownsLease) {
      events.released += 1;
      ownsLease = false;
    }
    const actual = { state: frame.state, error };
    steps.push({ action: step.action, actual, expected: step.expected, passed: sameValue(actual, step.expected) });
  }

  const passed = steps.every((step) => step.passed) && sameValue(events, testCase.expected_final_events) && !ownsLease;
  return { steps, events, passed };
}

for (const testCase of fixture.cases) {
  const actual = runCase(testCase);
  record(testCase.id, actual, { finalEvents: testCase.expected_final_events }, actual.passed);
}

function native(id, action) {
  try {
    const actual = action();
    const passed = actual === true;
    nativeChecks.push({ id, actual, passed });
    if (!passed) failures += 1;
  } catch (error) {
    nativeChecks.push({ id, actual: `UNEXPECTED:${error?.code ?? error?.name ?? "unknown"}`, passed: false });
    failures += 1;
  }
}

native("foreign-stale-double-and-reentrant-tokens", () => {
  const environment = fixture.environment;
  const foreign = new FrameState();
  const foreignPlan = foreign.prepareBegin(environment);
  const copiedPlan = Object.freeze({ environment: foreignPlan.environment });
  const foreignError = errorResult(() => foreign.activate(copiedPlan));

  const doubleResolve = new FrameState();
  const resolvedPlan = doubleResolve.prepareBegin(environment);
  doubleResolve.activate(resolvedPlan);
  const doubleError = errorResult(() => doubleResolve.activate(resolvedPlan));

  const reentrant = new FrameState();
  reentrant.prepareBegin(environment);
  const reentrantError = errorResult(() => reentrant.prepareBegin(environment));
  const batch = new FrameState();
  batch.activate(batch.prepareBegin(environment));
  const batchPlan = batch.prepareBatch([]);
  const batchError = errorResult(() => batch.commitBatch(Object.freeze({ ...batchPlan })));

  const end = new FrameState();
  end.activate(end.prepareBegin(environment));
  const endToken = end.prepareEnd();
  end.completeEnd(endToken);
  const staleEndError = errorResult(() => end.completeEnd(endToken));
  return sameValue(foreignError, { code: "INVALID_STATE", commandIndex: null }) && foreign.state === "aborted" &&
    sameValue(doubleError, { code: "INVALID_STATE", commandIndex: null }) && doubleResolve.state === "aborted" &&
    sameValue(reentrantError, { code: "INVALID_STATE", commandIndex: null }) && reentrant.state === "aborted" &&
    sameValue(batchError, { code: "INVALID_STATE", commandIndex: null }) && batch.state === "aborted" &&
    sameValue(staleEndError, { code: "INVALID_STATE", commandIndex: null }) && end.state === "completed";
});

native("prepared-batch-slots-are-detached-and-immutable", () => {
  const frame = new FrameState();
  const begin = frame.prepareBegin(fixture.environment);
  frame.activate(begin);
  const commands = [
    { kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" },
    { kind: "segment2", from: [1, 1], to: [1.0000000298023224, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" },
  ];
  const plan = frame.prepareBatch(commands);
  commands[0].from[0] = 99;
  const slot = plan.slots[0];
  const mutation = errorResult(() => { slot.command.points[0][0] = 99; });
  return Object.isFrozen(plan) && Object.isFrozen(plan.slots) && Object.isFrozen(slot) &&
    Object.isFrozen(slot.command) && Object.isFrozen(slot.command.points) && Object.isFrozen(slot.command.points[0]) &&
    slot.sourceOffset === 0 && slot.command.points[0][0] === 0 && mutation !== null && frame.count === 0;
});

native("counts-commit-only-after-success", () => {
  const frame = new FrameState();
  frame.activate(frame.prepareBegin(fixture.environment));
  const valid = [{ kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" }];
  frame.commitBatch(frame.prepareBatch(valid));
  const beforeFailure = frame.count;
  const invalid = [{ kind: "segment2", from: [0, 0], to: [0, 0], rgb: 0, opacity8: 180, width: 1, cap: "round" }];
  const error = errorResult(() => frame.prepareBatch(invalid));
  return beforeFailure === 1 && frame.count === 1 && frame.state === "aborted" &&
    sameValue(error, { code: "INVALID_COMMAND", commandIndex: 1 });
});

native("batch-failure-null-index-does-not-commit", () => {
  const frame = new FrameState();
  frame.activate(frame.prepareBegin(fixture.environment));
  const commands = [{ kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" }];
  const error = errorResult(() => frame.failBatch(frame.prepareBatch(commands), null));
  return frame.count === 0 && frame.state === "aborted" &&
    sameValue(error, { code: "RENDER_FAILURE", commandIndex: null });
});

native("indexed-batch-failure-rejects-noop-slot", () => {
  const frame = new FrameState();
  frame.activate(frame.prepareBegin(fixture.environment));
  const noop = [{ kind: "segment2", from: [1, 1], to: [1.0000000298023224, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" }];
  const error = errorResult(() => frame.failBatch(frame.prepareBatch(noop), 0));
  return frame.count === 0 && frame.state === "aborted" &&
    sameValue(error, { code: "INVALID_STATE", commandIndex: null });
});

native("reentrant-normalization-preserves-state-error", () => {
  const frame = new FrameState();
  frame.activate(frame.prepareBegin(fixture.environment));
  const command = new Proxy(
    { kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" },
    { ownKeys() { frame.prepareEnd(); return []; } },
  );
  const error = errorResult(() => frame.prepareBatch([command]));
  return frame.state === "aborted" && sameValue(error, { code: "INVALID_STATE", commandIndex: null });
});

native("snapshot-bounds-callback-mutation-and-unexpected-failure", () => {
  const frame = new FrameState();
  frame.activate(frame.prepareBegin(fixture.environment));
  const command = { kind: "segment2", from: [0, 0], to: [1, 1], rgb: 0, opacity8: 180, width: 1, cap: "round" };
  const backing = [command];
  const changing = new Proxy(backing, {
    get(target, key, receiver) {
      if (key === "0") target.push(command);
      return Reflect.get(target, key, receiver);
    },
  });
  const plan = frame.prepareBatch(changing);
  frame.commitBatch(plan);

  const broken = new FrameState();
  broken.activate(broken.prepareBegin(fixture.environment));
  const exploding = new Proxy([command], { get() { throw new Error("snapshot failure"); } });
  const error = errorResult(() => broken.prepareBatch(exploding));
  const normalizing = new FrameState();
  normalizing.activate(normalizing.prepareBegin(fixture.environment));
  const badCommand = new Proxy(command, { ownKeys() { throw new Error("normalization failure"); } });
  const normalizationError = errorResult(() => normalizing.prepareBatch([badCommand]));
  return plan.inputCount === 1 && plan.slots.length === 1 && frame.count === 1 &&
    broken.state === "aborted" && sameValue(error, { code: "INVALID_STATE", commandIndex: null }) &&
    normalizing.state === "aborted" && sameValue(normalizationError, { code: "INVALID_STATE", commandIndex: null });
});

const counts = {
  lifecycleCases: fixture.cases.length,
  lifecycleSteps: fixture.cases.reduce((total, testCase) => total + testCase.steps.length, 0),
  nativeChecks: nativeChecks.length,
  resultChecks: results.length,
};
process.stdout.write(`${JSON.stringify({ profile: fixture.profile, version: fixture.version, scope: "pure FrameState and simulated adapter events; not native drawing evidence", failures, counts, results, nativeChecks }, null, 2)}\n`);
process.exitCode = failures === 0 ? 0 : 1;
