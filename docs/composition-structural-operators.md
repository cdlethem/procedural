# Structural operators slice (W1 first batch)

Status: **in development, 2026-09-28. Not promoted, not in any release inventory.**
Recursive Cell Worlds, Ordered Disorder, Wallpaper Motifs and Fold Atlas build on the frozen
[reference slice](composition-reference-slice.md) boundary. Root has reviewed their rendered
output (defaults, seeds, all seventeen wallpaper groups, every fold map, control sweeps,
one map applied across released sources) and fixed what that review found. It has **not** yet
exercised them through the real Studio interface, layered them with other entries, or
reviewed responsiveness; those gate promotion.

## Development gate

Unreleased studies live in `developmentDefinitions`
(`packages/instruments/src/adapters/reference-composition-instruments.ts`), not in
`referenceDefinitions`. They are therefore absent from `definitions`, `metadata.json`,
`sources.json`, the shipped `guides/` directory and every package consumer inventory
(`npm run toolkit:local` in the private app builds the working tree with `--allow-dirty`, so
this is what keeps unfinished work out of its discovery). `createInstrument`,
`referenceComposition`, `drawInstrument` and `prepareInstrument` resolve them by id, so a
development view can enumerate `developmentDefinitions` and render them live.
Their source compiles into the package's `src/` and `dist/` but is not listed anywhere.

Their guides live in `packages/instruments/development/guides/`, which is not shipped: the
release builder requires the shipped `guides/` file count to equal the metadata guide count.

Promotion, once root has reviewed a study through the real interface:

1. Move its definition from `developmentDefinitions` to `referenceDefinitions`.
2. `git mv` its guide into `packages/instruments/guides/`.
3. Add its `metadata.json` entry (real title, description, category, `operationIds`,
   `source`, `sourceEntry`, `creativeReviewScope`) and regenerate `sources.json`.
4. Run the package tests and `tools/build_web_toolkit.mjs` (preview or release).

The working tree must build with `--allow-dirty` at every step; run that build before leaving
work in progress.

## Artist-facing brief

- **Recursive Cell Worlds (06):** a rectangle recursively divided into compartments, each
  filled by the region-quilt fillers (hatch, motifs, nested contour scores). Big quiet cells
  and dense small ones coexist; stopped or dropped branches leave open paper.
- **Ordered Disorder (07):** a regular lattice pushed out of order by a shared, spatially
  correlated field of displacement, rotation, scale and omission. Disorder fades from a focal
  region; anchors stay pinned; exceptions and anchors are colored by role.
- **Wallpaper Motifs (22):** a chosen plane symmetry group repeating one motif. Copies are
  colored by group operation so the symmetry is visible.
- **Contour Scores additions (04, released entry):** `phaseSpread` and `levelRamp`, both
  defaulting to zero. These change the released Contour Scores definition and are the only part
  of this slice visible to consumers today; with defaults they render as before.

## Frozen boundary and semantics

Types in `packages/instruments/src/composition/types.ts`.

- **`Site.tone`** (optional): a structural palette index. Stock marks use it instead of the
  per-site random hue, so color can carry structure. Wallpaper sets it to the operation index;
  lattice sets it to 0 (ordinary), 1 (exception), 2 (anchor).
- **Mirror frames.** `Site.scale < 0` reflects across the site's own axis after rotation:
  `atEach` calls `scale(|s|, -|s|)`. `CompositionSurface.scale(x, y?)`. The stock **arrow**
  (shaft, head, one-sided tail flag) is chiral, so mirrors and glides are legible; dots, rings
  and rosettes are round and reveal only positions.
- **Wallpaper.** Each group is a lattice family plus generators (rotation, mirror-across-x,
  translation in lattice-basis fractions). `wallpaperOperations(group)` is the **closure of
  the generators modulo the lattice**, so operation tables cannot silently omit elements;
  tests pin all seventeen point-group orders and the mirror/glide distinction (p4m has four
  mirrors through the four-fold center, p4g none). An instance is
  `(i + u)·a + (j + v)·b + A·anchor` with `A = R(θ)·diag(1, ±1)`. Ids are
  `wall:<i>:<j>:<operation>`; margin changes never rename copies. Square and hexagonal
  lattices use one edge length (`wallpaperUsesCellHeight`). Output is bounded (6000 copies).
  Symmetry breaking displaces/turns/rescales a stable, id-selected subset; raising the amount
  never changes the subset.
- **Lattice.** `latticeSites` returns every site with grid `origin`, disturbed `position`,
  `anchor`, `kept`, `exception`, `tone`. Disturbance samples seeded value noise at
  `(col/correlation, row/correlation)`, stretched (×3.2, clamped) because raw value noise
  clusters near 0.5. Amplitude is multiplied by a smoothstep falloff from the focal region.
  A site is an exception when omitted or past 70% of a stated limit. Zero amplitudes give the
  exact grid.
- **Cell trees.** `regionTree` returns a pre-ordered flat array of
  `{id, parentId, depth, bounds, seed, terminal}`. Each cut reuses the existing binary
  partition (`panelLeaves`, one cut, 8-cell grid) run on the node's own proportions: `LONGEST`
  is decided from the partition's grid shape, so node aspect is encoded in `columns`/`rows`.
  Ids are paths (`root/0/1`), so sibling bounds and seeds are independent of which branches
  survive. The root's children are never dropped by child retention. Total work is bounded by
  `boundNestedWork` before drawing.
- **Bead scores.** `Path.levelFraction` (0 first band, 1 last); `PathMaterialSpec.phaseSpread`
  (stable per-path phase offset) and `levelRamp` (bead scale `1 − ramp·levelFraction`).

## Checks

`packages/instruments/tests/composition-structural-operators.test.ts` (20 tests) covers:
group closure and orders, mirror semantics, orbit size per cell, id stability, non-square
extents and the instance limit, stable breaking, exact zero-disorder grid, spatial correlation
and omission runs, anchors/focus/tone, tree ordering and tiling, axis and bias behavior,
branch-omission stability, arrow chirality through a real transform stack, level ramp and
cross-path phase, and the development gate itself. Two mutations (root-children rule, level
ramp) were confirmed to fail their tests.

## Review record and open items

Rendered with a throwaway SVG surface under the native lease. First-pass defects found and
fixed: wallpaper colored per-site at random (unreadable symmetry); p4m/p4g tables listed 6 of
8 elements and p3m1/p31m mirror angles were wrong; glides ignored non-rectangular bases;
extent ignored height; disorder amplitude was tiny (noise clustering, quadratic falloff,
uncorrelated per-site factor); cell tree cut only horizontally at exact halves and could drop
half the canvas. Open before promotion: real-interface exploration of every control, layered
compositions in both orders, cancellation/responsiveness at large settings, and a decision on
whether the cell-world leaf fillers are distinct enough from Region Quilts to keep both.

## Fold Atlas (briefs 26/27 shape)

A coordinate-map **consumer**, separate from its grid source, so any sites or paths can be
folded. Guide: `packages/instruments/development/guides/fold-atlas.md`. Code:
`composition/warp.ts` (maps, `warpPoint`, `warpSites`, `warpPaths`) and `gridPaths`/`gridSites`
in `composition/sources.ts`.

- **Maps.** Eight documented maps on normalized coordinates `((x−cx)/r, (y−cy)/r)`:
  sinusoidal, swirl, fisheye, spherical (inversion), polar, handkerchief, waves, horseshoe.
  A stage blends the identity toward its map (`amount`); up to four stages run in order and
  the chain repeats `iterations` times. Order and repetition change the result (tested).
- **Singularity policy.** A point sent non-finite or beyond `bound × radius` is excluded. There
  is no clamping and no interpolation across a break: `warpSites` drops such sites;
  `warpPaths` subdivides to ≤ `segment` units and splits a path at an excluded vertex or at any
  step longer than `0.6 × radius` (fold seams, polar's branch cut). Parts are `<id>#<n>` and
  keep `level`, `levelFraction` and `tone`. Mapping is refused above 200,000 points.
- **Frames.** `warpSites` carries each frame through the map's finite-difference Jacobian:
  the axis follows the local direction, size follows `√|det|` (clamped 0.2–3), and a negative
  determinant mirrors the mark and sets `flipped`. It never rewrites `tone`; the Fold Atlas
  study colors flipped nodes itself. (An earlier version overwrote `tone`, which erased a
  wallpaper's operation colors under a fold; the composition render exposed it.)
- **Tone on paths.** `Path.tone` is optional like `Site.tone`; ink, stitch and bead materials
  use it instead of a random hue. The grid uses 0 for columns and 1 for rows so the two
  families stay distinguishable through a fold. Released contour paths carry none and render
  as before (verified).
- **Seed.** Grid irregularity blends regular line positions with the sorted draws of a seeded
  stream, so spacing clumps differently per seed while order and the edge lines are kept; at 0
  the seed changes nothing.
- **Not done.** No forward-density accumulation and no inverse raster sampling: the study maps
  vertices and marks only. Stretched image fragments (brief 27) need the asset foundation.

Tests: `tests/composition-warp.test.ts` (10) pin identity at amount 0, documented map values,
stage order/repetition, exclusion and path cutting at the pole, the seam/bound invariants over
all maps, fold mirroring with untouched tone, warping released Motif Ecologies sites and
Contour Scores paths, work limits, and grid irregularity. Mutating the seam break and the
fold mirror each fails a test.
