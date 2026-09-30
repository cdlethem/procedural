# Inversion Gardens

Circles, arcs and repeated shapes made by exact circle inversion. Inverting the plane in a circle turns
its inside out: a point at distance ρ from the centre goes to distance r²/ρ on the same ray, a circle
becomes a circle (or a straight line, if it passed through the centre), a straight edge becomes a true
circular arc, and every angle is kept while the orientation is reversed. This study uses those facts
rather than approximating them. The starting study reflects a letter R through the five circles that
cross the frame circle at right angles and touch their neighbours: the images are mirrored copies, each
one an odd or even number of inversions from the original, shrinking toward the rim as in a hyperbolic
tiling. Switch **Construction** to *Descartes gasket* for the other half of the study: circles packed
into the gaps between three mutually tangent circles, every radius exact.

It is not an orbital-curve preset and it does not call every recursive circle an inversion. The gasket
is built by Descartes' theorem (its steps are also inversions, in the circle through the other three
tangency points, and the tests check that); the group construction is inversion throughout.

The construction is one producer value. Colour, line style, fills, marks, the original's visibility and
the guides never move a circle: changing them redraws the same cached garden. Changing the construction,
its controls, Growth, Source, Placement, the curve tolerance or (when chance is in use) the seed builds a
new garden. Raising Generations adds elements and renames none.

## Choose the construction

| Controls | What changes on the canvas |
|---|---|
| **Construction** | **Descartes gasket** or **Inversion group**. The controls of the other one are hidden and change nothing. |
| **First circle**, **Second circle** | Gasket. The bounding circle has radius *Radius*; the first seed circle touches it and has that share of its radius; the second touches both and has that share of what the first leaves along a diameter. 0.5 and 1 is the classic gasket with integer curvatures −1, 2, 2, 3; smaller *Second circle* opens a wider gap on one side; 0.464 and 0.866 gives three equal circles. |
| **Circles** | Group. How many inversion circles (2 to 8). Each is named A, B, C… in order around the ring. |
| **Arrangement** | **Orthogonal to frame**: circles that cross the frame circle at right angles and touch their neighbours at Spread 1, so every image stays inside the frame. It needs at least 3 circles. **Ring**: circles of a chosen radius on a ring of a chosen distance, free to overlap. |
| **Ring radius**, **Circle radius** | Ring only, as shares of the frame radius. Keep circles apart (centre distance more than twice the radius) for a clean group; overlapping circles are allowed but the images then pile up and the size cutoff stops being exact. |
| **Spread** | Orthogonal only. 1 makes the circles touch: the reflection group of an ideal polygon, tiling the whole frame. Below 1 they separate and the images thin toward a Cantor-like dust. |
| **Twist**, **Jitter** | Turn the ring; wobble every circle's position and size (seeded, stable per circle). Jitter 0 keeps the symmetry. |

## Grow it

| Controls | What changes on the canvas |
|---|---|
| **Words** | **Every reduced word**: all sequences of circles up to Generations where no circle follows itself (an inversion applied twice cancels), n(n−1)^(g−1) images of length g. **Repeating word**: one image per step of the word you type, cycled: the image after `AB` is B(A(source)), so *AB* and *BA* differ and *ABC* and *ACB* march in different directions. |
| **Word** | Repeating word only: letters in the order applied. A letter may not follow itself, including from the last letter back to the first. |
| **Generations** | Gasket: rounds of gaps filled (generation g holds 2·3^(g−1) circles). Group: inversions deep. |
| **Minimum radius** | A circle or image region smaller than this many canvas units is not expanded further. In the tree, a word is cut when the disc that encloses all its extensions is smaller or misses the clip disc; with disjoint circles that loses nothing visible. |
| **Pole clearance** | Group. Source points that reach an inversion centre within this share of that circle's radius are removed, exactly, before they can be thrown to infinity. Nothing is clamped and no arc is stretched across the gap. It only shows where the source overlaps a circle's centre. |
| **Retention** | Share of gaps (gasket) or words (group) kept, drawn per address from the seed. A dropped gap or word takes everything inside it with it. |

## Choose the source (group)

| Controls | What changes on the canvas |
|---|---|
| **Source** | **Rings** (nested circles, which can be filled), **Polar net** (rings and spokes), **Grid**, **Letter** (a bundled outline) or **Wallpaper motif** (a p4g pattern of arrows over its cell grid). Straight edges become exact arcs; circles become circles. |
| **Density**, **Letter** | Rings/net circles, grid lines per direction, or wallpaper cells across the diameter; which letter (an asymmetric one shows which images are mirrored). |
| **Source size**, **Source X/Y**, **Source turn** | Radius as a share of the frame radius, offset from the middle, turn about its own centre. The source should sit inside the region left between the circles. |

Every straight edge maps to the arc through the images of its endpoints and midpoint, so the geometry is
exact; only the final sampling to polylines (Curve tolerance) approximates.

## Place it

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Radius**, **Rotation** | The middle, the gasket's bounding circle (and the frame circle the orthogonal arrangement crosses), and a turn of the whole construction. |
| **Clip radius** | The disc every result is cut to, as a share of the radius. Circles and arcs are cut exactly at its rim; a mark is never cut, so a mark whose diameter would cross the rim is left out. Every coordinate is inside this disc: there are no unbounded results, ever. |

## Draw it

| Controls | What changes on the canvas |
|---|---|
| **Line style**, **Line weight**, **Station spacing**, **Bead size** | Ink, stitch or beads along every arc. Stations follow arc length, so beads are evenly spaced around a circle. |
| **Curve tolerance** | Largest gap between a drawn chord and the true arc. Lower is smoother and costs vertices; it never moves an arc. |
| **Disc fill**, **Fill opacity**, **Rings per disc** | Fill each bounded disc (gasket circles, or images of a source circle): flat, or concentric rings. A disc that contains an inversion centre has an unbounded image and is not filled. |
| **Marks**, **Mark size**, **Mark weight** | A mark at each circle's centre (gasket: turned toward the tangency with its neighbour) or at each image of the source's anchors (group). Group marks grow and shrink with the map and flip when mirrored; arrows make that legible. |
| **Original**, **Construction circles** | The seed circles or untransformed source drawn fully, faintly or not at all; the inversion circles (or the gasket's dual circles, through the tangency points) and the clip rim as faint guides. |
| **Colour by** | **Generation**; **Size** (octave of shrinkage); **Branch** (subtree or last circle); **Orientation** (even or odd number of inversions, so mirrored images take the second colour). Entry 0 of the palette is the ink of guides and faint outlines; the others cycle. |

## Things to try

| Setting | Result |
|---|---|
| Starting study, Source *Letter*, Letter *k* | Mirrored copies of an asymmetric letter, alternating colour by generation. |
| Circles 3, Source *Rings*, Disc fill *Flat*, Colour by *Orientation* | An ideal-triangle tiling by nested discs; red discs are the same handedness as the original, blue are mirrored. |
| Circles 4, Source *Polar net*, Line style *Beads* | Nets of beaded circles pinched toward the rim. |
| Gasket, Second circle 0.3, Disc fill *Rings*, Colour by *Branch* | A lopsided packing in six colours, one per subtree. |
| Gasket, Retention 0.8, several seeds | Different gaps stay open; every kept circle is the same exact circle. |
| Words *Repeating word*, Word `AB` versus `BA`, Generations 12 | A chain of copies approaching the point where the two circles touch, on one side or the other. |
| Arrangement *Ring*, Ring radius 0.5, Circle radius 0.7 | Overlapping circles: a dense tangle bounded by the clip disc, with no coordinate lost to infinity. |

## As functions

The producers are ordinary functions; the instrument composes them.

```js
import { circleInversion, circleCline, invertCline, clineShape, apollonianGasket, orbitImages, orbitOptions,
  gardenProducts, inversionGardensComposition, drawInversionGardens, createInstrument } from "@procedurals/instruments";

// Exact images: the disc through the centre becomes the half plane x > 1/2 (normal −1, offset −1/2).
clineShape(invertCline(circleCline(1, 0, 1), circleInversion(0, 0, 1)));   // { kind: "line", nx: -1, ny: 0, offset: -0.5 }

// A gasket in unit-radius coordinates: signed curvatures are exact integers for this seed (the bounding circle is negative).
const gasket = apollonianGasket({ seed: 1, centerX: 0, centerY: 0, radius: 1, rotation: 0, first: 0.5, second: 1,
  generations: 4, minRadius: 1, retention: 1, maxCircles: 20000 });
gasket.circles.map((c) => [c.id, c.curvature]);   // O −1, A 2, B 2, C0 3, C1 3, C0.0 15, …

// The whole garden for the stored controls, drawn with your own mark:
const input = createInstrument("inversion-gardens");
const recipe = inversionGardensComposition(input);
drawInversionGardens(p, recipe, { mark: (surface, site) => { surface.circle(0, 0, 10); } });
```

`gardenProducts(recipe.garden)` returns the frozen `images`, `paths`, `discs`, `sites` and `guides`;
`drawInversionGardens` takes `{ stroke, fill, mark }` callbacks that replace the built-in path material,
disc fill and mark and receive those cached values unchanged. The instrument only names a bundled
source and a validated word; binding your own outline, wallpaper or pattern to a Studio layer is future
host work. Through the API, the pieces are plain data: `wordConstraints` returns each word's valid
domain in the source plane.

## Limits

Circles and images are bounded before drawing and a bound throws naming the controls to lower:
20,000 gasket circles, 6,000 images, 150,000 source pieces in images and 500,000 vertices. The slider
ranges stay well inside them; the hard limits do not (Generations 12, 8 circles). Overlapping inversion
circles are allowed, but then the group is no longer free, so images overlap and the size cutoff is only
a heuristic. The letter outlines are the bundled licensed font's unshaped Latin glyphs.
