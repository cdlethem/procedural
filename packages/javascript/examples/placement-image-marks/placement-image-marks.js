import { maskedSourceOver2D } from "../../src/masked-source-over.js";

const FIT_MODES = ["contain", "cover", "stretch"];

/** Extracts a sub-rectangle from a source raster as an independent raster. */
function cropRaster(source, x, y, width, height) {
  if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > source.width || y + height > source.height) {
    throw new Error("Crop outside source");
  }
  const pixels = new Array(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      pixels[row * width + col] = source.pixels[(y + row) * source.width + (x + col)] >>> 0;
    }
  }
  return { width, height, pixels };
}

/**
 * Computes the placement destination rectangle: fit-scaled crop dimensions
 * within the frame (CONTAIN uses the smaller of the two axis scales, COVER
 * the larger, STRETCH fills the frame exactly), then aligned by alignX/alignY
 * in [0,1] across the leftover space. Mirrors Java2DImagePlacement.render's
 * arithmetic exactly (a JAVA2D-only Processing adapter, not a portable
 * catalog operation).
 */
export function placementRect(cropWidth, cropHeight, frame, fit, alignX, alignY) {
  let w = frame.width, h = frame.height;
  if (fit !== "stretch") {
    const sx = frame.width / cropWidth, sy = frame.height / cropHeight;
    const s = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
    w = cropWidth * s;
    h = cropHeight * s;
  }
  const x = frame.x + (frame.width - w) * alignX;
  const y = frame.y + (frame.height - h) * alignY;
  return { x, y, width: w, height: h };
}

export { cropRaster };

/**
 * Fit/crop/align image placement study for PlacementImageMarks: one authored
 * source panel, optionally cropped, scaled into a fixed frame under one of
 * three fit modes and aligned within it, then composited over a grid ground
 * either with full coverage or through an elliptical alpha mask.
 * Independently composed; the source drawing, crop/frame rectangles, and
 * mask shape here are authored piece settings, not maskedSourceOver2D
 * defaults or recommended operation ranges. See
 * catalog/validation/masked-source-over-2d.json. Crop extraction and the
 * fit/align rectangle are portable, testable math; the actual scaled/clipped
 * draw needs a real canvas and is the sketch's responsibility (this module's
 * `placement` getter returns what to draw, not a rendered raster).
 */
class PlacementComposition {
  #source;
  #ground;
  #mask;
  #fullCoverage;
  #frame = { x: 80, y: 60, width: 560, height: 360 };
  #fitIndex = 0;
  #alignment = 1;
  #cropped = false;
  #masked = false;

  constructor(sourceRaster, groundRaster, maskCoverage) {
    this.#source = sourceRaster;
    this.#ground = groundRaster;
    this.#mask = maskCoverage;
    this.#fullCoverage = new Array(groundRaster.width * groundRaster.height).fill(1.0);
  }

  get fitMode() { return FIT_MODES[this.#fitIndex]; }
  get cropped() { return this.#cropped; }
  get alignment() { return this.#alignment; }
  get align() { return this.#alignment * 0.5; }
  get masked() { return this.#masked; }
  get frame() { return this.#frame; }
  get crop() { return this.#cropped ? { x: 80, y: 0, width: 160, height: 160 } : { x: 0, y: 0, width: 320, height: 160 }; }

  /** Portable crop-extraction + fit/align placement math (no drawing): the
   * isolated crop raster, its destination rectangle, and the frame clip. */
  get placement() {
    const crop = this.crop;
    const isolated = cropRaster(this.#source, crop.x, crop.y, crop.width, crop.height);
    const rect = placementRect(crop.width, crop.height, this.#frame, this.fitMode, this.align, this.align);
    return { isolated, rect, clip: this.#frame };
  }

  /** Composites a sketch-rendered "placed" raster (already scaled/clipped into
   * a full-canvas transparent layer by the sketch) over the ground, using the
   * elliptical mask when masked mode is on, else full coverage. */
  compose(placedRaster) {
    const coverage = this.#masked ? this.#mask : this.#fullCoverage;
    return maskedSourceOver2D({ source: placedRaster, destination: this.#ground, mask: coverage }).toValues();
  }

  cycleFit() { this.#fitIndex = (this.#fitIndex + 1) % 3; }
  toggleCropped() { this.#cropped = !this.#cropped; }
  cycleAlignment() { this.#alignment = (this.#alignment + 1) % 3; }
  toggleMasked() { this.#masked = !this.#masked; }
}

export function createPlacementImageMarks(sourceRaster, groundRaster, maskCoverage) {
  return new PlacementComposition(sourceRaster, groundRaster, maskCoverage);
}
