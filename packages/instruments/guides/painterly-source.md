# Painterly Source

A picture built from marks, coarse first. The starting drawing is a bundled portrait laid down as broad
ink strokes in ten colors; each later layer paints smaller strokes only where the paint so far still
differs from the picture (the eyes, the edge of the hair, the collar), and every stroke turns along the
edges and contours of the subject. A new seed is a different hand: the same subject, differently placed
and overlapped strokes.

The subject is one of four bundled synthetic images (a portrait, a geometric scene, a landscape and
photographic noise), each with a variant number that re-tints and rearranges it. Your own pictures are
a future host feature: the library accepts a validated raster value, but the instrument's saved
settings name only the bundled subjects. Every image is generated on the spot; nothing is fetched.

**One plan, three separate choices.** The marks (where they sit, how long, which way they point, which
color they sample) are planned once from the picture. *Material* (ink, stitches, beads, dots, rings,
rosettes, arrows), *color* (source, reduced, palette) and *retention* only decide how that plan is
drawn: changing them never moves, adds or removes a planned mark. Changing the layers, brush, coverage,
threshold, direction, negative space or the seed re-plans.

## How the layers work

Layer 0 covers the picture with the coarsest brush. Before each later layer paints, every cell of its
grid compares the paint on the canvas with the picture blurred to that brush's size; a cell whose
average difference is above the **error threshold** gets a mark, the others stay as they are. Marks
that would have painted a color already there are never repeated, so flat areas stay coarse and detail
gets small marks. Colors are averaged in linear light over the brush window, not copied from a pixel.

## Layers and marks

| Controls | What changes on the canvas |
|---|---|
| **Source image**, **Image variant** | The subject being painted. Variants change the sitter, ridge line or tile layout, not the marks' randomness (that is the seed). |
| **Center X/Y, Size** | Where the picture sits and how large it is, in canvas units. Marks keep their sizes, so a small picture is painted in relatively coarser marks. |
| **Layers** | Passes of marks, coarse to fine. Adding a layer only adds finer marks; the earlier ones do not move. |
| **Coarsest brush**, **Size ratio** | The first layer's mark width and the divisor between layers: 30 and 1.8 give widths 30, 17, 9 and 5. Near 1 layers are similar; a big ratio jumps from masses to fine marks. |
| **Coverage** | How many marks cover each point of a layer on average. Under 1 leaves gaps for later layers to fill; 3 is a thick, smooth build-up. |
| **Error threshold** | How different the paint must still be before a finer layer marks a cell. 0 paints every cell that is not an exact match, giving posterized detail; high values leave the broad layer standing; 1 paints nothing at all. |
| **Mark family** | The footprint: **dots**, **dabs** (1.8 times as long as wide), **short strokes** (3.6) or **ribbons** (9, bending through the picture's structure). |
| **Jitter** | Random strays from the grid cell's center; 0 is a regular lattice, 1 anywhere in the cell. |

## Direction

| Controls | What changes on the canvas |
|---|---|
| **Direction coherence** | 0 lays every mark at the base angle, like a hand hatching one way; 1 turns each along the picture's edges and contours where they are strong (the tangent of the level lines, not across them). Where the picture has no direction the base angle is used either way. |
| **Base angle** | The direction of marks where structure is weak or coherence is under 1. Angles blend as half-turns: strokes never turn through the wrong side. |
| **Structure scale** | How widely edges are averaged before marks follow them, in brush widths per layer: small follows every contour, large only the big shapes. |
| **Angle scatter** | A stable random turn of each mark either way. |

## Negative space

| Controls | What changes on the canvas |
|---|---|
| **Paper level** | Parts of the picture lighter than this are left bare and transparent, so a sky or highlights stay empty. 1 paints everything. |
| **Retention** | Keeps this fraction of the marks in every layer, chosen by the mark itself, so raising it only adds marks; it is the same set for every material. |
| **Subject** | **Window** paints only an ellipse of the picture and leaves the rest bare. |
| **Window X/Y, Window width/height, Window feather** | Center and size of the window as fractions of the picture (width and height scale together as one edit); feather thins the rim out in a stable way instead of cutting it. |

Bare areas are truly transparent: an earlier layer shows through. Coarse marks are opaque, so painterly
over another layer hides it except where you leave paper, use **Retention**, **Mark fill** or a window.

## Material and color

| Controls | What changes on the canvas |
|---|---|
| **Material** | **Ink stroke** draws each mark's path at the mark's width; **stitches** and **beads** are placed along the path; **dots**, **rings**, **rosettes** and **arrows** sit at its center (arrows show the mark's direction and length, scaled by fill). |
| **Mark fill** | Drawn width as a fraction of the planned width: below 1 leaves paper between marks; above overpaints. Ink limits a mark to 50 units wide. |
| **Line weight**, **Petals** | Outline width of rings, petals and arrows; radial strokes per rosette. |
| **Color** | **Source colors** as sampled; **Reduced** merges them into a few by median cut; **Nearest palette color** snaps each to the layer palette; **Palette ramp** maps lightness onto the palette from dark to light. |
| **Reduced colors** | How many colors Reduced keeps. Fewer looks flatter and more graphic; a box that mixes different families averages them, so a very small count muddies. |
| **Saturation** | Pushes each color away from its gray before it is reduced or matched (the lightness ramp reads lightness only, so it ignores this). |

Rings and rosettes draw a second, darker shade of each mark's own color, so they stay in its hue.

## Try these

- **Loose landscape:** *Landscape*, *Ribbons*, *Coarsest brush* 40, *Coherence* 1, *Structure scale* 2, *Layers* 3.
- **Posterized portrait:** *Error threshold* 0, *Layers* 6, *Ratio* 1.5, *Dabs*, *Coverage* 2.
- **Pointillism:** *Dots* or *Dabs*, *Material* beads, *Mark fill* 0.8, *Color* nearest palette color.
- **Pencil hatching:** *Dabs*, *Coherence* 0, *Base angle* 90, *Angle scatter* 0, *Jitter* 0.3.
- **Open sky:** *Landscape*, *Paper level* 0.62: clouds and light sky stay as paper.
- **Head only:** *Subject* window, width 0.5, height 0.6, feather 0.6.
- **Sparse fragments:** one layer, *Coarsest brush* 40, *Coverage* 0.6, *Retention* 0.5, *Jitter* 1.2.

## Use the pieces in code

The plan is an ordinary frozen value, and the named instrument is these same functions.

```js
import { bundledRaster, paintPlan, paintPalette, atEach, strokeWith, pathMaterial, motif,
  createCompositionRun } from "@procedurals/instruments";

// Any Raster you resolved yourself works in place of bundledRaster(...): createRaster({ width, height,
// channels, format, colorSpace, alpha, data }) validates it, keeps its alpha and color space.
const plan = paintPlan({
  seed: 7, source: bundledRaster("portrait", 3, 192),
  frame: { centerX: 320, centerY: 320, width: 560, height: 560 },
  layers: 4, brush: 30, ratio: 1.8, coverage: 1.6, family: "stroke", threshold: 0.05, jitter: 0.8,
  coherence: 0.9, baseAngle: 35, smoothing: 1, scatter: 8, paper: 1, subject: null,
});

// Marks have stable ids (`L2:14:9` = layer 2, cell column 14, row 9), a site and a centerline path.
// plan.sites[i] and plan.paths[i] belong to plan.marks[i]; plan.layers[k] gives the mark range.
const palette = paintPalette(plan, { mode: "reduced", colors: 8, saturation: 1.1 }, [0x222222]);
for (const layer of plan.layers) {
  const paths = plan.paths.slice(layer.first, layer.first + layer.count);
  strokeWith(p, paths, pathMaterial({ kind: "ink", weight: layer.brush, spacing: layer.brush, phase: 0, phaseSpread: 0,
    levelRamp: 0, retention: 1, mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, palette),
    createCompositionRun({ maxWork: 1_000_000 }));
}
// or anything of your own: atEach(p, plan.sites, (surface, site) => surface.circle(0, 0, plan.marks[...].width))
```

`palette` is interleaved: entry `2i` is mark `i`'s color and `2i + 1` a darker shade, and each site's and
path's `tone` is `2i`. `mark.color` and `mark.source` (lightness, structure coherence, structure angle,
the error that admitted it) let your own callback recolor by any rule. `paintPlan` is cached by
the picture's content hash and the construction options; palette, material and retention are not part
of it. Lengths are canvas units, angles in degrees for options and radians on results.

**Limits.** At most 8 layers, 240,000 candidate cells and 40,000 marks per plan, a finest brush of at least
0.5 units, and pictures larger than 512 pixels a side are box-resized once for analysis. Exceeding one
throws and names the control to change; nothing is truncated. Drawing charges one callback unit per
mark plus a stitch or bead material's own steps, against a budget of 1,000,000. Strokes are cut where
they would leave the picture, but a mark near the border may overhang it by half its width. Marks are
opaque in the planner even where a material draws with slight transparency.
