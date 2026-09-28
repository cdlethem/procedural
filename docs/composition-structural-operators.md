# Structural operators slice (W1 first batch)

Status: **in implementation, 2026-09-28; unreleased**.
Recursive Cell Worlds, Ordered Disorder and Wallpaper Motifs are the next vertical slice of
the [release roadmap](next-release-roadmap.md), built on the frozen
[reference slice](composition-reference-slice.md) boundary. Briefs 01, 03 and 04 are
already covered by Motif Ecologies, Region Quilts and Contour Scores (this batch adds
the two remaining bead-score controls).

## Artist-facing brief

- **Recursive Cell Worlds (06):** nested compartments whose children have their own
  construction. A root rectangle is recursively subdivided with the existing seeded
  binary-cut policy; depth, minimum leaf size and selective stopping bound the tree;
  terminal leaves are filled by the existing region fillers, including nested contour
  scores. Stopping or omitting a branch must not reseed its siblings.
- **Ordered Disorder (07):** a regular lattice whose correlated displacement, rotation,
  scale and omission fields make omissions and local exceptions carry the composition.
  Zero disorder is genuinely ordered; anchored sites stay pinned; a focal region limits
  where disorder applies.
- **Wallpaper Motifs (22):** a stated plane symmetry group, lattice vectors and motif
  offset producing instance transforms, with an ordinary motif callback. Seventeen
  explicit groups with documented lattice and operation tables; boundary duplicates are
  eliminated consistently and the visible extent is a declared margin, not a guess.
- **Contour Scores additions (04 completion):** cross-path phase relationship (stable
  per-path spread around the global phase) and contour-band size mapping (beads grow
  toward the selected field extremes). Both are appearance-only and stable per path ID.

## Frozen boundary

Same file as the reference slice: `packages/instruments/src/composition/types.ts`.
Reuse `binaryCellPartition2D` (via the existing panel cut policy), the reference slice's
`atEach`/`inside`/`strokeWith` consumers, `regionFill`/`regionGeometry` for leaves, and
`gradientNoise2D01` for the correlated disorder field. Do not add a second lattice,
symmetry or subdivision implementation.

- **Wallpaper instances.** Each supported group is an explicit table of lattice basis
  vectors (rectangular, centered-rectangular, square, hexagonal from cell width and
  height) and operations (rotation angle, optional reflection, cell-fraction
  translation). An instance is `T(i·a + j·b + t_op) ∘ (S·)R(θ)` applied to the motif
  anchor. Fingerprint `(rounded origin, θ mod 2π, mirror)` eliminates exact duplicates
  (e.g. glide compositions equal to a rotation). IDs are `wall:<i>:<j>:<op>` in
  lattice coordinates, so culling or filtering preserves identities. Culling keeps
  origins within a declared `margin` of the 640-unit viewport. Symmetry breaking is a
  stable per-instance jitter selected by ID: selected instances receive a bounded
  position, rotation and scale deviation; the rest remain exact.
- **Mirror frames.** `Site.scale < 0` marks a reflection. `atEach` applies
  `scale(|s|, −|s|)` after rotation, i.e. a mirror across the site's frame axis;
  positive scales are unchanged. Rotationally symmetric stock marks (dots, rings,
  rosettes) are therefore unchanged by mirrors; the new asymmetric **arrow** mark makes
  rotations and reflections visible without custom code.
- **Lattice sites.** `latticeSites` returns every lattice site with its exact grid
  `origin`, the perturbed `position`, and `kept`/`exception`/`anchor` attributes.
  Perturbation samples the seeded value-noise field at `(col / correlation, row /
  correlation)` with independent channel offsets, so nearby cells share displacement
  and omissions form runs. Amplitude is multiplied by a smooth falloff from the focal
  region, so sites outside it remain exactly on the grid. Anchored sites (stable by
  ID) are never displaced or omitted. Zero displacement, rotation, scale and omission
  reproduces the exact grid.
- **Cell trees.** `regionTree` grows a pre-order, parent-before-children flat array of
  `{id, parentId, depth, bounds, seed, terminal}`. Each split reuses the existing
  binary cut policy (one cut per node, per-node seed `componentSeed(seed, id, "cut")`).
  A node stops at maximum depth, below minimum side, by stable selective stopping, or
  when its whole subtree is omitted by child retention. IDs are path strings
  (`root/0/1/0`), so sibling identity and seeds are independent of which branches
  survive. Total node count and expanded terminal work are bounded before drawing,
  with the same aggregate estimate as the reference slice's nested leaves.
- **Bead scores.** `Path` gains `levelFraction` (0 at the first threshold, 1 at the
  last) computed at source time. `PathMaterialSpec.phaseSpread` offsets each path's
  station phase by a stable per-path unit in `[0,1]`; `levelRamp` scales bead marks by
  `1 − levelRamp · levelFraction`. Both defaults are zero: identical pixels to the
  accepted reference artifact.

## Studio scope

Three new named layers (`recursive-cells`, `ordered-disorder`, `wallpaper-motifs`)
resolve through `referenceComposition` to the typed descriptors above; no new host
document fields. Recursive Cell Worlds reuses the region-quilt filler control groups, so
a terminal leaf can contain the same three-level nesting as a quilt leaf. Wallpaper
offsets are canvas units; group, cell size, margin and breaking are structural, while
mark substitution and palette stay appearance-only.

## Checks

- Exact grid at zero disorder; correlation: neighbor displacement change smaller than
  distant change; anchored and out-of-focal sites exactly on grid.
- Wallpaper: p1/p2/p4/p3/p6 orbit counts for an off-corner motif; mirror-invariant
  special positions do not double-draw beyond the group's genuine images; cache
  identity; stable IDs under margin changes.
- Cell tree: parent-before-child order, parent ID agreement, depth/min-size invariants,
  sibling stability under selective stopping, node/work budget rejection, and
  `regionGeometry` key agreement with a region-quilt leaf of equal bounds and spec.
- Arrow mark: rotation and mirror change the recorded draw sequence; dot/ring/rosette
  sequences are unchanged.
- Bead scores: phaseSpread/levelRamp are appearance-only (source cache identity) and
  stable per path.
