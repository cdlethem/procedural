import { sequentialDiscProjection2D } from "../../src/disc-projection.js";

const CONTOUR_POINTS = 241;
const LINE_POINTS = 121;
const LINE_COUNT = 12;
const STRENGTHS = Object.freeze([0.45, 1.0, 0.0]);

function buildInputPoints() {
  const points = new Array(CONTOUR_POINTS + LINE_COUNT * LINE_POINTS);
  for (let i = 0; i < CONTOUR_POINTS; i += 1) {
    const angle = Math.PI * 2 * i / (CONTOUR_POINTS - 1);
    points[i] = [180 + 105 * Math.cos(angle), 250 + 105 * Math.sin(angle)];
  }
  for (let row = 0; row < LINE_COUNT; row += 1) {
    for (let i = 0; i < LINE_POINTS; i += 1) {
      const index = CONTOUR_POINTS + row * LINE_POINTS + i;
      points[index] = [390 + i * 2.5, 120 + row * 23];
    }
  }
  return points;
}

function buildDiscOrders() {
  const first = [[250, 215, 72], [230, 300, 58], [535, 205, 58], [585, 270, 72]];
  const reversed = first.slice().reverse();
  return [first, reversed];
}

/**
 * Editable ordered-disc projection deformation for ProjectionMarks: a filled contour
 * and twelve parallel scanlines pushed outward by four discs in either application
 * order, at three strengths. Independently composed; not collision resolution or
 * clipping (later discs can undo earlier exclusion). Contour/line counts, disc
 * positions, and strengths here are authored piece settings, not
 * DiscProjection2D defaults or recommended operation ranges. See
 * catalog/validation/sequential-disc-projection-2d.json, targets.processing-java.technique.
 */
class ProjectionComposition {
  #inputPoints = buildInputPoints();
  #discOrders = buildDiscOrders();
  #coordinates = new Array(6);
  #mode = 0;
  #order = 0;
  #alternate = false;

  constructor() {
    for (let o = 0; o < 2; o += 1) {
      for (let m = 0; m < 3; m += 1) {
        const index = o * 3 + m;
        const maxTests = this.#inputPoints.length * this.#discOrders[o].length;
        const projected = sequentialDiscProjection2D({
          points: this.#inputPoints,
          discs: this.#discOrders[o],
          strength: STRENGTHS[m],
          maxTests,
        });
        this.#coordinates[index] = projected.points();
      }
    }
  }

  get inputPoints() { return this.#inputPoints; }
  get discOrders() { return this.#discOrders; }
  get mode() { return this.#mode; }
  get order() { return this.#order; }
  get alternate() { return this.#alternate; }
  get activeCoordinates() { return this.#coordinates[this.#order * 3 + this.#mode]; }

  cycleMode() { this.#mode = (this.#mode + 1) % 3; }
  toggleOrder() { this.#order = 1 - this.#order; }
  toggleAlternate() { this.#alternate = !this.#alternate; }
}

export function createProjectionMarks() {
  return new ProjectionComposition();
}
