import { DrawingError, normalizeCommand, validateEnvironment } from "./drawing.js";

const MAX_BATCH_COMMANDS = 4_096;
const MAX_FRAME_COMMANDS = Number.MAX_SAFE_INTEGER;
const BEGIN_FAILURE_CODES = new Set(["UNSUPPORTED_CAPABILITY", "RESOURCE_FAILURE", "RENDER_FAILURE"]);

/** A fresh-raster lifecycle error with an optional absolute command index. */
export class FrameError extends DrawingError {
  constructor(code, commandIndex = null) {
    super(code);
    this.name = "FrameError";
    this.commandIndex = commandIndex;
  }
}

function frameError(error, commandIndex = null) {
  if (error instanceof FrameError) return error;
  if (error instanceof DrawingError) return new FrameError(error.code, commandIndex);
  return new FrameError("INVALID_STATE");
}

function freezeRecord(value) {
  if (Array.isArray(value)) {
    for (const item of value) freezeRecord(item);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) freezeRecord(item);
    return Object.freeze(value);
  }
  return value;
}

function immutablePlan(value) {
  return freezeRecord(value);
}

function validBatchFailureOffset(offset, inputCount) {
  return offset === null || (typeof offset === "number" && Number.isSafeInteger(offset) &&
    offset >= 0 && offset < inputCount);
}

/**
 * Pure internal lifecycle state for a fresh-raster frame.
 * It owns no renderer, surface lease, callback, or producer command buffer.
 */
export class FrameState {
  #state = "new";
  #count = 0;
  #environment = null;
  #pending = null;
  #pendingKind = null;

  get state() {
    return this.#state;
  }

  get count() {
    return this.#count;
  }

  #abort() {
    this.#environment = null;
    this.#pending = null;
    this.#pendingKind = null;
    this.#state = "aborted";
  }

  #invalidState() {
    if (this.#state !== "completed") this.#abort();
    throw new FrameError("INVALID_STATE");
  }

  #requirePending(plan, kind) {
    const expectedState = kind === "begin" ? "new" : "active";
    if (this.#state !== expectedState || this.#pending !== plan || this.#pendingKind !== kind) {
      this.#invalidState();
    }
  }

  /** Validate an environment and issue an immutable begin plan. */
  prepareBegin(environment) {
    if (this.#state !== "new" || this.#pending !== null) this.#invalidState();
    const reservation = immutablePlan({});
    this.#pending = reservation;
    this.#pendingKind = "begin-preparing";
    try {
      const detachedEnvironment = immutablePlan(validateEnvironment(environment));
      const plan = immutablePlan({ environment: detachedEnvironment });
      if (this.#state !== "new" || this.#pending !== reservation) throw new FrameError("INVALID_STATE");
      this.#pending = plan;
      this.#pendingKind = "begin";
      return plan;
    } catch (error) {
      this.#abort();
      throw frameError(error);
    }
  }

  /** Resolve a matching begin plan after adapter setup succeeds. */
  activate(plan) {
    this.#requirePending(plan, "begin");
    this.#environment = plan.environment;
    this.#pending = null;
    this.#pendingKind = null;
    this.#state = "active";
  }

  /** Resolve a matching begin plan after a phase-specific adapter failure. */
  failBegin(plan, code) {
    this.#requirePending(plan, "begin");
    if (!BEGIN_FAILURE_CODES.has(code)) this.#invalidState();
    this.#abort();
    throw new FrameError(code);
  }

  /**
   * Fully validate and normalize one bounded batch before any adapter drawing.
   * Slots retain input offsets, including no-op commands, until synchronous resolution.
   */
  prepareBatch(commands) {
    if (this.#state !== "active" || this.#pending !== null) this.#invalidState();
    const reservation = immutablePlan({});
    this.#pending = reservation;
    this.#pendingKind = "batch-preparing";
    try {
      if (!Array.isArray(commands)) throw new FrameError("INVALID_BATCH");
      const inputCount = commands.length;
      if (inputCount > MAX_BATCH_COMMANDS || this.#count > MAX_FRAME_COMMANDS - inputCount) {
        throw new FrameError("INVALID_BATCH");
      }
      const snapshot = new Array(inputCount);
      for (let offset = 0; offset < inputCount; offset += 1) {
        snapshot[offset] = commands[offset];
      }
      if (this.#state !== "active" || this.#pending !== reservation) throw new FrameError("INVALID_STATE");

      const baseIndex = this.#count;
      const slots = new Array(inputCount);
      for (let offset = 0; offset < inputCount; offset += 1) {
        try {
          slots[offset] = immutablePlan({ sourceOffset: offset, command: normalizeCommand(snapshot[offset], this.#environment) });
        } catch (error) {
          throw frameError(error, baseIndex + offset);
        }
      }
      if (this.#state !== "active" || this.#pending !== reservation) throw new FrameError("INVALID_STATE");
      const plan = immutablePlan({ baseIndex, inputCount, slots });
      if (this.#state !== "active" || this.#pending !== reservation) throw new FrameError("INVALID_STATE");
      this.#pending = plan;
      this.#pendingKind = "batch";
      return plan;
    } catch (error) {
      this.#abort();
      throw frameError(error);
    }
  }

  /** Commit a matching batch only after the adapter completes every slot. */
  commitBatch(plan) {
    this.#requirePending(plan, "batch");
    this.#count += plan.inputCount;
    this.#pending = null;
    this.#pendingKind = null;
  }

  /** Abort a matching batch after a native failure at an original input offset. */
  failBatch(plan, sourceOffset) {
    this.#requirePending(plan, "batch");
    if (!validBatchFailureOffset(sourceOffset, plan.inputCount) ||
        sourceOffset !== null && plan.slots[sourceOffset].command.outcome === "noop") {
      this.#invalidState();
    }
    const commandIndex = sourceOffset === null ? null : plan.baseIndex + sourceOffset;
    this.#abort();
    throw new FrameError("RENDER_FAILURE", commandIndex);
  }

  /** Issue an identity-bound end token for adapter finalization. */
  prepareEnd() {
    if (this.#state !== "active" || this.#pending !== null) this.#invalidState();
    const reservation = immutablePlan({});
    this.#pending = reservation;
    this.#pendingKind = "end-preparing";
    try {
      const token = immutablePlan({});
      if (this.#state !== "active" || this.#pending !== reservation) throw new FrameError("INVALID_STATE");
      this.#pending = token;
      this.#pendingKind = "end";
      return token;
    } catch (error) {
      this.#abort();
      throw frameError(error);
    }
  }

  /** Resolve a matching end token and mark the frame completed. */
  completeEnd(token) {
    this.#requirePending(token, "end");
    this.#pending = null;
    this.#pendingKind = null;
    this.#environment = null;
    this.#state = "completed";
  }

  /** Resolve a matching end token after native finalization fails. */
  failEnd(token) {
    this.#requirePending(token, "end");
    this.#abort();
    throw new FrameError("RENDER_FAILURE");
  }

  /** Idempotently abort an unfinished frame; completed frames remain immutable. */
  abort() {
    if (this.#state === "completed") throw new FrameError("INVALID_STATE");
    this.#abort();
  }

  /** Test-only exact-count hook; this internal module is never package-exported. */
  static forTestActive(environment, count) {
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > MAX_FRAME_COMMANDS) {
      throw new FrameError("INVALID_STATE");
    }
    const state = new FrameState();
    const plan = state.prepareBegin(environment);
    state.activate(plan);
    state.#count = count;
    return state;
  }
}
