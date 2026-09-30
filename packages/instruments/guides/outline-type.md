# Outline Type

Set big letters and let something else fill them. The starting picture is two lines of heavy capitals in
which every letter takes a different technique — wavy lines, hatching, concentric rings, rings that follow
the outline inward, a dot lattice, or stacked washes — each one cut off exactly at the letter's edge, with
the counters of B, O and D left open as paper. Every letter has a double outline: its own edge and a halo a
little outside it. A new seed picks different techniques for different letters, tilts the hatching
differently and wanders the outlines a different way.

Every filler works on a *region*, not on a picture of type, so the same idea goes further: fill whole words
or lines with one continuous set of lines, let touching letters merge into one shape, grow or shrink the
outline into halos and insets, cast or extrude a shadow, or displace the letters by a smooth field before
anything is drawn. The letters stay letters: they keep their baselines, their counters and their identity.

## What the text is

The instrument ships five bundled phrases (`Phrase`), each chosen for its counters; your own text is a future
host feature (the library accepts any 1–4 lines of 1–14 printable ASCII characters through `outlineText`, but a
saved layer names only a bundled phrase). Text is **unshaped Latin** from the licensed outline font of Word
Echo: one character, one glyph, left to right. There are no ligatures, no combining marks, no other scripts
and no right-to-left text. A character outside printable ASCII is an error naming the line and character,
never a blank or a substitute. The font is already inside the package, so nothing is loaded while drawing.

| Controls | What changes on the canvas |
|---|---|
| **Phrase** | Which bundled text. |
| **Kerning** | **Metric** uses the font's own advances, **optical** opens or closes each pair so the white between facing outlines matches H beside H, **monospaced** centres every letter in equal cells. |
| **Tracking** | Extra space after every letter in cap heights. Neighbouring letters start to touch near −0.06 with optical kerning and −0.15 with metric; with a *word* or larger fill unit they then become one shape. |
| **Leading** | Distance between baselines, in cap heights (only for phrases of more than one line). |
| **Center, Type size, Rotation** | Where the block sits, the cap height in canvas units, and a turn about its center. Every line is centred on its ink. |

## Regions

| Controls | What changes on the canvas |
|---|---|
| **Fill unit** | What a filler sees as one region: **letter**, **word** (its letters united), **line**, or the whole **block**. A word or line hatches in unbroken lines across its letters; outlines and shadows of a word merge letters that touch. |
| **Displacement, Displacement amount, Correlation length** | Moves the outline of every unit by a smooth field before anything is filled: **noise** wanders in two directions, **wave** ripples the line vertically. The amount is the largest move in cap heights; the correlation length is how far the field stays alike, so short lengths crinkle the outline and long ones sway letters together. While the amount stays under about a sixth of the length the letters only bend; beyond that the outline folds over itself and counters can close. |

## Fill

| Controls | What changes on the canvas |
|---|---|
| **Fill** | **Hatching**, **wavy lines**, **rings** (concentric about the block or each unit), **contours** (the letter inset again and again, so rings follow the outline and counters), **dots** (a lattice of marks that fit wholly inside), **washes** (overlapping layers that deepen stepwise across the letter), **solid**, **none**, or **mixed**, which gives every unit one of the six line-and-mark techniques by a seeded draw of its own id. |
| **Share filled** | Fraction of units that get the fill; the rest keep only their outlines. Raising it only adds filled units. |
| **Line spacing, Line weight** | Distance between lines (or the lattice period) and their width. Scaling them together keeps the texture and changes its scale. |
| **Angle, Angle variation** | Direction of hatching, waves, the dot lattice and the wash bands; each unit turns by up to the variation either way, drawn from its own id. |
| **Cross-hatch** | A second family of lines at 90°. |
| **Pattern origin** | *Shared*: lines and rings are counted from the middle of the block, so neighbouring letters continue each other. *Each unit*: every unit counts from its own center. |
| **Frequency drift** | Spacing of waves and rings changes with distance from the origin: positive tightens outward. Too much across a large block is refused. |
| **Wave amplitude, Wavelength** | Sideways swing and length of one wave; amplitude 0 gives straight lines. |
| **Lattice, Mark, Mark size, Size ramp** | Square or staggered rows; a dot, ring or rosette at every site whose disc fits inside the letter; its diameter as a share of the period; and how much it shrinks across each letter along the angle (a halftone gradient). |
| **Steps, Wash strength** | Number of contour rings (they stop early when the letter is used up) or wash layers, and the opacity of each wash layer. |
| **Line style, Stitch pitch** | Draw fill lines as continuous ink, as running stitches or as beads; stitches and beads are kept wholly inside the letter. |
| **Color by** | One fill color; or cycle the palette through units, through lines of text, or by which technique the unit got. |

Fill lines are cut exactly at the outline, so a hatch line ends where it meets the edge and never crosses a
counter; a stroke's own width extends half its weight past that point. Marks are not cut: a mark is kept when
a disc of its size fits inside the letter and left out otherwise.

## Outline and shadow

| Controls | What changes on the canvas |
|---|---|
| **Outline** | Which boundaries are stroked: the letter's **edge**, a **halo** outside it, an **inline** inside it, or any combination. |
| **Outline weight** | Stroke width of all three. |
| **Halo distance, Inline distance** | How far outside and inside, in cap heights. Halos of touching letters merge and shrink counters; a stroke narrower than twice the inline distance has none. |
| **Corners** | **Round**, **mitre** or **bevel** turns at halo and inline corners (mitres longer than four times the distance are bevelled). |
| **Shadow** | **Cast**: one offset copy, seen only outside the letters. **Extrude**: the letter swept along the shadow vector, a solid block behind it. Shadows of all letters are united and cleared of ink, so they never darken where they overlap and never lie over a letter. |
| **Shadow distance, Direction, Opacity** | Length of the vector in cap heights, its direction in degrees clockwise from the right, and the shadow's opacity in the ink color. |

## Try these

- **Hatched words:** **Fill unit** word, **Fill** hatching, **Cross-hatch**, **Kerning** optical, **Tracking** −0.08, **Outline** halo.
- **Topographic type:** **Fill** contours, **Steps** 12, **Line spacing** 4, **Outline** edge + inline with **Corners** mitre.
- **Halftone:** **Phrase** shade, **Fill** dots, **Mark size** 0.85, **Size ramp** 0.9, **Lattice** square, **Outline** none.
- **Block letters:** **Fill** solid, **Color by** unit, **Shadow** extrude, **Shadow distance** 0.3, **Displacement** none.
- **Wobbling sign:** **Displacement** wave, **Displacement amount** 0.09, **Correlation length** 1.6, **Fill** wavy lines with **Line style** stitch.
- **Some letters only:** **Share filled** 0.4 with **Outline** all three.

## Use the pieces in code

Text, layout, regions, displacement, fillers and drawing are ordinary values and functions; the named
instrument calls the same ones. A filler is any function of a unit's domain, so a replacement can produce
paths, filled shapes or mark sites for its own consumer, and the letters' domains are available as inputs to
other studies.

```js
import { outlineText, outlineLayout, outlineUnits, displaceUnits, outlineFillerFor, offsetDomain, hatchDomain,
  outlineTypeComposition, outlineTypeProducts, drawOutlineType, createInstrument } from "@procedurals/instruments";

// 1. Text and layout: one PlanarDomain per glyph with holes for counters and ids like "l0/g2".
const text = outlineText({ id: "mine", lines: ["HOLE", "PUNCH"] });
const layout = outlineLayout({ text, kerning: "optical", tracking: 0.02, size: 130, leading: 1.25, centerX: 320, centerY: 320, rotation: 0 });
layout.glyphs.map((g) => [g.id, g.domain.area, g.domain.regions[0].holes.length]);

// 2. Units (glyph, word, line, block), optionally displaced by a correlated field (canvas units).
const units = displaceUnits(outlineUnits(layout, "word"), { kind: "noise", amount: 6, length: 90 }, 7);

// 3. Any of the units' domains feeds the planar tools directly.
const lines = hatchDomain(units[0].domain, { spacing: 5, angle: 35 });
const halo = offsetDomain(units[0].domain, 8, { join: "miter" });

// 4. Or run the whole named construction and read its parts: products carry glyph units, fills, halos and shadows.
const input = createInstrument("outline-type");
const recipe = outlineTypeComposition(input);
const products = outlineTypeProducts(recipe);
products.units[0].fill.paths;    // exactly clipped Paths, ids like "l0/g0/h12#0"
drawOutlineType(p, recipe, { fill: (surface, product, tone) => { /* paint product.fill your way */ } });
// A replacement filler instead of the stock one: (unit, { seed, origin }) => { id, kind, paths, shapes, marks }
drawOutlineType(p, recipe, { filler: outlineFillerFor({ ...recipe.fill, kind: "hatch" }) });
```

Nothing here fetches a font or asset, clears a canvas or reads a pointer. Lengths are canvas units and angles
degrees. Work is bounded and each limit is an error naming the controls to change: 4 lines of 14 characters,
20,000 fill lines, 600,000 fill vertices, 30,000 marks, 40,000 stitches or beads, 200,000 subdivided boundary
vertices in one displacement, and the planar kernel's own work limit.
