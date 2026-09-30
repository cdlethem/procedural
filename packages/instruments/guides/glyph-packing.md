# Glyph Packing

Words and ornaments that occupy a shape, largest first, without touching. The starting picture is a
pebble-shaped silhouette with a protected round hole: a few big words (garden, bloom, fern, moss, seed) are set
first, and the gaps they leave are filled by smaller and smaller words and ornaments (rosettes, stars, leaves,
drops). Big words follow the nearest edge of the shape and of the hole, so the type bends around them; every
glyph keeps its own outline clear of its neighbours and of the container, whatever its shape. A new seed is a
different arrangement, not a nudge: the glyphs are tried at different places and angles, and a different mix of words is drawn.

This is not a text block clipped by a shape. Each glyph is placed only where its **actual outline** (plus a gap
that scales with its size) fits, so a small glyph can sit in the notch of an "e", in the open side of a "c", or
in the corner a bounding box would have wasted. Whatever cannot fit is **counted, not squeezed in**: the packer
reports how many glyphs it was asked for, how many were placed, and why each of the others was left out. An
impossible request (glyphs larger than the container) draws a partial picture, or nothing, and says so.

## What is packed

The instrument ships bundled inputs; your own words and silhouettes are future host features (the library takes
any word of 1–20 printable ASCII characters through `wordSource`, any polygons with holes through `symbolSource` and
`packingField`, but a saved layer names only a bundled one). Words are **unshaped Latin** set in the same licensed
outline font as Word Echo: no kerning table, ligatures, other scripts or bidirectional text.

| Vocabulary | Entries (ranked, most important first) |
|---|---|
| Garden words | garden, bloom, fern, moss, seed, root, rain, leaf, stem, dew |
| Tide words | tide, shore, drift, salt, wave, kelp, reef, foam, ebb, gull |
| Single letters | R, g, a, &, B, e, 8, o, Q, s (lots of counters) |
| Ornaments | rosette, star, ring, leaf, crescent, drop, bolt, cross, arrow, dot |
| Words and ornaments | the first five garden words, then six ornaments |

The containers are a **disc**, a **pebble**, a **ring with an island hole**, a **crescent**, a **star**, an **archipelago** (four
islands, one with a lake), the **ampersand** as a shape with its counter, and a **slab with three holes**. A hole is
never packing space, and a glyph never straddles a gap between islands.

## What happens to a request

1. **Plan.** Sizes follow a power law from the largest to the smallest size; **Size falloff** is its exponent
   (2 gives every band of sizes the same total area; higher gives many small glyphs). The plan is ranked large to
   small and is sized so its total footprint is the requested **Coverage**. Each glyph draws a vocabulary entry by
   frequency; **Hierarchy** makes the head of the list large and the tail small.
2. **Candidates.** Each glyph is tried at seeded positions in space not yet covered, at the angle the orientation rule
   gives, up to the **Retry budget**.
3. **Exact rejection.** A candidate is rejected if any part of its outline touches the container's edge, a hole, the
   protected space or the margin, or comes within the gap of any placed glyph. These are exact geometric tests on the
   glyph outlines (no bounding boxes, no tolerance); touching counts as a collision.
4. The first candidate that survives is placed, larger glyphs before smaller ones.

## Controls

| Group | Control | What changes on the canvas |
|---|---|---|
| Container | **Container** | Which silhouette the glyphs occupy. |
| | **Margin** | Empty band between every glyph and the container's edge, its holes and the protected space. A margin larger than a small island removes the island. |
| | **Protected space** (**Protected size**, **X**, **Y**) | Carves a disc, a band across the container, or a thin ring out of it. Nothing is placed there, and boundary-following glyphs wrap around it. |
| Placement | **Center X / Y** | Where the container sits on the canvas. |
| | **Width / Height** | Size of the container; the silhouette is stretched (they can be scaled together). |
| | **Rotation** | Turns the container (and its protected space) about its center. |
| Vocabulary | **Vocabulary** | The set of words or ornaments that is packed. |
| | **Hierarchy** | 0: any entry at any size. 1: the head of the list is set large, the tail small. |
| | **Counters** | **Solid**: the hole of an o or a ring is part of the glyph, nothing sits in it. **Open**: a smaller glyph may nest in a counter that is big enough. |
| Packing | **Coverage** | Share of the usable area the glyphs are asked to cover. The share actually reached is lower and is reported. |
| | **Largest / Smallest size** | Size of the first and last glyph: cap height for words, longer side for ornaments (can be scaled together). Smaller sizes mean many more glyphs and a longer wait. |
| | **Size falloff** | How quickly counts grow as size shrinks. |
| | **Gap** | Air between glyphs as a fraction of their size, so big glyphs get more room than small ones. |
| | **Retry budget** | Attempts per glyph before it is left unplaced. More fills tighter and takes longer. |
| Orientation | **Orientation** | **Aligned**: every glyph at **Angle**. **Along boundary**: turned to follow the nearest edge (container, hole or protected space), plus **Angle** (90 sets glyphs across the edge). **Random**: **Angle** plus or minus **Spread**. |
| | **Angle, Spread, Keep upright** | The base angle, the random variation, and (along the boundary) whether words are turned by half a turn when they would read upside down. |
| Ink | **Ink, Outline weight** | Solid glyphs or outlines only (weight in canvas units whatever the glyph size). |
| | **Color by** | One ink, or the palette by size quartile, vocabulary rank, or word/ornament. |
| | **Show container** | Nothing, its outline or a pale wash behind the glyphs. |

**Seed:** a different arrangement each time. Only Coverage, Sizes, Falloff, Gap, Retry budget, Hierarchy, Vocabulary, Counters,
Orientation and the container and protected-space settings change which glyphs are placed and where. Ink, colour and
container display never move or rename a glyph, so palette and style edits are instant.

## Try these

- **Bent around a hole:** the default, or **Container** ring with an island hole, **Orientation** along boundary.
- **A page of type in a shape:** **Container** ampersand, **Vocabulary** garden words, **Orientation** aligned, **Angle** −12,
  **Ink** outline.
- **Nested letters:** **Vocabulary** single letters, **Counters** open, **Largest size** 90, **Size falloff** 1.4.
- **Stripes of type:** **Container** disc, **Protected space** band, **Orientation** aligned.
- **A moat:** **Protected space** ring (0.55) in a disc; words fill the inner disc and the outer band.
- **A few big words:** **Coverage** 0.2, **Hierarchy** 1, **Gap** 0.3.
- **Dust of ornaments:** **Vocabulary** ornaments, **Smallest size** 5, **Coverage** 0.7, **Orientation** random.

## Limits

Work is bounded before it starts: at most 4,000 planned glyphs, 300,000 attempts (glyphs times **Retry budget**) and 80
million exact segment tests. Exceeding one throws an error naming the controls to change (**Coverage**, **Smallest size**,
**Retry budget**, **Margin**). A margin too large for a shape to hold anything leaves an empty layer, which is valid.

## Use the pieces in code

The container, the field, the packing and the drawing are ordinary values and functions; the named instrument calls the
same ones. Your own silhouette is any `PlanarDomain` (polygons with holes; `maskDomain` makes one from an image mask).

```js
import { bundledVocabulary, wordSource, symbolSource, glyphVocabulary, placeContainer, negativeSpace, noNegativeSpace,
  packingField, packGlyphs, instanceInk, atEach, packedGlyphFill, glyphPackingComposition, drawGlyphPacking,
  createInstrument } from "@procedurals/instruments";

// 1. The field: a silhouette (or any planar domain) minus protected space, inset by a margin.
const container = placeContainer("crescent", { centerX: 320, centerY: 320, width: 560, height: 560, rotation: 0 });
const field = packingField(container, noNegativeSpace, 10);

// 2. A vocabulary: your own words and shapes, ranked, with frequencies.
const vocabulary = glyphVocabulary({ id: "mine", entries: [
  { source: wordSource("harbour"), weight: 1 },
  { source: wordSource("tide"), weight: 3 },
  { source: symbolSource({ id: "square", regions: [{ outer: [[0, 0], [1, 0], [1, 1], [0, 1]] }] }), weight: 4 },
] });

// 3. Pack. Instances are Sites: id "d<j>", position, angle (radians), scale (canvas units per glyph unit).
const packing = packGlyphs(field, { seed: 7, vocabulary, coverage: 0.5, largest: 40, smallest: 8, falloff: 2, gap: 0.15,
  counters: "solid", hierarchy: 0.8, retries: 60, orientation: { rule: "boundary", angle: 0, spread: 5, upright: true } });
packing.instances;   // frames, sizes, glyph, rank, tier, footprint area, ink bounds
packing.unplaced;    // every demand that did not fit, with its reason and rejection counts
packing.stats;       // planned, placed, attempts, rejectedOutside, rejectedCollision, coverage, exact tests spent
instanceInk(packing.instances[0]);   // that glyph's outlines in canvas coordinates

// 4. Draw. A mark is an ordinary callback; the frame is already translated, turned and scaled (glyph units, y down).
atEach(p, packing.instances, packedGlyphFill([0x222222], "ink"));
atEach(p, packing.instances, (surface, instance) => surface.circle(0, 0, 1));    // or anything else, e.g. a motif
```

`glyphPackingComposition(input)` resolves the named instrument to a typed descriptor and
`drawGlyphPacking(p, recipe, { glyph })` replaces the glyph mark with your own while the container, field and packing
stay the same cached objects. Nothing here fetches a font or an asset, clears a canvas or reads pointer events. Lengths are
canvas units, option angles degrees and frame angles radians. The exact predicates it is built on (`segmentsContact`,
`ringsContact`, `regionsContact`, `ringWithin`, `locateInFlatRing`) are exported too.
