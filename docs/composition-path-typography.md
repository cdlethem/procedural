# Path Typography (brief 38)

Status: **implemented on branch `w2/path-typography`, unreleased. Reviewed from rendered output and
package tests only; not exercised through the real Studio interface.** It composes the existing contour,
branch-tree and recorded-gesture producers with the Word Echo outline font under the frozen
[composition boundary](composition-reference-slice.md): a shaped glyph run, an arc-length layout on any
supplied path, and a replaceable glyph consumer. A text-free motif sequence uses the same layout.

## Artist-facing brief

A line of text is set along contours, along the chains of a grown tree, or along a recorded hand stroke.
It reads: letters keep their advance in arc length, follow the path's direction, and repeat, start
where asked and stand above or hang below the line. Where a bend is too tight for neighbouring letters,
one of four stated policies acts (leave, drop, narrow, turn back). Where a path folds back inside one
letter the letter is dropped, never flipped. Lines of text that would cross yield to the first one set.
Optional correlated disruption moves, tilts, resizes and omits letters in runs. The starting picture is a
labelled contour map.

## Frozen input contract

Library values are typed, deeply frozen and resolved; nothing is fetched or decoded. A saved layer holds a
technique id, scalar params and a palette, so it selects among **bundled text** (`bundledPathTexts`, a
validated `select`) and bundled supplies (contour landscapes, seeded branch trees, five bundled recordings).
`pathText({id, text})` admits any caller's line (1–120 printable ASCII characters, not blank); `layoutAlongPath`
admits any `Path` and any items with advances. Host binding of a user's own text or recording is **future host
work**. Text is **unshaped Latin** from `fontGlyph` (a read-only accessor over the table `textOutlines` already
uses): no ligatures, no other scripts, no bidirectional text, and the font has no kerning table, so the
kerning rule is stated by this module (below).

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Arc-length table, position/heading, turning, spans | `composition/path-arc.ts` | extracted from Branch Ornament's flank stations, which now call it |
| Text values, glyphs, kerning rules, shaped runs | `composition/type-glyphs.ts` | `fontGlyph`, `keyholeRings`, `CAP_HEIGHT` (`type-text.ts`) |
| Layout, curvature policy, crowding, disruption, baselines | `composition/path-type.ts` | `arcTable`, `componentSeed`, core `offsetPolyline2D`, `gradientNoise2D01` |
| Supplies (contour, branch chains, gesture) | `composition/path-type-supply.ts` | `contourPaths`, `branchTree`, `gesturePath`, core `chaikinPolyline2D` |
| Consumers, descriptor, products, preparation | `composition/path-type-draw.ts` | `atEach`, `strokeWith`, `pathMaterial`, `color`, the run budget |
| Instrument, controls, admission | `adapters/path-typography-instrument.ts` | growth study's own control domains |

Shared files carry small additive hunks (`index.ts`, `metadata.json`, `image-signal-instruments.ts` gains
`fontGlyph`). `branch-tree.ts` replaced its inline walk with `arcPointAt`; the
existing drawings touched by the extractions (Word Echo, Typographic Rhythm, Optical Plates with type masks,
Branch Ornament flank variants, Data Scores, Gesture Scores: 16 configurations at three seeds each, 48 in
all) have identical draw fingerprints before and after.

## Semantics

- **Shaping precedes layout.** `shapeRun(text, {kerning, tracking})` gives `GlyphItem`s in font units
  (`size / CAP_HEIGHT` canvas units per font unit): an interval `advance`, `ink` rings centred on the
  interval's middle (y = 0 on the baseline, negative above) and keyholed `fill` polygons. Spaces are
  `spacer` items. Metric kerning reproduces `textOutlines` exactly (tested). **Optical** kerning: over 320 rows
  from above the ascenders to below the descenders, the mean white gap (each side capped at 0.25 cap
  heights, rows where neither glyph has ink ignored) between a pair's facing outlines is brought to that of
  "H" beside "H", clamped to [−0.35, +0.15] cap heights and never closing facing ink below 0.06 cap heights
  in any row both occupy (a crossbar stops short of a stem). Half of each pair adjustment goes to each
  glyph's interval. **Mono** centres each ink box in a cell as wide as the widest advance.
- **Layout** (`layoutAlongPath`, `layoutPaths`). Item `i` of repeat `r` occupies arc `[a, b]`,
  `a = start + r·(run + gap) + scale·Σ advance before`. Reading direction is forward, reverse, or upright
  (forward unless the first repeat's chord points left). `start` is measured in the reading direction; on a
  closed path it wraps and the run never passes its own start. Overflow at the end of an open path or one lap
  is explicit (`dropped`, reason `overflow`). `repeat`: once; whole (repeats only while a whole run fits, the
  first always starts); fill.
- **Frames.** A frame is a `Site`: position at the middle of the interval on the path, moved `baseline` toward
  the reader's up; **angle is the chord between the two interval ends**, not the middle tangent, so a corner
  inside one letter turns it by half. `turn` is the signed turning inside the interval (positive clockwise on
  screen), `seam` flags an interval crossing arc length 0, `condense` and `adapted` record what a policy did.
  Ids `<path id>/r<repeat>/g<index>`, seeds `componentSeed(path.seed, id, "glyph")`; neither depends on size,
  tracking, kerning, policy, disruption or colour.
- **Tight curves.** A letter whose chord is shorter than 0.8 of its arc (about 130° of turn on a circle: a hairpin,
  a cusp, a zigzag as tall as the type) is dropped as `fold` under every policy; sharp turns never flip letters.
  Otherwise the letter's outline is tested against the previous placed letter's (segment crossings or containment,
  touching does not count). `ignore` leaves overlaps; `skip` drops (`curvature`); `compress` narrows about the centre
  by bisection to the widest width that clears (floor 0.4, else dropped); `rotate` turns toward the previous letter's
  orientation by the smallest turn that clears (else dropped). Bisection returns only configurations tested clear;
  anchors never move. Only consecutive letters are compared.
- **Crowding.** With `avoid` (`layoutPaths`, earlier paths and repeats have priority) a repeat any of whose
  outlines comes within `clearance` of committed type from another path or repeat is dropped **whole**
  (`crowded`); a run stops at the first letter within clearance of an earlier letter of its own repeat other than
  its neighbours (a hairpin's other arm). `allow` sets everything.
- **Baselines.** One `Path` per kept repeat: the reading path offset by `baseline` (core `offsetPolyline2D`,
  miter limit 2), split at cusps beyond 150° which the core routine refuses.
- **Disruption** (`disruptFrames`), after layout and policy, so it can bring overlaps back: shift, tilt, size
  drift and dropout each follow their own smoothed noise sampled at arc length / correlation length (noise stretched ×3.2,
  clamped), from `componentSeed(seed, path id, "disruption")`. Zero amounts return the layout's frames; raising
  dropout only omits more letters.
- **Supplies.** Contour: ranked longest first. Branch: `branchChains` — the longest trunk-to-tip lineage whole, then for
  each next-longest only the edges no earlier chain runs along, so chains never share an edge and
  their total length equals the tree's (tested); a single edge is usually shorter than a phrase, hence chains.
  Gesture: `gesturePath` at 3-unit arc stations. `smooth` rounds are Chaikin corner cuts. **Path** picks a rank,
  **Paths lettered** takes consecutive ranks (capped by what exists; a pick past the end is an error).
- **Units.** Canvas units; `size` is cap height; tracking, gap, shift, correlation length and clearance in cap heights;
  option angles degrees, frame angles radians; `start` a fraction of each path's length in the instrument, arc units in
  `layoutAlongPath`.
- **Limits** (each an error naming the settings to change): 6,000 items per layout, 20,000 drawn letters, 40,000,000
  outline segment pairs tested, 200,000 path points, growth budget at admission for the branch supply, and the contour
  source's own chain limit (reported with the controls that feed it).

## Controls

| Group | Controls |
|---|---|
| Path | **Path supply**; landscape, frequency, first threshold, threshold interval, threshold count (contour); recording, hand smoothing (gesture); **Growth** (attractors, ticks, branches, spread) and routing (branch); **Path**, **Paths lettered**, smoothing |
| Placement | Center X/Y, size, rotation |
| Text | Phrase, type size, kerning, tracking |
| Layout | Reading direction, start, baseline offset, repeat, repeat gap, tight curves, crowding, clearance |
| Disruption | Disruption, correlation length; **Amount** (shift, tilt, size drift, dropout) |
| Ink | Letter style, outline weight, color by, guide line, guide weight |

No group is `proportional`: the members of every candidate mix units (canvas units with fractions, counts with lengths)
or sit at different scales. Inline `visibleWhen`: landscape, threshold controls under contour (frequency only for
noise/waves); recording and hand smoothing under gesture; growth and routing under branch; **Paths lettered** under
contour or branch; rotation under contour or gesture; repeat gap under whole/fill; clearance under crowding avoid;
disruption amounts under correlated; outline weight under outline; guide weight under a guide. The measured control
audit (43 controls, 2,113 probes) reports 0 violations and 4 controls left visible because their relevance is a
disjunction (repeat, tight curves, crowding, color by). Slider intervals are narrower than `hardMin`/`hardMax` throughout.

## Checks

`tests/composition-path-typography.test.ts` (18 tests), with expected values from raw geometry and the font, never the
library's own values: the arc table on hand-worked polylines (open, closed, wrapping, turning, spans); branch flank
stations equal to the original inline walk; a shaped run equal to `textOutlines`; tracking and mono cells; optical
kerning of straight pairs, pairs beside a space, and no facing ink of any of ~2,100 kerned pairs overlapping (boundary
sampling against even-odd ink); exact centres, direction, baseline side, start, overflow and repeat counts for text-free
items; a circle (positions, chord heading, signed turn, baseline side, one-lap limit, seam); hairpin folds under every policy;
the four curvature policies against an independent overlap test (overlaps exist under `ignore`, none under the others, anchors
unmoved, straight text unchanged); crowding (crossing lines, clearance, a hairpin's run stopping at itself, prefix property);
id and seed stability; disruption (bounds, correlation length, monotone dropout, runs, seeds); baselines and cusps;
supplies (ranking, windows, chains partition the tree, errors); producer sharing across appearance edits and rebuilding for
structural ones; consumers and colour rules; named work bounds; seeds, admission and cancellation. Eight mutations each fail a
test: baseline side flipped, fold check removed, self-crowding removed, optical clearance removed, compress never narrowing,
crowding disabled, seam flag inverted, branch chains reusing edges.

## Review record

Rendered through a throwaway SVG surface under Chromium and read: the default at seeds 42, 7 and 1234; the three supplies;
nine strongly different settings (hills with whole phrases, waves' small loops coloured by word, branch chains, an outlined
gesture hung below its stroke, a rotated spiral coloured by adaptation, a torn saddle banner, monospaced spaced-out type, one
sparse straight-routed chain, forty dense paths); the four curve policies on tight cursive loops; kerning specimens
(metric, optical, mono) on a straight line; three default candidates over three seeds; one layered composition with the
unmodified Region Quilts and Motif Ecologies in both orders (the layer is transparent; the type stays legible over hatching
and dots either way).

Defects found by looking, fixed: (1) neighbouring contours' type overlapped in a pile, so crowding avoidance and clearance
were added, whole repeats first (half a phrase left fragments); (2) the same path's two hairpin arms met, so a run stops at
itself; (3) optical kerning let a crossbar touch the next stem (clearance floor), and 36 rows then missed the hook of "f" beside
"1" (found by the exhaustive pair test), so 320 rows; (4) trunk-to-tip lineages shared the trunk and overlapped, so branch chains;
(5) a total-turning limit dropped letters on wiggles that cancel, so the chord-straightness rule; (6) the first default
(22 units, six paths) was sparse and cluttered, so 17 units, eight paths, thin guide lines; (7) `pathTypographyProducts` rebuilt
its arrays every call, so it caches by structure; (8) a contour work-limit message named none of this instrument's controls.

Timing (Node, null surface, this machine; cold first draw includes contour generation): default first preparation and draw
55–75 ms, appearance-only edit (style, colour, guide, palette) 0.7 ms including draw, phrase edit about 5 ms, structural edit
at a large setting (28 contours, size 6, fill, 8,000+ letters) 58–91 ms, repeat draw 4–8 ms, branch growth with 70 ticks
about 90 ms. Extreme admitted settings (64 contours, size 4–5): 130–300 ms. A p5 canvas will spend more painting the
polygons than the library spends building them.

## Open concerns

- The real Studio interface, layered use and responsiveness in the app are unexercised.
- Curvature policies compare only consecutive letters; on a spiral tighter than the type is tall, letters two apart may
  touch. Disruption is not tested for overlap. Very small type with low clearance still piles up when dense.
- Grown branch chains wander at letter scale, so large type fans and loses letters at their kinks (reported, not hidden);
  straight routing and more smoothing help. `smooth` is corner cutting, not a low-pass filter.
- Crowding drops whole repeats, which can leave a lettered path bare; that is a deliberate empty result, reported per
  layout, but the instrument does not yet show which paths were left bare.
- Contours are polylines; type is placed by chord orientation only, no ink-following of the exact curve.
