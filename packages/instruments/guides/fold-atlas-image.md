# Fold Atlas Image

Push a picture through the same chained coordinate maps as [Fold Atlas](fold-atlas.md) and watch it fold, swirl, pinch or
unroll. Two views of one mapping share this entry, and they answer different questions:

- **Fragments** asks, for every cell of the output, *which point of the picture lands here?* It inverts the map and paints
  the picture's color at that point. Where the map folds the picture over itself, several regions of the picture want the
  same cell; only one **sheet** is visible, chosen by you, and the others are hidden underneath. Cells no part of the
  picture reaches stay bare paper. The starting study drapes the portrait with a handkerchief map and twists it: the face
  sits at the center of sweeping folded arms of backdrop and hair, some of them turned over and darkened.
- **Density** asks, for every sample of the picture, *where does it land?* Thousands of points of the picture are pushed
  forward and counted per cell. Where a fold piles several regions of the picture onto the same cell their counts **add**;
  where the map stretches the picture thin, cells between the samples receive nothing and **stay empty**: nothing is
  interpolated or filled. Folds print as heavy seams, stretched regions as sparse ones.

| | Fragments (inverse) | Density (forward) |
|---|---|---|
| Works over | output cells | source samples |
| A fold (many-to-one) | one sheet is shown, the rest hidden | the counts of all sheets add |
| A stretch (one-to-many) | every cell inside the picture is painted | cells between samples stay empty |
| A singularity | cells with no reachable source stay bare | samples the map sends past the bound are dropped and counted |

The map itself is the one described in the Fold Atlas guide: up to three maps in order, repeated up to four times, with a
fixed point, radius and exclusion bound.

## Choose the picture and place it

| Controls | What changes on the canvas |
|---|---|
| **Source image**, **Image variant**, **Image resolution** | One of four bundled sample pictures (*portrait*, *geometry*, *landscape*, *noise*), its own seed, and the pixels across it. Pictures you supply bind through the host once it offers that. |
| **Image center X/Y**, **Image width/height** | The rectangle the whole picture is fitted to before the map (stretched if width and height differ). |
| **Frame width/height** | The region the result is drawn in, centered on the picture. Whatever the map sends outside the frame is dropped; the frame is also where output cells are laid. |

## Choose the mapping

| Controls | What changes on the canvas |
|---|---|
| **Map center X/Y**, **Map radius** | The fixed point of every map and the length it treats as 1. A smaller radius applies each map more strongly. |
| **First / second / third map**, **Amount**, **Frequency** | The same eight maps as Fold Atlas: sinusoidal, swirl, fisheye, spherical, polar, handkerchief, waves, horseshoe, blended from no change (0) to full (1). |
| **Repeat chain**, **Exclusion bound** | Runs the chain again on its own output. Points a map sends farther than the bound from the center are excluded: that is how spherical leaves a clean hole at the pole. |

## Show

| Controls | What changes on the canvas |
|---|---|
| **Show** | *Fragments* or *Density*. |
| **Cell size** | Side of each output cell in canvas units (4 to 24 in the slider; 1 to 400 allowed). Small cells resolve fold edges more finely. The frame is refused past 40,000 cells. |

## Fragments

| Controls | What changes on the canvas |
|---|---|
| **Sampling filter** | How the picture is read between its pixels: *nearest* keeps hard pixels, *bilinear* blends four, *bicubic* is crisper. Reads are interpolated in linear light; a preimage inside the picture only ever touches its outermost half pixel at the edge, which repeats the edge pixel. |
| **Average shrunken areas** | Where the map shrinks the picture, a cell reads the mean of the picture area it covers (from box-averaged half-size copies, blended between the two nearest sizes, never coarser than 16 source pixels) instead of one point, so shrunken detail blurs rather than speckles. Cells the map does not shrink read the picture exactly. Off reads one point per cell. |
| **Fold search** | *Nearest* starts the numeric inverse from each cell itself, so a folded cell shows whichever sheet is closest to it, and cells that only a distant sheet can reach may stay bare. *Sheets* also seeds the search by pushing a fine lattice of the picture forward, finds every sheet, and shows the one you choose. |
| **Search detail** | *Sheets* only. Seed points per cell side (1 to 3 in the slider). Higher values find thin or small sheets that a coarse seeding misses. |
| **Sheet on top** | *Sheets* only. *Front* shows the sheet the map has kept the right way round (positive Jacobian determinant); *back* shows the mirrored one. |
| **Mirrored shade** | Darkens fragments the map has turned over, so folds read as folds. 0 leaves them the picture's color. |
| **Color levels**, **Color source** | Steps per color channel, so cells of one stepped color merge into a single rectangle (fewer levels give bigger, simpler shapes); *image* keeps the picture's colors, *palette* maps its brightness along the palette from its first color (dark) to its last (light). |

The inverse is numeric: damped Newton on the map with at most 24 iterations per start. A cell is drawn exactly when a start
converges to a preimage inside the picture; otherwise it is left as paper. No neighbouring cell's color is borrowed.

## Density

| Controls | What changes on the canvas |
|---|---|
| **Sampling** | *Tone* draws random points where the picture is dark (or light), so density carries the picture; the seed rearranges them. *Grid* places one jittered point per cell of an even lattice, so density shows only the map's own stretching. |
| **Sample count** | Points pushed through the map (2,000 to 150,000 in the slider). The first N points of a larger tone set are the N-point set, so raising the count only adds. Grid sampling rounds to a whole lattice. |
| **Sample where**, **Tone contrast** | Tone sampling only: dark or light, and the power applied to a pixel's tone. |
| **Grid jitter** | Grid sampling only: how far each point wanders inside its own lattice cell. 0 is exactly centered (the seed then changes nothing). |
| **Exposure**, **Tone response** | Brightens or dims the finished counts. 1 calls the density an unfolded picture would give 1. *Film* saturates smoothly, *log* lifts light regions and compresses pile-ups, *linear* clips at four times the reference. Exposure is a separate stage: it never moves a sample, and changing it redraws from the same mapped samples. Empty cells stay empty. |
| **Density marks**, **Bands**, **Largest dot** | *Bands* paint stepped tone as merged rectangles; *dots* size a round dot by tone so a fold prints as a heavy line. |
| **Density color** | *Ink* tints the first palette color toward white as density falls; *palette* runs the palette from its last color (sparse) to its first (dense). |

## Try these

- Default: handkerchief 1 at frequency 1.2, then swirl .7, radius 230, fragments. The face sits in sweeping folded arms.
- Swirl .8 then sinusoidal .9 at frequency 2.5, radius 175: a calmer fold whose thinnest sheets are finer than a 5-unit cell, so confetti shows along the folds; lower **Cell size** to resolve them.
- Sinusoidal only, amount 1, frequency 3: the picture folds twice across each axis; flip **Sheet on top** between front and back.
- Set **Fold search** to *nearest* on the same fold: some cells lose their front sheet, and the seam turns ragged.
- Density, sampling *grid*, jitter 0.5, dots: with no image detail, only the fold's own caustics show.
- Density, sampling *tone*, 150,000 samples, *log*: the picture's tones printed through the fold, seams as bright lines.
- Spherical, amount 1, radius 120: the picture inverts about the center; the pole is a clover-shaped hole in fragments and an empty patch in density.
- Layer the Fold Atlas grid over Fragments with the same map: the grid lines follow the folds of the picture.

## Use it in code

```js
import { bundledRaster, foldPreimages, foldColors, foldSamples, foldMapped, foldDensity, tonemapDensity, invertMap,
  latticeStarts } from "@procedurals/instruments";

const picture = bundledRaster("portrait", 3, 128), source = { x: 100, y: 100, width: 440, height: 440 };
const map = { centerX: 320, centerY: 320, radius: 175, iterations: 1, bound: 8,
  stages: [{ map: "sinusoidal", amount: 1, frequency: 3 }] };

// Inverse: the preimage of every output cell and the color read there. Cached; deeply frozen.
const pre = foldPreimages(map, source, source, 6, { search: "sheets", seeds: 3, sheet: "front" });
const colors = foldColors(pre, picture, source, "bilinear");    // NaN where the cell is excluded

// Forward: samples, where they land, how many land in each cell, and the tone of each cell.
const samples = foldSamples(picture, source, { kind: "tone", seed: 7, count: 80000, weight: "dark", curve: 1 });
const density = foldDensity(foldMapped(samples, map), source, 6); // density.count, .holes, .excluded, .outside
const tone = tonemapDensity(density, 1.5, "film");               // a separate stage: exposure never moves samples

// One point, by hand: candidates > 1 means a fold put several regions there.
invertMap(map, source, 380, 320, { sheet: "front", starts: latticeStarts(source, 3) });
```

Every sample is accounted for: `density.total + density.excluded + density.outside` equals the sample count.

## Bounds

At most 40,000 output cells, 400,000 samples and 300,000 forward-mapped seed points per drawing. A setting that needs more
is refused with the control to change named; nothing is thinned. The layer is transparent: excluded cells and holes leave
paper for other layers.
