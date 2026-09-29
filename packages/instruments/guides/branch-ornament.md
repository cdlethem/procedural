# Branch Ornament

Grow a branching tree, then decorate it by what each part of it is. Blossoms open at the tips,
small joints sit where the branches fork, a ring marks the base, and pennants or leaves line the
stems, each with its own size, offset and angle. A separate ribbon outline follows the same tree.
The starting picture is a bare, wandering tree in ink with tapered stems, gold rosettes at its
tips, red dots at its forks and a row of arrows up the trunk; a new seed grows a different tree.

The tree itself comes from the attractor growth used by Attractor Growth: tips chase the nearest
unclaimed target point in a footprint you place, and split when they reach one. Everything
below the tree (marks, materials, colors, outline) only decorates it. **Changing a mark, a
material, the outline or the palette never regrows the tree**, so you can restyle a tree you like.

## What each part is

| Role | Where it sits | Its direction |
|---|---|---|
| **Base** | The start of each root tip. | The way the first branch leaves. |
| **Junction** | Where two or more branches leave one point. | The average direction of the outgoing branches. If they spread so wide that they nearly cancel (for example two branches a right angle either side), the direction the tree was travelling when it arrived. A junction always has a direction. |
| **Tip** | The end of a branch that grew no further. | The direction it was travelling. |
| **Flank** | Stations along the stems, every *spacing* units, on alternating sides. | The stem direction, turned away from it by the flank angle; the other side is mirrored. |

A branch is the whole run between two nodes. **Depth** counts the forks between the trunk and a
branch: the trunk is 0 and both children of a fork are one deeper.

## Grow the tree

| Controls | What changes on the canvas |
|---|---|
| **Attractor footprint**, **Attractors**, **Source disorder**, **Center exclusion**, **Ring thickness**, **Lobe separation / Left lobe share** | The region the branches grow toward and how many targets it holds. An area fills a blob, a ring makes a wreath with an open middle, two lobes make growth cross from one cluster to the other. Disorder loosens the regular angular spacing of the targets. |
| **Placement** (Source X/Y, extent, aspect, direction) | Position, size and tilt of the footprint. |
| **Roots** (count, X/Y, heading, spread, jitter) | Where growth starts. Several roots grow separate trees that compete for the same targets. |
| **Growth ticks** | How long the tree grows. A short run leaves tips spread around a frontier; running to exhaustion piles the last tips onto the last targets. This is the strongest control for sparse or full trees. |
| **Growth step**, **Consumption distance** | Length of each growth increment and how close a tip must come to claim a target. Larger steps make angular, open trees; smaller steps follow targets closely. |
| **Branches per tip**, **Branch spread** | How many branches leave a claimed target and how widely they diverge. One branch per tip gives a single vine with no forks. |

## Shape and draw the branches

| Controls | What changes on the canvas |
|---|---|
| **Branch routing** | **Grown** keeps every growth vertex, **smooth** rounds the corners, **straight** joins junction to junction, **octilinear** routes each branch with a single 45° elbow for a circuit-board look. The tree and its junctions do not move. |
| **Branch material** | Continuous ink, tangent stitches, or none (leave only the outline and marks). |
| **Branch weight**, **Weight falloff** | Trunk stroke width and how quickly it thins with each fork. |
| **Stitch spacing / phase / cross-branch phase** | Stitch rhythm along each branch. |
| **First / last visible depth**, **Branch retention** | Which branches are drawn: a depth window (raise the first to leave only twigs, lower the last to keep only the trunk and its first forks) and a stable random thinning that keeps the same branches as the value changes. |
| **Outline half-width, falloff, taper, weight** | A closed ribbon around every visible branch, widest at the trunk. Taper 1 narrows each ribbon to a point at the branch end for a blade-like look; taper 0 keeps parallel sides. Half-width 0 turns the outline off. |

## Attach marks

Each role has its own mark (none, dot, ring, rosette or arrow), size, line weight, petals,
opening and offset. Offset moves the mark along its own direction: positive pushes a blossom
beyond the tip or a flank mark away from the stem, negative pulls it back.

| Controls | What changes on the canvas |
|---|---|
| **Marks follow branches** | On: marks attach only to visible branches, and where you have hidden the deeper branches the cut end counts as a tip, so a pruned tree still ends in blossoms. Off: marks stay where the whole tree puts them, floating where their branch is hidden. |
| **Angle inheritance** | 0 keeps every mark upright; 1 turns each with its branch; in between blends along the shortest arc. Round marks show only their position. |
| **Size falloff** | Shrinks marks from the trunk (full size) toward the deepest fork. |
| **Size variation**, **Mark retention** | Stable random size variation and stable omission; marks keep their place as these change. |
| **Tip / Junction / Flank first and last depth** | Which depths receive that role's mark. Setting the junction window to depths 0–3 and the tip window to 4 and deeper puts joints on the trunk's early forks and blossoms only on the outer twigs. |
| **Flank spacing, sides, angle** | Distance between stations along a stem, whether they alternate, come in mirrored pairs or sit on one side, and how far each turns from the stem. |

## Try these

- **Sparse botanical fragment:** *Last visible depth* 2 with *Marks follow branches* on: a trunk and a Y of twigs, each ending in a blossom. Raise it to 5 with *Branch retention* 0.85 for a loose sprig.
- **Circuit ornament:** *Branch routing* octilinear, *Branch spread* 90, *Growth step* 16, *Weight falloff* 0.95, no outline, *Angle inheritance* 0, ring marks at the tips, dots at the junctions.
- **Stitched vine:** *Branch material* stitch, small ring flank marks in mirrored pairs on the first few depths, dot tips.
- **Blades:** *Branch material* none, outline half-width 9, taper 1, no marks.
- **Constellation:** *Branch material* none, no outline: only tips, junctions and base marks remain, hanging where the tree put them.
- **Wreath:** Attractor footprint ring, several roots along the bottom, ring marks at the tips.

## Use the pieces in code

The tree, its attachment sites and its outline are ordinary values you can draw with any mark
or material; the named instrument is these same functions.

```js
import { branchOrnamentComposition, branchTree, attachmentSites, branchOutline, visibleEdges,
  atEach, strokeWith, pathMaterial, createInstrument } from "@procedurals/instruments";

const recipe = branchOrnamentComposition(createInstrument("branch-ornament"));
const tree = branchTree(recipe.tree);                      // frozen, cached; ids stable for the same growth

// Blossoms at the tips, whatever mark you like:
atEach(p, attachmentSites(tree, { role: "terminal", minDepth: 0, maxDepth: 48, offset: 5,
  inherit: 1, falloff: 0.35 }), (surface, site) => surface.circle(0, 0, 14 * site.scale));

// The same edges as stitches, and as an outline layer:
strokeWith(p, visibleEdges(tree, { minDepth: 0, maxDepth: 48, retention: 1 }),
  pathMaterial({ ...recipe.edges.material, kind: "stitch" }, recipe.palette));
strokeWith(p, branchOutline(tree, { minDepth: 0, maxDepth: 48, retention: 1, width: 6, falloff: 0.8, taper: 0.9, tone: 3 }),
  pathMaterial(recipe.outline.material, recipe.palette));
```

Edges are `Path` values (`level` is their depth), and attachment sites are `Site` values with
`role`, `depth`, `owner` and a `tone` that names the role's color (trunk 0, fork 1, tip 2,
flank 3). `drawBranchOrnament(p, recipe, { edge, outline, marks })` swaps any consumer for your
own callback and keeps the rest. A tree is refused, with the growth's own message, if the
attractor and tick settings exceed its work budget; more than 30,000 flank marks is refused too.
The library never clears or creates a canvas, and every length is in canvas units.
