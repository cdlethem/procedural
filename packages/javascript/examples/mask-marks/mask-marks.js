import { maskedSourceOver2D } from "../../src/masked-source-over.js";
import { rasterCrossfade2D } from "../../src/raster-crossfade.js";

/**
 * Retained-layer alpha-mask study for MaskMarks: a marks layer and a source
 * layer revealed through an authored alpha mask over a ground layer, or a
 * crossfade between the two layers weighted by the same mask, or the raw
 * mask itself. Independently composed; the layer drawings, mask shapes, and
 * modes here are authored piece settings, not maskedSourceOver2D/
 * rasterCrossfade2D defaults or recommended operation ranges. See
 * catalog/validation/masked-source-over-2d.json and
 * catalog/validation/crossfade-2d.json.
 * Takes pre-rendered ground/source/marks/mask ARGB rasters
 * ({width,height,pixels}) so this module's mask/composite logic is testable
 * without a canvas; the browser sketch owns drawing those four rasters.
 */
class MaskComposition {
  #width;
  #height;
  #ground;
  #source;
  #marks;
  #mask;
  #coverage;
  #mode = 0;
  #showMask = false;

  constructor(groundRaster, sourceRaster, marksRaster, maskRaster) {
    for (const raster of [sourceRaster, marksRaster, maskRaster]) {
      if (raster.width !== groundRaster.width || raster.height !== groundRaster.height) {
        throw new Error("all layers must share dimensions");
      }
    }
    this.#width = groundRaster.width;
    this.#height = groundRaster.height;
    this.#ground = groundRaster;
    this.#source = sourceRaster;
    this.#marks = marksRaster;
    this.#mask = maskRaster;
    // Java2DLayers.alphaMask: alpha/255 coverage, row-major, one per pixel.
    // Opaque black and opaque white both yield one; RGB is fully opaque.
    const count = this.#width * this.#height;
    this.#coverage = new Array(count);
    for (let i = 0; i < count; i += 1) this.#coverage[i] = (this.#mask.pixels[i] >>> 24) / 255.0;
  }

  get width() { return this.#width; }
  get height() { return this.#height; }
  get mode() { return this.#mode; }
  get showMask() { return this.#showMask; }
  get coverage() { return this.#coverage; }
  get mask() { return this.#mask; }

  /** Recomputes the currently displayed raster from the retained layers; pure, no caching. */
  get displayed() {
    if (this.#showMask) return this.#mask;
    if (this.#mode === 0) {
      return maskedSourceOver2D({ source: this.#marks, destination: this.#ground, mask: this.#coverage }).toValues();
    }
    if (this.#mode === 1) {
      return maskedSourceOver2D({ source: this.#source, destination: this.#ground, mask: this.#coverage }).toValues();
    }
    // Weight zero selects first (marks); weight one selects second (source).
    return rasterCrossfade2D({ first: this.#marks, second: this.#source, weights: this.#coverage }).toValues();
  }

  cycleMode() { this.#mode = (this.#mode + 1) % 3; }
  toggleShowMask() { this.#showMask = !this.#showMask; }
}

export function createMaskMarks(groundRaster, sourceRaster, marksRaster, maskRaster) {
  return new MaskComposition(groundRaster, sourceRaster, marksRaster, maskRaster);
}
