# Nodal Plates (brief 25)

Status: **implemented on branch `w4/nodal-plates`, unreleased. Reviewed from rendered output and package tests only;
not exercised through the real Studio interface, not layered in the app.** It is a composition under the frozen
[composition boundary](composition-reference-slice.md) and the
[structural operator conventions](composition-structural-operators.md). It is a **mathematical plate study, not a
validated vibration or fabrication simulation**: nothing here claims physical accuracy beyond the stated ideal model.

## Artist-facing brief

Particle-like concentrations and voids around the nodes of combined standing waves, in the family of the Chladni figures.
The artist chooses a plate (square, rectangle, disc), one edge condition, and up to four weighted, phased modes; the study
draws the nodal lines (exact zero set), an optional node band (the low-amplitude region as one shape) and grains drawn toward
the nodes. Consumers are replaceable: nodal paths take any path material, grains take any mark, the band is an ordinary planar
domain.

## Frozen input contract

Instruments persist a technique id, scalar params and a palette. The **library** defines the typed values:
`NodalFieldOptions` (with a `NodalMode[]`) in; `NodalField`, `Path[]`, `NodalSite[]` and a `PlanarDomain` out. The instrument
names only a plate, an edge and a short mode list through validated selects and numbers; no asset, URL or decoded file is
involved. Binding a user's own measured mode shapes or a recorded resonance to a Studio layer is **future host work**.

## Model (stated, not validated)

One boundary condition applies to the whole plate; the two are never mixed.

| | free (∂ψ/∂n = 0) | fixed (ψ = 0) |
|---|---|---|
| Rectangle W × H | cos(nπu/W)·cos(mπv/H) | sin((n+1)πu/W)·sin((m+1)πv/H) |
| Disc radius R | J_n(κ r/R)·cos(n(θ−orient)), κ = (m+1)-th zero of J_n′ (n = 0: m-th) | same with κ = (m+1)-th zero of J_n |

These are eigenfunctions of the Laplacian (a scalar membrane wave equation). A real plate obeys the fourth-order Kirchhoff
equation with different free-edge modes and frequencies, and sand on it follows physics not modelled here.

**Indices count interior nodal curves**, so `n`, `m` mean the same under both edges and never make a mode vanish: `n` lines
across the width (circle: diameters), `m` across the height (circle: circles inside the edge). Free `(0, 0)` is the uniform
mode; a plate of only that has no nodes and is refused. **Dispersion** is ω = c·k (membrane), so the frequency ratio of two
modes is their wavenumber ratio `k = π√(n′²/W² + m′²/H²)` or `κ/R`. **Snapshot:** mode i has coefficient
`w_i·cos(2π·time·k_i/k_ref + φ_i)` where `k_ref` is the smallest positive wavenumber among the listed modes; the field is
`u = Σ coefficient_i·ψ_i / Σ|w_i|`, so `|u| ≤ 1`, with the sign fixed so that the first sample within 1e-9 of the peak is positive
(lobe colours cannot flip when only a weight sign changes). Frequency ratio is therefore an output (`NodalResolvedMode.ratio`), set
by indices, width/height and time; on a square, swapped indices share a wavenumber and the pair is stationary, on a rectangle they
drift.

Special functions: Bessel J_n(x) and J_n′(x) by Bessel's integral with the trapezoid rule (geometric convergence for a periodic
analytic integrand): error below 1e-13 for |x| ≤ 100 against 80-digit series. Zeros by a sign scan from x = n and bisection.
Circle modes read the radial function from a cubic Hermite table (3,072 intervals over r/R ∈ [0, 1.75], exact derivatives): error
below 1e-8 for κ ≤ 80; beyond the table the exact integral is used. Every mode is scaled to peak magnitude 1.

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Bessel J, J′, zeros; rectangle and circle mode functions | `composition/nodal-modes.ts` | nothing |
| Field, grid, nodal paths, sites, bands, outline | `composition/nodal-plate.ts` | `marchingSquares2D` (the contour source), `contourChains`, `clipPaths`, `maskDomain`, `ringsDomain`, `domainIntersection`, `planarDomain`, `componentSeed`, `cachedBy`, `memoized` |
| Composition, consumers, preparation | `composition/nodal-draw.ts` | `strokeWith`, `atEach`, `pathMaterial`, `tonedMaterial`, `motif`, `color`, `keyholeRing` |
| Instrument, controls, groups, conditions | `adapters/nodal-plates-instrument.ts` | |

## Semantics

- **Grid.** A square cell `h = max(W, H)/resolution`, odd column and row counts so the grid is symmetric about the plate center, two
  cells of analytic continuation past the plate edge. Values, `peak` (max |u| over samples inside the plate) and the outline are
  frozen. `amplitude(x, y)` is analytic (NaN outside the plate); the grid is not interpolated for any decision except contour
  crossings.
- **Nodal lines.** Marching squares of the grid at 0 (the existing contour producer), non-branching runs handed to the existing
  chain assembler one entry each (a whole level in one call would trip its 2,200-segment pre-check on any plate whose lines
  cross), mapped to canvas coordinates, clipped to the plate with the exact planar clipper. Ids `nodal:<k>` in scan order; lines
  shorter than 0.75 cell are below the resolution and dropped. **Under a fixed edge the edge is a node by construction:** the edge
  contour of the continued field and the turns marching squares makes where an interior line meets it are removed segment-wise
  (both ends within 0.35 cell of the edge); an interior line that ends on the edge keeps its last segment. **Crossings** of two
  nodal lines are resolved to one cell: the curves touch or bounce at the crossing (standard marching-squares saddle), so which
  pieces join there is not meaningful; the point set is.
- **Sites.** Candidate j is uniform in the plate's bounding box from `componentSeed(seed, "cand:j", "site")` (one hash, three
  draws). Rejected outside the plate; accepted with probability `ρ = exp(−½(u/(τ·peak))²)` (0.61 at the band edge); rejected
  within `separation` of an accepted site (dart throwing with a spatial hash). The first `particles` accepted candidates in index
  order are the sites `grain:0…`, so raising `particles` only appends. Each site records `amplitude`, `proximity` ρ,
  `nodeDistance` = |u|/|∇u| (a first-order estimate, **not a bound**, and undefined at critical points), `lobe`, and `angle` = the
  nodal tangent (perpendicular to ∇u by central differences), `scale` 1.
- **Bands.** The grid read as a scalar raster of ρ (samples are pixel centers, threshold e^(−½): the exact |u| = τ·peak level)
  through `maskDomain` in contour mode, transformed to canvas and intersected with the outline. A single free mode `cos(πu/W)` has
  band area `H·(2W/π)·asin(τ)` (tested).
- **Ids, seeds, caching.** Field (construction key: shape, edge, placement, size, rotation, time, resolution, modes; orientation
  only for a circle, height only for a rectangle), paths (field, seed), sites (field, seed, tolerance, particles, separation) and
  bands (field, tolerance) are cached by construction and deeply frozen; nothing is keyed by palette, mark, material, opacity or
  retention. The seed derives the path and site seeds only; the field, lines and bands read no seed, the grains do (`usesSeed` is
  `particles > 0`). Structural edits may replace ids; appearance edits never rename or move anything (tested by object identity).
- **Failure and limits (named in the message).** Modes ≤ 8 (instrument 4); indices ≤ 24; resolution 16–480 and cells ≤ 300,000;
  particles ≤ 20,000; candidates ≤ 500,000. **A grain request the geometry cannot hold is not an error**: `nodalSiteSet` returns the
  sites found after the candidate limit with `requested`, `shortfall` and `candidates` (`nodalSites` is its `.sites`), so any combination of
  slider values draws; the sites returned are still the prefix a roomier plate would give. Errors (naming the control): grid cells,
  resolution, indices, all weights zero, modes that cancel at the snapshot (Weight, Phase, Time), contour assembly bounds (Line
  resolution and the mode indices). A plate of only the free uniform (0, 0) mode has no nodes and is a valid empty picture.

## Controls, groups and conditions

Groups: **Plate** (shape, edge, outline, outline weight), **Placement** (center, proportional *Size*, rotation), **Modes** (mode
count, time, four nested groups *Mode 1…4* of n, m, weight, phase, orientation), **Nodes** (node width, line resolution),
**Grains** (particles, separation, mark, proportional *Scale* of size and line weight, *Shape* of petals and opening, variation,
retention, colour, follow node), **Nodal lines**, **Bands**. Inline `visibleWhen`: height follows shape = rectangle; orientation
follows shape = circle; modes 2–4, and weight, phase and time of every mode, follow the mode count (mode 1's weight and phase and
time are ignored for one mode, so hidden values cannot change or invalidate the drawing); grain line weight follows ring/rosette/
arrow; petals follow rosette; opening follows ring/rosette; follow node follows rosette/arrow (for round marks the angle is not
applied, so the hidden control cannot change the fingerprint); line controls follow the line toggle and material; band opacity
follows bands; outline weight follows outline. The control audit (`tests/helpers/audit-controls.ts nodal-plates`, 2,527 probes, 51 controls) reports **0 violations** and no dead or disjunctive control. Slider intervals differ from hard limits (indices 0–10 vs 0–24, resolution 60–240 vs
16–480, particles 0–6,000 vs 20,000, node width 0.02–0.2 vs 0.002–1).

## Checks (`tests/composition-nodal-plates.test.ts`, 17 tests)

Independent expected values: Bessel J and J′ at eight points and thirteen zeros against an 80-digit Decimal series (not the code
under test); fixed modes vanish on the edge and free modes have zero normal slope (finite differences), peak 1, wavenumbers count
n+1 under a fixed edge; the Hermite table against the exact integral; a free rectangle mode draws n straight lines at (2j+1)W/2n
across the full height; a fixed rectangle draws lines at uW/(n+1) and no edge line (total length 1000, not 2400); circle nodal
circles at j₀,₁/j₁,₁ (free) and j₀,₁/j₀,₃, j₀,₂/j₀,₃ (fixed), diameters at 45° and 135° turned by the orientation with total length
4R; parity (−1)^n and (−1)^m of free rectangle modes, antisymmetry of a swapped pair on a square, and symmetry of its drawn
lines under transposition; coefficient formula and sign canonicality; exactly N grains with stable ids, prefix stability under
`particles`, seed dependence, identity of field/paths/sites under appearance edits and of the paths under a tolerance edit;
concentration statistic (site mean |u|/peak below 0.06 against a plate mean above 0.2 from a fine independent grid, under 2%
beyond 3τ) and the accepted-amplitude mean and in-band share of a single mode against numerical integration of the stated
density; separation, tangent angles, node-distance estimate and lobes; band area H·(2W/π)·asin τ; bound and error messages;
hidden controls never change a fingerprint and visible ones do; the seed matters only where grains exist. Mutations that each fail
at least one test: fixed edge counted n instead of n+1; inverted acceptance; free circle using zeros of J instead of J′; time
ignoring the wavenumber ratio; grid sign not canonical.

## Review record

Rendered through a throwaway SVG surface under the native lease: defaults on three seeds; strongly different structures (square
(4,7)−(7,4); three modes; a 580×320 rectangle with a time-drifted swapped pair; disc n = 6, m = 2; fixed disc (3,2)+(0,4);
rectangle n = 20, m = 14; disc n = 14, m = 6; fixed rectangle rotated 25° with bands; four modes with phases; free disc
(2,1)+(3,0) turned 30°); sparse (250 ring grains, stitched lines) and dense (6,000 grains at τ 0.02, separation 0) settings;
line-only sheets for fixed rectangle, fixed disc, free disc stitched, coarse resolution 60; bands with large Node width; beads
without grains; aligned arrows; and one layered sheet (a nodal disc with Motif Ecologies, Region Quilts and Contour Scores, each in
both orders). The images were read; the layered pairs differ subtly because the layers overlap little. Defects found and fixed:

1. Marching squares turned interior lines onto the edge contour under a fixed edge, so line pieces ran along the plate edge and
   reached the corner (found by a failing line-geometry test, confirmed on a lines-only render): edge segments are now removed
   segment-wise and the line cut there.
2. Root's real-interface run found every slider at its maximum refused to draw (1,511 of 6,000 grains fit). Refusal is now reserved for
   invalid values; an unmeetable grain request returns the grains found with a reported shortfall (and the candidate limit fell
   from 2,000,000 to 500,000, since the 2,000,000-candidate search took 3.2 s at four modes of index 10). Sliders' all-min, all-max and
   every single end are tested to validate and draw for each shape, edge and mode count. All-min sets free indices to (0, 0), the
   uniform mode, so that state became a valid empty picture instead of an error.
4. Near a crossing the marching-squares saddle leaves a small notch at thick line weights (visible on the default at weight 2.5);
   finer Line resolution shrinks it. Left as a documented limit rather than special-casing crossings.

Measured on the review machine (build plus first draw into a recording surface): default first draw 63 ms; appearance-only edits
1.8–2.9 ms (everything cached); structural edits: particles 22 ms, seed 28 ms, an index 34 ms, node width 9.5 ms. Large: resolution
240 with 6,000 grains 190 ms; resolution 480 105 ms; free disc n = 12, m = 8 at resolution 240 87 ms; four disc modes up to n = 14
90 ms; band fill of a rotated disc at resolution 480 about 1.0 s (the exact planar intersection dominates). These are observations,
not certified bounds. Circle n = 24, m = 24 at resolution 480 exceeds the contour-assembly bound and is refused with the controls named.

## Open items

- Real Studio interface exploration, layered review in the app and responsiveness were not done.
- Crossings of two nodal lines are one-cell saddles; a topology-aware crossing (exact junction vertices) is not implemented.
- A Separation that no longer fits is found by reaching the candidate limit (about 0.3 s), not predicted.
- Only the free and fixed scalar conditions exist. Kirchhoff free-plate modes, damping and measured shapes are outside this study.
