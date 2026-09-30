# Region Stitch

Fill flat regions with thread the way an embroiderer would. The starting picture is a quilt of seven
patches, each stitched in its own colour and its own direction: tight rows of short stitches whose ends
are staggered like brickwork, a dark satin border zigzagging along every edge, a pale gutter between
patches, and windows the thread never enters. Under the fill, dark underlay stitches run across it, so
you can see threads crossing at the gaps. Nothing is painted behind the stitching: the paper (or any
layer below) shows through between the rows.

The instrument ships four kinds of region: the letters of a word, a lobed **blob** with a hole and two
separate islands, a **quilt** of patches (some joined into L shapes, some with windows), and the
connected **tone bands** of a bundled picture. They are chosen with **Regions**. Your own outlines, glyphs
and pictures are a future host feature: the library accepts resolved values (see the code section) but this
instrument's saved settings name only the bundled ones.

**The regions never change when you change the stitching.** Regions come from the Regions and Placement
controls; direction, stitches, underlay, outline and thread are built on top. Changing thread width,
colour, dashes or *Color by* does not move a single stitch. Changing spacing, stitch length, direction,
inset, the seam or the routing rebuilds the stitches, and only for the regions it affects.

This is a drawing of stitching, not a machine embroidery file: there is no pull compensation, thread
density unit, trim, colour-change or export format.

## How a region is stitched

1. The region is pulled in by **Region inset** (holes grow by the same amount, so they stay open; a region
   narrower than twice the inset disappears).
2. **Underlay** goes down first: along the edge, in rows across the fill direction, or both.
3. The **fill** rows follow the direction field. Each row is cut into stitches no longer than **Stitch
   length**; a stitch that would have to pass over a hole or out of the region is cut short instead.
4. An optional **crossing layer** runs over the fill at another angle.
5. The **outline** goes round every boundary (and every hole), starting and ending at the **seam**.

Thread is routed greedily: it continues from where it stopped to the nearest end of the nearest unstitched
row. Neighbouring rows are therefore stitched in opposite directions, the way a machine zigzags. When the
next row is farther than one stitch away or the way to it leaves the region, the thread simply ends there
(a trim). Separate regions and the far sides of holes get no stitch between them unless you ask for travel
stitches.

## Regions and placement

| Controls | What changes on the canvas |
|---|---|
| **Regions** | Letters, blob, quilt or picture tone bands. |
| **Word**, **Letter weight** | The word (the font's counters, the holes in R, A or D, stay open) and how much bolder the strokes are made, in canvas units. Strokes that then touch merge into one region. The font is light, so 4 to 8 suits stitching. |
| **Arrangement** | Re-arranges blob lobes, the quilt's cuts or the picture's parts, without touching the seed. |
| **Patches**, **Joined patches**, **Windows** | Quilt: about how many patches, the fraction that join a neighbour into an L or T, the fraction of the remaining rectangles given a rectangular hole. |
| **Source image**, **Tone bands**, **Smallest region**, **Leave lightest open** | Tone bands: which bundled picture, how many equal lightness bands, how small a region may be before its longest-border neighbour absorbs it, and whether the lightest band stays bare paper. |
| **Center X/Y**, **Width/Height** | Where the footprint is and how big. Width and height can be scaled together. Letters and pictures keep their proportions inside it. |

## Direction

| Controls | What changes on the canvas |
|---|---|
| **Direction field** | **Constant**: one angle. **Radial**: spokes from a center. **Swirl**: spokes near the center that curl outward. **Image**: follows a picture's edges and stripes. |
| **Angle** | Degrees, 0 along +x and positive clockwise on screen. For radial and swirl it turns the pattern from the spokes (90 makes rings); for an image it is the direction used where the picture has none. |
| **Center X/Y offset** | Radial and swirl: where the field is centered, as a fraction of the footprint. |
| **Twist** | Swirl: extra turn per 100 units of distance from the center. |
| **Field image**, **Field arrangement**, **Image direction**, **Direction smoothing** | Image field: which picture, its arrangement, how strongly the thread follows it where its structure is coherent (0 ignores it), and the length it averages directions over. |
| **Angle spread** | Turns each region's field by its own seeded amount within plus or minus this many degrees. 0 keeps one direction; about 60 gives a quilt of differently grained patches. Curved fields give each region its own curves. |

## Stitches

| Controls | What changes on the canvas |
|---|---|
| **Fill** | **Running**: rows cut into stitches of one length, staggered. **Satin**: each row is one long stitch across the shape (cut into equal parts only if longer than the bound). **Seed**: short stitches scattered like moss. **Mixed**: each region draws its own choice from the seed. |
| **Row spacing**, **Stitch length** | Distance between rows (the cell size of the scatter for seed stitches) and the longest stitch anywhere. The two can be scaled together. Connecting, outline and travel stitches obey the same bound. |
| **Stagger** | Running fill: how far the stitch ends in each row are shifted from their neighbours, from the seed. 0 lines every penetration up into columns; 1 scatters them. |
| **Scatter** | Seed stitching: 0 lies every stitch along the field; 1 lets each point any way. |
| **Region inset** | The gutter between neighbouring regions and the margin round holes, in canvas units. |

## Underlay, crossing layer and outline

| Controls | What changes on the canvas |
|---|---|
| **Underlay**, **Underlay spacing**, **Underlay inset** | None, edge (running stitches inside the boundary), cross (rows across the fill), or both; the spacing of the cross rows and how far inside the fill's edge the underlay stays. |
| **Crossing layer**, **Crossing angle**, **Crossing spacing** | A second layer over the fill, turned by this angle from it, at this spacing. Overlapping threads darken where they cross. |
| **Outline**, **Band width**, **Seam lap** | Running stitches with a penetration at every corner, or a zigzag satin band this wide inside the boundary; the lap is how far the thread runs on past its start, over itself. |
| **Seam position** | The extreme point of each boundary in this direction (degrees, 0 right, 90 down): where its outline and edge underlay begin and end, and where each region's stitching starts. |

## Routing and thread

| Controls | What changes on the canvas |
|---|---|
| **Region order** | Regions in label order, or always to the nearest unstitched region next. |
| **Show travel stitches** | Draws the jumps between separate threads as straight stitches (cut to the same bound). Off, nothing joins the gaps. |
| **Thread**, **Thread width**, **Dash spacing** | Continuous ink, dashes, or beads laid along the thread; its width; the dash or bead spacing. |
| **Color by** | **Region**: each region takes a palette color. **Tone**: the palette runs from the lightest tone to the darkest. **Row**: colours alternate from row to row. **Stitch**: every stitch draws its own colour from the seed. Underlay and travel use the first palette color; every other color goes to the fills. |
| **Outline and crossing color** | **Ink**: first palette colour. **Region**: the region's own colour. **Contrast**: the next colour. |

A new seed changes each region's turn (with **Angle spread**), the scatter and rule choice of seed and mixed
fills, the stagger and the crossing layer's stitch ends, and stitch colours in *Color by* stitch. A constant
field with no stagger, spread, seed stitching or crossing layer ignores the seed, and the instrument says
so.

## Try these

- **Quilt of patches:** the default; change *Arrangement* for other quilts, *Angle spread* 90 for more
  contrast between patches, *Fill* mixed for a moss patch or two.
- **Embroidered letters:** *Regions* letters, *Region inset* 1.5, *Outline* running, *Angle spread* 0.
- **Swirl:** *Regions* blob, *Direction field* swirl, *Twist* 120, *Angle spread* 0.
- **Satin sun:** *Regions* blob, radial field, *Angle* 0, *Fill* satin, *Row spacing* 2.6, *Stitch length* 18.
- **Stitched portrait:** *Regions* tones, *Direction field* swirl, *Twist* 40, *Region inset* 2.5.
- **Following the picture:** *Regions* tones, *Source image* landscape, *Direction field* image, *Image direction* 1.
- **Moss lettering:** *Regions* letters, *Word* THREAD, *Fill* seed, *Row spacing* 2.4, *Scatter* 0.6.
- **Crossed threads:** *Crossing layer* over, *Crossing angle* 75, *Thread* dashes.
- **Every jump shown:** *Show travel stitches* on, *Row spacing* 8.

## Use the pieces in code

Every stage is an ordinary function and returns a frozen value; the instrument is these same functions.

```js
import { planarDomain, stitchRegionsOf, stitchThreads, drawStitchProducts, regionBoundaries,
  strokeWith, pathMaterial } from "@procedurals/instruments";

// Any planar regions you built: outer rings and holes (or textDomain, maskDomain, labelDomains ...).
const regions = stitchRegionsOf(planarDomain([{ outer: [[40, 40], [400, 40], [400, 300], [40, 300]],
  holes: [[[160, 120], [280, 120], [280, 220], [160, 220]]] }], { id: "patch" }), { prefix: "patch" });

const products = stitchThreads({
  seed: 1, regions, origin: [220, 170], field: { kind: "swirl", angle: 0, twist: 60, centerX: 220, centerY: 170 },
  fill: { rule: "running", spacing: 3.2, length: 7, stagger: 0.5, scatter: 0, angleSpread: 0, inset: 4 },
  underlay: { kind: "cross", spacing: 12, inset: 2 }, crossing: { kind: "none", angle: 90, spacing: 8 },
  outline: { kind: "satin", width: 3, lap: 6 }, seam: -45, routing: { order: "nearest", travel: false },
});
// products.threads: ordered `StitchThread`s (id, role, region, points, order, ...); products.regions: labels and areas.
drawStitchProducts(p, products, { kind: "ink", weight: 1.7, dash: 5, colorBy: "region", trim: "ink" }, [0x2b2a33, 0xb8503a, 0xe0b458], 1);
// The same boundary drawn with any path material (beads here) instead of the built-in outline:
strokeWith(p, regionBoundaries(regions), pathMaterial({ kind: "beads", weight: 1, spacing: 6, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x2b2a33]));
```

`regionStitchComposition(input)` resolves the named instrument to a typed descriptor, `regionStitchProducts(recipe)`
builds its regions and threads, and `drawStitches(p, recipe, { thread })` replaces the ink, dash or bead material
with any callback that receives whole same-colour runs of stitches. Lengths are canvas units, angles degrees, and the
library never fetches or decodes an image or outline.
