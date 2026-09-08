# Recreation cohort 01: evidence map

This is a bounded source-to-package assessment of exactly `ciscis002`, `momito`, and
`parapara`. It makes no whole-sketch support claim. Ordinary Processing drawing and layout
glue may surround accepted operations, but a defining algorithm absent from the package is
an unresolved recreation gap.

## Identity

The notes are the checked-in survey records. The PDE hashes are for the exact files read
with `git show HEAD:` from pinned upstream revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`.

| original | note SHA-256 | PDE SHA-256 | candidate IDs / candidate evidence SHA-256 |
| --- | --- | --- | --- |
| `2019/generativos/ciscis002` | `1119a49f706df79005fe52aaa0917e984d06af85bf05f165e864509d4d53bc45` | `d657226f831d9676144e2f63edd1b3d314eb4b20db1a7a0a067b6ba6d502015a` | `#0 quadtreeCells`, `#1 facadeBoxes`, `#2 lerpPalette`; evidence `63b2613d63f78e717a4291ba82c1ce02a9ff03285939ae7043ed529d5c804b38` |
| `2019/generativos/momito` | `d2109caf618f19f0a10fbfd70c164a0a4750abfc233cddab0612094eaf20b685` | `81fea5011da665addb98fc2ed167babddc795a1bc3543125db8171c6649332e9` | `#0 randomQuadtree`, `#1 delaunayWedgeMesh`, `#2 spikeBars`; evidence `b96d315dcd55192b24c673f341cbbf892217c37f9482db2c3769138a4a99ecc0` |
| `2019/generativos/parapara` | `ea08ea5cb8ca5d4c0c40796af45322f5d515755c990fad2c6fb40e22952f14fd` | `b9e72b24f1dfd28e13539fefeac8ac59c760203783d1684887b2057be014d548` | `#0 gradientStripes`, `#1 packPoints`, `#2 delaunayMesh`, `#3 ringGlow`; evidence `1a071b7b14b08b60ddd7d11f2b378dd6c6840d3e1bbf094dc4633f733fd6b440` |

All ten candidate records remain `review_required`/`unreviewed` in the current ledger.

## ciscis002: subdivision city

The source starts with a centred 960×960 rectangle and performs 100 replacements. Each
iteration selects `int(random(rects.size()*0.5))` from the first half, splits the chosen
rectangle into TL, TR, BR, BL quadrants, appends the four children, and removes the parent
(`ciscis002.pde:96-102`, `59-69`). This is structurally represented by reviewed
`QuadrantPartition2D` with `selectionFraction=.5`; its ordered bounds and creation IDs can
provide the leaf rectangles and centres. Exact source replay still diverges because the
catalog uses private xoshiro/binary64 arithmetic while the PDE uses Processing random and
float geometry. The source's `splits=100`→`30` change is large, but it does not establish a
portable range.

The leaf centres feed the third-party `Triangulate.triangulate` call (`105-112`). Reviewed
`Delaunay2D` supplies topology from caller points, detached faces and edges, but uses exact
binary64 predicates and canonical ordering. It has no source triangulator compatibility,
camera, clipping, height, or drawing state. The source then draws a random-height top and
three wall quads per face (`172-207`), followed by a stochastic 2-D window grid on each
wall (`210-233`, `268-299`). Orthographic camera, P3D lights and projection are renderer
glue. The literal face/wall emission can be authored as ordinary mesh drawing from triangle
vertices, but the height distribution, window subdivision, lit-probability stream, and box
footprints are defining source policies absent from the catalog. Thus ciscis002 is not
recreated by the two mapped operations.

## momito: biased relief and spikes

`momito` repeats the same first-half quadtree selection and quadrant order for 290 splits
(`momito.pde:94-100`, `59-69`). The result is **871 live leaves** (`1 + 3*290`), correcting
the note's approximate 1161. `QuadrantPartition2D` matches this selection structure, but
its private stream, binary64 bounds, and explicit selection arithmetic are not Processing
source replay. Leaf centres become `points`; a 90% random subset becomes `wirePoints` with
height `min(w,h)*.08*3.8` (`107-123`). The catalog returns bounds, so a drawing layer can
derive centres and local sizes, but it does not return the source subset or its random
state.

The active mesh triangulates `points` and emits exactly three triangles per face: one
sloped triangle and two triangles along one vertical edge (`145-169`). This is not a closed
extrusion. The nine-vertex per-face emission, camera, lights, and thin spike boxes are
ordinary scene mesh/drawing glue if written explicitly; they do not justify a universal
extrusion operation. However, source vertex order, the single colour selected before the
face loop, spike subset, rotation, and height policy remain source-specific. The source's
`delaunayWedgeMesh` and `spikeBars` candidates therefore have no complete catalog mapping.
Momito is not fully recreated.

## parapara: landscape, circles, and overlay

The horizon and two 1000-quad sky/ground stripe loops (`parapara.pde:42-117`) are direct
layout/drawing glue, but their `pow` spacing, random palette starts/drifts, alpha and steep
`pow(v%1,10.8)` colour easing are not the reviewed `CyclicPalette` semantics. That palette
operation interpolates opaque RGB24 channels with its own linear phase and quantization; it
has no easing or alpha. Reproducing the source treatment therefore needs authored drawing
helpers and a source-specific colour policy.

The 50-point loop uses `val=random(0,random(.98))`, depth-dependent `y` and radius, and
rejects a candidate when Euclidean distance is below `.6*(r+oldR)` (`138-160`). Reviewed
`CirclePlacements2D.filter` supplies the ordered radius-dependent exclusion predicate and
`seeded` supplies a different uniform rectangle/product-radius proposal stream. Neither
matches parapara's nested `val` distribution, horizon mapping, or source random order.
The filter can be used only after a caller independently constructs those proposals; that
constructor remains a missing source algorithm. The source's `pointCount` 50→150 change is
subtle and does not establish a general count range.

Reviewed `Delaunay2D` can replace the third-party triangulation for an independently
specified edge overlay, followed by ordinary line drawing. It does not reproduce source
face order or Processing float behavior. The triangle-centre stretched specks, annular
`arc2` glow/shadow, and source palette/alpha choices are also drawing glue plus missing
source-specific easing, not covered operations. Horizon, stripe, proposal, and overlay
semantics together leave parapara unsupported as a whole.

## Cohort result — root correction

Zero whole-original recreations have been demonstrated by this evidence review. That is
not zero potentially supported originals: exact source RNG/order compatibility is separate
from declared structural fidelity. Root's momito walkthrough maps the defining algorithms
to accepted operations and classifies its explicit face/box drawing as artistic glue, so
momito is plausibly supported and its recreation is now being implemented.

For ciscis002 and parapara, the remaining boundary assessment stays unresolved. A source
height distribution, palette phase remapping, alpha or proposal-coordinate formula is not
a missing reusable algorithm merely because no public function bears its name. Conversely,
custom overlap rejection or triangulation would be algorithmic gaps if copied into glue;
those computations already have package operations here. Do not count the other two as
supported until a complete composition walkthrough resolves their remaining drawing and
field semantics. No additional API is admitted by this cohort review.
