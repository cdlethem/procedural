import { regularGrid } from "../../src/regular-grid.js";
import { targetSprings2D } from "../../src/target-springs.js";
import { delaunay2D } from "../../src/delaunay.js";

const RETURN_RATE = 0.04;
const POINTER_RADIUS = 180.0;
const POINTER_RATE = 0.12;
const STRENGTH = 0.025;
const RETENTION = 0.7;
export const PALETTE = Object.freeze([0x173f5f, 0xaf5441, 0xe9c46a, 0x347969]);

/** Example-owned no-step accessor view matching the subset of TargetSprings this
 * composition reads (size/positionInto/toValues), the same divergence documented
 * in spring-marks.js: Java's TargetSprings2D.create() wraps state with no physics;
 * the JS core's sole targetSprings2D entry point always performs one step. */
function wrapMotionState(bodies) {
  return {
    size: bodies.length,
    positionInto(index, output, offset) { output[offset] = bodies[index].position[0]; output[offset + 1] = bodies[index].position[1]; },
    toValues() { return { bodies: bodies.map((b) => ({ position: [...b.position], velocity: [...b.velocity], strength: b.strength, retention: b.retention })) }; },
  };
}

function buildInitialState() {
  const grid = regularGrid({ origin: [128.0, 128.0], spacing: [64.0, 64.0], columns: 7, rows: 7 });
  const count = grid.size;
  const initial = new Float64Array(count * 2);
  const sites = new Array(count);
  const point = [0, 0];
  for (let body = 0; body < count; body += 1) {
    grid.pointInto(body, point, 0);
    initial[body * 2] = point[0];
    initial[body * 2 + 1] = point[1];
    sites[body] = [point[0], point[1]];
  }
  // This topology is built from the undeformed regular grid exactly once.
  const initialMesh = delaunay2D({ points: sites, maxWork: 50000000 });
  return { initial, initialMesh };
}

function newMotion(initial) {
  const bodies = new Array(initial.length / 2);
  for (let body = 0; body < bodies.length; body += 1) {
    bodies[body] = { position: [initial[body * 2], initial[body * 2 + 1]], velocity: [0.0, 0.0], strength: STRENGTH, retention: RETENTION };
  }
  return wrapMotionState(bodies);
}

/**
 * Editable mouse-driven local target-impulse composition for PointerMarks: a fixed
 * 7x7 grid of spring bodies whose targets drift back toward their initial positions
 * unless a held pointer pulls nearby targets toward it, with a fixed initial
 * Delaunay wire connectivity transferred from the undeformed grid. Independently
 * composed; grid, response, radius, and palette here are authored piece settings,
 * not TargetSprings2D/Delaunay2D defaults or recommended operation ranges. See
 * catalog/validation/target-springs-2d.json, targets.processing-java.technique.
 */
class PointerComposition {
  #initial; #initialMesh;
  #targets; #motion;
  #running = false;
  #wire = false;
  #showTargets = false;
  #pointerHeld = false;
  #pointerX = 0.0;
  #pointerY = 0.0;
  #tick = 0;

  constructor() {
    const built = buildInitialState();
    this.#initial = built.initial;
    this.#initialMesh = built.initialMesh;
    this.#resetState();
  }

  #resetState() {
    this.#targets = this.#initial.slice();
    this.#motion = newMotion(this.#initial);
    this.#tick = 0;
    this.#pointerHeld = false;
    this.#pointerX = 0.0;
    this.#pointerY = 0.0;
    this.#running = false;
    this.#wire = false;
    this.#showTargets = false;
  }

  /** Deterministic replay seam: callers supply one already-sampled pointer for one logical tick. */
  stepWithInput(held, sampledPointerX, sampledPointerY) {
    if (!Number.isFinite(sampledPointerX) || !Number.isFinite(sampledPointerY)) throw new Error("finite pointer required");
    if (this.#tick === Number.MAX_SAFE_INTEGER) throw new Error("tick counter exhausted");
    const nextTargets = new Float64Array(this.#targets.length);
    for (let offset = 0; offset < this.#targets.length; offset += 2) {
      let targetX = this.#targets[offset] + (this.#initial[offset] - this.#targets[offset]) * RETURN_RATE;
      let targetY = this.#targets[offset + 1] + (this.#initial[offset + 1] - this.#targets[offset + 1]) * RETURN_RATE;
      if (held) {
        const dx = sampledPointerX - targetX;
        const dy = sampledPointerY - targetY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < POINTER_RADIUS) {
          const amount = POINTER_RATE * (1.0 - distance / POINTER_RADIUS);
          targetX += dx * amount;
          targetY += dy * amount;
        }
      }
      nextTargets[offset] = targetX;
      nextTargets[offset + 1] = targetY;
    }
    const targetPairs = new Array(nextTargets.length / 2);
    for (let i = 0; i < targetPairs.length; i += 1) targetPairs[i] = [nextTargets[i * 2], nextTargets[i * 2 + 1]];
    this.#motion = targetSprings2D({ state: this.#motion.toValues(), targets: targetPairs });
    this.#targets = nextTargets;
    this.#tick += 1;
  }

  capturePointer(x, y, width, height) {
    if (x >= 0 && x <= width && y >= 0 && y <= height) {
      this.#pointerX = x;
      this.#pointerY = y;
      this.#pointerHeld = true;
    } else {
      this.#pointerHeld = false;
    }
  }

  releasePointer() { this.#pointerHeld = false; }

  get initialMesh() { return this.#initialMesh; }
  get motion() { return this.#motion; }
  get targets() { return this.#targets; }
  get running() { return this.#running; }
  get wire() { return this.#wire; }
  get showTargets() { return this.#showTargets; }
  get pointerHeld() { return this.#pointerHeld; }
  get pointerX() { return this.#pointerX; }
  get pointerY() { return this.#pointerY; }
  get tick() { return this.#tick; }

  toggleRunning() { this.#running = !this.#running; }
  toggleWire() { this.#wire = !this.#wire; }
  toggleShowTargets() { this.#showTargets = !this.#showTargets; }
  reset() { this.#resetState(); }
}

export function createPointerMarks() {
  return new PointerComposition();
}
