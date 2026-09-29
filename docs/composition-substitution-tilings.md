# Substitution tilings (brief 23)

Status: **implemented on branch `w1/substitution-tilings`; reviewed from rendered output and package tests
only, not through the real Studio interface.** Guide: `packages/instruments/guides/substitution-tilings.md`.

## Producer

`substitutionTiling(options)` in `packages/instruments/src/composition/tilings.ts` turns an explicit rule,
a seed patch and a depth into a deeply frozen, construction-cached `Tiling`: oriented `tiles` with ancestry,
`vertices`, and deduplicated shared `edges`. The doc comment there states inputs, outputs, ownership, seed,
unit, failure and work rules. It reuses `componentSeed` and the `memoized` source cache; it adds no RNG,
coordinate or ownership semantics.

- **Rules.** `penrose-p3`: Robinson half-tiles (acute 36-72-72 and obtuse 108-36-36); acute → acute + obtuse,
  obtuse → acute + 2 obtuse; lengths scale by 1/φ per generation, areas by 1/φ². Two halves glue along the
  diagonal `BC` **with the same (B, C) order**; that pairing is what keeps parent boundaries crack-free (a
  swapped partner leaves T-junctions; the tests catch it). Seed patches: `sun`, `decagon`, `thick`, `thin`.
  `chair`: the L-tromino; the dissection of the 2×-inflated chair into four chairs is unique (found by search),
  slots 0..3 with orientation k, k−1, k, k+1. Seed patches: `chair`, `rectangle`, `block`.
- **Exact coordinates.** Penrose vertices are integer vectors over Z[ζ5] (division by φ is an integer matrix);
  chair vertices are dyadic binary64. Vertex identity is an exact string key: matching, deduplication and
  T-junction splitting use no tolerance.
- **Ids.** Piece ids are child-index paths (`p:seedPiece/slot/…`); tiles `t:<canonical piece path>`; vertices
  `v:<exact coordinates>`; edges `e:<a>|<b>`. They depend on rule and patch only, never on depth, radius,
  rotation, crop or appearance. A Penrose rhombus is named for its half with the smaller path.
- **Ancestry.** `path`, `lineage` (piece class per generation), `parentId`, `pieces`, `tileAncestorId`. Edges
  carry `level`: the first generation where the two sides' ancestries differ.
- **Frames.** A tile is a `Site` at its centroid (`angle` = tile axis, scale 1) with a local `outline`, so
  `atEach` places marks and fills; vertices are Sites; `tilingEdgePaths` publishes edges as `Path`s for
  `strokeWith`/`pathMaterial`.
- **Seeds.** Substitution is deterministic. The seed only names each element's chance stream.
- **Limits.** `MAX_TILING_DEPTH` 16; `MAX_TILING_PIECES` 40,000 (about 0.3 s Penrose, 1 s chair; measured). Uncropped
  requests fail before expansion from the exact piece-count recurrence; cropped requests prune subtrees that
  cannot reach the crop and fail once retained pieces exceed the limit. Drawing is bounded by the composition
  run's callback budget.

## Consumers

`tileFill` (flat, wash, hatch via `hatchRegionLines2D`, concentric via miter `insetPolygon`, or a `motif` sized
as a fraction of the tile), `tonedTiles`/`tileTone` (class, ancestor class, child slot, supertile),
`tonedEdges`, `selectedVertices`, and `drawTiling`. The instrument reaches them through
`referenceComposition` (`kind: "tiling"`), `drawReferenceComposition` and `prepareReferenceComposition`.

## Checks

`tests/composition-substitution-tilings.test.ts`: exact piece counts per generation, area and boundary
conservation against closed forms, exact single cover of the seed polygon by sampling, area scaling by φ² and 4,
tile frames and corner angles from geometry, chair class orientation, the seven legal Penrose interior vertex
configurations, deduplicated edges (Euler characteristic, no vertex inside an edge, perimeters), edge levels,
ancestry and id stability, crop and boundary policies, freezing and caching, validation and work limits,
hatching inside tiles, class omission, tones, and the named recipe. Five mutations (wrong subdivision leg,
dropped mirroring, chair child orientation, swapped glue labels, missing work preflight) each fail tests.

Not covered: real-interface acceptance, layered compositions, a portable (Java/py5/Android) contract. A
per-brief operation contract is not warranted while the computation is a p5 composition source; it would be
if a non-p5 target adopts it.
