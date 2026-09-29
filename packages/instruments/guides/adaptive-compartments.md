# Adaptive Compartments

A picture is cut into a mosaic of rectangular cells whose size follows its detail. Where the image
is flat, one large cell stands for a whole patch of backdrop or sky; where it changes, along the
edge of a head, a ridge line or a painted stripe, the cells shrink to a few units across. Each cell
is then filled by a technique you can swap: its average color as a flat patch, hatching that runs
along the local direction of the edges, halftone dots, one small glyph turned to that direction, or a
stitched line around its border. A retained share of the cells leaves the rest as open paper.
The starting study divides the bundled *portrait* (a soft head and shoulders on a graded backdrop).
Big quiet cells cover the backdrop and shoulders as flat color, middle-sized cells along the outline of the hair,
face and shoulders are hatched along the edge they sit on, and the smallest cells at the eyes and the hairline carry
glyphs, so the subject stays readable at a glance while the mosaic's own structure shows.

Everything the mosaic is built from comes from the picture and a handful of construction settings:
the partition, each cell's average color, its darkness and its dominant direction. Choosing
another filler, another palette or another gutter repaints the same cells; nothing moves. Raising the
error threshold only merges cells, so a coarser mosaic is always a simplification of a finer one.

## Choose the picture

| Controls | What changes on the canvas |
|---|---|
| **Source image** | One of four bundled sample pictures: a soft *portrait*, a hard-edged *geometry* scene (flat color, a disc, stripes, a checker patch), a *landscape* with sky, sun, ridges and textured ground, and *noise*, a grainy color field that gives every cell something to split on. Pictures you supply bind through the host once it offers that; the library never fetches or decodes files. |
| **Image variant** | The sample's own seed. It re-arranges and re-tints the picture itself (a different head, a different horizon), not just the mosaic. |
| **Detail resolution** | Pixels across the sample (48–256 in the slider, 16–512 allowed). More pixels let small cells follow finer edges; fewer are blunter and faster. The layout of the picture never changes. |
| **Detail measured in** | *Lightness* splits where the picture changes brightness (the default: it separates a dark head from a bright backdrop). *Saturation* splits where its colorfulness changes, so a tinted patch of equal brightness gets its own cells. |
| **Zoom**, **Crop X**, **Crop Y** | Look closer than the whole picture: zoom 2 shows the central quarter, and the crop sliders move that window (0 left/top, 1 right/bottom). The crop is fitted to the mosaic rectangle to within one source pixel. |

## Place it

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Width/Height** | The rectangle the cropped picture is fitted to, in canvas units. Changing the size rescales the whole mosaic; it is a construction change, because cell sizes are measured in canvas units. |

## Divide it

| Controls | What changes on the canvas |
|---|---|
| **Error metric** | How a cell's detail is scored. *Stddev* averages over all its pixels. *Range* is the difference between its extremes, so one crisp edge or speck is enough to split a cell. |
| **Error threshold** | A cell splits while its score is above this percentage of the full lightness range. Lower values give more, smaller cells; higher values merge. A flat picture never splits on error. The slider runs 1–30; exact entry allows up to 100. |
| **Split policy** | *Quad* halves both sides (the square mosaic of a quadtree). *Longest* halves only the longer side, keeping cells near square and giving long strips along long edges. *Best* picks, for each cell, the cut that separates dark from light most cleanly, giving strips where the picture is graded. |
| **Smallest cell**, **Largest cell** | Shortest side of any cell, and the side above which a cell always splits even if flat, in canvas units. Detail finer than the smallest cell is averaged into its cell. The smallest cell is rounded up to whole source pixels, never down, so no cell is smaller than you asked. |

The mosaic is refused, never thinned, past 4,096 cells (raise the threshold or the smallest cell).

## Leave some open

| Controls | What changes on the canvas |
|---|---|
| **Retained cells** | The share of cells drawn. 1 draws all; 0 draws none. Raising it only ever adds cells. |
| **Retain by** | *Chance* draws which cells stay from a stable per-cell draw (a new seed rearranges them). *Detailed* keeps the busiest first, so flat areas open up. *Quiet* keeps the flattest. *Dark* or *light* keeps that tone first. Ties are broken by the same stable draw. |
| **Gutter** | Clear space between neighbouring cells, in canvas units; each cell is drawn half the gutter smaller on every side. It must stay below the smallest cell. At gutter 0, adjoining cells touch and antialiasing can show a faint hairline where two abut. |

## Fill the cells

| Controls | What changes on the canvas |
|---|---|
| **Filler** | *Detail* picks per cell by its size: large cells flat, middle cells hatched, small cells glyphs. *Flat*, *hatch*, *dots* and *motif* use one technique everywhere. |
| **Color source** | *Image* paints each cell's average color, averaged in linear light so a red and a blue cell-half make a proper purple. *Palette* snaps that color to the nearest palette color in Oklab (a posterized portrait). *Ink* uses only the first palette color and inks darker cells more heavily: a monochrome print. |
| **Body opacity** | Opacity of the flat color under each cell's marks; flat cells are drawn at this opacity. Cells that the source leaves partly transparent are drawn proportionally fainter. |
| **Hatch below**, **Glyph below**, **Class mixing** | Detail only. Cells whose shorter side is under *Glyph below* get glyphs, under *Hatch below* hatching, otherwise flat. Mixing lets each cell's two limits wander by up to half of it, by a stable per-cell draw, so classes interleave at the borders; the seed decides which cells change class. |
| **Mark spacing** | Hatch line spacing at mid tone, and the pitch of the halftone lattice. |
| **Line weight** | Stroke width of hatch lines and glyph outlines. |
| **Angle offset** | Degrees added to the direction of the picture's edges in the cell: 0 runs along them, 90 across. Where a cell has no clear direction (flat, or edges pointing every way) it is the whole angle. |
| **Tone response** | Hatch only. Darker cells hatch tighter and lighter cells looser, by this many octaves of line spacing between white and black. |
| **Largest dot** | Dots only. Diameter of the biggest halftone dot as a share of the lattice pitch; dot area follows the cell's darkness, and above 1 dots in dark cells merge. |
| **Direction smoothing** | How widely, in canvas units, edge directions are averaged before a cell reads its own. Small values follow every wiggle; large values give calm, regional directions. |
| **Glyph**, **Glyph size**, **Petals**, **Opening** | The mark nested in glyph cells: a dot, rings, a rosette of petals or an arrow, sized as a share of the cell's shorter side and turned to the cell's direction. Rings and rosettes can be hollowed; petals apply to rosettes. |
| **Border**, **Border weight**, **Stitch spacing**, **Border from** | A line around each cell whose shorter side reaches *Border from*: solid ink, stitches or beads, drawn by the same path material as the stitched-contour studies. Small cells stay uncluttered. |

A control that a choice makes irrelevant is hidden by it (hatch spacing under *flat*, petals for any glyph other than
a rosette) and keeps its value for when you switch back.

## Try these

- **Readable portrait, calm**: threshold 6, filler *flat*, gutter 1, smallest cell 6. The head is a clean mosaic of color.
- **Hatched portrait**: filler *hatch*, threshold 5, body 0.6, tone response 1.5. Line directions follow the outlines; darker cells hatch tighter.
- **Halftone**: filler *dots*, spacing 5, body 0.3, largest dot 1.1, threshold 5.
- **Monochrome print**: color *ink*, filler *flat*, body 1, threshold 4, gutter 1. One ink at different densities.
- **Patchwork**: filler *flat*, body 1, gutter 3, border *stitch*, border from 30, threshold 5, color *palette*.
- **Arrows on the flow**: filler *motif*, glyph *arrow*, glyph size 0.85, direction smoothing 12, threshold 8.
- **Silhouette**: retained 0.3, retain by *dark*, filler *hatch*. Only the darkest cells remain, on open paper.
- **Openings by detail**: retained 0.55, retain by *detailed*: the flat backdrop drops away and the outline of the head remains.
- **Crop in**: zoom 2.4, crop Y 0.25, threshold 4. The eyes fill the canvas at finer cells.
- **Landscape strata**: image *landscape*, threshold 3.5, split *longest*: strips follow the horizon and ridge lines.

## Use the mosaic in code

The partition is a producer; fillers are ordinary callbacks. A plan is deeply frozen and cached by its
construction only (the picture's hash, crop, rectangle, measure, metric, threshold, limits, split and
smoothing); the seed only labels cells.

```js
import { bundledRaster, coverCrop, compartmentPlan, keptCompartments, compartmentRegions, inside, motif,
  createInstrument, referenceComposition, compartmentOptions, compartmentFiller } from "@procedurals/instruments";

const picture = bundledRaster("portrait", 3, 128);            // or any resolved Raster from createRaster
const plan = compartmentPlan({ seed: 7, source: picture, crop: coverCrop(picture, 1, 1, .5, .5),
  centerX: 320, centerY: 320, width: 560, height: 560, measure: "lightness", metric: "stddev",
  threshold: .035, minCell: 10, maxCell: 140, split: "quad", smoothing: 8 });
// plan.cells: id "r.2.0", canvas bounds, value, error, spread, resolved, color (sRGB), tone, coverage, orientation
// plan.tree:  every node, parents first, so you can walk coarse-to-fine

const kept = keptCompartments(plan, 0.8, "detailed");        // a stable subset
inside(p, compartmentRegions(kept, 2), (p, region, run) => {  // your own filler
  const { cell } = region;                                    // region.bounds is inset by half the gutter
  p.noStroke(); p.fill(cell.color[0] * 255, cell.color[1] * 255, cell.color[2] * 255);
  p.rect(0, 0, region.bounds[2] - region.bounds[0], region.bounds[3] - region.bounds[1]);
});

const recipe = referenceComposition(createInstrument("adaptive-compartments"));  // the same values as a descriptor
const fill = compartmentFiller(recipe.fill, recipe.palette);                     // the built-in filler as a callback
```

Cells and their bounds, colors and orientation are frozen: a filler can read them but cannot change them, and
nothing a filler draws can re-divide the picture. A source raster is any resolved `Raster`; the library never
opens files or URLs, and the private host binds user pictures to this input later. Transparent source pixels are
composited over white for the error measure but stay transparent in the cell's color and coverage.
Detail is measured on one scalar (lightness, luma, luminance, saturation or alpha); there is no multi-channel color error.
There is no watercolor filler yet: wash-like cells are flat cells at a lower body opacity.

## Bounds

At most 4,096 cells (20,000 through the direct API), 4,194,304 source pixels, and about 80,000 hatch lines,
dots, glyphs and border stitches per drawing. A setting that needs more is refused with the control to change
named, never thinned. Hatching and dots are computed exactly on each cell's rectangle; hatch and dot marks stay inside their cell, and a line
of weight *w* stays half a weight inside the edge. The layer is transparent: nothing is drawn behind the cells
and open cells leave paper for other layers.
