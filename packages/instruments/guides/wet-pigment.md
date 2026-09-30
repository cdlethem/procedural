# Wet Pigment

Pigmented water on paper. The starting picture is an irregular wet patch with four drops of blue paint and, later, a few drops of
clear water. Each pigment drop floods outward, is soaked up by the uneven paper and dries from the edge in, and the pigment it was
carrying is left where the water stopped: a pale middle with a darker, feathered rim. The late clear-water drops then push the
pigment they land in outward again, leaving a pale bloom with a dark crescent, a *backrun*. Drag **Elapsed steps** and the same
picture is painted at every moment of that history, from the first drop to the dried result. A new seed is a different sheet: a
different outline, different paper, different places for the drops.

Nothing is drawn from a picture and nothing is blurred. There is a small, stated model underneath (a grid of water, floating
pigment and deposited pigment), stepped forward in time, and three separate treatments of it: the **pigment** as banded polygon
fills, the **drying fronts** as contour lines, and the **water film** as a sheen. It is a 2D cellular model that makes blooms,
backruns, pooling and drying fronts, not physically accurate paint.

## How it is built

1. **Wet region.** You choose where water may go: a blob, the letters of a word, or a ring with a dry island. Everything else is
   dry paper. Water and pigment never cross dry paper; they only wet it as a spreading front.
2. **Paper.** Every cell of the paper has a seeded *porosity*. Porous cells soak water out of the surface and slow its spread.
3. **Water.** Water spreads from deeper cells to shallower ones, is soaked into the paper and evaporates, faster at the region's
   edge than in its middle. A cell whose film gets too thin is dry: its remaining water is gone and all the pigment still floating
   in it is left on the paper. A dry cell holds nothing and moves nothing.
4. **Pigment.** Floating pigment is carried along with the water and also diffuses a little. While the film is deep, a small share
   of it settles on the paper each step; where the film is thin, more; when the cell dries, all of it. Deposited pigment in a wet
   cell can lift back into the water, which is what a late drop of clear water does to old paint.
5. **Drops.** Pigment drops land at the start; clear-water drops can land later. Each has a seeded place and never moves.
6. **Steps.** One step is a fixed amount of time. *Elapsed steps* is how many have run. Once every cell is dry and no drop is
   still due, nothing changes any more.

Accounting is exact and tested: the pigment dropped equals the pigment floating plus the pigment on the paper plus the pigment
lost through an open edge, at every step; water likewise, with evaporation and absorption.

## Wet region and placement

| Controls | What changes on the canvas |
|---|---|
| **Wet region** | *Blob*: an irregular patch. *Letters*: the outline of a word (thin strokes hold little water and dry first, so they need drops of their own). *Ring*: a patch with a dry island; water goes around it, never across. |
| **Word** | (Letters only.) Which of the bundled words is wet. |
| **Outline roughness** | (Blob and ring.) 0 is an ellipse; 1 is a lobed blot. A new seed draws another outline. |
| **Island size** | (Ring only.) The dry island as a fraction of the region. |
| **Center X/Y, Width/Height, Rotation** | Place, size and turn the region. Width and height scale together as one edit. Parts beyond the canvas are cut off and stay dry. |

## Paper, water and transport

| Controls | What changes on the canvas |
|---|---|
| **Paper variation / Paper grain** | How unevenly the paper takes water and the size of its patches. Porous patches slow fronts, so a smooth bloom edge becomes ragged and lobed. 0 is uniform paper. |
| **Absorbency** | Water soaked out of the film each step (times porosity). Pigment stays behind, so absorbent paper concentrates it and stops a bloom sooner. |
| **Pre-wet** | Water laid over the whole region first. 0 paints onto dry paper: blooms stay close to their drops and have crisp rims. Higher lets drops flood across the sheet and merge. |
| **Drying rate** | Water lost to the air per step. Higher freezes the picture sooner, so blooms are smaller. Run **Elapsed steps** past the moment it dries to see the finished bloom. |
| **Edge drying / Edge reach** | How much faster the region's edge dries than its middle, and how far in that reaches. Water flows out to the drying edge and carries pigment with it: a dark rim (a coffee ring) against the region's outline. |
| **Transport strength** | How readily water evens out. 0 freezes water where it lands (nothing blooms); 1 is the model's fastest. |
| **Pigment diffusion** | How readily floating pigment spreads by itself, on top of being carried. Softens rims. |
| **Tilt / Tilt direction** | Tips the sheet: water drifts downhill and pools at the low side, carrying pigment to a dark pool. |
| **Edge** | *Sealed*: the region's edge is a wall. *Open*: water and pigment drain out through the edge into the surrounding paper and are lost from the picture, so the deposit thins toward the edge. |

## Pigment, drops and backruns

| Controls | What changes on the canvas |
|---|---|
| **Deposit sites / Site layout** | How many pigment drops, and where: spread over the region, near its edge, or as deep inside as possible. Each is seeded and fixed. |
| **Drop radius / Drop depth** | Size of each drop and how much water it carries at its middle. Deeper drops carry their pigment further. |
| **Water per pigment** | Dilution of a drop: high is a thin wash, low a heavy charge. |
| **Deposit rate** | How much floating pigment settles each step while the film is deep. High leaves pigment near the drop (crisp, small); low lets it travel to the rim. |
| **Redissolve** | How much deposit lifts back into the water where it is wet. This is the strength of a backrun. |
| **Late water** | Turns the late clear-water drops on. Everything below is ignored, and cannot change the picture, while it is off. |
| **Late drops / First drop at / Gap between drops / Late drop depth, radius** | How many, when the first lands, the time between them, and their size. Each lands beside one of the pigment sites. A drop that lands while the sheet is still damp mixes; one that lands on a nearly dry sheet makes a crisp backrun; one that lands after the sheet has dried does nothing. |

## Time and resolution

| Controls | What changes on the canvas |
|---|---|
| **Elapsed steps** | Scrubs time. The picture at step *k* is exactly what a run of *k* steps produces, and going forward reuses the steps already run. |
| **Grid cells** | Cells across the canvas. More cells resolve thin letters and finer fronts, cost time as the square of the count, and spread water a fixed number of cells a step, so a finer grid also spreads less far in canvas units. |

## Drawing

Recolouring, changing opacity, and turning treatments on or off never re-run the model. Bands, gain and front interval
rebuild only the geometry read from the finished steps. The layer is transparent.

| Controls | What changes on the canvas |
|---|---|
| **Pigment bands** | Draws the pigment on the paper as nested translucent fills. |
| **Color / Bands / Pigment strength / Opacity** | *Ramp* shades from the first palette color (thin pigment) to the second (dense); *single* uses the second. More bands give finer steps. Strength sets how dense pigment must be to read as dark. Opacity is that of the densest band. |
| **Include wet pigment** | Also draws pigment still floating in the water; off shows only what has settled. |
| **Drying fronts / Front interval / Front weight** | Contour lines (third palette color) at regular times: the order in which the sheet dried. Lines stay inside the wet region, never along its own edge. |
| **Water film / Film opacity / Film edge** | A pale sheen (fourth palette color) where water still stands, and a line along its advancing edge. Best while scrubbing early steps. |
| **Region outline / Outline weight** | The outline of the wet region itself (fifth palette color). |

## Using it in code

`wetPigmentSnapshots(model, seed, steps)` returns the cached, frozen snapshots of a `WetModel`; `stateAt(snapshots, k)` reads any
step. The three treatments are `pigmentBands`, `dryingFronts` and `wetFilm`, each a function of one frame, and each consumer
(`pigmentFills`, `frontLines`, `filmSheen`) can be replaced by an ordinary callback in `drawWetPigment`. The wet mask can be a
supplied region (`{ kind: "domain", regions }`) in canvas units; the saved instrument names only the bundled masks, and binding a
user's own region or an image's value regions to a saved instrument is future host work.

## Limits

Elapsed steps × grid cells² is bounded (about a second of work at the limit); the error names both controls. Grid 96 at 360
steps is about a tenth of a second; grid 160 at 600 steps, with water still standing to the end, is about half a second.
