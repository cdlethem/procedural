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
  #width; #height; #ground; #layers; #transition; #coverage;
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

  /** Recomputes the currently displayed raster from the retained layers; pure, no caching. */
  get displayed() {
    let selected = this.#layers[this.#mode];
    if (this.#blended) {
      selected = rasterCrossfade2D({ first: this.#layers[0], second: selected, weights: this.#transition }).toValues();
    }
    return maskedSourceOver2D({ source: selected, destination: this.#ground, mask: this.#coverage }).toValues();
  }

  cycleMode() { this.#mode = (this.#mode + 1) % this.#layers.length; }
  toggleBlended() { this.#blended = !this.#blended; }
}

export function createBlurMarks(groundRaster, artworkRaster) {
  return new BlurComposition(groundRaster, artworkRaster);
}
