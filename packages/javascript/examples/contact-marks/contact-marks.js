import { nearestSegmentContact2D } from "../../src/nearest-segment-contact.js";

// Ten authored start points; every query runs from its start toward the center.
const STARTS = [[60, 80], [180, 50], [370, 50], [550, 100], [590, 280],
  [550, 550], [370, 590], [170, 560], [50, 390], [50, 210]];
const CENTER = [320, 320];

export const PALETTE_DEFAULT = Object.freeze([0xc75146, 0xdb9555, 0x288782, 0x517293]);
export const PALETTE_ALTERNATE = Object.freeze([0x72649a, 0xaa713f, 0x3e879c, 0x719445]);

/**
 * Nearest-segment contact study for ContactMarks: ten query segments from authored
 * start points toward the center, a four-edge obstacle quadrilateral, and one nearest
 * contact per query. Independently composed; the starts, corners, and palette here are
 * authored piece settings, not NearestSegmentContact2D defaults or recommended
 * operation ranges. See catalog/validation/nearest-segment-contact-2d.json.
 */
class ContactComposition {
  #queries;
  #obstacles;
  #contacts;
  #shifted = false;
  #alternateColors = false;

  constructor() {
    this.#queries = STARTS.map(([x, y]) => [x, y, CENTER[0], CENTER[1]]);
    this.#rebuildContacts();
  }

  #obstacleCorners() {
    // Swap these obstacle segments for retained polygon edges or another line drawing.
    return [[this.#shifted ? 295 : 240, 140], [460, 220], [410, 470], [180, 420]];
  }

  #rebuildContacts() {
    const corners = this.#obstacleCorners();
    const obstacles = new Array(corners.length);
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      obstacles[i] = [a[0], a[1], b[0], b[1]];
    }
    this.#obstacles = obstacles;
    this.#contacts = nearestSegmentContact2D({
      queries: this.#queries,
      obstacles,
      maxWork: this.#queries.length * obstacles.length,
    });
  }

  get queries() { return this.#queries; }
  get obstacles() { return this.#obstacles; }
  get contacts() { return this.#contacts; }
  get shifted() { return this.#shifted; }
  get alternateColors() { return this.#alternateColors; }
  get palette() { return this.#alternateColors ? PALETTE_ALTERNATE : PALETTE_DEFAULT; }

  toggleShifted() { this.#shifted = !this.#shifted; this.#rebuildContacts(); }
  toggleAlternateColors() { this.#alternateColors = !this.#alternateColors; }

  /** Java's 0 key: geometry rebuild only when the shifted corner actually changes. */
  reset() {
    const geometryChanged = this.#shifted;
    this.#shifted = false;
    this.#alternateColors = false;
    if (geometryChanged) this.#rebuildContacts();
  }
}

export function createContactMarks() {
  return new ContactComposition();
}
