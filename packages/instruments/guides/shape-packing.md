# Shape Packing

Irregular pieces fitted into a container so that they lock together: letters nested in each other's
counters, leaves and blobs turned into each other's bays, polygons with holes stacked at the angle that
leaves the least room between them. The starting study is a mixed population in a round frame: a few
large pieces gather in the middle, medium ones tilt into the spaces they leave, and small ones follow the
curve of the edge, so size falls off from the centre outward and the paper shows only as thin, even
channels. Every piece is kept exactly `Gap` away from every other one, whatever its shape.

The layer is transparent and stays inside the container. Pieces that do not fit are not drawn and are not
an error: the library returns them as a list with the reason, and the coverage actually reached.

Five piece families ship with the instrument, all deterministic: **Letters** (the licensed outline font;
counters are holes), **Leaf shapes** (pointed, bent, lopsided, with serrated or plain margins), **Blobs**
(concave radial shapes), **Polygons** (L, T, U, cross, star, arrow, chevron, comb, bolt, crescent, frame and
donut, stretched at random) and **Mixed**. The **container** is a rectangle, an ellipse, a ring, the ink of a
letter or a leaf outline. Binding your own silhouettes or your own container to a Studio layer is future host
work; the library functions already accept any valid planar shape (see the end of this guide).

## How a piece finds its place

1. Pieces are taken **largest first** (or smallest first, or shuffled) and each is tried at every one of the
   **Rotations** angles (and mirrored, if allowed).
2. For each angle the search finds every place where the piece fits and touches something: the container's
   edge or a piece already placed. Among all of them the **Placement rule** picks the winner: nearest the
   middle, nearest the edge, or furthest in a direction. The first piece has nothing to touch, so the rule
   alone chooses where it starts.
3. The winner is checked exactly (not by bounding boxes): the piece must lie inside the container, and its
   outline, grown by half the gap, must not overlap any other. A hole in a piece is free space, so a smaller
   piece may sit in an A or a frame, unless **Counters** are solid.
4. The piece is then slid towards its rule and against its neighbours until it stands at the gap from them,
   so the search grid's slack disappears. Finer **Search resolution** finds narrower notches.
5. A piece that fits nowhere is retried smaller (**Retries** times, each at **Shrink per retry** times the
   previous size) and then reported as unplaced.

Nothing is truncated: if a setting would cost more than the search limit the drawing is refused with the
control to change.

## Controls

| Controls | What changes on the canvas |
|---|---|
| **Container** | The shape being filled. Ring and letter containers have holes that stay empty; the leaf is a curved, lobed outline. |
| **Container letter** | Which glyph is the container. Counters (A, B, R, 8, @) are holes. |
| **Ring hole** | Size of the ring's hole as a fraction of the outer ellipse. |
| **Center, Width, Height, Rotation** | Where the container sits, its box (a proportional pair; a different ratio stretches the container, never the pieces) and how far it is turned. |
| **Piece family, Letters** | Which shapes are packed, and which characters letter pieces use. A new seed re-deals every shape, size and, for letters, character. |
| **Pieces** | How many pieces are tried. More than fit is normal; the surplus is reported unplaced. |
| **Largest piece, Smallest piece, Small-piece bias** | The size range (longest side, canvas units) and how it is spread. A high bias gives a few large pieces and many small ones, which is what makes the hierarchy. |
| **Counters** | Open: smaller pieces may enter holes. Solid: holes are filled. Only for families that have holes. |
| **Order** | Largest first (strong hierarchy), smallest first (the big pieces may find no room) or shuffled by the seed. |
| **Placement rule, Settle direction** | Grow from the middle, follow the edge, or settle in a direction like pieces falling and stacking (0 right, 90 down, 180 left, 270 up). |
| **Rotations, Allow mirrored** | The angle set (equal steps around a turn): 1 keeps everything upright, 4 quarter turns, 8 or more tilt pieces into gaps. Mirrored variants double the search; mirrored letters read backwards. |
| **Gap, Edge margin** | Minimum distance between pieces, and between a piece and the container's edge or holes (a proportional pair). The gap is exact up to a 1/16 chord error of the rounded outlines. |
| **Search resolution** | Cells across the container in the search grid. Finer grids fit tighter and cost about the square. |
| **Retries, Shrink per retry** | How hard a piece that does not fit is pushed: retried smaller, then given up. Zero never resizes. |
| **Stop, Coverage target** | Try every piece, or stop as soon as the pieces cover a share of the container's area. |
| **Draw, Color by, Line weight** | Fill, outline, fill with ink outline, hatch, or fill / hatch / outline by piece tone. Color from size, placement order, angle or family; the first palette color is the ink, the rest are piece tones. |
| **Hatch spacing, angle, follows piece** | Line spacing and direction; when following, hatching turns with each piece and is anchored to it. At most 150,000 lines. |
| **Negative space** | A wash or an outline of the container minus every piece, derived exactly. |
| **Container outline** | An ink line around the container and its holes. |

Controls that only matter under another choice (the letter set, counters, the settle direction, the ring hole,
the container letter, the coverage target and the hatch controls) appear only under that choice, and their
hidden values never change the drawing. **Shrink per retry** matters only when Retries is above zero, and
**Line weight** only for outlines, hatching, the negative-space outline and the container outline; they stay
visible because a condition cannot be stated on a number.

## Try these

- The default: mixed pieces in an ellipse. Change the seed to re-deal the population; set **Placement rule**
  to *Follow the edge* for a ring of pieces around the wall that fills inward.
- **Piece family** *Letters*, **Rotations** 8: capitals nested in each other's counters. Set **Counters** to
  *Solid* to see the same letters unable to nest and the count of placed pieces fall.
- **Rotations** 1, **Container** *Rectangle*, **Piece family** *Polygons*, **Gap** 0, **Draw** *Fill and outline*:
  an upright masonry of interlocking pieces.
- **Container** *Letter* (S or R), **Largest piece** 60, **Smallest piece** 9, **Pieces** 220: a glyph filled with
  a texture of small forms, with **Container outline** on.
- **Placement rule** *Settle*, direction 90, **Container** *Rectangle*: pieces stack from the bottom edge.
- **Stop** *At a coverage target* 0.35 with *Follow the edge*: a few large pieces around a ring, deliberately open.
- **Draw** *Fill, hatch and outline by color* with **Negative space** *Outline*: three material treatments of one packing.
- Put this layer over or under an existing instrument: it is transparent, so *Outline* over a dot lattice or a
  contour field leaves both readable.

## Use the pieces yourself

Items and containers are resolved values, never URLs. A packing is a pure function of the container, the
items and the rules, and returns frozen values.

```js
import { customShape, customItem, packContainer, packShapes, packNegativeSpace, planarRegion } from "@procedurals/instruments";

const tromino = customShape("tromino", planarRegion({ outer: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]] }));
const container = packContainer({ kind: "rectangle", centerX: 320, centerY: 320, width: 340, height: 240, angle: 0 });
const packing = packShapes(container, [customItem("a", tromino, 200), customItem("b", tromino, 200)],
  { order: "largest", rule: "settle", settleAngle: 180, rotations: 4, mirror: false, gap: 0, margin: 0,
    counters: "open", resolution: 240, retries: 0, shrink: 0.8, stop: null });
packing.instances.length;   // 2: two 2 x 2 boxes cannot share 340 x 240, two interlocked L pieces can
packing.instances[1].angle; // the transform: position, angle (radians), mirrored, size
packing.unplaced;           // anything that did not fit, with its reason
packNegativeSpace(packing); // the container minus the pieces, as a planar domain
```

`shapePackingComposition(createInstrument("shape-packing"))` returns the whole recipe as JSON and
`drawShapePacking(surface, recipe, { piece, leftover })` draws it; a `piece` consumer replaces the stock
look and is called through `atEach` in each piece's local frame (origin at the piece's centroid, `scale` = ±size,
draw the normal-form shape `site.instance.item.shape.domain`), a `leftover` consumer replaces the
negative-space drawing. Each placed `region` is an ordinary planar domain, so it can be handed to any other
region technique (`hatchDomain`, `offsetDomain`, clipping). Palette, colors, drawing style, hatching,
negative space and the container outline never re-solve the packing or rename a piece (ids are `p<index>`,
stable for the same seed, family, letters, size range and bias whatever the count).

Limits: at most 600 pieces, 24 angles (48 with mirrors), search resolution 320, 8 retries and 60,000,000 search
steps, each reported with the control to lower when values are typed in; the sliders stop lower (100 pieces, 12 angles,
resolution 160, 3 retries, pieces up to 200 units) so that every slider at its end still prepares in about two seconds;
lengths are canvas units of the 640-unit reference canvas. The rule is greedy: it is not optimal and it does not
relax an existing layout. When a container is a plain rectangle and pieces are rectangles or circles, the
existing packed shapes and circle placement are cheaper and give the same result.
