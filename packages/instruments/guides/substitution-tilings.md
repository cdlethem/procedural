# Substitution Tilings

A tiling that grows by exact substitution: every generation cuts each tile into smaller ones
that fit together with no gap and no crack, so structure repeats at every scale without ever
repeating in place. The starting study is a Penrose star, five thick rhombi around one point,
substituted five times, washed in watercolor and colored by which supertile each rhombus came from.
Two constructions are supported by name: **Penrose rhombi** (thin and thick rhombi; each
substitution scales lengths by 1/φ and areas by 1/φ²) and the **chair** (an L-shaped tile; each
substitution splits it into four at half size).

## Build the tiling

| Controls | What changes on the canvas |
|---|---|
| **Construction** | Penrose rhombi or chair. This decides the tile shapes and their number of classes: thin and thick, or four chair orientations. |
| **Seed patch** | What is substituted. Penrose: five thick rhombi around a point (sun), ten acute half-tiles around a point (decagon), or a single thick or thin rhombus. Chair: one chair, two forming a 2 × 3 rectangle, or four forming a 4 × 3 block. The seed's outline survives every generation, so it is the silhouette of the image. |
| **Depth** | Substitution generations inside the same seed patch. Each Penrose generation makes about 2.6 times as many tiles, each chair generation four times as many. Depth 0 is the seed itself. |
| **Boundary tiles** | Where the seed's outline cuts a rhombus in two, keep the leftover triangular half-tile (crisp outline) or leave it out (a ragged edge of whole rhombi). Penrose only; the chair has no half-tiles. |
| **Center X/Y**, **Patch radius**, **Rotation** | Where the patch sits, how far its farthest vertex is from its center, and its turn. Radius fixes the patch: raising depth subdivides it, never enlarges it. |
| **Crop**, **Crop center**, **Crop width/height** | Keep only tiles whose centers fall in a rectangle or ellipse. Tiles that cannot reach the crop are never built, so a huge patch cropped small stays cheap; move the crop center to pan across the tiling. |

These are construction edits. Tile counts are bounded: a request that would need more than
40,000 substitution pieces (a Penrose decagon at depth 9, a chair at depth 8) is refused; lower
the depth or crop. A drawing that would need more than 100,000 callback units (very dense tiles with
stitched edges and marks together) is refused as well.

## Choose what is drawn

| Controls | What changes on the canvas |
|---|---|
| **Thin / thick rhombi**, **Chair elbow NW/NE/SE/SW** | Draw or omit a tile class. Omitted tiles leave bare paper; edges and vertex marks follow the tiles that remain. |
| **Tile retention** | Omit tiles at random without moving any other. The set omitted at 0.3 is inside the set omitted at 0.6. |

## Interior

| Controls | What changes on the canvas |
|---|---|
| **Interior** | Flat paint, layered watercolor wash, hatching, concentric outlines, or one mark per tile. Every tile is drawn in its own frame (origin at its center, x along its axis), so hatch direction and marks turn with it. |
| **Color by** | *Class* colors by tile class. *Ancestor* colors by the class of the supertile a tile came from. *Slot* colors by which child of its parent it is. *Supertile* gives every supertile its own color; a new seed reshuffles them. |
| **Ancestor level** | How many generations up the color is taken from: 1 is the parent, larger values group tiles into ever bigger supertiles. |
| **Inset**, **Opacity** | Clearance between interior and tile edges; paint strength. |
| **Wash bleed**, **Wash layers** | How far each translucent layer wanders from the outline, and how many build up. |
| **Line spacing**, **Hatch angle**, **Turn per class**, **Line weight** | Hatch or concentric-outline geometry. The angle is relative to each tile's own axis; the per-class turn makes thin and thick tiles hatch in different directions. |
| **Tile mark**, **Mark size** and shape controls | A dot, ring, rosette or arrow at every tile center, turned with the tile (the arrow shows orientation). Size is a fraction of the tile's own size. |

The first palette color is reserved for ink (edges, vertex marks); fills use the others.

## Shared edges and vertices

| Controls | What changes on the canvas |
|---|---|
| **Shared edges** | Every shared edge is drawn once: around the tiles drawn, around every tile (including omitted ones), or not at all. |
| **Edge color** | Uniform ink, or hierarchy: the coarsest boundaries (the outline and seed-piece borders first) take the accent colors in order and finer edges stay ink. |
| **Edge material**, **Edge weight**, **Station spacing/phase**, **Cross-edge phase** | Ink, stitches or beads along each edge. |
| **Size ramp by level**, **Bead** controls | Beads shrink on finer edges, so coarse supertile boundaries read as larger beads. |
| **Vertex marks**, **Vertex mark**, size and shape | Mark all tile corners, only interior ones, or only regular vertices, where equal corners close the turn: the Penrose sun (five 72° corners) and the chair's four-right-angle points. Marks are colored by how many corners meet. |

## Try these

- Decagon, depth 6, flat fills colored by class, hierarchy edges: two-tone rhombi with the coarse structure traced in color.
- Thick seed, depth 7, ancestor level 3: a single rhombus grown into a fragment, with the sun vertices marked.
- Chair block, depth 3, hatch with a turn per class of 45°: four orientations hatched four ways.
- Decagon at radius 600, ellipse crop 520 × 420, tile marks (arrows): a window onto a larger tiling, every tile's orientation visible.
- Thick rhombi only, retention 0.5, edges *all* with beads and a size ramp: the omitted tiles' outlines stay as a faint scaffold.

```js
import { createInstrument, referenceComposition, substitutionTiling, tilingEdgePaths, atEach, strokeWith,
  tileFill, motif, pathMaterial } from "@procedurals/instruments";

const { source, view, palette } = referenceComposition(createInstrument("substitution-tilings"));
const tiling = substitutionTiling(source);
atEach(p, tiling.tiles, tileFill(view.fill, palette));                // interiors, in each tile's frame
strokeWith(p, tilingEdgePaths(tiling), pathMaterial(view.edgeMaterial, palette)); // each shared edge once
atEach(p, tiling.vertices.filter((v) => v.regular), motif(view.vertexMark, palette));
```

A tile is a site at its centroid: `angle` is its axis, `outline` its polygon in the local frame, and
`corners` its interior angles in units of one turn ÷ `unitsPerTurn` (10 for Penrose, 4 for the
chair). Ancestry is in `path` (seed piece, then the child slot at each generation), `lineage` (the
piece class along the path), `parentId` and `pieces`; `tileAncestorId(tile, generation)` names any
ancestor. Ids are child-index paths, so they depend on the construction and never on depth, radius,
rotation, crop or appearance: a coarser tiling's vertex ids all reappear in a finer one. A Penrose
rhombus is two Robinson half-tiles glued along a diagonal and is named for the half with the smaller
path; a half-tile left alone at the seed boundary has `complete: false`. Vertices are exact ring
coordinates (`v:…`), and edges are split at T-junctions, so no two edges overlap. `level` says where the
two sides' ancestries diverge (0 = outer boundary or different seed pieces). The tiling itself is
deterministic; the seed only names each element's stable chance (retention, supertile colors, wash
wander). Any callback can replace `tileFill`, `pathMaterial` or `motif`; the library does not create
or clear a canvas.
