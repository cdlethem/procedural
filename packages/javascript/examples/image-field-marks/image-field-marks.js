import { regularGrid } from "../../src/regular-grid.js";
import { bilinearRasterRemap2D } from "../../src/raster-remap.js";

/**
 * Retained-field dot study for ImageFieldMarks: a fixed 45x30 regular grid of
 * points samples one of two retained source rasters, drawing a dot per point
 * whose size (or, in visibility mode, whether it appears at all) is driven by
 * the sampled brightness. Independently composed; the grid layout, sources,
 * brightness threshold, and diameter formula here are authored piece
 * settings, not regularGrid/bilinearRasterRemap2D defaults or recommended
 * operation ranges. See catalog/validation/regular-grid.json and
 * catalog/validation/bilinear-remap-2d.json.
 */
class ImageFieldComposition {
  #positions;
  #samples;
  #sourceIndex = 0;
  #visibility = false;
  #sourceColors = false;

  constructor(sourceRasters) {
    const grid = regularGrid({ origin: [8, 8], spacing: [16, 16], columns: 45, rows: 30 });
    const point = new Float64Array(2);
    this.#positions = new Array(grid.size * 2);
    for (let i = 0; i < grid.size; i += 1) {
      grid.pointInto(i, point, 0);
      this.#positions[i * 2] = point[0];
      this.#positions[i * 2 + 1] = point[1];
    }
    const pairs = new Array(grid.size);
    for (let i = 0; i < grid.size; i += 1) pairs[i] = [this.#positions[i * 2], this.#positions[i * 2 + 1]];
    this.#samples = sourceRasters.map((raster) => bilinearRasterRemap2D({
      source: raster, outputWidth: grid.size, outputHeight: 1, sourceCoordinates: pairs,
    }));
  }

  get positions() { return this.#positions; }
  get pointCount() { return this.#positions.length / 2; }
  get sourceIndex() { return this.#sourceIndex; }
  get visibility() { return this.#visibility; }
  get sourceColors() { return this.#sourceColors; }

  /** Sampled straight ARGB8 at a grid point, from the currently selected source. */
  argbAt(index) { return this.#samples[this.#sourceIndex].pixelAt(index) >>> 0; }
  /** Maximum sampled RGB channel over 255; not luminance, and ignores alpha. */
  maxRgb01At(index) {
    const value = this.argbAt(index);
    return Math.max((value >>> 16) & 255, (value >>> 8) & 255, value & 255) / 255.0;
  }

  /** Per-point drawing data for the current mode: position, diameter, color, and
   * whether visibility mode hides this point (bright points >= 0.65 disappear). */
  get dots() {
    const out = [];
    for (let i = 0; i < this.pointCount; i += 1) {
      const brightness = this.maxRgb01At(i);
      if (this.#visibility && brightness >= 0.65) continue;
      const diameter = this.#visibility ? 10 : 2 + 12 * (1 - brightness);
      out.push({ x: this.#positions[i * 2], y: this.#positions[i * 2 + 1], diameter, argb: this.argbAt(i) });
    }
    return out;
  }

  toggleVisibility() { this.#visibility = !this.#visibility; }
  toggleSource() { this.#sourceIndex = 1 - this.#sourceIndex; }
  toggleSourceColors() { this.#sourceColors = !this.#sourceColors; }
}

export function createImageFieldMarks(sourceRasters) {
  return new ImageFieldComposition(sourceRasters);
}
