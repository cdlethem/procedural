# Wallpaper Motifs

Choose a plane symmetry group and one motif; the group repeats it across the canvas.
Marks are colored by which group operation produced them, so the symmetry is visible as
well as the repetition. The starting study is a p4g field of pinwheeling arrows with a few
instances knocked slightly out of place.

## Choose the symmetry

| Controls | What changes on the canvas |
|---|---|
| **Symmetry group** | One of the seventeen plane groups. The group decides which rotations, mirrors and glides copy the motif, and how many copies each cell holds (p1 has one; p4m has eight; p6m has twelve). |
| **Cell width** | The lattice edge length. Square (p4 family) and hexagonal (p3, p6 families) groups use this alone. |
| **Cell height** | The second lattice edge for the rectangular and centered groups (p1 through cmm). Hidden for the others, where it has no effect. |
| **Motif offset X/Y** | Where the motif sits inside the cell, as a fraction of the two lattice edges. Sit it on a rotation center or mirror line and copies coincide; move it off and the whole orbit appears. |
| **Center X/Y**, **Viewport width/height**, **Viewport margin** | The rectangle the pattern fills. Copies up to the margin beyond it are kept so edges do not look trimmed. |

These are construction edits. Changing the group or cell size changes which copies exist.
A pattern that would need more than 6000 copies is refused; enlarge the cell or shrink the
viewport.

## Break the symmetry

| Controls | What changes on the canvas |
|---|---|
| **Breaking density** | The stable fraction of copies that leave their exact place. Which copies break depends on their identity, so raising the amount does not change the chosen set. |
| **Breaking amount** | How far broken copies move, turn and rescale. |

## Replace the mark

| Controls | What changes on the canvas |
|---|---|
| **Mark** | Arrow, dot, rings or rosette on the same copies. The arrow has a head and a one-sided tail flag, so rotations, mirrors and glides are legible. Dots, rings and rosettes are round, so only their positions reveal the group. |
| **Mark diameter**, **Size variation** | Nominal size and a stable per-copy reduction. |
| **Petals**, **Interior opening**, **Line weight** | Rosette petals, ring/rosette opening, and stroke width. |
| **Instance retention** | Omit copies without moving the others. |
| **Palette** | Recolor by operation: the first color is the identity copy, later colors follow the group's other operations in a fixed order. |

## Try these

- p6m at cell width 190, arrow size 50: six pinwheeling arrows with mirror partners.
- pgg, cell 150 by 120: glide pairs that alternate direction row by row.
- p4m against p4g with identical settings: the same point group, but mirrors through the
  four-fold center versus glides.

```js
import { createInstrument, referenceComposition, wallpaperSites, atEach, motif } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("wallpaper-motifs"));
atEach(p, wallpaperSites(recipe.source), motif(recipe.mark, recipe.palette));
```

Each site carries a frame (position, radians angle, scale) and a `tone` naming its group
operation. A negative scale is a mirror across the site's own axis; a mark that draws
asymmetric geometry (like the arrow) shows it. Site ids are `wall:<i>:<j>:<operation>`, so
changing the margin adds or removes copies without renaming the rest. `wallpaperOperations`
lists a group's operations, derived from its generators by closure over the lattice.

The library does not create or clear a canvas. Lengths are canvas units; angles in site
frames are radians.
