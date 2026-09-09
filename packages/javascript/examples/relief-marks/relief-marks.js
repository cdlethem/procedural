import { seededQuadrantPartition2D } from "../../src/quadrant-partition.js";
import { delaunay2D } from "../../src/delaunay.js";

const REPLACEMENTS = 290;
const TRIANGULATION_WORK = 50_000_000;

/** Example-only java.util.Random nextDouble stream for the authored spike policy. */
class JavaRandom {
  #state;
  static #MULT = 0x5deece66dn;
  static #MASK = (1n << 48n) - 1n;

  constructor(seed) {
    this.#state = (BigInt(seed >>> 0) ^ JavaRandom.#MULT) & JavaRandom.#MASK;
  }

  #next(bits) {
    this.#state = (this.#state * JavaRandom.#MULT + 11n) & JavaRandom.#MASK;
    return Number(this.#state >> BigInt(48 - bits));
  }

  nextDouble() {
    return (this.#next(26) * 134217728 + this.#next(27)) / 9007199254740992;
  }
}

function checkSeed(seed) {
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("seed must be an unsigned 32-bit integer");
  }
  return seed;
}

/**
 * Retained Momito composition policy. The quadrant partition and Delaunay
 * topology are accepted reusable operations; this module owns the source
 * sketch's fixed canvas/layout settings and a separate Java-compatible stream
 * deciding which leaf centres receive spikes. Independently composed from
 * survey/out/2019/generativos/momito/notes.md and ReliefComposition.java.
 */
class ReliefComposition {
  #partition;
  #mesh;
  #spans;
  #spikes;

  constructor(partition, mesh, spans, spikes) {
    this.#partition = partition;
    this.#mesh = mesh;
    this.#spans = spans;
    this.#spikes = spikes;
    Object.freeze(this);
  }

  static create(seed) {
    seed = checkSeed(seed);
    const partition = seededQuadrantPartition2D({
      seed,
      replacements: REPLACEMENTS,
      origin: [-480, -480],
      extent: [960, 960],
      selectionFraction: 0.5,
    });
    const count = partition.size;
    const sites = new Array(count);
    const spans = new Float64Array(count);
    const bounds = new Float64Array(4);
    for (let i = 0; i < count; i += 1) {
      partition.boundsInto(i, bounds, 0);
      sites[i] = [(bounds[0] + bounds[2]) * 0.5, (bounds[1] + bounds[3]) * 0.5];
      spans[i] = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
    }
    const mesh = delaunay2D({ points: sites, maxWork: TRIANGULATION_WORK });
    const selection = new JavaRandom(seed);
    const spikes = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) spikes[i] = selection.nextDouble() < 0.9 ? 1 : 0;
    return new ReliefComposition(partition, mesh, spans, spikes);
  }

  get mesh() { return this.#mesh; }
  get leafCount() { return this.#partition.size; }
  spikeAt(leaf) { return this.#spikes[this.#index(leaf)] === 1; }
  spikeHeight(leaf) { return this.#spans[this.#index(leaf)] * 0.08 * 3.8; }
  centerInto(leaf, out, offset = 0) {
    const index = this.#index(leaf);
    return this.#mesh.pointInto(this.#mesh.inputVertexAt(index), out, offset);
  }

  #index(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.#partition.size) throw new RangeError("leaf index");
    return index;
  }
}

export function createReliefComposition(seed) {
  return ReliefComposition.create(seed);
}
