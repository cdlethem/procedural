# Wet Pigment (brief 09)

Status: **implemented on branch `w3/wet-pigment`, unreleased. Reviewed from rendered output only; not yet exercised through the real
Studio interface, layered in the app, or reviewed for responsiveness there.** It runs on the [stateful snapshots foundation](composition-snapshots.md)
(F7), the [planar domains](composition-domains.md) (F4) and the frozen [reference slice](composition-reference-slice.md) conventions.
Guide: `packages/instruments/guides/wet-pigment.md`. Code: `composition/wet-pigment.ts` (model), `composition/wet-pigment-draw.ts`
(treatments, composition, drawing), `adapters/wet-pigment-instrument.ts` (definition); tests `tests/composition-wet-pigment.test.ts`.

## Artist-facing brief

Blooms, backruns, pooling and drying fronts inside an artist-defined wet region. Drops of pigmented water land on (optionally
pre-wet) paper and spread; uneven paper soaks water out of the film and slows fronts; the region's edge dries first; pigment rides
the water and is left where the film thins or a cell dries. Late clear-water drops lift old pigment and push it outward. One stepped
model publishes water, floating pigment, deposited pigment and drying time, and three treatments read the same frame. This is a
**2D cellular model that produces the look, not physically accurate paint**, and it is not a blur of any source image.

## The model (frozen semantics)

Written in full in the header of `wet-pigment.ts`; the essentials:

* **Grid.** `grid` cells across the 640-unit canvas, `cell = 640 / grid`; a cell is in the wet mask iff its centre is inside or on the
  mask polygon (exact predicate). Fields are per-cell densities (water depth, pigment mass); totals are sums.
* **State.** `water`, `pigment` (suspended), `deposit`, `dried` (step the cell last ran dry, −1 while wet or never wet), accounting
  totals, the drop sites with birth-counter ids `site:n`, `settled`. Typed arrays; checkpoints copy them.
* **Update order** (fixed, per step *k*): (1) drops with `step === k`; (2) transport, three passes, each synchronous over the edges
  between wet-mask cells (right then down neighbour of each cell, ascending): water flux `m·D₀·(Wᵢ−Wⱼ)` plus an upwind tilt term,
  pigment advected with the water it leaves in (`P/W·q`) and diffused `m·κ·(Pᵢ−Pⱼ)` between two wet cells; an *open* boundary turns
  every link to a non-mask cell into a sink; (3) absorption then evaporation per wet cell; (4) a cell below the dry limit dries:
  the residue counts as evaporated and its suspended pigment is deposited; (5) settling and lifting from the values at the start of
  the stage; (6) `settled` = first step with no water and no drop due.
* **Dry cells** never emit, diffuse or lift. They change only by receiving water from a wet neighbour, so a front advances one cell
  a pass (three cells a step at most); a test asserts every change of a cell has water within three cells at the start of the step.
* **Stability by construction.** `D₀ = 0.1·transport`, mobility ≤ 1.25, `κ = 0.07·pigmentSpread`, tilt ≤ 0.1: the largest total
  outflow share of a cell in a pass is `4·1.25·0.1 + √2·0.1 + 4·1.25·0.07 = 0.99 < 1`, so no cell sends out more than it holds and
  nothing goes negative (asserted at six steps of each of six runs).
* **Accounting** (tested to 1e-9 relative): injected pigment = suspended + deposited + lost; injected water = surface + evaporated +
  absorbed + lost; `lost` is exactly 0 for a sealed boundary. An *open* boundary loses real pigment (55% in the checked
  configuration), so the edge-loss term has teeth.
* **Termination.** After `settled` the state is a fixed point and a step costs one work unit. `settled = −1` (never dries) is
  reported, not hidden. A wet mask with no cell, or one wholly off the canvas, is a valid empty picture settled at step 0.
* **Seeds.** Mask outline, paper porosity and drop places come from `componentSeed` / `ctx.stream(elementId, purpose)`. Site *k*'s
  place depends on the seed, *k* and the earlier sites only (tested: adding sites or backruns leaves earlier sites where they were).
* **Appearance never enters a key.** Palette, colour mode, opacity, bands, gain, fronts, film and outline are read at draw time from
  the frame; hidden controls (late-drop settings with Late water off, ring size for a blob, tilt direction with no tilt, paper grain
  with no variation, word for a blob) are normalised out of the model, so changing one is the *same snapshot object*.

## Values, ownership, units, failure

| Value | Type | Notes |
|---|---|---|
| `WetModel` | plain data | The construction: grid, mask spec, frame, paper, water, transport, pigment, backruns. No steps, no appearance. |
| `WetSnapshots` | `Snapshots<WetState, WetModel, WetFrame>` | Frozen, cached by construction + steps in a shared `SimulationCache` (3 entries). Checkpoint every 50 steps, history only at step 0 and the last (`historyEvery: 0`); read any step with `stateAt`. |
| `WetFrame` | frozen plain data + typed arrays | `water`, `pigment`, `deposit`, `dried`, `wetCells`, `settled`, `totals`. Typed arrays are private copies, read-only by convention. Units: canvas units for geometry, depth / mass per cell for fields, steps for time. |
| `WetEnvironment` | frozen | Mask domain, wet cells, porosity, edge distance, edges and sinks; cached by content. Owns scratch deltas that every step rewrites before reading. |
| `PigmentBands`, `DryingFronts`, `WetFilm` | frozen geometry | `PlanarDomain`s and composition `Path`s, cached per frame object (and per display level). |

Failures name the control: grid 24–256, steps ≤ 2000, `steps × grid²` work (below), `prewet` 0 or ≥ 0.005, tilt ≤ 0.1, bands ≤ 24,
front count ≤ 40 (names the interval), mask vertices ≤ 4000, word 1–20 printable ASCII. Nothing is thinned to fit.

## Treatments (same frame, three consumers)

1. **Pigment bands.** `bands` nested domains `{density ≥ L_k}`, `L_k = −ln(1 − k/(bands+1)) / gain`, from marching squares with linear
   interpolation on the density field carried two cells past the region's staircase edge and intersected with the smooth mask polygon
   (so pigment ends on the region's outline, not on a cell staircase). Cumulative opacity after band *k* is `opacity·k/bands`.
2. **Drying fronts.** Contours of drying time every `frontEvery` steps, clipped to the region shrunk by 0.8 cell; pieces under three
   cells dropped.
3. **Water film.** The domain where water stands and its advancing edge (same clipping).
Also the region outline. Every consumer is replaceable by a callback in `drawWetPigment`; the producers stay the same cached objects.

## Input contract

Instruments persist technique id, scalar params and palette. The instrument selects a **bundled** mask through a validated select
(blob, letters of six bundled words via `textDomain`, ring). The direct API and the typed descriptor also accept a **resolved region**
(`{ kind: "domain", regions }`, canvas units, ≤ 4000 vertices; the frame does not move it). **Binding a user's own mask, or the value
regions or type masks of a source image, to a saved instrument is future host work** (an asset field in the document); the
library never fetches or decodes. Feeding `labelDomains` / `maskDomain` output to a `domain` mask works today in code.

## Controls

By group (all groups in `controlGroups`):

| Group | Controls |
|---|---|
| Wet region | Wet region (select), Word (letters), Outline roughness (blob, ring), Island size (ring) |
| Placement | Center X, Center Y, **Size (proportional: Width, Height)**, Rotation |
| Paper | Paper variation, Paper grain, Absorbency |
| Water | Pre-wet, Drying rate, Edge (Edge drying, Edge reach) |
| Transport | Transport strength, Pigment diffusion, Tilt (Tilt, Tilt direction), Edge (sealed, open) |
| Pigment | Drops (Deposit sites, Site layout, Drop radius, Drop depth), Water per pigment, Deposit rate, Redissolve |
| Backruns | Late water, Late drops, First drop at, Gap between drops, Drop (depth, radius) |
| Simulation | Elapsed steps, Grid cells |
| Drawing | Pigment (toggle, color, bands, strength, opacity, include wet pigment), Drying fronts, Water film, Outline |

Conditional visibility (inline `visibleWhen`, drivers are selects/booleans): Word ← Wet region = letters; Outline roughness ← blob or
ring; Island size ← ring; the five late-drop controls ← Late water; each drawing treatment's controls ← its toggle. Numeric relevance
(tilt direction with no tilt, paper grain with no variation) cannot be stated by a conjunctive condition; those stay visible and the
model ignores them when they cannot matter. Only Width/Height is a proportional cluster: no other pair shares one unit.

Slider intervals against hard limits: steps 0–600 slider, 2000 hard; grid 48–160 slider, 24–256 hard; drop radius 20–120 slider, 1–1000 hard;
deposit rate 0–0.2 slider, 0–1 hard; every other control likewise (see the definition). The step and grid hard limits are the measured
work bound, not the numeric limit of the model.

## Bounds and measurement

Declared work = `4·grid² + steps·(4·grid² + 1)` cell updates, at most 100,000,000 (`WET_LIMITS.maxWork`); a step charges the actual wet
cells, so the bound is an upper bound. Stored values: 4 fields per cell per checkpoint (≤ 8,000,000 in checkpoints, 1,000,000 per state).
Measured on this machine (Node 22, null drawing surface; best of one run; **real steps**, no early settling, water standing to the end):

| Case | First preparation | Appearance-only edit | Display edit (bands/gain) | Structural edit | steps +10 / −25 |
|---|---|---|---|---|---|
| Default, grid 96, 360 steps (settles at ~200) | 102 ms | 1 ms | 15 ms | 48–59 ms | 9 / 7 ms |
| Grid 160, **600 steps (slider max)**, unsettled | 520 ms | 0–1 ms | 25 ms | 440 ms | 30 / 34 ms |
| Grid 200, 600 steps (hard-limit region) | 823 ms | 1 ms | – | – | – |
| Grid 256, 380 steps (hard limit) | 874 ms | 2 ms | 59 ms | – | – |
| Grid 256, 600 steps | refused: names steps and grid | | | | |

Preparation runs in 8 ms time slices with a yield to the host and cancellation checked before every step (`prepareInstrument`).

## Evidence

`tests/composition-wet-pigment.test.ts` (36 tests): analytic mask areas (ellipse, ring); cut and empty masks; evaporation and
absorption drying steps derived by hand (`0.503 − 0.01k`, `0.503 − 0.005k`) and their exact accounting; edge drying by ring
(step 13) against interior (step 50); exact water conservation with no loss terms; levelling to injected/cells in water and pigment; tilt
centroid drift along the tilt only; kernel volume `πR²·depth/3` and pigment = water/ratio; the settling law `(1−rate)^k`, and full
deposit on drying; lifting on/off; pigment and water accounting at six steps for sealed and open boundaries, three seeds; dry cells
zero at every step and changing only near water; pigment carried by water beyond its drop but never denser than the drop; no diffusion
into dry cells with frozen water; paper porosity range, mean, correlation and seed dependence; backrun lowers the deposit under the
drop and raises it farther out, same total; open edge loses pigment exactly as deposit is missing; `settled` is the first waterless
step and later steps are identical; a pending drop delays settling; site ids and prefix independence; `checkSimulation` for three
constructions; cancellation leaves no cache entry and does not change a later result; extension equals scratch; snapshot identity under
appearance edits and across the three treatments; each initial-condition edit gives another snapshot and field; hidden controls do not
change the snapshot; seed relevance; band level and opacity formulas and nesting; fronts inside the region and straddling drying time;
film area and emptiness; error messages naming controls; control groups, proportional cluster and visibility; drawing is transparent.

**Mutations proven to fail** (each by at least one test, restored afterwards): no deposit when a cell dries (4 tests); pigment not
carried by the water; pigment diffusing into dry cells; edge loss of pigment not counted (2); evaporation not accounted (2); never
settling (5); hidden late drops leaking into the model; paper ignoring the seed; absorbed water not removed (3); tilt sign flipped;
band geometry cache broken (appearance identity). The generic conditional-controls property test and control-group tests pass for
the new entry.

## Defects found by looking, and fixed

1. **Blobs had straight facets** (low harmonics dominated; a diagonal cut across the shape read as a clipped mask). Harmonics 3–7 with
   a gentler falloff: organic outlines for every seed checked.
2. **Pigment ended on a cell staircase at the region edge.** Contours of the density field followed the mask's raster cells. Fields
   are now carried two cells past the edge and the band domains intersected with the exact mask polygon.
3. **Pigment stayed a dot at its drop** (spread of about five cells; unreadably pale). Three transport passes per step, larger
   coefficients (with the stability bound recomputed) and re-tuned defaults: rims, backruns and coffee rings appear.
4. **Backruns were invisible** at the first defaults (lifting too weak, late drop too small, landing before the sheet had dried).
   Redissolve, late drop size and timing re-tuned; the default now shows pale discs with dark crescents.
5. **Stray red specks** from front pieces at isolated edge cells: pieces under three cells are dropped.
6. **Letters were unreadable** when edge drying dried the thin strokes before pigment arrived: guidance in the guide (lower edge
   drying, larger drops) and a letters sheet reviewed at 720 px.

## Images reviewed

Default at seeds 42, 7 and 1234567; early (40, 60), mid (150–160) and late steps with film and fronts; nine strongly different
structural settings (letters wet-on-wet, ring with rim sites and fronts, wet-on-dry heavy, tilt pooling, open edge, edge drying,
absorbent uneven paper, dilute wash, rotated rough blob); blob masks at three seeds and roughness 0.2/0.5/1; letters BLOOM and WET
(with film, rotated, outlined); the layered composition with the unmodified Dry Bristles and Sand Deposition in **both orders**. All by
the throwaway SVG surface, rasterised by headless Chromium under the native render lease; not the real interface.

## Open concerns

* One step spreads water up to three cells; a finer grid therefore spreads less far in canvas units (documented in the control).
* The paper's porosity acts on absorption and mobility only; there is no wicking through the paper.
* The density fills keep the zero-width "keyhole" cut for holes (as elsewhere): a hairline seam is possible on an antialiased canvas
  where a band has a hole; not observed in the SVG review.
* Numeric-driver visibility (tilt direction, paper grain) is not expressible; those controls stay visible.
* Saturation: with very heavy loads the top band covers everything (flat dark blot); that is the strength control's range, not a fault.
* Real-interface review, responsiveness in the app, and binding a user mask are not done.
