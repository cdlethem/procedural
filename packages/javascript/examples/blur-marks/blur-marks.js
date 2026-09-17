import { separableBlur2D } from "../../src/separable-blur.js";
import { rasterCrossfade2D } from "../../src/raster-crossfade.js";
import { maskedSourceOver2D } from "../../src/masked-source-over.js";

/** Authored finite weight profile; normalization is the package's responsibility. */
export function triangular(radius) {
  const weights = new Array(2 * radius + 1);
  for (let i = 0; i < weights.length; i += 1) weights[i] = radius + 1 - Math.abs(i - radius);
  return weights;
}

/**
 * Editable retained-layer blur/blend/composite study for BlurMarks: three fixed
 * separable-blur treatments of one artwork layer (soft, horizontal-only,
 * vertical-only), an optional left-to-right sharp/selected crossfade, composited
 * over a ground image. Independently composed; kernel radii, transition, and
 * coverage here are authored piece settings, not separableBlur2D/rasterCrossfade2D/
 * maskedSourceOver2D defaults or recommended operation ranges. See
 * catalog/validation/separable-blur.json, targets.processing-java.technique.
 * Takes pre-rendered ground/artwork ARGB rasters ({width,height,pixels}) so this
 * module's blend/composite logic is testable without a canvas; the browser sketch
 * owns drawing those two source rasters.
 */
class BlurComposition {
  #width; #height; #ground; #artwork; #layers; #maskedLayers = null; #transition; #coverage;
  #sourceCoverage = 1;
  #mode = 0;
  #blended = false;
  #filterCalls = 0;

  constructor(groundRaster, artworkRaster) {
    if (groundRaster.width !== artworkRaster.width || groundRaster.height !== artworkRaster.height) {
      throw new Error("ground and artwork rasters must share dimensions");
    }
    this.#width = groundRaster.width;
    this.#height = groundRaster.height;
    this.#ground = groundRaster;
    this.#artwork = artworkRaster;

    const softKernel = triangular(12);
    const directionalKernel = triangular(24);
    const deltaKernel = [1];
    const filtered = (kernelX, kernelY) => {
      this.#filterCalls += 1;
      const maxSamples = this.#width * this.#height * (kernelX.length + kernelY.length);
      return separableBlur2D({ source: artworkRaster, kernelX, kernelY, maxSamples }).toValues();
    };
    this.#layers = [
      artworkRaster,
      filtered(softKernel, softKernel),
      filtered(directionalKernel, deltaKernel),
      filtered(deltaKernel, directionalKernel),
    ];

    const count = this.#width * this.#height;
    this.#transition = new Array(count);
    this.#coverage = new Array(count).fill(1.0);
    for (let y = 0; y < this.#height; y += 1) {
      for (let x = 0; x < this.#width; x += 1) this.#transition[y * this.#width + x] = x / (this.#width - 1);
    }
  }

  get width() { return this.#width; }
  get height() { return this.#height; }
  get mode() { return this.#mode; }
  get blended() { return this.#blended; }
  get filterCalls() { return this.#filterCalls; }
  get layerCount() { return this.#layers.length; }
  get sourceCoverage() { return this.#sourceCoverage; }

  /** Mask the combined source image before filtering; full coverage keeps the old path. */
  setSourceCoverage(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError("sourceCoverage must be between 0 and 1");
    if (value === this.#sourceCoverage) return;
    if (value === 1) { this.#maskedLayers = null; this.#sourceCoverage = 1; return; }
    const combined = maskedSourceOver2D({
      source: this.#artwork, destination: this.#ground, mask: this.#coverage,
    }).toValues();
    const pixels = combined.pixels.map((pixel, index) => {
      const y = Math.floor(index / this.#width), x = index - y * this.#width;
      const band = (x + y * 0.55) / 96;
      const phase = band - Math.floor(band);
      return Math.abs(phase - 0.5) < value / 2 ? pixel : 0;
    });
    const source = { width: this.#width, height: this.#height, pixels };
    const soft = triangular(12), directional = triangular(24);
    const filtered = (kernelX, kernelY) => {
      return separableBlur2D({
        source, kernelX, kernelY,
        maxSamples: this.#width * this.#height * (kernelX.length + kernelY.length),
      }).toValues();
    };
    const maskedLayers = [
      source,
      filtered(soft, soft),
      filtered(directional, [1]),
      filtered([1], directional),
    ];
    this.#maskedLayers = maskedLayers;
    this.#sourceCoverage = value;
    this.#filterCalls += 3;
  }

  /** Recomputes the currently displayed raster from the retained layers; pure, no caching. */
  get displayed() {
    const layers = this.#sourceCoverage === 1 ? this.#layers : this.#maskedLayers;
    let selected = layers[this.#mode];
    if (this.#blended) {
      selected = rasterCrossfade2D({ first: layers[0], second: selected, weights: this.#transition }).toValues();
    }
    return this.#sourceCoverage === 1
      ? maskedSourceOver2D({ source: selected, destination: this.#ground, mask: this.#coverage }).toValues()
      : selected;
  }

  cycleMode() { this.#mode = (this.#mode + 1) % this.#layers.length; }
  toggleBlended() { this.#blended = !this.#blended; }
  reset() { this.#mode = 0; this.#blended = false; this.setSourceCoverage(1); }
}

export function createBlurMarks(groundRaster, artworkRaster) {
  return new BlurComposition(groundRaster, artworkRaster);
}
