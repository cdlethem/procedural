# Outline Type (brief 36)

Status: **implemented on branch `w2/outline-type-regions`, unreleased. Reviewed from rendered output and package tests only; not
exercised through the real Studio interface.** It composes the merged planar-domain foundation
([domains](composition-domains.md)), the shaped glyph run of Path Typography, the pattern functions of Optical Plates, the stock
`motif` and `pathMaterial` consumers and the Word Echo outline font under the frozen
[composition boundary](composition-reference-slice.md).

## Artist-facing brief

Big letters are regions. Each letter (or word, line or the whole block) is filled by another technique, exactly clipped to its outline
with the counters of B, O, D, 8 and @ left open; the outline can be grown into halos and insets or given a cast or extruded shadow;
and a correlated field can displace the letters before anything is drawn. The starting picture is "BOLD / FORM" in which every letter
takes a different technique, coloured by technique, under a double outline.

## Frozen input contract

Library values are typed, deeply frozen and resolved; nothing is fetched or decoded, and no font loads while drawing (the outline
font is already in the package). A saved layer holds a technique id, scalar params and a palette, so it selects among **bundled phrases**
(`bundledOutlineTexts`: `bold`, `open`, `ink`, `shade`, `figures`, each chosen for its counters). `outlineText({ id, lines })` admits any
caller's text (1–4 lines of 1–14 printable ASCII characters, each with a non-space). Host binding of a user's own text is **future host
work**. **Text scope is unshaped Latin**: one code point, one glyph, left to right, with the kerning rules of `shapeRun` (metric,
optical, mono) and tracking; no ligatures, no combining marks, no other scripts, no bidirectional text. A character outside U+0020–U+007E
is a **visible error naming line, character and code point**; nothing is substituted or dropped.

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Text, layout to glyph domains, units, displacement | `composition/outline-type.ts` | `shapeRun`, `pathText`, `CAP_HEIGHT`, `ringsDomain`, `unionDomains`, `gradientNoise2D01`, `componentSeed`, `cachedBy`, `memoized` |
| Replaceable fillers and their geometry | `composition/outline-type-fill.ts` | `hatchDomain`, `clipPath`, `offsetDomain`, `domainIntersection`, `domainClearance`, `patternFunction` (`patterns.ts` waves, rings, dots) |
| Products, offsets, shadows, consumers, descriptor, preparation | `composition/outline-type-draw.ts` | `offsetDomain`, `sweepDomain`, `pathMaterial`, `tonedMaterial`, `motif`, `atEach`, `strokeWith`, `keyholeRing`, the run budget |
| Instrument, controls | `adapters/outline-type-instrument.ts` | `numeric`, `choice`, `toggle` |

**Foundation additions (small, tested here, reported).** `domains-offset.ts` gains `sweepDomain(shape, dx, dy)`, the exact Minkowski sum with a
segment (the region united with one parallelogram per boundary edge, one exact Boolean): extrusion, a shape's swept area; counters
narrower than the vector close, wider ones keep a remnant. `shadowDomain(shapes, dx, dy, { sweep })` is the shadow of shapes thrown by a vector (their moved copy, or the whole path they sweep) minus every shape, in one exact
pass over the thrown geometry and the shapes' own rings; it exists because building the shadow as `(sweep ∖ letter)`, uniting those and subtracting the letters again rebuilt the shared
boundary from rounded vertices and failed to converge in 18 of 400 fuzzed settings (0 of 400 after). `domains.ts` gains `domainClearance(shape, x, y, limit?)`, the signed distance to the
nearest boundary edge (float distance; sign and zero by the exact `locateInDomain` rule) through the shared edge grid, capped at `limit`; a disc
of radius `r` fits when it is `≥ r`. Both are exported from `index.ts`. No existing function changed.

Shared files carry small additive hunks (`index.ts`, `metadata.json`, and the two foundation additions). No existing drawer changed, so
existing drawings are untouched (full package run below).

## Semantics

- **Layout.** Lines are centred on `centerX` by ink extent, `leading × size` apart about `centerY`, every glyph on its baseline
  (`centerY + (i − (n−1)/2)·leading·size + size/2`), then the block is turned by `rotation` degrees clockwise about the centre. `size` is the
  cap height. A glyph with ink is one `PlanarDomain` (nonzero fill of the font's contours): counters are holes, a glyph of several parts (i, %)
  has several regions. Glyph ids `l<line>/g<index>` (index counts characters incl. spaces) depend on the text alone.
- **Units.** glyph (the glyph domain itself), word (`l<line>/w<word>`, glyph domains united: touching or overlapping letters become one
  region), line (`l<line>`), block (`all`).
- **Displacement.** Rings are subdivided into pieces of at most `min(length/6, 6)` (at least 0.5) units, every vertex moves by the field, and
  the result is resolved by nonzero fill. Field: `noise` = two independent gradient-noise channels `(n − ½)·2·amount` sampled at
  `(x, y)/length`; `wave` = `[0, amount·sin(2πx/length + φ)]`, φ from the seed. Sampled in canvas coordinates, so neighbours move alike. One-to-one
  while `2π·amount/length < 1`: letters bend, counters stay counters. Beyond, the boundary folds and the resolution merges overlaps (valid
  regions; counters may close). Fills, halos and shadows are computed on the moved domain.
- **Fillers** (see the header of `outline-type-fill.ts`). Lines are exactly clipped; shapes are set operations on the domain; marks are
  kept when a disc of their radius fits (`domainClearance`) and never cut. Lines and lattices are counted from an origin: `shared` (the block
  centre; neighbours continue each other) or `unit` (its own bounding-box centre). Dot lattices are requested around a whole-period translate
  nearest the unit, so the count follows the unit, not its distance from a shared origin. Contours inset by `k·spacing` (round joins, chord error
  ≤ 0.15), stopping when the letter is gone. Washes are overlapping half-plane layers drawn at low alpha, so they deepen without seams. Each
  unit's angle is `angle + spread·(2u − 1)` with `u` from `componentSeed(seed, unit id, "angle")`; `mixed` draws its technique from
  `componentSeed(seed, unit id, "technique")`.
- **Offsets.** Halo `offsetDomain(D, +d)`, inline `offsetDomain(D, −d)`, both with the chosen join (round / mitre with limit 4 / bevel); a stroke narrower
  than `2d` has no inline; halos of touching letters merge and counters shrink. **Shadow**: cast is the copy translated by the vector minus the letter,
  extrude is the sweep minus the letter (`shadowDomain`); the drawn shadow is `shadowDomain` over all units at once, so overlaps do not darken and no shadow lies over ink.
- **Consumers.** Order: united shadow, halos, fills, letter edges, insets. Palette entry 0 is the ink of shadows and outlines; entries 1… colour fills.
  Colour rules: ink (entry 1), unit, line, technique; the palette wraps over entries 1…. Stitch and bead marks are kept inside by trimming both ends of an
  open path by the mark's reach; ink strokes are centred on the exact geometry.
- **Seeds.** Displacement field, each unit's angle variation and technique (mixed), and which units are filled: `share` is compared with the unit's own
  draw, so raising it only adds units. With none of those set the seed changes nothing and `usesSeed` says so.
- **Units of measure.** Canvas units; cap heights for tracking, leading, displacement amount and correlation length, halo and inline distances and the
  shadow distance; degrees for angles.
- **Limits** (each an error naming the controls to change): 4 lines of 14 characters; the planar kernel's work limit around any Boolean, offset,
  sweep or hatch; 200,000 subdivided boundary vertices per displacement; 20,000 fill lines, 600,000 fill vertices, 30,000 marks and 40,000 stitches or
  beads per composition; the pattern functions' own bounds (dot lattice 40,000, drift over the reach). Nothing is thinned.
- **Failure.** Invalid options, text, and coupled settings (frequency drift beyond the reach, unknown kinds) throw at admission or first use.

## Controls

| Group | Controls |
|---|---|
| Text | Phrase; kerning; tracking; leading (multi-line phrases) |
| Placement | Center X/Y; type size; rotation |
| Regions | **Fill unit**; displacement kind; **Field** (displacement amount, correlation length) |
| Fill | Fill; share filled; **Lines** (line spacing, line weight: proportional); angle; angle variation; cross-hatch; pattern origin; frequency drift; wave amplitude; wavelength; **Marks** (lattice, mark, mark size, size ramp); steps; wash strength |
| Ink | Line style; stitch pitch; colour rule |
| Outline | Outline; outline weight; **Offsets** (halo distance, inline distance: proportional); corners |
| Shadow | Shadow; distance; direction; opacity |

Inline `visibleWhen`: every fill-specific control depends on the fill (hatch angle group, waves, lattice/mark group, steps, wash, stroke style; pitch under stitch
or beads); displacement amount and length under a displacement; outline weight, halo, inline and corners under the outlines that use them; shadow controls under
a shadow; leading under phrases of more than one line. The measured control audit (41 controls, 1,935 probes) reports 0 violations; `unit` stays visible
because its relevance is a disjunction. Slider intervals are narrower than `hardMin`/`hardMax` throughout.

## Checks

`tests/composition-outline-type.test.ts` (17 tests), with expected values from raw font contours and closed forms, never the library's own values: text
refusals (accented letter, combining mark, ligature code point, emoji, blank, limits) naming line and character; glyph domains against the raw contours mapped by the
documented transform (nonzero winding, 4,000 random points per glyph, boundary excluded) with counter counts for 12 glyphs; baselines, cap heights, leading, ink
centring, rotation (quarter-turn mapping), id stability and area scaling; unions (sum apart, `a + b − a∩b` when overlapping, counters kept); displacement by
constant, ripple and shear fields (exact vertex maps, area, hole counts), fold-over validity, work limit, and the named noise and wave fields (bounds, smoothness,
period, seeds); `sweepDomain` (square, diagonal, L, counters narrowing and closing) and `domainClearance` (inside, outside corner, counters, cap, 600 random points
against brute force); every fill kind, seed and unit kind (with and without displacement) inside its unit by independent even-odd and distance; closed forms on the
bar "I" (hatch line positions and ends at 0° and 90°, `Σ length · spacing ≈ area` on an "O", cross-hatch, contour rectangles, contour distances around a counter,
wash layer areas and bounds, straight waves equal hatching, ring radii, exact lattice enumeration, hex stagger and row pitch, ramp); halo, inline and shadow areas on
the bar (mitre, bevel, round, cast, extrude, vanishing inline) and the united shadow; producer sharing across appearance edits and rebuilding for structural ones;
seeds (technique draw distribution, share monotone, unused seed identical drawings, used seeds differing); consumers (draw order, colour rules, trimming, stitch and
bead containment, custom filler and consumers); named work bounds; registration, groups, transparency, cancellation. Seven mutations each fail at least one test:
dots ignoring clearance, pattern strokes left unclipped, stitch trimming removed, sweep ignoring counters, baseline below the centre, contours growing instead of
insetting, `share` ignoring the unit id. The control audit and `npm run sources` pass.

## Review record

Rendered through a throwaway SVG surface under Chromium and read: the default on each of the five bundled phrases and at seeds 42, 7, 1234 and 3; fifteen strongly
different settings (word hatching with merged halos, block rings with extrusion, contours with mitred insets, halftone dots with ramp, washes, wave displacement with
stitches, dense cross-hatch, sparse share with all outlines, beads with cast shadow, strong noise displacement with folds, solid block letters with a deep extrusion,
line-unit contours at tight tracking, tiny dense type, chirped straight lines, extrusion with all outlines and a ripple); 3× crops for hairlines at keyhole cuts and shadow
edges (none seen); one layered composition with the unmodified Contour Scores, Motif Ecologies and Optical Plates in both orders (transparent; letters read over and under).

Defects found by looking, by the tests or by the hidden-control rule, fixed: (1) the default's six techniques shared four palette colours, so technique and colour disagreed; the default palette has
six fill colours; (2) fill lines were pale, so weight 1.5 and a deeper ochre; (3) extruded shadows of neighbouring letters overlapped and darkened and lay over other letters' ink, so the
drawn shadow is united and cleared of every letter; (4) a shared-origin dot lattice at large sizes hit the pattern limit because the lattice was generated over the
whole distance from the origin (found by a seed edit in timing), so it is requested around a whole-period translate nearest the unit; (5) that translate first doubled the lattice
phase (found by the exact-lattice test); (6) ring patterns would have moved with the hidden angle control (their vertices start at the angle), so rings ignore it; (7) the audit found leading has no effect on a
one-line phrase, so it depends on the phrase; (8) tracking's slider could not reach merging letters, so it starts at −0.2. Default first preparation and draw, and the layers, were
checked for transparency (no rectangle).

Timing (Node, null surface, this machine; first draw includes preparing every producer): default first preparation and draw 100–135 ms, appearance-only edit (colour, weights,
stroke style, wash, shadow opacity) 1–3 ms, spacing (structural) edit 30–36 ms, seed edit 25–30 ms. Large admitted settings: size 260 mixed at 3.5 spacing 55–80 ms first, 55–60 ms
structural; dense dots at size 240 53 ms; word-unit cross-hatch 27 ms; block rings with a 0.3 extrusion 80 ms; contours with 20 steps and all outlines at size 220 150 ms
(structural 160 ms); noise displacement 0.2 at correlation 0.25 and size 260 173 ms; the heaviest combination tried (block unit, contours, all outlines, extrusion 0.5,
noise displacement) 700 ms. A p5 canvas will spend more painting the polygons than the library spends building them.

## Open concerns

- The real Studio interface, layered use and responsiveness in the app are unexercised.
- The frozen input contract stops at bundled phrases; a host must supply any binding of the user's own text.
- The layer is transparent: fill lines leave paper between them and a lower layer shows through, and there is no knock-out or underpaint ground.
- Marks are contained, not clipped, so a thin stroke can hold no marks; the clipped alternative for marks is not offered.
- Fills are chosen per unit; `mixed` can give neighbours the same technique or colour.
- `CompositionSurface` has no contour call, so counters are cut into polygons by zero-width keyholes; none showed as hairlines in Chromium.
- The named fields are correlated noise and a ripple; other deformation fields (swirl, radial) are not offered though `deformDomain` accepts any function.
- Pattern lines and rings are clipped after generation, so their cost follows the reach of the shared origin; the pattern functions' own limits apply and are named.
