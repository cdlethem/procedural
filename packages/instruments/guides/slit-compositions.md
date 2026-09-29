# Slit Compositions

Recompose a picture through parallel slices, or stretch time into bands. The starting study is a
portrait cut into 96 vertical slices: most stay where they were, a tenth trade places, and every band is
nudged up or down along a slow wave, so the face is still there but built from displaced strips. Two
small windows keep the original, unsliced, exactly where it belongs so you can judge what was moved. Every
band is a vector strip (long runs of equal colour merge into single rectangles); nothing is a per-pixel mark.

There are two methods and they are labelled honestly:

- **Slice one image** cuts a picture into strips. Ordering the slices recomposes the picture.
- **Slit-scan a frame sequence** reads a short moving scene along one thin line, the slit, once per band, at
  a different moment for each band. Ordering the slices reorders time. Static parts of the scene smear into long
  streaks, moving things are stretched across the bands they passed the slit in.

Both share one **slice table**: for every output band, which source slice it shows, which frame and moment it
reads (sequences only), and how it is offset and scaled along its own length. Nothing here is video: the
frames of a scene are generated, deterministic and seeded, and the sliced images are the bundled sample
pictures. Binding your own image or frames to a Studio layer is future host work; called as a library
function, `slitComposition`, `drawSlit` and the producers below already accept any `Raster` or `FrameStack`
you construct (see the end of this guide).

## What is bundled

| Source | Method | What it is |
|---|---|---|
| Portrait, Geometry, Landscape | Slice one image | A feathered head and shoulders, a Mondrian-like grid with shapes, and ridges under a sky. The seed re-tints and rearranges them. |
| Walkers (8 s) | Slit-scan | Three figures crossing a street, one against the flow. The slit shows each figure's profile stretched in time, legs as a ripple, the still street as streaks. |
| Sunrise (12 s) | Slit-scan | Sun, hills and lake from night to day. The slit shows the sky's colour history and the sun's arc. |
| Orbits (10 s) | Slit-scan | Five bodies on circular orbits round a star. Whole turns, so it loops. |
| Windmill (4 s) | Slit-scan | Four blades on a tower. Two whole turns, so it loops; a horizontal slit through the hub shows the blades as curves. |

## Choose the source and its slices

| Controls | What changes on the canvas |
|---|---|
| **Method** | Whether bands are strips of one picture or moments of a moving scene. Controls that only mean something for one method are hidden under the other and keep their values. |
| **Source image / Source scene / Frames** | Which bundled picture or scene. Frames sets how many frames the scene is sampled into over its fixed duration: few frames make the motion step, many make it fine. |
| **Between frames** | Hold the earlier frame, take the closer frame, or cross-fade in linear light. Hold and closer show visible steps when there are more bands than frames; the cross-fade blends them. |
| **Band direction** | Vertical bands side by side (columns) or horizontal bands stacked (rows). |
| **Slices, Repeats, Repeat order** | Slices is how many strips the source is cut into and so the width of a band. Repeats lays the whole order across the footprint several times, each pass narrower; alternate plays every other pass backwards. Repeat order does nothing with one repeat. |
| **Order** | Sequence keeps it; reverse mirrors it; comb deals slices into groups so the picture appears once per group, each copy thinned to every k-th strip; interleave riffles the groups together; shuffle lets a **Disorder** fraction of the slices trade places. |
| **Groups** | Groups for comb and interleave. |
| **Disorder** | Shuffle only. Which slices move, and where, is decided by each slice's own id, so raising Disorder only adds movers. |
| **Phase shift** | Rotates whatever order results to the left by a fraction of the slices, wrapping round: a shifted picture, or time started somewhere else. |

## Time map and slit (slit-scan only)

| Controls | What changes on the canvas |
|---|---|
| **Time curve, Power, Swings** | How position across the output becomes time. Linear is even; power lingers at one end; swing runs time forward and back. |
| **Gesture, Gesture channel** | A bundled recorded stroke drives time with its own timing: its horizontal or vertical position, or the distance travelled (forward only; constant while the hand rests, so time freezes). Each is scaled to fill the window. |
| **Window start / length** | Which part of the sequence the output spans, as fractions of its duration. Beyond 0 to 1 the sequence is passed more than once or held, according to **Past the ends**. |
| **Past the ends** | Hold the first or last frame, loop, mirror, or refuse: an error that names Window start, Window length and Time curve. Nothing is silently clamped unless you choose Hold. |
| **Slit position** | Where the slit crosses the frame, as a fraction of its width. |
| **Slit angle** | 0 runs down the frame; 90 runs across it. |
| **Slit bend** | Bows the middle of the slit sideways, so the slit becomes a curve through the scene. |
| **Slit length** | How much of the frame the slit spans. Where a slit leaves the frame the band is empty: there is nothing beyond the frame to read. |

## Shape the bands

| Controls | What changes on the canvas |
|---|---|
| **Offset pattern, Offset, Offset period** | Shifts each band's content along its own length. Ramp, wave and alternate follow the band's place on the canvas, so they stay put when you reorder; random belongs to the slice and travels with it. Offset is a fraction of the band's length; the period is the bands per cycle of the wave. |
| **Scale pattern, Scale, Scale period** | Stretches content along its length about its middle, with the same patterns. Scale is in octaves (1 doubles or halves). |
| **Beyond the source** | Where offset or scale carry a band past the source: hold the edge, wrap round, mirror, or leave a gap (a transparent hole). |

## Fragments and mask

| Controls | What changes on the canvas |
|---|---|
| **Fragments, Fragment size** | Windows that show the unsliced source at its true place (or one frame of a scene), so the recomposition can be judged against the original. Raising the count only adds fragments; the earlier ones do not move. |
| **Fragment moment** | Slit-scan only: which moment of the scene the fragments show. |
| **Mask, Quilt grid, Quilt cuts, Quilt keep** | Clips the bands to the kept leaves of a Region Quilt partition of the footprint. A leaf keeps its place when Keep changes; the rest of the footprint is left empty. Fragments are not clipped. |

## Placement and drawing

| Controls | What changes on the canvas |
|---|---|
| **Center, Width, Height, Rotation** | The footprint the bands fill, turned clockwise on screen. Width and height are one proportional pair. A picture is fitted to the footprint by cover (uniform scale, crop, centred), so a non-square footprint crops a square picture rather than stretching it. |
| **Detail** | Samples along every band. More resolve finer changes and make more, shorter runs. |
| **Color** | Source colors (posterized), a tonal ramp (lightness mapped through the palette from dark to light), or ink (only the dark parts, in the first palette color; the rest is empty, which layers well over other studies). |
| **Tone steps** | Steps per color channel (source) or of lightness (ramp). Fewer steps merge more into long runs and fewer rectangles. |
| **Ink threshold** | Ink only: the lightness below which a sample is inked. |
| **Gap** | Fraction of each band's width left empty. Bands then stay separate strips. |

The layer is transparent outside the footprint, gaps, mask and voids. A source with transparency
(a raster with an alpha channel) is drawn opaque where its coverage is at least one half and left empty elsewhere.

## Try these

- Landscape, comb into 4 groups, 2 repeats alternating: four thin skylines mirrored side by side.
- Portrait, sequence order, phase shift .3: the face slides out of the frame at one edge and back in at the other.
- Portrait, random offset, scale ramp, mirror beyond the source: the picture melts into vertical hair.
- Sunrise, slit-scan, recorded gesture (spiral, vertical position), rows: time replays as the hand did, with two rests.
- Windmill, slit angle 90, slit through the hub: the blades as curved white and blue strokes.
- Walkers, ink, few frames (30) with Hold: each figure as a stepped block, the street mostly ink.
- Any picture, quilt mask with 65% keep, rotated 20 degrees, gap .15: a fragment of the recomposition with real negative space.

## Use the pieces yourself

Every stage is an ordinary function returning a frozen, cached value, so any stage can be replaced or
reused by another study.

```js
import { bundledRaster, createRaster, createFrameStack, sliceTable, slitStrips, slitFragments, slitRects,
  drawSlit, slitComposition, createInstrument } from "@procedurals/instruments";

// 1. A source: any Raster (image) or FrameStack (timestamped frames, seconds, strictly increasing).
const raster = bundledRaster("landscape", 42, 256);

// 2. The mapping: output band -> source slice (and frame/time for sequences).
const table = sliceTable({ seed: 1, count: 48, repeats: 1, repeatMode: "same",
  order: { kind: "comb", groups: 3, disorder: 0, phase: 0 },
  offset: { mode: "wave", amount: 0.06, period: 24 }, scale: { mode: "none", amount: 0, period: 10 },
  scan: { kind: "space" } });
table.rows[5]; // { id: "slice:015", source: 15, slot: 5, across: [.104, .125], interval: [.3125, .333], time: null, offset, scale, seed }

// 3. Strips sampled once per band, then vector rectangles under any appearance.
const source = { kind: "image", raster };
const strips = slitStrips(source, table, { direction: "columns", width: 460, height: 460, detail: 96, outside: "clamp",
  slit: { x: 0.5, angle: 0, bend: 0, length: 1 } });
const rects = slitRects(table, strips, slitFragments(source, { seed: 1, count: 0, size: 0.2, time: 0, width: 460, height: 460, detail: 96 }),
  { direction: "columns", width: 460, height: 460, gap: 0, cells: null,
    color: { mode: "source", levels: 8, threshold: 0.5, palette: [0x1d2733, 0xf1e6cc] } });
// rects: frozen { id, x, y, width, height, rgb, rows, fragment } in footprint-local units (origin at the centre).
```

Whole recipes are JSON: `slitComposition(createInstrument("slit-compositions"))` resolves the stored
controls to a recipe, `drawSlit(surface, recipe, { band })` draws it (a `band` callback replaces the fill and receives
each merged rectangle), `slitScene(recipe)` returns the table, strips, fragments and mask cells, and
`prepareSlit(recipe, cancelled)` builds them in stages. A recipe's `source` may be `{ kind: "raster", raster }` or
`{ kind: "stack", stack }` with your own resolved values; those are typed values, not JSON, so a saved
instrument names only bundled sources.

Frame stacks come from `createFrameStack({ id, times, frames })`: one raster per frame, all with the
same size, channels, format, colour space and alpha mode; a missing frame or a non-increasing timestamp is an error
naming its index.

Limits (every one names the control to change): 1 to 600 slices, 1 to 64 repeats and at most 1,200 bands in
all; 4 to 400 samples per band; 1 to 256 frames and 16,777,216 frame pixels per stack (bundled scenes: 2 to
240 frames of 128 x 128); at most 24 fragments and 250,000 fragment cells; at most 120,000 rectangles.
Lengths are canvas units of the 640-unit reference canvas.
