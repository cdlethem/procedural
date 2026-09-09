import { binaryCellPartition2D } from "../../src/binary-cell-partition.js";

/**
 * Editable attempt-count/axis-policy cell partition for PanelMarks. Independently
 * composed from the integer panel idioms in survey/out/2018/Generativos/poop/notes.md
 * and survey/out/2018/Generativos/barab/notes.md. Constants here (attempts cycle,
 * palettes, cell size) are example settings, not library defaults or encouraged
 * ranges. See catalog/validation/binary-cell-partition-2d.json,
 * targets.processing-java.technique (CP17).
 */
const SEED = 42;
const COLUMNS = 60;
const ROWS = 60;

function rebuild(attempts, randomAxis) {
  return binaryCellPartition2D({
    seed: SEED,
    columns: COLUMNS,
    rows: ROWS,
    attempts,
    axisPolicy: randomAxis ? "RANDOM" : "LONGEST",
  });
}

class PanelComposition {
  #attempts = 80;
  #randomAxis = false;
  #layout;

  constructor() {
    this.#layout = rebuild(this.#attempts, this.#randomAxis);
  }

  get layout() { return this.#layout; }
  get attempts() { return this.#attempts; }
  get randomAxis() { return this.#randomAxis; }

  cycleAttempts() {
    this.#attempts = this.#attempts === 80 ? 240 : this.#attempts === 240 ? 20 : 80;
    this.#layout = rebuild(this.#attempts, this.#randomAxis);
  }

  toggleAxisPolicy() {
    this.#randomAxis = !this.#randomAxis;
    this.#layout = rebuild(this.#attempts, this.#randomAxis);
  }

  reset() {
    this.#attempts = 80;
    this.#randomAxis = false;
    this.#layout = rebuild(this.#attempts, this.#randomAxis);
  }
}

export function createPanelMarks() {
  return new PanelComposition();
}
