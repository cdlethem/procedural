# Hyperbolic motif gardens (brief 24)

Status: **implemented on branch `w4/hyperbolic-gardens`, unreleased. Reviewed from rendered output and package tests only;
not exercised through the real Studio interface.** Guide: `packages/instruments/guides/hyperbolic-gardens.md`. It builds on
the frozen [composition boundary](composition-reference-slice.md) and [structural operator conventions](composition-structural-operators.md)
and is distinct from Wallpaper Motifs (Euclidean, wallpaper groups) and Fold Atlas (coordinate maps applied afterwards).

## What it is

A regular {p,q} tiling of the hyperbolic plane in the Poincaré disk, grown by exact reflection, published as cells, shared
geodesic edges, vertices, per-triangle motif frames and ring paths. Cells and marks shrink toward the boundary circle by the
disk's conformal factor; every mark is turned and reflected as the group moves it.

| Concern | Module | Reuses |
|---|---|---|
| Hyperboloid-model isometries, base triangle, mirror address, frame differential | `composition/hyperbolic-geometry.ts` | nothing (pure math) |
| Tiling growth, cutoffs, cells/edges/vertices, cell and edge paths, retention | `composition/hyperbolic.ts` | `componentSeed`, `memoized` |
| Motif frames (chamber images, exact dedupe) and ring chains | `composition/hyperbolic-frames.ts` | `componentSeed` |
| Composition value, consumers, hatching, sprig, preparation | `composition/hyperbolic-draw.ts` | `atEach`, `strokeWith`, `motif`, `pathMaterial`, `color` |
| Instrument, controls, groups, conditions | `adapters/hyperbolic-gardens-instrument.ts` | |

## Model and numeric policy

Points are on the hyperboloid `-x0² + x1² + x2² = -1`; the disk point is `(x1 + i x2)/(1 + x0)`. Isometries are real 3×3
matrices (reflection `X - 2<X,n>n`, orientation reversal is det −1), so composing, inverting and checking them is matrix
algebra. The base triangle has angle π/p at the cell centre O, π/q at a vertex V and a right angle at an edge midpoint M
(`cosh R = cot(π/p) cot(π/q)`, `cosh r = cos(π/q)/sin(π/p)`, `cosh(a/2) = cos(π/p)/sin(π/q)`); its three mirrors generate the
group with `(s1s2)^p = (s0s2)^q = (s0s1)² = 1`, and the 2p triangles per cell are its chambers.

Identity is never decided by comparing positions with a tolerance. The **mirror address** of a point is the word of mirrors
chosen by repeatedly reflecting it across the smallest-numbered base mirror that strictly separates it from the base
triangle; its length is the chamber's mirror distance from the base chamber, and points on a mirror give one address for all
chambers sharing them (exact dedupe of coincident copies). The test value `<X,n>` is exactly sinh of the signed distance to a
mirror; a point is on a mirror or at least 0.24 from it (measured over every corner of every {p,q} up to 24), against a
tolerance `2e-9·x0` and a measured rounding error near `1e-10·x0` (relative error of far points was measured near 1e-10 after
forty compositions). Limits keep that margin: disk radius ≤ 0.9999 (x0 ≤ 2·10⁴), canonical x0 ≤ 2·10⁶, refused with the control
named (the vertex/edge centre offset is subtracted). `<X,X> = -1` is not used to renormalise far points (cancellation).

## Frozen semantics

- **`hyperbolicTiling(options)`** → frozen, construction-cached `HyperbolicTiling`: `tiles` (Sites at cell centres: `angle` toward
  the base vertex, `scale` the conformal factor `1 − |z|²`, `generation`, `distance`, `sector`, `vertices`/`edges`/`neighbors`,
  outline `points`, `transform`), `vertices`, deduplicated `edges` (geodesic arcs sampled to 0.08 canvas units), `layers`
  (cells per generation), `candidates` (work measure). Seed-free geometry is shared between seeds.
- **Ids** `cell:<word>`, `vertex:<word>`, `edge:<word>`, `frame:<word>`, `ring:<around>:<k>:<chamber>`: the address in the canonical
  frame, so they depend on {p,q} (and the anchor or ring numbers) only, never on crop, generations, centre, rotation, placement,
  seed or appearance. Ring chains that grow when the region grows may take a smaller chamber address; closed rings keep theirs.
- **Cutoffs**, all declared: `generations` (edge-adjacency rings from the central cell set inside the kept region); `diskRadius`
  (all corners inside); `minSize` (canvas diameter of the smallest circle about the corner centroid that holds the corners);
  `MAX_HYPERBOLIC_TILES` 20,000 (an error naming Smallest cell, Disk radius, Generations, never a truncation). The kept region is the
  dual-connected component of the central cells inside these tests. Every kept cell tests at most p neighbours, so work is
  bounded by `p × cells` candidates (`candidates` reports it). An empty tiling is a valid result.
- **Centre** on a cell (p-fold), vertex (q-fold) or edge midpoint (2-fold): the seed cells are the one cell, the q around the
  vertex, or the two sharing the edge; generation 0 is that set. Rotation is degrees clockwise on the canvas; at 0 the base
  vertex axis points up.
- **`hyperbolicFrames(tiling, {seed, radial, along, minScale?})`** → one Site per chamber image of the anchor (`along` from V to M
  on the cell edge, `radial` from O to that point, both hyperbolic fractions). `angle` is the image of the base +x axis, `scale`
  the conformal factor, negative for chambers reached by an odd number of reflections (`atEach` mirrors the mark). Anchors within
  1e-9 of a mirror are on it: coincident chambers share one address and one frame is kept, the orientation-preserving one of least
  address (counts: centre → cells, vertex → vertices, midpoint → edges, on an axis or diagonal → p per cell, on the cell edge → 2 per
  edge). `minScale` drops frames the mark stop would omit anyway, before they cost anything; more than 60,000 is an error.
- **`hyperbolicRings`** publishes circles (or geodesic chords, `round` 0) around cell centres, vertices or edge midpoints as chains of
  chamber arcs joined at wall crossings by address (with the wall's label, since the word only names the chamber). Points shared by
  more than two arcs (touching rings at radius 1) end chains; chains open at the region boundary. More than 80,000 arcs is an error.
- **`retainCells(tiling, key, keep)`** restricts a tiling to chosen cells, recomputing vertices, edges and neighbours, keeping ids
  and generations. Retention in the instrument uses it, so edges, rings and frames of omitted cells vanish consistently.
- The drawing is transparent (no clear, no paper). Hatching is an even-odd float scanline over one simple polygon (linear in lines ×
  edges) because the exact hatcher is far too slow for thousands of cells with hundreds of vertices; it throws naming Hatch spacing
  above 1,500 lines in one cell. Line weights, station spacing and bead size follow `taper` per path by the conformal factor of the
  path midpoint (six bins per octave); motif strokes follow their own frame's scale.

## Controls, by group

| Group | Controls | Notes |
|---|---|---|
| Tiling | `p`, `q`, `center`, `generations`, `diskRadius`, `minSize`, `retention` | slider p 5–12, q 4–12 (so any slider setting is hyperbolic; type 3 or 7 to reach {7,3}, {3,7}), generations 0–10, disk .5–.999, smallest cell .5–12, motif size .05–.75 (so 0.75 × the largest edge at slider ends stays under the 500-unit motif limit); hard limits 3–24, 0–40, .001–.9999, .05–10000 |
| Placement | `centerX`, `centerY`, `radius`, `rotation` | no proportional subgroup (one length) |
| Cells | `cellFill`, `inset`, `opacity`, Hatch{`hatchSpacing`, `hatchAngle`, `hatchWeight`} | conditional on `cellFill` (inset/opacity: any fill; Hatch: hatched choices) |
| Edges | `edgeMaterial`, `edgeColor`, `edgeWeight`, Stations{spacing, phase}, Bead mark{`beadMark`, **Scale** (proportional: `beadSize`, `beadWeight`)} | conditional on `edgeMaterial` |
| Rings | `ringsAround`, `ringCount`, `ringRadius`, `ringRound`, `ringWeight` | conditional on `ringsAround` |
| Motif | `motif`, `motifColor`, Anchor{`anchorRadial`, `anchorAlong`}, `motifFit`, `motifWeight`, `motifTurn`, `petals`, `twigs`, `opening`, `motifVariation`, `minMark` | conditional on `motif` (weight: stroked; turn: arrow/rosette/sprig; petals: rosette; twigs: sprig; opening: rings/rosette) |
| Color | `colorBy` | left visible: relevance is a disjunction |
| Boundary | `limit`, `limitWeight`, `taper` | `limitWeight` on `limit`; `taper` left visible (disjunction) |

The shared control audit (`tests/helpers/audit-controls.ts hyperbolic-gardens`, 2,794 probes, 46 controls) reports **0
violations**, `minSize` dead where generations bind, and `taper` disjunctive (both left visible). A first run found `motifTurn`
mattering for dots and rings (the turn was applied to a symmetric mark); the turn is now not applied for them.

Seed use (`usesSeed`): retention strictly between 0 and 1, or a visible motif with size variation above 0. The default shows both
(retention 0.95, variation 0.25), so seeds re-deal the gaps and mark sizes.

## Checks (`tests/composition-hyperbolic-gardens.test.ts`, 24 tests)

Independent expected values: Euclidean and spherical {p,q} refused naming both controls; **cells and new vertices per generation
equal a purely combinatorial boundary-ring oracle** for {5,4}, {7,3}, {4,5}, {6,4} at all three centres (with literal
sequences pinned, {7,3}: 1, 7, 21, 56, 147 and 7, 28, 77, 203, 532; {5,4}: 1, 5, 15, 40, 105) and an **independent Poincaré
tiling grown by circle inversion** matches cell centres per generation and rotation; the mirror-chamber growth equals the
reflection group's **growth series** from Steinberg's formula (1, 3, 5, 8, 12, 16, 21, … for {5,4}) with address length equal to
BFS depth; Euler characteristic 1, valence, edge sharing and neighbour symmetry; every corner 2π/q by a Möbius angle construction
and every cell area (p−2)π − Σθ = π(pq−2p−2q)/q (Gauss–Bonnet) and again by Girard triangles; edges are circles orthogonal to
the unit circle or diameters, within the stated sampling tolerance and of the exact hyperbolic length; isometry composition
identities (group relations, `MᵀJM = J`, reflection across a shared edge maps a cell onto its neighbour); coincident-copy removal
(distinct cells ≥ 2 inradii apart, frame counts per anchor class, no two frames coincide); a frame's angle, mirror flag and scale
under reflection across an edge; conformal scaling; cutoffs, connected-component semantics against brute force, monotone ids;
consistency of a 2,000+ cell tiling near the rim at every centre; frozen and construction-keyed caching (appearance never rebuilds
a producer); rings as true hyperbolic circles and chord midpoints by `tanh m = tanh ρ cos(π/2p)`; analytic hatching; drawing calls
(mirrored frames give negative scale, transparent layer, replaceable consumers, taper); tones; control visibility and seed use.

Mutations proven to fail: mirror descent treating on-mirror as violating (19 tests), frame handedness sign (1), neighbour step
without the cell's own mirror (2), smallest-cell test removed (2), ring endpoints without their wall label (1), chamber dedupe
keeping the mirrored copy (1). Beyond the suite, a random stress of 565 configurations (p, q up to 12, all centres) and
extreme tilings for p, q up to 24 found no inconsistent tiling.

## Review record

Rendered through a throwaway SVG surface under the native lease (defaults, three seeds, six strongly different structures, sparse,
generation 0, dense, extreme {3,12}, combined {12,5}, tiny crop, and layered with Motif Ecologies, Wallpaper Motifs and Contour Scores
in both orders). Defects found and fixed: the exact hatcher exceeded its work limit and was unusably slow (replaced by a float scanline);
edges took a random hue per path (now ink or generation); NaN edge vertices deep near the rim from renormalising by `<X,X>` and a crop
test that passed NaN (removed; finite tests; the address and radius limits above); a {12,12} edge-centred tiling that lost its
topology at disk radius 0.99999 (limit lowered to 0.9999 with a measured margin); ring chains that never closed because a wall point's
address word does not say which wall it is on; sprigs invisible on a fill of their own colour (added Motif color); an edge sampler that
over-sampled diameters and under-sampled uneven arcs (adaptive subdivision to 0.6 × the tolerance); a frame budget that counted
marks the mark stop would have dropped (`minScale`). Large-cell tilings ({12,5}) show only the first cell at the default disk radius
because the crop needs every corner inside; the control's text says so.

Timing on the review machine (SVG surface, warm JIT, Bun/Node 22): default 15 ms to build the tiling (121 cells, 415 edges) plus 5 ms for
1,210 frames; first `prepareInstrument` 35 ms, drawing 16–30 ms; an appearance-only edit prepares in 1 ms; a structural edit ({7,3},
smallest cell 0.8) 32 ms; large settings {7,3} with smallest cell 0.3 and disk radius 0.9995 build 6,553 cells and 30,583 edges in
338 ms (plus 87 ms for 16,562 frames), {4,5} with 0.2 and 0.9999 17,597 cells in 532 ms. These are observations, not certified ranges.

## Boundaries and open concerns

- Klein and half-plane models are not offered: the Klein map is not conformal (a mark's frame there would be an approximation) and the
  half-plane has no natural finite window. They would be exact for points and curves; that partial coverage was judged worse than none.
- Real Studio interface, layered acceptance in the app, and cancellation during a ~1 s extreme build have not been exercised;
  producers are synchronous and bounded by the limits above, preparation yields between the tiling and the products.
- `taper` does not thin motif strokes (they follow their frame); hatch lines run at one canvas direction.
- The connected-component rule can drop a cell that fits but is reachable only through cells that fail; it is the declared semantics.
- `index.ts` gains one import pair, exports, a palette, and one line each in the definitions list, `canPrepareInstrument`, draw,
  prepare and `usesSeed`; no existing drawer changed, so existing drawings are unchanged. Merges with other briefs will touch the same lines.
