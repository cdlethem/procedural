import { regularGrid } from "../../src/regular-grid.js";
import { targetSprings2D } from "../../src/target-springs.js";
import { delaunay2D } from "../../src/delaunay.js";

/**
 * Editable target policy, bounded trails, and fixed-connectivity transfer for
 * SpringMarks. The spring recurrence is motivated by
 * survey/out/2018/Generativos/araniaaas/notes.md; this regular layout and local target
 * impulse are authored composition choices. Constants here are example settings, not
 * library defaults or encouraged ranges. See catalog/validation/target-springs-2d.json,
 * targets.processing-java.technique.
 *
 * Adapted to the JS core's pure {state,targets}->nextState transition (the deliberate,
 * documented divergence from Java's mutable create()+step() API): each step() call
 * reassigns `motion` to a freshly returned TargetSprings result instead of mutating
 * in place. This preserves the same atomicity Java gets from its try/finally: if
 * targetSprings2D throws, this composition's fields are untouched.
 * Java's `TargetSprings2D` exposes both a `create(state)` factory (wraps a state
 * descriptor with no physics) and a mutable `step(targets)`. The JS core's sole
 * entry point, `targetSprings2D({state,targets})`, always performs one physics step
 * (the shared input_schema/output_schema's actual portable contract; Java's bare
 * `create()` is a Java-specific shortcut outside that contract). `response()` needs
 * Java's no-step wrap (replace coefficients, keep position/velocity exactly), so this
 * composition provides its own tiny local read-only view over a state descriptor,
 * entirely example-owned and never touching the shared core's step physics.
 */
const HISTORY = 121;

function pair(x, y) { return [x, y]; }

/** Example-owned no-step accessor view matching the subset of TargetSprings this
 * composition reads (size/positionInto/velocityInto/strengthAt/retentionAt/toValues).
 */
function wrapMotionState(state) {
  const bodies = state.bodies;
  return {
    size: bodies.length,
    positionInto(index, output, offset) { output[offset] = bodies[index].position[0]; output[offset + 1] = bodies[index].position[1]; },
    velocityInto(index, output, offset) { output[offset] = bodies[index].velocity[0]; output[offset + 1] = bodies[index].velocity[1]; },
    strengthAt(index) { return bodies[index].strength; },
    retentionAt(index) { return bodies[index].retention; },
    toValues() { return { bodies: bodies.map((b) => ({ position: [...b.position], velocity: [...b.velocity], strength: b.strength, retention: b.retention })) }; },
  };
}

class SpringComposition {
  #initial; #targets; #nextTargets; #history; #mesh; #initialState;
  #motion; #tick; #newest; #samples;

  constructor() {
    const grid = regularGrid({ origin: pair(128, 128), spacing: pair(64, 64), columns: 7, rows: 7 });
    const count = grid.size;
    this.#initial = new Array(count * 2).fill(0);
    this.#targets = new Array(count * 2).fill(0);
    this.#nextTargets = new Array(count * 2).fill(0);
    this.#history = new Array(HISTORY);
    for (let h = 0; h < HISTORY; h += 1) this.#history[h] = new Array(count * 2).fill(0);
    const bodies = new Array(count), sites = new Array(count);
    for (let i = 0; i < count; i += 1) {
      grid.pointInto(i, this.#initial, i * 2);
      const point = pair(this.#initial[i * 2], this.#initial[i * 2 + 1]);
      sites[i] = point;
      bodies[i] = { position: point, velocity: pair(0, 0), strength: 0.025, retention: 0.7 };
    }
    this.#initialState = { bodies };
    this.#mesh = delaunay2D({ points: sites, maxWork: 50000000 });
    this.reset();
  }

  /** Restore motion and example history without rebuilding initial connectivity. */
  reset() {
    this.#motion = targetSprings2D({ state: this.#initialState, targets: this.#targetPairs(this.#initial) });
    for (let i = 0; i < this.#initial.length; i += 1) this.#targets[i] = this.#initial[i];
    this.#tick = 0; this.#newest = 0; this.#samples = 1;
    for (let i = 0; i < this.#initial.length; i += 1) this.#history[0][i] = this.#initial[i];
  }

  /** Change only the targets. Calling this at rest does not itself run a tick. */
  disturb() {
    for (let i = 0; i < this.#targets.length; i += 2) {
      const dx = this.#initial[i] - 320, dy = this.#initial[i + 1] - 320;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 200) {
        const weight = 1 - distance / 200;
        this.#targets[i] += 80 * weight;
        this.#targets[i + 1] -= 40 * weight;
      }
    }
  }

  #targetPairs(flat) {
    const pairs = new Array(flat.length / 2);
    for (let i = 0, offset = 0; offset < flat.length; i += 1, offset += 2) pairs[i] = [flat[offset], flat[offset + 1]];
    return pairs;
  }

  /** One explicit return-policy update, spring step, and completed history sample. */
  step() {
    if (this.#tick === Number.MAX_SAFE_INTEGER) throw new RangeError("example tick counter exhausted");
    for (let i = 0; i < this.#targets.length; i += 1) {
      this.#nextTargets[i] = this.#targets[i] + (this.#initial[i] - this.#targets[i]) * 0.04;
    }
    // If the core fails, targets, tick and history remain at the previous sample
    // (this reassignment only happens after targetSprings2D returns successfully).
    const advanced = targetSprings2D({ state: this.#motion.toValues(), targets: this.#targetPairs(this.#nextTargets) });
    this.#motion = advanced;
    for (let i = 0; i < this.#targets.length; i += 1) this.#targets[i] = this.#nextTargets[i];
    this.#tick += 1;
    this.#newest = (this.#newest + 1) % HISTORY;
    if (this.#samples < HISTORY) this.#samples += 1;
    for (let i = 0; i < this.#motion.size; i += 1) this.#motion.positionInto(i, this.#history[this.#newest], i * 2);
  }

  /** Replace coefficients through the same detached state route available to artists. */
  response(strength, retention) {
    const state = this.#motion.toValues();
    for (const body of state.bodies) { body.strength = strength; body.retention = retention; }
    this.#motion = wrapMotionState(state);
  }

  get motion() { return this.#motion; }
  get mesh() { return this.#mesh; }
  get tick() { return this.#tick; }
  get sampleCount() { return this.#samples; }
  get oldestTick() { return this.#tick - this.#samples + 1; }

  #checkBody(body) {
    if (body < 0 || body >= this.#motion.size) throw new RangeError("body");
  }

  initialInto(body, output, offset) {
    this.#checkBody(body);
    output[offset] = this.#initial[body * 2]; output[offset + 1] = this.#initial[body * 2 + 1];
  }
  targetInto(body, output, offset) {
    this.#checkBody(body);
    output[offset] = this.#targets[body * 2]; output[offset + 1] = this.#targets[body * 2 + 1];
  }
  /** sample 0 is oldest, sampleCount-1 is current; never joins newest back to oldest. */
  historyInto(sample, body, output, offset) {
    if (sample < 0 || sample >= this.#samples) throw new RangeError("sample");
    this.#checkBody(body);
    const slot = (this.#newest - this.#samples + 1 + HISTORY + sample) % HISTORY;
    output[offset] = this.#history[slot][body * 2]; output[offset + 1] = this.#history[slot][body * 2 + 1];
  }
  /** Convert a canonical mesh vertex to its original spring body explicitly. */
  bodyForVertex(vertex) { return this.#mesh.sourceIndexAt(vertex); }
}

export function createSpringMarks() {
  return new SpringComposition();
}
