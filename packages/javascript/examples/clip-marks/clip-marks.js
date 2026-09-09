import { clipSegmentsSimplePolygon2D } from "../../src/segment-clip.js";

// Authored source sets. The hatch rows and supplied polylines belong to this
// artwork, not to SegmentClip2D defaults or recommended ranges.
function hatch(spacing) {
  const result = [];
  for (let y = -180; y < 700; y += spacing) result.push([40, y, 600, y + 220]);
  return result;
}

const HATCH_POINTS = [[40, 150], [600, 220], [40, 290], [600, 360], [40, 430], [600, 500]];

/**
 * Segment-clip study for ClipMarks: three authored source sets (dense hatch,
 * sparse hatch, supplied polylines) clipped against a notched octagon.
 * Independently composed; settings here are authored piece settings, not
 * SegmentClip2D defaults. See catalog/validation/segment-clip-2d.json.
 */
class ClipComposition {
  #denseStrokes;
  #sparseStrokes;
  #suppliedStrokes;
  #sources;
  #polygon;
  #clipped;
  #sparse = false;
  #shallow = false;
  #alternateSource = false;
  #alternateColor = false;
  #endpoints = true;
  #overlay = false;
  #clipCalls = 0;

  constructor() {
    this.#denseStrokes = hatch(12);
    this.#sparseStrokes = hatch(28);
    this.#suppliedStrokes = [];
    for (let i = 1; i < HATCH_POINTS.length; i += 1) {
      const a = HATCH_POINTS[i - 1];
      const b = HATCH_POINTS[i];
      this.#suppliedStrokes.push([a[0], a[1], b[0], b[1]]);
    }
    this.#rebuildGeometry();
  }

  #rebuildGeometry() {
    this.#sources = this.#alternateSource ? this.#suppliedStrokes : (this.#sparse ? this.#sparseStrokes : this.#denseStrokes);
    const floor = this.#shallow ? 430 : 270;
    this.#polygon = [[100, 100], [540, 100], [540, 540], [380, 540],
      [380, floor], [260, floor], [260, 540], [100, 540]];
    this.#clipped = clipSegmentsSimplePolygon2D({
      polygon: this.#polygon,
      segments: this.#sources,
      maxWork: 100000,
      maxOutputSegments: 512,
    });
    this.#clipCalls += 1;
  }

  get sources() { return this.#sources; }
  get polygon() { return this.#polygon; }
  get clipped() { return this.#clipped; }
  get sparse() { return this.#sparse; }
  get shallow() { return this.#shallow; }
  get alternateSource() { return this.#alternateSource; }
  get alternateColor() { return this.#alternateColor; }
  get endpoints() { return this.#endpoints; }
  get overlay() { return this.#overlay; }
  get clipCalls() { return this.#clipCalls; }

  /** H: toggling the hatch density only rebuilds when the supplied source is not active. */
  toggleSparse() {
    this.#sparse = !this.#sparse;
    if (!this.#alternateSource) this.#rebuildGeometry();
  }
  toggleShallow() { this.#shallow = !this.#shallow; this.#rebuildGeometry(); }
  toggleAlternateSource() { this.#alternateSource = !this.#alternateSource; this.#rebuildGeometry(); }
  toggleAlternateColor() { this.#alternateColor = !this.#alternateColor; }
  toggleEndpoints() { this.#endpoints = !this.#endpoints; }
  toggleOverlay() { this.#overlay = !this.#overlay; }

  /** Java's 0 key: geometry rebuild only when a geometry-affecting flag was on. */
  reset() {
    const geometryChanged = this.#sparse || this.#shallow || this.#alternateSource;
    this.#sparse = false;
    this.#shallow = false;
    this.#alternateSource = false;
    this.#alternateColor = false;
    this.#endpoints = true;
    this.#overlay = false;
    if (geometryChanged) this.#rebuildGeometry();
  }
}

export function createClipMarks() {
  return new ClipComposition();
}
