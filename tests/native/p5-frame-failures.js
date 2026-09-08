import { FrameError } from "../../packages/javascript/src/internal/drawing-state.js";
import { P5Frame } from "../../packages/javascript/src/internal/p5-frame.js";

const environment = Object.freeze({ width: 32, height: 24, density: 1, background: 0x102030 });
const segment = Object.freeze({
  kind: "segment2", from: [4, 8], to: [24, 8], rgb: 0xaa3311, opacity8: 180, width: 2, cap: "round",
});
const convertedNoop = Object.freeze({
  kind: "segment2", from: [1, 1], to: [1 + 2 ** -25, 1],
  rgb: 0xaa3311, opacity8: 180, width: 1, cap: "round",
});

function resultFor(error) {
  if (error instanceof FrameError) return { code: error.code, commandIndex: error.commandIndex };
  return { code: `UNEXPECTED:${error?.name ?? "unknown"}`, commandIndex: null };
}

function capture(action) {
  try {
    return { returned: action(), error: null };
  } catch (error) {
    return { returned: null, error: resultFor(error) };
  }
}

function sameError(actual, code, commandIndex = null) {
  return actual !== null && actual.code === code && actual.commandIndex === commandIndex;
}

function setOwnMethod(target, name, value) {
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function trackedGraphics(p, mutate = null) {
  let graphics = null;
  let canvas = null;
  let removeCalls = 0;
  const factory = (width, height, renderer) => {
    graphics = p.createGraphics(width, height, renderer);
    canvas = graphics.elt;
    const remove = graphics.remove;
    setOwnMethod(graphics, "remove", function removeTracked() {
      removeCalls += 1;
      return remove.call(this);
    });
    if (mutate !== null) mutate(graphics, canvas, () => removeCalls);
    return graphics;
  };
  return {
    factory,
    graphics: () => graphics,
    canvas: () => canvas,
    removeCalls: () => removeCalls,
  };
}

function cleanup(frame, completed = null) {
  try {
    if (completed !== null) {
      P5Frame.releaseCompleted(completed);
      return;
    }
    if (frame.state !== "completed") frame.abort();
  } catch {
    // Each assertion records adapter failures; cleanup cannot hide its original code.
  }
}

/**
 * Runs lifecycle/failure conformance in a real browser p5 instance.
 * Every non-browser failure below is deliberately injected through P5Frame's
 * internal factory/context seams. It does not claim spontaneous context loss.
 */
export async function runFailures(p) {
  const checks = [];
  let failures = 0;

  function record(id, injected, action) {
    let actual;
    let passed = false;
    try {
      actual = action();
      passed = actual.passed === true;
    } catch (error) {
      actual = { unexpected: resultFor(error), passed: false };
    }
    checks.push({ id, injected, ...actual, passed });
    if (!passed) failures += 1;
  }

  record("invalid-environment-precedes-static-capability", false, () => {
    const frame = new P5Frame(null);
    const invalid = capture(() => frame.begin({ width: 0, height: 1, density: 1, background: 0 }));
    const staticAbsent = capture(() => new P5Frame(null).begin(environment));
    return {
      invalid: invalid.error,
      staticAbsent: staticAbsent.error,
      passed: sameError(invalid.error, "INVALID_ENVIRONMENT") && frame.state === "aborted" &&
        sameError(staticAbsent.error, "UNSUPPORTED_CAPABILITY"),
    };
  });

  record("allocation-failure-is-resource-failure", true, () => {
    const frame = new P5Frame(p, () => { throw new Error("injected allocation failure"); });
    const attempt = capture(() => frame.begin(environment));
    cleanup(frame);
    return {
      error: attempt.error,
      state: frame.state,
      passed: sameError(attempt.error, "RESOURCE_FAILURE") && frame.state === "aborted",
    };
  });

  record("factory-frame-error-is-wrapped-as-resource-failure", true, () => {
    const frame = new P5Frame(p, () => { throw new FrameError("INVALID_COMMAND", 777); });
    const attempt = capture(() => frame.begin(environment));
    cleanup(frame);
    return {
      hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
      error: attempt.error,
      state: frame.state,
      passed: sameError(attempt.error, "RESOURCE_FAILURE") && frame.state === "aborted",
    };
  });

  record("readiness-failure-releases-real-graphics", true, () => {
    const tracked = trackedGraphics(p, (graphics) => {
      setOwnMethod(graphics, "pixelDensity", () => { throw new Error("injected readiness failure"); });
    });
    const frame = new P5Frame(p, tracked.factory);
    const attempt = capture(() => frame.begin(environment));
    const canvas = tracked.canvas();
    cleanup(frame);
    return {
      error: attempt.error,
      state: frame.state,
      removeCalls: tracked.removeCalls(),
      backing: canvas === null ? null : [canvas.width, canvas.height],
      passed: sameError(attempt.error, "RESOURCE_FAILURE") && frame.state === "aborted" &&
        tracked.removeCalls() === 1 && canvas.width === 0 && canvas.height === 0,
    };
  });

  record("readiness-frame-error-is-wrapped-as-resource-failure", true, () => {
    const tracked = trackedGraphics(p, (graphics) => {
      setOwnMethod(graphics, "pixelDensity", () => { throw new FrameError("INVALID_COMMAND", 777); });
    });
    const frame = new P5Frame(p, tracked.factory);
    const attempt = capture(() => frame.begin(environment));
    cleanup(frame);
    return {
      hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
      error: attempt.error,
      state: frame.state,
      removeCalls: tracked.removeCalls(),
      passed: sameError(attempt.error, "RESOURCE_FAILURE") && frame.state === "aborted" &&
        tracked.removeCalls() === 1,
    };
  });

  record("initialization-failure-releases-real-graphics", true, () => {
    const tracked = trackedGraphics(p, (graphics) => {
      setOwnMethod(graphics.drawingContext, "setTransform", () => {
        throw new Error("injected initialization failure");
      });
    });
    const frame = new P5Frame(p, tracked.factory);
    const attempt = capture(() => frame.begin(environment));
    const canvas = tracked.canvas();
    cleanup(frame);
    return {
      error: attempt.error,
      state: frame.state,
      removeCalls: tracked.removeCalls(),
      backing: [canvas.width, canvas.height],
      passed: sameError(attempt.error, "RENDER_FAILURE") && frame.state === "aborted" &&
        tracked.removeCalls() === 1 && canvas.width === 0 && canvas.height === 0,
    };
  });

  record("initialization-frame-error-is-wrapped-as-render-failure", true, () => {
    const tracked = trackedGraphics(p, (graphics) => {
      setOwnMethod(graphics.drawingContext, "fillRect", () => {
        throw new FrameError("INVALID_COMMAND", 777);
      });
    });
    const frame = new P5Frame(p, tracked.factory);
    const attempt = capture(() => frame.begin(environment));
    cleanup(frame);
    return {
      hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
      error: attempt.error,
      state: frame.state,
      removeCalls: tracked.removeCalls(),
      passed: sameError(attempt.error, "RENDER_FAILURE") && frame.state === "aborted" &&
        tracked.removeCalls() === 1,
    };
  });

  record("draw-failure-preserves-prior-count-and-noop-index", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    let first = null;
    let failed = null;
    try {
      frame.begin(environment);
      first = capture(() => frame.batch([segment]));
      const context = tracked.graphics().drawingContext;
      setOwnMethod(context, "stroke", () => { throw new Error("injected draw failure"); });
      failed = capture(() => frame.batch([convertedNoop, segment]));
      const laterEnd = capture(() => frame.end());
      return {
        first: first.error,
        error: failed.error,
        laterEnd: laterEnd.error,
        output: failed.returned,
        state: frame.state,
        count: frame.count,
        removeCalls: tracked.removeCalls(),
        passed: first.error === null && sameError(failed.error, "RENDER_FAILURE", 2) &&
          sameError(laterEnd.error, "INVALID_STATE") && failed.returned === null &&
          frame.state === "aborted" && frame.count === 1 && tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("draw-frame-error-is-wrapped-at-original-source-index", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      const first = capture(() => frame.batch([segment]));
      setOwnMethod(tracked.graphics().drawingContext, "stroke", () => {
        throw new FrameError("INVALID_COMMAND", 777);
      });
      const failed = capture(() => frame.batch([convertedNoop, segment]));
      return {
        hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
        first: first.error,
        error: failed.error,
        state: frame.state,
        count: frame.count,
        removeCalls: tracked.removeCalls(),
        passed: first.error === null && sameError(failed.error, "RENDER_FAILURE", 2) &&
          frame.state === "aborted" && frame.count === 1 && tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("silent-loss-after-stroke-preserves-prior-count-and-noop-index", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      const first = capture(() => frame.batch([segment]));
      const context = tracked.graphics().drawingContext;
      let lost = false;
      const stroke = context.stroke;
      setOwnMethod(context, "isContextLost", () => lost);
      setOwnMethod(context, "stroke", function strokeThenLoseContext() {
        stroke.call(context);
        lost = true;
      });
      const failed = capture(() => frame.batch([convertedNoop, segment]));
      return {
        first: first.error,
        error: failed.error,
        state: frame.state,
        count: frame.count,
        removeCalls: tracked.removeCalls(),
        contextLoss: "injected silently after native stroke; not spontaneous browser loss",
        passed: first.error === null && sameError(failed.error, "RENDER_FAILURE", 2) &&
          frame.state === "aborted" && frame.count === 1 && tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("end-failure-is-render-failure", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    let attempt;
    try {
      frame.begin(environment);
      setOwnMethod(tracked.graphics().drawingContext, "isContextLost", () => {
        throw new Error("injected finalization failure");
      });
      attempt = capture(() => frame.end());
      const canvas = tracked.canvas();
      return {
        error: attempt.error,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        backing: [canvas.width, canvas.height],
        passed: sameError(attempt.error, "RENDER_FAILURE") && frame.state === "aborted" &&
          tracked.removeCalls() === 1 && canvas.width === 0 && canvas.height === 0,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("prebatch-loss-frame-error-is-wrapped-as-render-failure", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      setOwnMethod(tracked.graphics().drawingContext, "isContextLost", () => {
        throw new FrameError("INVALID_COMMAND", 777);
      });
      const attempt = capture(() => frame.batch([]));
      return {
        hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
        error: attempt.error,
        state: frame.state,
        count: frame.count,
        removeCalls: tracked.removeCalls(),
        passed: sameError(attempt.error, "RENDER_FAILURE") && frame.state === "aborted" &&
          frame.count === 0 && tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("end-loss-frame-error-is-wrapped-as-render-failure", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      setOwnMethod(tracked.graphics().drawingContext, "isContextLost", () => {
        throw new FrameError("INVALID_COMMAND", 777);
      });
      const attempt = capture(() => frame.end());
      return {
        hostError: { code: "INVALID_COMMAND", commandIndex: 777 },
        error: attempt.error,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        passed: sameError(attempt.error, "RENDER_FAILURE") && frame.state === "aborted" &&
          tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("empty-and-noop-only-injected-loss-do-not-commit", true, () => {
    const attempts = [];
    for (const commands of [[], [convertedNoop]]) {
      const tracked = trackedGraphics(p);
      const frame = new P5Frame(p, tracked.factory);
      try {
        frame.begin(environment);
        setOwnMethod(tracked.graphics().drawingContext, "isContextLost", () => true);
        const attempt = capture(() => frame.batch(commands));
        attempts.push({
          inputCount: commands.length,
          error: attempt.error,
          state: frame.state,
          count: frame.count,
          removeCalls: tracked.removeCalls(),
        });
      } finally {
        cleanup(frame);
      }
    }
    return {
      attempts,
      spontaneousContextLoss: "not simulated; both failures are injected isContextLost probes",
      passed: attempts.every((attempt) => sameError(attempt.error, "RENDER_FAILURE") &&
        attempt.state === "aborted" && attempt.count === 0 && attempt.removeCalls === 1),
    };
  });

  record("reentrant-host-frame-error-aborts-and-releases", true, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    let attempt;
    try {
      frame.begin(environment);
      setOwnMethod(tracked.graphics().drawingContext, "stroke", () => frame.end());
      attempt = capture(() => frame.batch([segment]));
      return {
        error: attempt.error,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        passed: sameError(attempt.error, "INVALID_STATE") && frame.state === "aborted" &&
          tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("cleanup-accessor-preserves-primary-frame-error", true, () => {
    const tracked = trackedGraphics(p, (graphics, _canvas, removeCalls) => {
      const remove = graphics.remove;
      Object.defineProperty(graphics, "remove", {
        configurable: true,
        get() {
          remove.call(graphics);
          if (removeCalls() !== 1) throw new Error("injected cleanup count mismatch");
          throw new Error("injected remove accessor failure");
        },
      });
    });
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      setOwnMethod(tracked.graphics().drawingContext, "stroke", () => {
        throw new Error("injected draw failure before cleanup accessor");
      });
      const attempt = capture(() => frame.batch([segment]));
      return {
        error: attempt.error,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        passed: sameError(attempt.error, "RENDER_FAILURE", 0) && frame.state === "aborted" &&
          tracked.removeCalls() === 1,
      };
    } finally {
      cleanup(frame);
    }
  });

  record("completed-transfer-repeated-release-zeros-backing-once", false, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    let completed = null;
    try {
      frame.begin(environment);
      completed = frame.end();
      const canvas = tracked.canvas();
      P5Frame.releaseCompleted(completed);
      P5Frame.releaseCompleted(completed);
      const misuse = capture(() => frame.end());
      return {
        misuse: misuse.error,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        backing: [canvas.width, canvas.height],
        passed: sameError(misuse.error, "INVALID_STATE") && frame.state === "completed" &&
          tracked.removeCalls() === 1 && canvas.width === 0 && canvas.height === 0,
      };
    } finally {
      cleanup(frame, completed);
    }
  });

  record("explicit-abort-publishes-no-output", false, () => {
    const tracked = trackedGraphics(p);
    const frame = new P5Frame(p, tracked.factory);
    try {
      frame.begin(environment);
      frame.abort();
      const laterEnd = capture(() => frame.end());
      const canvas = tracked.canvas();
      return {
        laterEnd: laterEnd.error,
        output: laterEnd.returned,
        state: frame.state,
        removeCalls: tracked.removeCalls(),
        backing: [canvas.width, canvas.height],
        passed: sameError(laterEnd.error, "INVALID_STATE") && laterEnd.returned === null &&
          frame.state === "aborted" && tracked.removeCalls() === 1 &&
          canvas.width === 0 && canvas.height === 0,
      };
    } finally {
      cleanup(frame);
    }
  });

  return {
    scope: "real p5.Graphics/Canvas2D lifecycle with deterministic injected adapter faults; spontaneous browser context loss is not claimed",
    profile: "drawing.fresh-raster-2d",
    version: "0.1.0",
    failures,
    passed: failures === 0,
    counts: { checks: checks.length },
    checks,
  };
}
