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
export function remapSource(sourcePixels, model, strength, alternateField) {
  const coordinates = new Array(SIDE * SIDE);
  let index = 0;
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      coordinates[index] = displacementAt(model, x, y, strength, alternateField);
      index += 1;
    }
  }
  return bilinearRasterRemap2D({
    source: { width: SIDE, height: SIDE, pixels: sourcePixels },
    outputWidth: SIDE, outputHeight: SIDE, sourceCoordinates: coordinates,
  });
}
