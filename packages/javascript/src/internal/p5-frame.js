import { FrameState } from "./drawing-state.js";

const releasedGraphics = new WeakSet();

function isObject(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function attachCause(error, cause) {
  if (!(error instanceof Error) || cause === error || cause === undefined) return error;
  try {
    if (!Object.hasOwn(error, "cause")) {
      Object.defineProperty(error, "cause", { configurable: true, value: cause });
    }
  } catch {
    // The stable FrameError code and index take precedence over host diagnostics.
  }
  return error;
}

function rememberCleanupFailure(primary, cleanupFailure) {
  if (!(primary instanceof Error)) return;
  try {
    const existing = Array.isArray(primary.cleanupFailures) ? primary.cleanupFailures : [];
    existing.push(cleanupFailure);
    Object.defineProperty(primary, "cleanupFailures", { configurable: true, value: existing });
  } catch {
    // Cleanup must never replace the lifecycle failure that triggered it.
  }
}

function releaseGraphics(graphics, primary = null) {
  if (!isObject(graphics) || releasedGraphics.has(graphics)) return;
  releasedGraphics.add(graphics);
  let firstFailure = null;
  const attempt = (action) => {
    try {
      action();
    } catch (error) {
      if (firstFailure === null) firstFailure = error;
      else if (primary !== null) rememberCleanupFailure(primary, error);
    }
  };

  let canvas = null;
  attempt(() => { canvas = graphics.elt; });
  if (isObject(canvas)) {
    // Resetting both backing dimensions clears the bitmap even if remove() cannot
    // detach it. This is intentionally done for failed and completed ownership.
    attempt(() => { canvas.width = 0; });
    attempt(() => { canvas.height = 0; });
  }
  let remove = null;
  attempt(() => { remove = graphics.remove; });
  if (typeof remove === "function") attempt(() => { remove.call(graphics); });

  if (firstFailure !== null) {
    if (primary !== null) rememberCleanupFailure(primary, firstFailure);
    else throw firstFailure;
  }
}

function defaultContextVerifier(context, canvas) {
  const Canvas2D = globalThis.CanvasRenderingContext2D;
  return typeof Canvas2D === "function" && context instanceof Canvas2D && context.canvas === canvas;
}

function rgbStyle(channels) {
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

/**
 * Internal p5 P2D/Canvas2D adapter for drawing.fresh-raster-2d v0.1.0.
 * It owns a new graphics buffer while active and transfers it only after end().
 * No host object enters the portable FrameState or package public API.
 */
export class P5Frame {
  #p;
  #factory;
  #contextVerifier;
  #state = new FrameState();
  #graphics = null;
  #context = null;

  /**
   * @param {object} p A p5 instance.
   * @param {Function|null} testFactory Internal fault-injection seam. Production
   * always calls p.createGraphics(width, height, p.P2D).
   * @param {Function} testContextVerifier Internal seam for non-browser unit tests.
   */
  constructor(p, testFactory = null, testContextVerifier = defaultContextVerifier) {
    this.#p = p;
    this.#factory = testFactory;
    this.#contextVerifier = testContextVerifier;
  }

  get state() {
    return this.#state.state;
  }

  get count() {
    return this.#state.count;
  }

  #staticCapabilityAvailable() {
    if (this.#factory !== null) return typeof this.#factory === "function";
    try {
      return isObject(this.#p) && typeof this.#p.createGraphics === "function" && this.#p.P2D !== undefined;
    } catch {
      return false;
    }
  }

  #createGraphics(environment) {
    if (this.#factory !== null) return this.#factory(environment.width, environment.height, this.#p?.P2D);
    return this.#p.createGraphics(environment.width, environment.height, this.#p.P2D);
  }

  #releaseOwned(primary) {
    const graphics = this.#graphics;
    this.#graphics = null;
    this.#context = null;
    releaseGraphics(graphics, primary);
  }

  #abortUnfinishedAndRelease(primary) {
    if (this.#state.state !== "completed") {
      try {
        this.#state.abort();
      } catch (error) {
        rememberCleanupFailure(primary, error);
      }
    }
    this.#releaseOwned(primary);
  }

  #failBegin(plan, code, cause) {
    try {
      this.#state.failBegin(plan, code);
    } catch (error) {
      throw attachCause(error, cause);
    }
  }

  #failBatch(plan, sourceOffset, cause) {
    try {
      this.#state.failBatch(plan, sourceOffset);
    } catch (error) {
      throw attachCause(error, cause);
    }
  }

  #failEnd(token, cause) {
    try {
      this.#state.failEnd(token);
    } catch (error) {
      throw attachCause(error, cause);
    }
  }

  #acquireAndVerify(environment) {
    const graphics = this.#createGraphics(environment);
    this.#graphics = graphics;
    if (!isObject(graphics) || typeof graphics.pixelDensity !== "function") {
      throw new Error("p5 graphics buffer is not ready");
    }

    graphics.pixelDensity(1);
    const canvas = graphics.elt;
    const context = graphics.drawingContext;
    if (graphics.pixelDensity() !== 1 || graphics.width !== environment.width ||
        graphics.height !== environment.height || !isObject(canvas) ||
        canvas.width !== environment.width || canvas.height !== environment.height ||
        !this.#contextVerifier(context, canvas)) {
      throw new Error("p5 graphics buffer does not meet the density-1 Canvas2D profile");
    }
    this.#context = context;
  }

  #initialize(environment) {
    const context = this.#context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.lineCap = "butt";
    context.lineJoin = "miter";
    context.lineWidth = 1;
    context.lineDashOffset = 0;
    context.setLineDash([]);
    if ("filter" in context) context.filter = "none";
    if ("shadowColor" in context) context.shadowColor = "rgba(0, 0, 0, 0)";
    if ("shadowBlur" in context) context.shadowBlur = 0;
    if ("shadowOffsetX" in context) context.shadowOffsetX = 0;
    if ("shadowOffsetY" in context) context.shadowOffsetY = 0;
    context.clearRect(0, 0, environment.width, environment.height);
    const background = environment.background;
    context.fillStyle = `rgb(${(background >>> 16) & 0xff}, ${(background >>> 8) & 0xff}, ${background & 0xff})`;
    context.fillRect(0, 0, environment.width, environment.height);
  }

  #contextLost() {
    const context = this.#context;
    if (context === null) return true;
    const check = context.isContextLost;
    return typeof check === "function" && check.call(context) === true;
  }

  #draw(command) {
    const context = this.#context;
    context.save();
    try {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = command.alpha64;
      context.setLineDash([]);
      if ("filter" in context) context.filter = "none";
      if ("shadowColor" in context) context.shadowColor = "rgba(0, 0, 0, 0)";
      if ("shadowBlur" in context) context.shadowBlur = 0;
      if ("shadowOffsetX" in context) context.shadowOffsetX = 0;
      if ("shadowOffsetY" in context) context.shadowOffsetY = 0;

      context.beginPath();
      if (command.kind === "segment2") {
        context.lineWidth = command.width;
        context.lineCap = "round";
        context.strokeStyle = rgbStyle(command.channels);
        context.moveTo(command.points[0][0], command.points[0][1]);
        context.lineTo(command.points[1][0], command.points[1][1]);
        context.stroke();
      } else {
        context.fillStyle = rgbStyle(command.channels);
        context.moveTo(command.points[0][0], command.points[0][1]);
        for (let index = 1; index < 4; index += 1) {
          context.lineTo(command.points[index][0], command.points[index][1]);
        }
        context.closePath();
        context.fill();
      }
    } finally {
      context.restore();
    }
  }

  #checkBatchContext(plan) {
    let lost;
    try {
      lost = this.#contextLost();
    } catch (error) {
      this.#failBatch(plan, null, error);
    }
    if (lost) this.#failBatch(plan, null, new Error("Canvas2D context is lost"));
  }

  /** Acquire and initialize a fresh owned P2D graphics buffer. */
  begin(environment) {
    let plan = null;
    try {
      plan = this.#state.prepareBegin(environment);
      if (!this.#staticCapabilityAvailable()) {
        this.#failBegin(plan, "UNSUPPORTED_CAPABILITY");
      }
      try {
        this.#acquireAndVerify(plan.environment);
      } catch (error) {
        this.#failBegin(plan, "RESOURCE_FAILURE", error);
      }
      try {
        if (this.#contextLost()) throw new Error("Canvas2D context is lost");
        this.#initialize(plan.environment);
      } catch (error) {
        this.#failBegin(plan, "RENDER_FAILURE", error);
      }
      this.#state.activate(plan);
    } catch (error) {
      this.#abortUnfinishedAndRelease(error);
      throw error;
    }
  }

  /** Normalize a complete batch, then draw its emitting slots in encounter order. */
  batch(commands) {
    try {
      const plan = this.#state.prepareBatch(commands);
      // This follows full normalization, including an empty/no-op-only batch, but
      // precedes every native operation and therefore cannot commit after loss.
      this.#checkBatchContext(plan);
      for (const slot of plan.slots) {
        if (slot.command.outcome === "noop") continue;
        this.#checkBatchContext(plan);
        let lost;
        try {
          this.#draw(slot.command);
          lost = this.#contextLost();
        } catch (error) {
          this.#failBatch(plan, slot.sourceOffset, error);
        }
        if (lost) this.#failBatch(plan, slot.sourceOffset, new Error("Canvas2D context lost during drawing"));
      }
      this.#state.commitBatch(plan);
    } catch (error) {
      this.#abortUnfinishedAndRelease(error);
      throw error;
    }
  }

  /** Complete the frame and transfer its graphics buffer to the caller. */
  end() {
    let token = null;
    try {
      token = this.#state.prepareEnd();
      try {
        if (this.#contextLost()) throw new Error("Canvas2D context is lost");
      } catch (error) {
        this.#failEnd(token, error);
      }
      this.#state.completeEnd(token);
      const completed = this.#graphics;
      this.#graphics = null;
      this.#context = null;
      return completed;
    } catch (error) {
      this.#abortUnfinishedAndRelease(error);
      throw error;
    }
  }

  /** Abort an unfinished frame and release its owned buffer exactly once. */
  abort() {
    try {
      this.#state.abort();
    } catch (error) {
      this.#releaseOwned(error);
      throw error;
    }
    this.#releaseOwned(null);
  }

  /**
   * Release a completed p5.Graphics buffer after integration display/save.
   * It is idempotent and clears the backing canvas before p5 removes its element.
   */
  static releaseCompleted(graphics) {
    releaseGraphics(graphics);
  }
}
