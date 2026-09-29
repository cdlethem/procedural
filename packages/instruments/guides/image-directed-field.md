# Image Directed Field

Draw a picture as flow. The starting picture is a head and shoulders made only of evenly spaced fine lines:
they run around the hair, the collar and the lids and lips, ring the face in soft halos, and turn heavier and
darker where the picture is dark and paler where it is light. No line crosses another and none is drawn where
the picture has no structure to follow. Follow runs along edges and contours; **Resist** runs across them, so the
same portrait becomes rays leaving every edge; **Blend** follows the picture where its structure is strong and an
ambient swirl, spiral or constant angle where it is not, so flat areas fill with a chosen flow instead of staying blank.

The picture is one of four bundled samples (portrait, geometric scene, landscape, grain). A host can hand the
library its own decoded picture through the typed API; the instrument's saved settings name only the bundled ones.
**The lines never change the picture and the picture never changes the lines' material:** recolouring, changing ink to
stitches or beads, or changing weights moves nothing. Changing the picture, the field, the separation or the seed
re-traces.

## What the field is

The instrument reads one property of the picture (lightness, luminance or saturation), measures the direction of its
edges and textures with a structure tensor averaged over the **Coherence scale**, and asks how one-sided that
structure is (its *confidence*: 1 for straight stripes or a clean edge, 0 for isotropic texture or a flat area).
Directions have no sign, so a line is never turned back where the angle wraps: each step keeps the sense of the one
before. Lines are traced by an evenly-spaced streamline method and stop at the picture's border, at another line, where
confidence falls below the threshold, at their longest length or where they would turn tighter than the limit.
**Flat areas never draw** in Follow and Resist; only Blend with an ambient strength above zero fills them.

## Image, placement and field

| Controls | What changes on the canvas |
|---|---|
| **Source image** | Which bundled picture is analysed. Portrait has soft feathered edges; geometric scene has hard edges, stripes and a checker patch; landscape has a sky gradient, ridges and textured ground; grain has almost no large flat areas. |
| **Image arrangement** | Which arrangement of the chosen picture (it moves and re-tints parts). Independent of the seed. |
| **Image resolution** | Pixels per side of the analysed picture. More follow finer detail; the coherence scale stays in canvas units. |
| **Read structure from** | Lightness (default), luminance, or saturation, which finds colour edges that lightness misses. |
| **Center X/Y, Width, Height, Rotation** | Where the picture sits, its size (independent width and height stretch the field too) and its turn. Everything drawn turns with it, so a large turned picture can reach past the canvas. |
| **Direction** | Follow (along edges), Resist (across edges) or Blend. |
| **Ambient field, Ambient angle, Ambient strength** | Blend only. The direction that fills unstructured areas: a constant angle, a swirl around the picture's center, or rays from it; the angle turns the pattern (a swirl plus an angle is a spiral). Strength 0 leaves unstructured areas empty; higher strengths fill them and let the ambient direction compete with strong edges. |
| **Coherence scale** | Neighbourhood, in canvas units, over which edge direction is averaged. Small follows every fine edge (busy, hairy); large gives calm, broad flow. |
| **Confidence threshold** | How one-sided the structure must be. Raising it removes lines and marks from textured areas first and leaves the strongest edges. |
| **Limit to tones, Darkest tone, Lightest tone** | Draw only where the picture's tone is inside the window: for instance only the darks, which draws the portrait's hair and shoulders and nothing else. |

## Streamlines

| Controls | What changes on the canvas |
|---|---|
| **Streamlines** | Turns the traced lines on or off (the marks can be used alone). |
| **Line separation** | Distance between neighbouring lines. Small values give dense, hair-like fields; large values a sparse contour drawing. |
| **Crowding stop** | A line ends when it comes closer than this fraction of the separation to another. Near 1 gives even, shorter lines with small gaps; lower lets lines run longer and crowd. |
| **Start spacing, Start scatter** | The grid of places lines are first started from, and how far the seed displaces each start. With **Fill gaps** off, these alone decide how many lines there are; the seed decides where they start and the order they are tried in. |
| **Fill gaps** | On: after the starts, lines keep being added wherever there is room, so the field is evenly covered. Off: only the starts are traced, which gives sparse long strokes. |
| **Shortest line, Longest line** | Shorter lines are removed together with the room they took, so a stub never blocks its neighbours; a line ends at the longest length. |
| **Tightest turn** | Lines end where they would turn tighter than this radius; 0 lets lines curl freely. |
| **Clip to image** | On: lines stop at the picture's border. Off: they run on past it (up to the longest length) through the direction the border has. Starts stay inside the picture. |

## Line material and color

| Controls | What changes on the canvas |
|---|---|
| **Line material** | Continuous ink, stitches along the line, or beads. The same lines under any material. |
| **Line weight** | Stroke width of ink or stitches. |
| **Tone weight** | Thins lines toward the light parts of the picture (weight, and bead size, scaled by one minus this times the picture's tone along the line, in eighths). 0 keeps one weight. |
| **Station spacing, Station phase, Cross-line phase** | Stitches and beads only: spacing along the line, where the first one sits, and a stable per-line offset so neighbours do not line up. |
| **Line retention** | Stable omission of lines (ink) or stations. |
| **Bead mark, Bead diameter/line weight, Bead petals/opening** | The mark on each bead station. |
| **Color by** | Which palette color each line and mark takes: one color, the picture's tone there (dark is the first color), the drawn direction in equal turns of the palette, or a stable random choice. |

## Oriented marks

| Controls | What changes on the canvas |
|---|---|
| **Oriented marks** | Marks placed across the picture and turned along the field, independent of the lines: dot, ring, rosette or arrow. An arrow shows the field's axis, not a sense of travel. |
| **Mark spacing, Mark scatter** | Grid the marks come from and how far each is displaced from its cell; cells without enough confidence stay empty. |
| **Mark diameter/line weight, Petals, Opening, Size variation, Mark retention** | The mark itself; retention and variation are stable per mark. |

## Using it from code

`imageDirectedFieldComposition(input)` resolves the instrument's values to a typed descriptor and
`drawImageDirectedField(p, recipe, { line, mark })` replaces the line material or the mark with your own
callback while the lines and sites stay the same cached objects. The pieces are ordinary functions:
`imageField(options)` gives the direction and confidence at any point (`field.at(x, y)`), `fieldLines` and
`fieldSites` return frozen lines (with `meanValue`, `meanConfidence`, `meanDirection`) and oriented sites,
and `traceStreamlines(options)` traces any unit-direction function you give it. Pass `{ kind: "raster", raster }`
as the image to use a picture you decoded yourself (`createRaster`); the library never fetches or decodes. All
lengths are canvas units; published angles are radians in [0, π) and unsigned.
