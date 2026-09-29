# Pixel Sorting

Ordered streaks that dissolve part of a picture while the rest stays exactly as it was. The starting
study is a synthetic portrait: the head sits inside a protected ellipse and is untouched, while the dark
tones of the collar and the background are gathered into vertical streaks, darkest first, that drip
and rise from where the shoulders were. Run boundaries are ragged rather than ruled, so a new seed
frays the same picture differently.

Everything is drawn as vector bars (or stitch-like strokes), never per-pixel marks: pixels of one
streak that share a color merge into one bar, so a 128 × 128 image is about ten thousand marks and the
whole image can be redrawn from the controls in a few milliseconds. The layer is transparent and stays
inside its footprint.

Four sample images ship with the instrument, all synthetic and deterministic (not photographs):
**Portrait blobs** (soft, feathered head and shoulders), **Geometric scene** (flat colors, hard edges,
stripes and a checker patch), **Landscape** (sky gradient, sun, ridges, textured ground) and
**Photographic noise** (graded color field with detail and grain). The image is chosen with **Source
image**; binding your own image to a Studio layer is future host work, and the library functions
already accept any raster you construct (see the end of this guide).

## How a sort works

1. The image is scanned along straight lines in one **direction** (a row, a column or a diagonal).
2. On every line, the pixels whose selection value lies in the **interval** (and that are not
   protected) form runs; runs shorter than **Shortest run** are dropped, and, if wanted, long runs are
   cut into pieces of **Longest run**.
3. Each run is sorted by the **Sort by** value, ascending or descending. Equal values keep the order in
   which they were visited, in both orders.
4. Pixels only rearrange inside their own run. Pixels outside every run, and fully transparent pixels,
   are never touched.

Sorting is not displacement: no pixel is created or lost inside a run, and nothing crosses a run
boundary. The library returns the **run table** (id, position, length, key range, pixels moved) and the
**moved-pixel mapping** (which source pixel each pixel came from) alongside the drawing.

## Controls

| Controls | What changes on the canvas |
|---|---|
| **Source image** | Which sample picture is scanned. Hard-edged flat images such as the Geometric scene only change where a run holds several colors, so widen the interval to move them. |
| **Resolution** | Pixels per side of the working image. Higher values give thinner, more detailed streaks and more marks; the streak count is limited to 40,000 and a larger image or a smaller merge tolerance can reach it. |
| **Center, Width, Height** | Where the image sits and how big it is. Width and height are a proportional pair; a different ratio stretches the picture and leaves the sort unchanged. |
| **Scan direction** | The line runs are cut from: right, left, down, up and the four diagonals. Streaks follow it; a diagonal run is a staircase of pixels. |
| **Select by, Interval start, Interval width** | Which pixels can be sorted: those whose brightness, lightness, hue or saturation lies inside the interval (both ends included). Everything else, and the runs it interrupts, stays put. A narrow interval gives short scattered runs; the whole range sorts every line. |
| **Shortest run** | Drops runs shorter than this many pixels: removes speckle and keeps tiny details. |
| **Cap run length, Longest run** | Cuts long runs into the fewest nearly equal pieces of at most this length, so the image dissolves into tiles instead of long smears. |
| **Ragged edges, Ragged amount, Ragged scale** | Bend the selection with a smooth seeded field so runs start and stop irregularly. The amount is how far the field can move a pixel's value; the scale is the size of its features in pixels. **This is where the seed matters.** |
| **Sort by, Order** | The value runs are ordered by (brightness, lightness, hue, saturation) and whether the lowest or highest comes first along the scan direction. |
| **Region, Region acts as** | What is kept out of the sort: an ellipse, the connected region under a point, the strongest edges, or seeded noise blobs. Protected pixels never move and split every run they touch. The other role sorts only inside the region and leaves everything outside exactly as it was. |
| **Focus X / Y, Ellipse width / height** | Position of the ellipse or of the picking point, as fractions of the image. The ellipse size is a proportional pair. |
| **Tone bands** | Connected region only: how many equal lightness bands split the image before the region under the point is taken. Few bands give one large region across gradients; many keep a small patch of nearly one tone. |
| **Share of the image, Blob size** | Strong edges: the fraction of pixels with the strongest gradient that are protected (flat areas never are). Noise field: the fraction of the image covered and the size of one blob. |
| **Grow** | Widens a connected region or the edges by whole pixels. One-pixel edges become a real barrier that runs stop against. |
| **Draw** | Whole image; only the sorted streaks (transparent where nothing was sorted, so an unsorted copy underneath shows through); or only the unsorted pixels. |
| **Color** | The image's own colors, or each pixel's brightness mapped through the palette from its first color (dark) to its last (light). |
| **Streak mark, Merge tolerance** | Bars are flat rectangles that fill the pixels a streak covers (a hairline of the same color hides seams). Stitches are short round-capped strokes with gaps between them, so paper shows through and the whole picture, protected pixels included, becomes a thread-like abstraction: their colors are unchanged but the marks are not exact pixel squares, so use bars to see the protected region exactly. Merge tolerance is how far a pixel may differ from its streak's running average to join the same bar; unsorted pixels are always drawn exactly. |
| **Stitch thickness, Stitch gap** | Stroke width of a stitch as a fraction of its pixel row, and the space left between successive stitches. |
| **Run outlines, Outline weight, Outline stitch spacing** | Outline every sorted run with ink or stitches. Runs are outlined as the exact pixel set they cover. |

Controls that only matter under another choice (the ellipse controls, the edge share, the stitch gap,
the outline spacing, the cap length, the ragged amount and scale) appear only under that choice; hidden
values are kept and never change the drawing. There are at most 4,000 outlined runs, and stitched outlines
are limited by total length over their spacing; raise **Shortest run**, narrow the interval, widen the
outline stitch spacing or use ink if you reach either.

## Try these

- Portrait, the default: an ellipse keeps the face exact while dark tones become streaks. Change the
  seed to move the ragged edges; set **Scan direction** to *right* for the same tones smeared sideways in
  gentle, faint bands.
- Portrait, **Interval start** .55, **Interval width** .12, **Shortest run** 10, **Region** None, direction *right*:
  a sparse fragment, a few sideways slips across the face and the collar.
- Landscape, **Interval width** 1, **Region** *Strong edges* (share .2, grow 1), **Ragged edges** off, descending: the
  ridge lines hold as a fringe while the sky and ground pour through the gaps between them.
- Geometric scene, **Interval width** .95, **Region** *Connected region* at the disc (focus .42, .45, 3 bands),
  ragged amount .2: the black rules and shapes stay sharp while parts of the checker patch and the stripes
  are rearranged.
- Portrait, **Region acts as** *The only place that sorts*, **Sort by** hue, direction right: only the face
  dissolves, into speckle, inside an untouched picture.
- **Draw** *Sorted streaks only*, **Color** *Palette gradient*: warm streaks on a transparent layer; put an
  unsorted copy of the picture (the same instrument with a very narrow interval at a tone the picture lacks) under it.
- **Cap run length** 14 with **Streak mark** *Stitches*: short tiles with paper between them.

## Use the pieces yourself

The image is a resolved value, never a URL. Sorting is a pure function of the image and the options
and returns frozen values.

```js
import { createRaster, pixelSortStructure, pixelSortRunTable, movedPixels, pixelSortStreaks,
  drawPixelSorting, pixelSortingComposition, createInstrument } from "@procedurals/instruments";

const raster = createRaster({ width: 6, height: 1, channels: 1, format: "u8", colorSpace: "srgb",
  alpha: "none", data: [90, 10, 200, 30, 250, 60] });
const sort = pixelSortStructure({
  seed: 1, image: { kind: "raster", raster },
  runs: { direction: "right", select: { value: "luma", from: 0, to: 100 / 255 }, minRun: 1, maxRun: null, ragged: null },
  sort: { key: "luma", order: "ascending" }, mask: null, maskRole: "protect",
});
// sort.sorted holds [10, 90, 200, 30, 250, 60]; 200 and 250 were never selected
pixelSortRunTable(sort, "luma");   // run:0.0 (2 pixels, both moved), run:3.0, run:5.0
movedPixels(sort);                 // pixel index pairs (to, from) for the pixels that changed place
```

`pixelSortingComposition(createInstrument("pixel-sorting"))` returns the whole recipe as JSON (the bundled
image is named by id, size and variant), and `drawPixelSorting(surface, recipe, { streak, outline })`
draws it; a `streak` callback replaces the stock bars and receives each streak as a site (position,
angle, length and breadth in canvas units) inside `atEach`, and an `outline` path material replaces the
run outlines. `pixelSortStreaks` returns the merged streak list, `pixelSortRunPaths` the outlines as
closed paths, `pixelSortMask` and `dilateMask` the region grids. Every published value is frozen and
cached by construction: palette, color, mark kind, merge tolerance, outlines and footprint never rebuild
the sort or rename a run (ids are `run:<x>.<y>` and `s:<x>.<y>` of the first pixel).

Limits: only straight scan lines (a curved path would need its own pixel visitation and overlap rules);
at most 4,194,304 pixels per analysis, 1,000,000 runs, 40,000 drawn streaks and 4,000 outlined runs,
each reported with the control to change; lengths are canvas units of the 640-unit reference canvas.
