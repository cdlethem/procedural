import { gradientPath2D } from "../../src/gradient-path.js";
import { retainedRectangleCuts2D } from "../../src/retained-rectangle-cuts.js";
import { maskedSourceOver2D } from "../../src/masked-source-over.js";

// Authored path/palette settings; not gradientPath2D defaults or recommended ranges.
const PATH_COUNT = 24, PATH_STEPS = 120, STEP_DISTANCE = 4.0, FIELD_SCALE = 0.004;
const PATH_COLORS = Object.freeze([0xffe76f51, 0xffe9c46a, 0xff2a9d8f, 0xff457b9d,
  0xff8d5a97, 0xffe07a5f, 0xff81b29a, 0xff3d5a80]);

function traceConfig(x, y) {
  return {
    field: { seed: 17 },
    start: [x, y],
    steps: PATH_STEPS,
    stepDistance: STEP_DISTANCE,
    fieldScale: FIELD_SCALE,
    fieldOffset: [0, 0],
    angleBase: -Math.PI,
    angleScale: 2 * Math.PI,
  };
}

/**
 * Sequential masked-region compositor mirroring Java2DRegions.renderMasked: each
 * region's EXPLICIT coverage raster (an independently supplied full-destination
 * array, e.g. a rendered ellipse's alpha channel) is applied over the whole
 * destination -- not clipped to the region's own frame, so holes and coverage
 * outside the frame are visible, matching Java exactly -- accumulated in order
 * via the accepted raster.masked-source-over-2d core. Verified against a real
 * Java2DRegions.renderMasked run with an irregular (checkerboard,
 * non-frame-clipped) coverage raster; see masked-partition-marks-model.mjs.
 */
export function compositeMaskedRegions(destinationRaster, maskedRegions, contentRasterFor) {
  let background = destinationRaster;
  for (const masked of maskedRegions) {
    const content = contentRasterFor(masked.region);
    background = maskedSourceOver2D({ source: content, destination: background, mask: masked.coverage }).toValues();
  }
  return background;
}

/**
 * Retained-partition masked-region layering study for MaskedPartitionMarks: 24
 * gradient-field paths and an independent decorative source image, revealed
 * through per-region elliptical alpha masks over a four-quadrant retained
 * partition (an alternate, uneven X split is available), in a region-independent
 * global pass or two per-region local passes (decorative lines/ellipses, or a
 * cropped source snippet). Independently composed; the path starts/settings,
 * layout bounds/cuts, mask insets, and drawing recipes here are authored piece
 * settings, not gradientPath2D/retainedRectangleCuts2D/maskedSourceOver2D
 * defaults or recommended operation ranges. See
 * catalog/validation/gradient-path-2d.json,
 * catalog/validation/retained-rectangle-cuts-2d.json, and
 * catalog/validation/masked-source-over-2d.json.
 *
 * Mask coverage (rendered ellipses) and per-region content both depend on
 * region geometry, so this module cannot pre-render every displayed variant up
 * front; it owns the portable path tracing, region geometry, and compositing
 * math, while the browser sketch draws each region's mask/content (with a
 * translated origin for the local passes) and supplies the resulting rasters
 * back to `compose`.
 */
class MaskedPartitionComposition {
  #ground;
  #paths;
  #regions;
  #mode = 0;
  #alternateLayout = false;

  constructor(groundRaster) {
    this.#ground = groundRaster;
    this.#paths = [];
    for (let i = 0; i < PATH_COUNT; i += 1) {
      const x = 50 + (i % 6) * 120;
      const y = 55 + Math.floor(i / 6) * 120;
      this.#paths.push(gradientPath2D(traceConfig(x, y)));
    }
    this.#rebuildRegions();
  }

  #rebuildRegions() {
    const layout = retainedRectangleCuts2D({ bounds: [36, 36, 684, 444] });
    const [columnLow, columnHigh] = layout.cut(0, "X", this.#alternateLayout ? 430 : 360);
    layout.cut(columnLow, "Y", 240);
    layout.cut(columnHigh, "Y", 240);
    this.#regions = layout.leaves().map((leaf) => {
      const [l, t, r, b] = leaf.bounds;
      return { id: leaf.id, left: l, top: t, right: r, bottom: b };
    });
  }

  get ground() { return this.#ground; }
  get paths() { return this.#paths; }
  get regions() { return this.#regions; }
  get mode() { return this.#mode; }
  get alternateLayout() { return this.#alternateLayout; }
  /** Java's Content dispatch: mode 0 draws region-independent global content in Space.CANVAS; modes 1-2 draw per-region content in Space.LOCAL. */
  get space() { return this.#mode === 0 ? "canvas" : "local"; }

  cycleMode() { this.#mode = (this.#mode + 1) % 3; }

  /** N: toggles the layout's X-cut position and rebuilds the partition. Masks depend on region geometry and must be rebuilt by the sketch afterward. */
  toggleAlternateLayout() { this.#alternateLayout = !this.#alternateLayout; this.#rebuildRegions(); }

  /** 0: geometry rebuild only when the layout actually changed; mode always resets to 0. Returns whether the sketch must also rebuild masks. */
  reset() {
    const layoutChanged = this.#alternateLayout;
    this.#alternateLayout = false;
    this.#mode = 0;
    if (layoutChanged) this.#rebuildRegions();
    return layoutChanged;
  }

  compose(maskedRegions, contentRasterFor) {
    return compositeMaskedRegions(this.#ground, maskedRegions, contentRasterFor);
  }
}

export function createMaskedPartitionMarks(groundRaster) {
  return new MaskedPartitionComposition(groundRaster);
}

export { PATH_COLORS, PATH_COUNT, PATH_STEPS };
