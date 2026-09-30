# Value Regions

A picture reduced to a handful of coherent shapes. The starting study is a synthetic portrait cut into
about ten regions: the halo behind the head, the hair, the face planes, the collar. Each is a single
polygon, filled with hatching whose spacing follows the region's tone (dark shapes are crossed, light ones
are open), turned along the shape's long axis and a little more for every band, and outlined once in ink.
Nothing is a rasterised patch: every region is a polygon with holes, and two neighbours share each
boundary edge exactly, so there is never a gap or an overlap between them.

This is segmentation, not palette extraction. Pixels are grouped by value into **bands**, each band is
split into its **connected** pieces (two dark areas on opposite sides of a light one stay two regions),
pieces that are too small are **merged into a neighbour**, and only then are the boundaries traced.
Changing how the picture is cut changes which shapes exist; changing how they are drawn never does.

Four sample pictures ship with the instrument, all synthetic and deterministic (not photographs):
**Portrait blobs** (a soft, feathered head and shoulders), **Geometric scene** (flat colors, hard edges,
stripes and a checker patch), **Landscape** (sky gradient, sun, ridges, textured ground) and
**Photographic noise** (a graded color field with detail and grain, the worst case for segmentation).
The picture is chosen with **Source image**; binding your own image to a Studio layer is future host work,
and the library functions already accept any raster you construct (see the end of this guide).

## How the shapes are made

1. The picture is cropped (**Zoom**, **Crop X/Y**) and placed on the canvas (**Center**, **Width**,
   **Height**).
2. One value per pixel is measured (**Grouped by**: lightness, brightness or saturation) and optionally
   blurred (**Smoothing**), which removes grain before it can become speckle.
3. The values are cut into **bands**: equal value widths, equal pixel shares, or three cuts you place.
4. Each band is split into connected regions: across edges only, or also across corners
   (**Join across corners**).
5. Regions smaller than **Smallest region** are merged into the neighbour that shares the longest border
   (or the one with the nearest average value) until every remaining shape is large enough.
6. Boundaries are traced as polygons with holes and thinned by **Simplification**. A boundary between two
   regions is thinned once, so both change together and the picture's four corners always stay.
7. **Retained regions** decides which regions are drawn; the rest stay as open paper.
8. Each retained region is filled and its boundaries are outlined.

## Controls

| Controls | What changes on the canvas |
|---|---|
| **Source image, Image variant, Detail resolution** | Which sample is cut, how it is arranged (the variant re-arranges and re-tints it), and how many pixels resolve it. More pixels find narrower shapes and give more regions to merge; fewer are blunter and faster. |
| **Grouped by** | The value that is banded: lightness (equal steps look equal), brightness (the display gray) or saturation. Saturation cuts a picture by colorfulness instead of tone. |
| **Zoom, Crop X, Crop Y** | A closer crop of the picture; the regions are cut from the crop, so a zoom finds the detail inside a shape. Simplification is in canvas units, so a zoomed crop needs a larger value to stay smooth. |
| **Center, Width, Height** | Where the picture sits and how big it is. Width and height are a proportional pair. |
| **Band rule, Bands** | Equal value widths, equal pixel shares (a mostly dark picture still yields shapes of every tone) or manual cuts. Two bands give a silhouette; more give more, smaller shapes. |
| **First, second and third cut** | Manual band rule only: where the four bands begin. They must rise. A value equal to a cut is in the band above it. |
| **Smoothing** | Blurs the values before banding, in canvas units. Calmer bands, fewer specks; 0 bands the raw pixels. |
| **Join across corners** | Off: only edge contact connects pixels of one band, so thin diagonal features are broken into separate regions. On: corner contact connects them, so those features stay whole but a region may then be made of pieces that touch at single points (drawn as one region with several pieces). |
| **Smallest region, Merge into** | The share of the picture below which a region is merged away, and which neighbour absorbs it. Raise it for fewer, larger shapes; the merge is repeated until every survivor is large enough. A region with no neighbour (isolated by transparent pixels) stays. |
| **Simplification** | How far a boundary may be straightened, in canvas units. 0 keeps every pixel step; a pixel is roughly 4 units at the default resolution. Regions never open a gap, overlap or lose a hole because of it. |
| **Retained regions, Retain by** | The share of regions drawn, chosen by seeded chance, by area, by tone, or by depth (enclosed regions first, or the outermost). Raising the share only adds regions. |
| **Gutter** | Pulls every fill back from the boundary by half this distance, leaving paper between neighbours. The outline stays on the true boundary. A region thinner than the gutter disappears. |
| **Filler** | Flat color; hatching by tone; marks or contour lines nested in the polygon (the region-fill machinery, cut to the shape); or nothing, leaving only the outline. |
| **Color source, Body opacity** | Each region's average color, the nearest palette color, the palette read as a dark-to-light ramp at the region's tone, or the first palette color inking darker regions more. Body opacity is the flat fill, or the underpaint beneath hatching and nested marks. |
| **Hatch direction, Hatch angle, Turn per band, Direction jitter** | Fixed angle, or along each region's long axis (round regions keep the fixed angle). The angle is added to that; every band up from the darkest turns by an extra amount; a stable random turn per region is added. **The seed draws the jitter.** |
| **Hatch spacing, Hatch weight, Tone response** | Line spacing at mid tone and stroke width; darker regions hatch tighter and lighter ones looser by up to this many octaves. Lines are anchored to the canvas, so neighbours with the same spacing and angle continue each other. |
| **Cross-hatch below, Cross angle** | Regions darker than this tone get a second layer at the given angle to the first. |
| **Nested content, Mark, Mark size, Mark spacing** | Motifs stamped at random sites inside each region (at most 80 per region, none crossing its edge), contour lines of a seeded field fitted to it, or a stable draw of one or the other per region. **The seed places the marks and the fields.** |
| **Contour levels, Contour material, Nested weight, Nested clearance** | How many contour lines, whether they are ink, stitches or beads (pitch is five line weights), the stroke width of marks and lines, and the space kept between them and the region's edge. |
| **Outline, Outline color, Outline weight, Stitch spacing** | A line along every boundary of a retained region, in ink, stitches or beads, in the first or second palette color. A shared boundary is drawn once, so stitches never double. |

Controls that only matter under another choice appear only then (the cuts under the manual rule, hatching
under the hatch filler, stitch spacing under stitches, and so on); hidden values are kept and never change
the drawing. The picture is drawn on a transparent layer inside its footprint.

## Try these

- Portrait, the default: hatched, toned shapes with an ink outline. Set **Band rule** to *Equal value widths*
  and **Bands** to 6 for a finer stack; set **Bands** to 2 and **Filler** to *Flat color* for a silhouette.
- Landscape, **Bands** 5, **Filler** *Flat color*, **Color source** *Palette ramp by tone*, **Gutter** 3,
  **Simplification** 6: a cut-paper landscape with paper showing between the shapes.
- Landscape, **Color source** *Ink by darkness*, **Filler** *Hatching by tone*, **Body opacity** 0,
  **Cross-hatch below** .5, **Outline** *None*: an engraving whose darks are crossed and whose lights are open.
- Portrait, **Retained regions** .45 with **Retain by** *Chance*: a stencil of negative space. Change the seed
  to keep a different set. With *Most enclosed* the shapes inside others survive first.
- Geometric scene, **Bands** 5, **Filler** *Nested marks or contours*, **Join across corners** on: rings
  stamped inside each rectangle and disc, and the diagonal stripe kept as one region.
- Noise, **Smallest region** .05, **Join across corners** off, then on: the same grain becomes either a
  mosaic of separate patches or a few sprawling regions joined at their corners. **Smoothing** 4 calms either.
- **Filler** *None*, **Outline** *Beads*: the region map as a drawing of its boundaries alone.
- Layer it: flat regions with a **Gutter** over any other instrument show that instrument in the gaps; a
  stitched outline with no fill sits over anything.

## Use the pieces yourself

The image is a resolved value, never a URL. The map is a pure function of the picture and the options and
returns frozen values, cached by construction.

```js
import { createRaster, valueRegionMap, keptValueRegions, createInstrument, valueRegionsComposition,
  drawValueRegions } from "@procedurals/instruments";

const raster = createRaster({ width: 6, height: 2, channels: 1, format: "u8", colorSpace: "srgb",
  alpha: "none", data: [20, 20, 240, 240, 20, 20,   20, 20, 240, 240, 20, 20] });
const map = valueRegionMap({ seed: 1, source: raster, centerX: 6, centerY: 2, width: 12, height: 4,
  measure: "lightness", smoothing: 0, bands: { kind: "equal", count: 2 }, connectivity: 4,
  minArea: 0, merge: "longest-border", simplify: 0 });
map.regions.map((r) => [r.id, r.pixels, r.parent]);  // v0, v2, v4: 4 pixels each; the two dark shapes are never joined
map.adjacency;                                       // v0|v2 and v2|v4, each length 4 (two pixel edges of two units), 1 arc
map.arcs;                                            // each boundary edge exactly once: left, right, points
```

`valueRegionsComposition(createInstrument("connected-value-regions"))` returns the whole recipe as JSON (the
bundled image is named by id, variant and resolution). `drawValueRegions(surface, recipe, { fill, outline })`
draws it; a `fill` callback replaces the stock filler and receives each retained region (its shape and the
gutter-inset polygon `domain`, in world coordinates), and an `outline` path material replaces the outline.
`keptValueRegions(map, fraction, rule)` gives the retained regions, and `valueRegionOutline` the arcs to
stroke. Every published value is frozen and cached by construction: palette, fill, outline, retention and
gutter never rebuild the map or rename a region (ids are `v<index of the first pixel>`, arcs
`<left>|<right or ~>#<k>`).

Limits: at most 4,194,304 pixels per analysis, 800 regions (raise **Smallest region**, raise **Smoothing**,
use fewer bands or lower the resolution), 300,000 boundary vertices (raise **Simplification**), and 80,000
drawn units (hatch lines, nested marks, contour paths, outline stations), each reported with the control
to change. Lengths are canvas units of the 640-unit reference canvas.
