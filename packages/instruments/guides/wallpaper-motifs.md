# Wallpaper Motifs

A stated plane symmetry group stamps one motif across the plane. Seventeen groups with
explicit lattices and operation tables produce instance transforms; a motif callback draws
at each instance. Symmetry breaking selects a stable subset of instances and displaces them
without changing any other instance.

## Choose the group

| Controls | What changes on the canvas |
|---|---|
| **Symmetry group** | One of the seventeen plane groups. Each group defines a lattice and a set of rotations, mirrors, and glide reflections. p1 is pure translation; p2 adds 180° rotation; p4/p6 add square/hexagonal rotation; mirror groups add reflections. |
| **Cell width**, **Cell height** | Lengths of the two lattice vectors in canvas units. For p3/p6 groups the cell height derives the hexagonal basis; for p4 groups width and height should match. |
| **Center X/Y**, **Width**, **Height** | Position and size of the pattern domain. Instances are culled to a declared margin around this domain. |
| **Motif offset X/Y** | Fractional position of the motif within its unit cell. Off-corner offsets make each group's orbit visible as multiple copies. |
| **Viewport margin** | Extra canvas units past the domain edge where instances remain visible. |

These are construction edits. Changing the group or cell size reshuffles the lattice.

## Break symmetry

| Controls | What changes on the canvas |
|---|---|
| **Breaking amount** | Bounded position, rotation and scale deviation applied to selected instances. |
| **Breaking density** | Stable fraction of instances that break. The subset is chosen by each instance's ID; changing breaking amount does not change which instances break. |

## Replace the mark

| Controls | What changes on the canvas |
|---|---|
| **Mark** | Dots, concentric rings, radial rosettes, or arrows. Arrows make rotation and mirror visible. |
| **Mark diameter**, **Size variation** | Nominal size and stable per-site variation. |
| **Petals** | Radial strokes in a rosette. Ignored for dots and arrows. |
| **Interior opening** | Rosette center offset or ring thickness. |
| **Line weight** | Outline, petal and arrow stroke width. |
| **Instance retention** | Omit instances without moving the underlying lattice. |
| **Palette** | Recolor existing marks without rerolling positions. |

## Try these

- p4m at 82×82 cells with an off-corner arrow offset, 20% breaking density, and a muted earth palette.
- p6 with 70-unit hexagonal cells, rosettes of 6 petals, and full retention.
- pg with a half-cell glide, motif offset (0.25, 0.25), and arrows that show the glide direction.

```js
import {
  createInstrument, referenceComposition, wallpaperSites, atEach, motif,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("wallpaper-motifs"));
const sites = wallpaperSites(recipe.source);

atEach(p, sites, motif(recipe.mark, recipe.palette));
```

A mark receives `(surface, site, run)`. The consumer installs the site's frame
(translate, rotate, uniform or mirrored scale) then restores drawing state. Negative site
scale mirrors the mark across the site's frame axis; rotationally symmetric stock marks
(dots, rings, rosettes) are unchanged by mirrors, while arrows show orientation.

The wallpaper source supports all seventeen plane groups with explicit lattice bases and
operation tables. Instance IDs are `wall:<i>:<j>:<op>` in lattice coordinates, so
culling preserves identities. The source caches by parameter value; repeated calls with
equal parameters return the same array reference.

The library does not create or clear a canvas. Source options use canvas units. Instances
are culled to a margin around the domain. No general mask editor is provided.
