import { retainedRectangleCuts2D, RectangleCutError } from "../../src/retained-rectangle-cuts.js";

// Example-only java.util.Random nextDouble sequence, matching CutComposition's
// authored ratio source. This does not expose or alter the library's private
// xoshiro sampling stream. Duplicated per-module per the established convention
// (see facet-marks.js/grain-marks.js's identical helper).
function javaExampleRandom(seed) {
  const multiplier = 0x5deece66dn, mask = (1n << 48n) - 1n;
  let state = (BigInt(seed) ^ multiplier) & mask;
  function next(bits) {
    state = (state * multiplier + 11n) & mask;
    return Number(state >> BigInt(48 - bits));
  }
  return () => (next(26) * 134217728 + next(27)) / 9007199254740992;
}

const PALETTE = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261];

/**
 * Click-to-select, mid-point X/Y cuts, and identity-preserving removal for CutMarks.
 * Independently composed from survey/out/2019/generativos/griton/notes.md's retained
 * unequal-region editing motivation. Seed, palette, cut count, ratios, and decoration
 * here are authored piece settings, not RetainedRectangleCuts2D defaults or
 * recommended operation ranges. See catalog/validation/retained-rectangle-cuts-2d.json.
 */
function cutIfInterior(model, leaf, axis, coordinate) {
  const [left, top, right, bottom] = leaf.bounds;
  const low = axis === "X" ? left : top;
  const high = axis === "X" ? right : bottom;
  if (!(coordinate > low && coordinate < high)) return null;
  return model.cut(leaf.id, axis, coordinate);
}

function rebuild(seed, staggered, holes) {
  const model = retainedRectangleCuts2D({ bounds: [24.0, 24.0, 488.0, 488.0] });
  const random = javaExampleRandom(seed);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const leaves = model.leaves();
    const selected = leaves[iteration % leaves.length];
    const ratioX = 0.25 + 0.5 * random();
    const ratioYLow = 0.25 + 0.5 * random();
    const ratioYHigh = 0.25 + 0.5 * random();
    const children = cutIfInterior(model, selected, "X",
      selected.bounds[0] + (selected.bounds[2] - selected.bounds[0]) * ratioX);
    if (children === null) continue;
    const low = model.leaf(children[0]);
    const high = model.leaf(children[1]);
    cutIfInterior(model, low, "Y", low.bounds[1] + (low.bounds[3] - low.bounds[1]) * ratioYLow);
    const highRatio = staggered ? ratioYHigh : ratioYLow;
    cutIfInterior(model, high, "Y", high.bounds[1] + (high.bounds[3] - high.bounds[1]) * highRatio);
  }
  if (holes) {
    for (const leaf of model.leaves()) if (leaf.id % 7 === 0) model.remove(leaf.id);
  }
  // Java's `initialEdit` branch is reachable only via the offline `configureRender`
  // render-helper hook (not an interactive key binding); this browser starter's
  // interactive path always starts with no selection, matching keyPressed's reset.
  return { model, selectedId: -1 };
}

class CutComposition {
  #seed = 42;
  #staggered = false;
  #decoration = false;
  #holes = false;
  #model;
  #selectedId;

  constructor() {
    const built = rebuild(this.#seed, this.#staggered, this.#holes);
    this.#model = built.model;
    this.#selectedId = built.selectedId;
  }

  get model() { return this.#model; }
  get selectedId() { return this.#selectedId; }
  get staggered() { return this.#staggered; }
  get decoration() { return this.#decoration; }
  get holes() { return this.#holes; }

  #rebuild() {
    const built = rebuild(this.#seed, this.#staggered, this.#holes);
    this.#model = built.model;
    this.#selectedId = built.selectedId;
  }

  toggleStaggered() { this.#staggered = !this.#staggered; this.#rebuild(); }
  toggleDecoration() { this.#decoration = !this.#decoration; }
  toggleHoles() { this.#holes = !this.#holes; this.#rebuild(); }

  select(x, y) {
    for (const leaf of this.#model.leaves()) {
      const [left, top, right, bottom] = leaf.bounds;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        this.#selectedId = leaf.id;
        return;
      }
    }
    this.#selectedId = -1;
  }

  cutSelected(axis) {
    if (this.#selectedId < 0) return;
    let selected;
    try {
      selected = this.#model.leaf(this.#selectedId);
    } catch (error) {
      if (!(error instanceof RectangleCutError) || error.code !== "UNKNOWN_ID") throw error;
      this.#selectedId = -1;
      return;
    }
    const coordinate = axis === "X"
      ? selected.bounds[0] + (selected.bounds[2] - selected.bounds[0]) * 0.5
      : selected.bounds[1] + (selected.bounds[3] - selected.bounds[1]) * 0.5;
    const children = cutIfInterior(this.#model, selected, axis, coordinate);
    if (children !== null) this.#selectedId = children[0];
  }

  removeSelected() {
    if (this.#selectedId < 0) return;
    try {
      this.#model.remove(this.#selectedId);
    } catch (error) {
      if (!(error instanceof RectangleCutError) || error.code !== "UNKNOWN_ID") throw error;
    }
    this.#selectedId = -1;
  }

  reset() {
    this.#seed = 42;
    this.#staggered = false;
    this.#decoration = false;
    this.#holes = false;
    this.#rebuild();
  }
}

export function createCutMarks() {
  return new CutComposition();
}

export { PALETTE };
