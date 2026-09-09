import { maskedSourceOver2D } from "../../src/masked-source-over.js";
import { rasterCrossfade2D } from "../../src/raster-crossfade.js";
import { retainedRectangleCuts2D } from "../../src/retained-rectangle-cuts.js";

/**
 * Per-pixel inward-feather coverage for one axis-aligned region: binary inside the
 * region at feather 0, otherwise a linear ramp inward from the nearest of all four
 * edges over `feather` logical pixels. Mirrors Java2DRegions.render's coverage
 * formula exactly (verified against a real Java2DRegions.render run, see
 * layer-marks-model.mjs).
 */
function regionCoverage(width, height, region, feather) {
  const { left, top, right, bottom } = region;
  const coverage = new Array(width * height);
  for (let y = 0, i = 0; y < height; y += 1) {
    const py = y + 0.5;
    for (let x = 0; x < width; x += 1, i += 1) {
      const px = x + 0.5;
      if (px < left || px >= right || py < top || py >= bottom) { coverage[i] = 0; continue; }
      if (feather === 0) { coverage[i] = 1; continue; }
      const d = Math.min(Math.min(px - left, right - px), Math.min(py - top, bottom - py));
      coverage[i] = Math.min(1, d / feather);
    }
  }
  return coverage;
}

/**
 * Sequential region compositor mirroring Java2DRegions.render (a JAVA2D-only
 * Processing adapter, not a portable catalog operation): for each region in
 * order, composites its pre-rendered content raster over the accumulating
 * destination using the region's coverage, via the accepted
 * raster.masked-source-over-2d core. Content rasters must already be positioned
 * in canvas coordinates by the caller -- Space.LOCAL vs Space.CANVAS is a
 * drawing-time choice (translate before drawing, or not), not this function's
 * concern. Regions therefore follow ordered source-over compositing, exactly
 * matching Java2DRegions.render.
 */
export function compositeRegions(destinationRaster, regions, feather, contentRasterFor) {
  const { width, height } = destinationRaster;
  let background = destinationRaster;
  for (const region of regions) {
    const coverage = regionCoverage(width, height, region, feather);
    const content = contentRasterFor(region);
    background = maskedSourceOver2D({ source: content, destination: background, mask: coverage }).toValues();
  }
  return background;
}

/** Horizontal crossfade weight field: 0 for x<=180, 1 for x>=540, linear between. */
export function horizontalCrossfadeWeights(width, height) {
  const weights = new Array(width * height);
  for (let y = 0, i = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, i += 1) {
      weights[i] = Math.min(1, Math.max(0, (x - 180.0) / 360.0));
    }
  }
  return weights;
}

export { regionCoverage };

/**
 * Retained-partition region layering study for LayerMarks: a fixed four-quadrant
 * RetainedRectangles2D layout over one retained source raster, displayed as a
 * canvas-positioned "picture" pass, a locally-cropped-and-decorated "local" pass
 * (sharp or feathered region edges), or a horizontal crossfade between both
 * passes. Independently composed; the layout bounds/cuts, drawing recipes, and
 * crossfade band here are authored piece settings, not
 * retainedRectangleCuts2D/maskedSourceOver2D/rasterCrossfade2D defaults or
 * recommended operation ranges. See
 * catalog/validation/retained-rectangle-cuts-2d.json and
 * catalog/validation/masked-source-over-2d.json.
 *
 * Region content depends on both region geometry (the "local" pass crops and
 * repositions per region) and mode, so -- unlike the flat pre-rendered layers in
 * MaskMarks/BlurMarks -- this module cannot pre-render every displayed variant up
 * front. It owns the portable region geometry, coverage, and compositing math;
 * the browser sketch owns drawing each region's content (with a translated
 * origin for Space.LOCAL, mirroring Java2DRegions exactly) and supplies the
 * resulting rasters back to `compose`/`composeCrossfade`.
 */
class LayerComposition {
  #ground;
  #regions;
  #mode = 0;

  constructor(groundRaster) {
    this.#ground = groundRaster;
    const layout = retainedRectangleCuts2D({ bounds: [36, 36, 684, 444] });
    const [left, right] = layout.cut(0, "X", 360);
    layout.cut(left, "Y", 240);
    layout.cut(right, "Y", 240);
    this.#regions = layout.leaves().map((leaf) => {
      const [l, t, r, b] = leaf.bounds;
      return { id: leaf.id, left: l, top: t, right: r, bottom: b };
    });
  }

  get ground() { return this.#ground; }
  get regions() { return this.#regions; }
  get mode() { return this.#mode; }
  /** {space, feather, contentKind} for the current single-pass modes (0-2); mode 3 is a crossfade of a 'picture'/canvas pass and a 'local'/local pass, each at feather 0. */
  get modeInfo() {
    if (this.#mode === 0) return { space: "canvas", feather: 0, contentKind: "picture" };
    if (this.#mode === 1) return { space: "local", feather: 0, contentKind: "local" };
    if (this.#mode === 2) return { space: "local", feather: 24, contentKind: "local" };
    return { space: "crossfade", feather: 0, contentKind: null };
  }

  cycleMode() { this.#mode = (this.#mode + 1) % 4; }

  /** Modes 0-2: composite the sketch-supplied per-region content rasters (already positioned per modeInfo.space) using the current mode's feather. */
  compose(contentRasterFor) {
    const { feather } = this.modeInfo;
    return compositeRegions(this.#ground, this.#regions, feather, contentRasterFor);
  }

  /** Mode 3: crossfade a canvas-space 'picture' composite into a local-space 'local' composite along a horizontal band. */
  composeCrossfade(pictureContentRasterFor, localContentRasterFor) {
    const first = compositeRegions(this.#ground, this.#regions, 0, pictureContentRasterFor);
    const second = compositeRegions(this.#ground, this.#regions, 0, localContentRasterFor);
    const weights = horizontalCrossfadeWeights(this.#ground.width, this.#ground.height);
    return rasterCrossfade2D({ first, second, weights }).toValues();
  }
}

export function createLayerMarks(groundRaster) {
  return new LayerComposition(groundRaster);
}
