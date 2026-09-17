import { bilinearRasterRemap2D } from "../../src/raster-remap.js";
import { gradientNoise2D01 } from "../../src/gradient-noise-2d-01.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

/**
 * Example composition motivated by the raster.bilinear-remap-2d reference, composed
 * with the already-ported cyclic-palette and gradient-noise-2d-01 operations. These
 * constants (canvas side, palette, noise seed, displacement strengths, source pattern
 * geometry) describe this piece, not public defaults or recommended ranges.
 */
export const SIDE = 640;
export const COLORS = Object.freeze([0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x264653]);
export const BACKGROUND_RGB = 0xf8f5ee;
export const STRENGTHS = Object.freeze([32, 64, 0]);

/** Retained palette and noise field, independent of the strength/field/pattern edits. */
export function createWarpMarks() {
  const palette = cyclicPalette({ colors: COLORS });
  const noiseField = gradientNoise2D01({ seed: 42 });
  return Object.freeze({ palette, noiseField });
}

/** The dot-pattern source color sampled at one grid position (non-stripe source). */
export function dotColorAt(model, x, y) {
  return model.palette.sample((x + 3.0 * y) / SIDE);
}

/** The stripe source color for one 32px row band. */
export function stripeColorAt(row) {
  return COLORS[Math.floor(row / 32) % COLORS.length];
}

/** The exact source-sampling displacement for one output pixel. */
export function displacementAt(model, x, y, strength, alternateField) {
  if (strength === 0) return [x, y];
  if (alternateField) {
    return [x + strength * Math.sin((y * (2.0 * Math.PI)) / 160.0),
      y + strength * Math.sin((x * (2.0 * Math.PI)) / 160.0)];
  }
  const angle = model.noiseField.sample(x * 0.01, y * 0.01) * (2.0 * Math.PI);
  return [x + strength * Math.cos(angle), y + strength * Math.sin(angle)];
}

/**
 * Remap an owned packed-ARGB8 source raster through the exact per-pixel displacement
 * field. sourcePixels must be a row-major array of SIDE*SIDE unsigned32 ARGB8 values
 * (matching the shared raster.bilinear-remap-2d contract exactly).
 */
export function remapSource(sourcePixels, model, strength, alternateField, sourceCoverage = 1) {
  if (!Number.isFinite(sourceCoverage) || sourceCoverage < 0 || sourceCoverage > 1)
    throw new RangeError("sourceCoverage must be between 0 and 1");
  const coordinates = new Array(SIDE * SIDE);
  let index = 0;
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      coordinates[index] = displacementAt(model, x, y, strength, alternateField);
      index += 1;
    }
  }
  // Leave the original opaque raster untouched at full coverage. The mask is
  // authored in source space, so its clear gutters follow the displacement.
  const source = sourceCoverage === 1 ? sourcePixels : sourcePixels.map((pixel, index) => {
    const y = Math.floor(index / SIDE), x = index - y * SIDE;
    const band = (x + y * 0.55) / 96;
    const phase = band - Math.floor(band);
    return Math.abs(phase - 0.5) < sourceCoverage / 2 ? pixel : 0;
  });
  const encoded = sourceCoverage === 1 ? source : source.map((pixel) => {
    const alpha = pixel >>> 24;
    const channel = shift => Math.round(((pixel >>> shift) & 255) * alpha / 255);
    return ((alpha << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
  });
  const result = bilinearRasterRemap2D({
    source: { width: SIDE, height: SIDE, pixels: encoded },
    outputWidth: SIDE, outputHeight: SIDE, sourceCoordinates: coordinates,
  });
  if (sourceCoverage === 1) return result;
  const pixels = result.pixels().map((pixel) => {
    const alpha = pixel >>> 24;
    if (alpha === 0) return 0;
    const channel = shift => Math.min(255, Math.round(((pixel >>> shift) & 255) * 255 / alpha));
    return ((alpha << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
  });
  return Object.freeze({
    pixelAt: index => pixels[index],
    pixels: () => pixels.slice(),
    toValues: () => ({ width: SIDE, height: SIDE, pixels: pixels.slice() }),
  });
}
