# Drainage and Erosion

Branching rivers on a landscape that the water has been shaping. The starting picture is a tilted, rough slope draining to the bottom edge after
120 steps of erosion: tapering blue rivers gather from fine headwater branches into a few trunks, each drainage basin is tinted, contour lines
(every fifth heavier) bend upstream into the valleys the rivers cut, low hollows that had to be filled are drawn as lakes, and pale and shaded
polygon bands light the relief from the upper left. Drag **Erosion steps** and watch the valleys deepen and the network organize itself; at
0 you see the land before any water touched it. A new seed is a different landscape (different noise, storms and bedrock) with the same construction.

All the treatments read **one simulation**, so contours, rivers, basins, lakes and shading always agree. Recolouring, changing the line weights,
choosing another stream material or moving the light never re-runs the erosion; changing the water, the rock or the steps does.

## How it is built

1. **Height grid.** The land is a grid of square cells (the **Resolution** control is cells across the longer side), started from a chosen landform
   mixed with seeded fractal noise. The land falls to base level toward the outlets, which stay at base level for good.
2. **Fill depressions.** Hollows with no way out are filled to their spill level (Priority-Flood; ties go to the cell queued first), so every
   cell has a strictly lower neighbour and water can always reach an outlet. The filled hollows are the lakes.
3. **Route and accumulate.** Each cell sends its water to its steepest neighbour (eight directions, diagonals count `1/√2`). Rain accumulated
   downstream is the drainage area.
4. **Erode and deposit.** Every step lowers a cell by `K · A^m · S^n` (area `A`, slope `S`, never below the cell it drains to), carries the
   material downstream, and drops a share of whatever the flow cannot carry. Uplift and hillslope creep act in the same step.
5. **Extract.** Cells that drain more than the **Stream threshold** share of the map are streams, forming a directed graph (sources, confluences,
   mouths, reaches, Strahler orders). Basins are the land draining to each river; contours are marching squares of the height; shading is the
   slope lit from a direction.

This is a 2D model of the transport and update relationship, not a calibrated landscape-evolution code; the grid resolution changes what can be
resolved and is not a cosmetic setting. Mass follows the model: what is uplifted minus what is eroded plus what is deposited is the change in
volume, and what is eroded minus what is deposited leaves through the outlets.

## Terrain

| Controls | What changes on the canvas |
|---|---|
| **Landform** | The starting land: a rounded *dome*, a *ridge* down the middle, a tilted *plane*, an *escarpment* (plateau above a plain) or *noise only*. |
| **Roughness** | Mixes fractal noise into the landform. More noise gives many small catchments and hollows to fill; none leaves the smooth shape (hidden for noise only). |
| **Relief** | Height of the land as a fraction of its longer side. Steeper land carves deeper. |
| **Noise scale / Noise detail** | Broad hills or many small ones; how many finer octaves add ridges and hollows. |
| **Outlets** | Where water leaves the map: all edges, the bottom edge only (other sides are walls), left and right, or one cell. The land ramps down to base level toward an open side. |
| **Resolution** | Cells across the longer side. Streams cannot be thinner than a cell; erosion and creep are per unit area. Cost grows with its square and with the steps. |
| **Center X/Y, Width/Height** | Place and size the map. The longer side is exact; the shorter snaps to whole cells. Width and height scale together as one edit. |

## Water and bedrock

| Controls | What changes on the canvas |
|---|---|
| **Rainfall** | Uniform, a *gradient* wetter toward one side, or seeded *storms*. Total rain is the same in every mode. |
| **Rain contrast / Wet side / Storms** | How strongly rain varies, which way it increases (gradient only) and how many wet patches there are (storms only). Wetter catchments carve deeper. |
| **Bedrock** | Uniform, warped parallel *layers* of hard and soft rock, or hard *blobs* in soft rock. Rivers cut soft rock and turn along hard bands; hard cores survive as hills. |
| **Hardness contrast / Bedrock scale / Band direction** | How much harder hard rock is, how many bands or blobs, and which way bands run (layers only). |

## Erosion

| Controls | What changes on the canvas |
|---|---|
| **Erosion steps** | How long the water has worked. 0 is the starting land. Scrubbing reuses earlier steps: more steps extend, fewer replay from a checkpoint. |
| **Erodibility / Area exponent / Slope exponent** | Stream-power strength, how much big rivers cut compared with headwaters, and how much steep reaches cut compared with gentle ones. |
| **Uplift** | Rock raised each step, so relief survives; none wears the land toward a plain. |
| **Hillslope creep** | Diffusion that rounds ridges and softens fine valleys. |
| **Deposition / Carrying capacity** | How much of the excess sediment is dropped each step and how much a flow can carry; deposition builds fans and fills lakes (capacity is hidden effect when deposition is 0). |

## Drawing

Every treatment is a separate switch; each is transparent, so the map can sit over or under any other layer. Palette: the first colour is the ink
(contours, divides, marks, shadow), the second the water (streams, lakes), the rest the basin washes.

| Controls | What changes on the canvas |
|---|---|
| **Contours, interval, index, weight, starting contours** | Contour lines every elevation interval; every *n*th heavier; optionally the pre-erosion contours fainter beneath, to show what the water removed. An interval too fine for the land is refused. |
| **Relief shading, light direction, light height, depth** | Polygon bands of light and shadow from the slope; flat ground stays clear. |
| **Streams, threshold, smoothing** | *Ribbon* tapers by the water carried; *ink*, *stitch* and *beads* draw the same reaches through the path materials, heavier for higher orders. The threshold also sets basins and marks. |
| **Ribbon width / Line weight / Spacing** | Widest ribbon; stream line weight; stitch or bead spacing. |
| **Basins, detail, wash, hatch, divides** | *Wash* tints each basin, *hatch* fills it with lines at its own angle, *divides* outlines the ridge lines between them. Detail 0 is one basin per river reaching an outlet; higher values also split off tributaries. Very small catchments merge into the basin downstream. |
| **Lakes, lake depth** | Shade the filled hollows above a depth. |
| **Marks, shape, size** | Dots, rings or arrows at sources and confluences, larger for larger rivers. |

## Using it from code

`drainageErosionComposition(input)` resolves the stored controls; `drainageErosionProducts(recipe)` returns the cached snapshot, the drainage,
the stream graph, the basins, lakes, shading and contours; `drawDrainageErosion(surface, recipe, consumers)` paints them, and any consumer
(contour material, stream drawer, shading patch, node mark) can be replaced by an ordinary callback. The pieces are also exported on their own
(`fillDepressions`, `flowReceivers`, `accumulateFlow`, `gridContours`, `analyzeDrainage`, `streamNetwork`, `drainageBasins`, `erosionSimulation`).
A host's own height raster or rain map is future host work: saved instruments name only the bundled landforms and scalar controls.
