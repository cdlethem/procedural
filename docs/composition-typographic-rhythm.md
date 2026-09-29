# Typographic Rhythm (brief 39)

Status: **implemented on branch `w1/typographic-rhythm`, unreleased. Reviewed from rendered
output and package tests only; not exercised through the real Studio interface.** It composes the
existing binary partition, the Ordered Disorder lattice field, the optical-plate pattern and
support code, and the Word Echo outline font under the frozen
[composition boundary](composition-reference-slice.md). It is a composition of shared operators,
not an effect renderer for one word: no phrase, size or glyph is special-cased, and the same
producers accept any validated text.

## Artist-facing brief

A phrase is set far larger than the canvas and repeated, then seen through a sheet of
rectangular modules. Undisturbed modules show the piece of the poster under them, so type runs on
across them. Correlated local transforms (a sliding window, a horizontal stretch, a size change,
a quarter turn) shear and break it at the module edges. Modules may hold type, a line screen from
the same field, flat colour or nothing, and a small legible anchor caption sits outside every
module.

## Frozen input contract

The library defines **typed, deeply frozen, resolved input values**; it never fetches, decodes or
measures. Instruments persist only a technique id, scalar params and a palette, so the Studio
layer selects among **bundled phrases** through a validated `select` (`rhythm`, `more`, `slice`,
`again`, `quiet`, `open`); each is a `TextSource { id, lines, anchor }` made by `textSource`, which
the direct function API and the JSON descriptor accept for any caller-supplied text.
Host-owned binding of a user's own text, recording or table is **future host work**; nothing here
reads a URL or captures a pointer. Text is 1–8 lines and an anchor, each 1–20 printable ASCII
characters, outlined by the existing licensed font (`textOutlines`, unchanged). This is
**unshaped Latin**: glyphs advance by their own widths with no kerning pairs, ligatures, other
scripts, bidirectional text or combining marks. The font's contours are flattened polylines
(the pinned font carries one degenerate one-point contour in `u`; it is dropped).

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Text source, bundled phrases, line outlines, ring clipping, keyholed fill polygons | `composition/type-text.ts` | `textOutlines` (Word Echo's outline font) |
| Layout producer (modules), type field, per-module transform and geometry, screens, lined type, outline, anchor | `composition/type-rhythm.ts` | `partitionRegions`, `latticeSites`, `patternFunction` (grating), `clipToSupport`, `resolveSupport`, `componentSeed`, `memoized` |
| Consumers and named descriptor (`TypeRhythmComposition`), preparation | `composition/type-rhythm-draw.ts` | `inside`, `strokeWith`, `atEach`, `pathMaterial`, `color`, the run budget |
| Instrument, controls, descriptor from named params | `adapters/type-rhythm-instrument.ts` | recipe kind `typography` is one more member of `ReferenceComposition` |

Shared files carry small additive hunks only (`types.ts`, `reference.ts`, `reference-composition-instruments.ts`,
`index.ts`, `metadata.json`). No existing drawer or producer changed, so existing default drawings
are untouched (full package run below).

## Semantics

- **Type field.** Field coordinates are canvas coordinates. Row `r` (any integer) shows
  `lines[⌊mod(r, n·rowsPerLine) / rowsPerLine⌋]`, its cap band centred in a pitch of
  `leading × size` counted from the top of the module area; the line repeats along the row with
  period `inkWidth + gap × size`; row `r` slides `r × phase` periods. `size` is the cap height
  (`CAP_HEIGHT` = 115.18 font units), so one font unit equals one canvas unit when
  `size = CAP_HEIGHT`. Lines are placed by ink bounds, not advance width.
- **Modules never depend on the text.** `typeRhythmLayout(options)` is cached by options, is not
  given the text, type size or any appearance choice, and returns the same frozen object for
  every phrase, size, leading, ink, palette and screen edit. Ids are the slicing source's:
  `lat:<col>:<row>` (grid) and `region:<i>` (partition). Options a mode ignores (partition
  options for a grid, the anchor height with no anchor) never split the cache.
- **Slicing.** `grid`: the lattice's own cells. `partition`: `partitionRegions` leaves. Both tile
  the module area exactly (the composition rectangle minus the optional top or bottom anchor
  strip, which is disjoint from every module). `gutter` insets the clip by half on each side; a
  module whose clip would be under one unit is published as blank.
- **Correlated field.** `latticeSites` over the module area at displacement 1, rotation 1 and
  scale 1 gives clean channels in [−1, 1] already attenuated by the focal falloff. Each module
  reads the site at its own cell (a partition module, the cell containing its centre): shift
  `(position − origin)/cell`, turn channel `angle`, grow channel `scale − 1`, `kept` (false where
  the blank threshold omits it) and `anchor` (pinned, exactly neutral). Displacement is
  `shift × amount × module size`; stretch is `(2^(zoom·grow + stretch·turn), 2^(zoom·grow))`.
- **Kinds** come from independent stable draws of each module's own seed: blank from the
  correlated omission (clusters), then screens and flats as fractions of the remainder, then
  turned type among text. Raising one share only converts modules to that kind. `tone` is
  a palette index: plain text 0, turned text 1, screens 2, flats 1 or 3.
- **Transform order and clipping.** For a field point `q` and module centre `c`:
  `p = c + R·S·(q − c − D)`: displace by `D`, stretch by `S = diag(sx, sy)` about `c`, quarter
  turn `R` (clockwise on the canvas, `(x, y) → (−y, x)`), then **clip to the module rectangle
  last**, in the canvas frame. Stretch precedes the turn, so a turned module's stretch runs
  along the canvas y axis. Only instances whose ink can reach the module are generated (the
  window is found by the inverse map); glyph rings are culled by bounding box.
- **Clipping mechanics.** Fills are Sutherland–Hodgman clipped rings (winding preserved), then
  merged into per-glyph polygons by one short **keyhole** cut from each counter to its outer
  ring at the nearest vertex pair, cut through ink. Bridging rings across paper was tried first;
  Chromium rendered the doubled bridges as hairline streaks through the gaps, so they are never
  long. Strokes (outline, lined, screens) are clipped as polylines with `clipToSupport`. Nothing
  is clipped by the surface, which has no clip call.
- **Screens live in the same field.** A screen is the grating `{q : n·q = k·period}` of field
  angle `α = screen.angle + screenStep·45°`, mapped through the module's transform: mapped period
  `period/|R·S⁻¹·n|`, phase `−n·(c + D)/period`, ids `<module>/line:<k>#<part>` with `k` the field
  line index. Neutral neighbours therefore continue each other's lines, and a stretched, displaced
  or turned module maps its lines as it maps its letters. A mapped period below `MIN_PERIOD`
  (3) is refused and names the module. **Lined type** is the module's grating clipped to the glyph
  rings through the plate `Support` mask (nonzero winding).
- **Anchor.** The caption is fitted once to the strip (94% of its width, 68% of its height,
  uniform scale, no rotation or stretch) and drawn through `atEach`; its ink bounds always lie
  inside the strip, so modules never cover it.
- **Seed.** Seeds change the partition, the correlated field, and every kind, turn and tone
  draw; with no random amount set (`slicing: grid`, no blanks, screens, flats, turns, displacement,
  stretch or zoom) the seed changes nothing and `usesSeed` says so.
- **Units.** Canvas units; angles in degrees in controls and options, radians in frames;
  stretch and zoom in octaves; displacement in module-size fractions.
- **Limits** (each an explicit error naming the limit): 600 modules, 24 columns/rows, 2,000 glyph
  runs and 150,000 vertices per module, 1,000,000 vertices across a sheet, 4,000 mask rings per lined
  module, the shared run's 100,000 callback units, screen periods under 3 after stretch. Cancellable
  through the run's predicate and the preparation's.
- **Failure.** Invalid options, texts and coupled settings (anchor leaving under 16 units of
  height, a screen period the stretch would push under 3) throw at admission or first use.

## Controls

| Group | Controls |
|---|---|
| Modules | Slicing; **Divisions** (columns, rows: proportional); cuts, axis, size bias (partition only); gutter |
| Placement | Center X/Y; **Size** (width, height: proportional) |
| Anchor | Anchor side; anchor height (only with an anchor) |
| Type | Phrase; type size; leading; repeat gap; rows per line; row phase |
| Mix | Blank, screens, flat colour, turned shares |
| Disruption | Displacement, stretch, zoom, correlation, pinned; **Focus** (X, Y, radius) |
| Ink | Type style; line weight (outline and lined only) |
| Screens | Period, angle, angle variation, weight |

Inline `visibleWhen`: partition controls under `slicing: partition`; anchor height under an anchor
side; line weight under outline or lined type. Numeric drivers are unsupported, so screen
controls stay visible even when no screen appears (the measured audit lists only Focus X/Y as
irrelevant everywhere sampled, because the default radius is zero). Slider intervals are narrower than the exact-entry
limits (`hardMin`/`hardMax`) throughout.

## Checks

`tests/composition-type-rhythm.test.ts` (20 tests), with expected values from the raw font
outlines and hand-derived geometry, never the library's own line values: text-source refusals
and freezing; modules tile the area exactly (grid, partition, top, bottom and no anchor) with a
disjoint anchor; gutter insets and blank collapse; a neutral module's published rings equal an
independently enumerated poster, culled by the clip rectangle and by nothing else; the documented
transform order, quarter-turn direction and a discriminating order swap; clipped fill area against
dense point sampling with counters, and an exact rectangle inside an "I" bar; keyholed polygons
against even-odd classification of the raw glyphs (each polygon painted on its own); screens'
line indices, positions and counts under stretch, displacement, turn and tilt, mapped period and
the refusal; stable kinds (only converts, both shares realised, turn only on text, tones); pinning
and focus confinement; the anchor's fit, aspect and disjointness; layout identity under text, size
and appearance edits with a construction edit changing it; deep freezing; outline strokes only
add clip crossings and lined strokes stay in the ink; drawing paints only inside non-blank clips
and the anchor, flats are exactly their clip, blanks stay bare; run budget and cancellation;
named work-bound errors; coupled validation and structural seed variation; preparation and
cancellation. Six mutations each fail a test: row stagger sign, displacement dropped from the
transform, fill left unclipped, quarter-turn direction reversed, flats sharing the screens draw,
holes treated as outer rings. The full package run (build, 199 tests including control groups
and conditional controls), `npm run sources` and the control audit (37 controls, 1,520 probes,
0 violations) pass.

## Review record

Rendered through a throwaway SVG surface under Chromium and read: the default at seeds 42, 7 and
1234; nine strongly different settings (calm 6×5 grid; noisy strong grid with correlation 1;
even-area partition with another phrase; 12×2 stretched bands; outline type at 200; lined fanned
type; sparse fragments; dense 16×16 small type; lowercase, turned, two rows per line); five
default candidates and a focused-disruption variant across three seeds; nine phrase, anchor and
gutter variations; one layered composition with the unmodified Contour Scores and Motif Ecologies
in both orders (transparency holds, blank modules leave paper for the other layer); zoomed crops
at 10×.

Defects found by looking, fixed: (1) filling all rings as one path with long bridges rendered
hairline streaks across paper in Chromium, so fills became per-glyph keyhole polygons cut through
ink (checked against a subpath render); (2) the font's one-point contour in `u` broke lined masks
(found by random sampling), so degenerate contours are dropped; (3) height below 16 or an anchor
that consumed it gave a misleading message, so a coupled bound and hard minimum were added; (4)
`keyholeRings` took 18 s at type size 8 (thousands of glyphs), so parent search prunes by bounding
box (worst random hard-limit configuration now 168 ms); (5) cooperative preparation yielded through
`setTimeout` every four modules, costing about 64 ms even on a warm cache, so it yields only after
8 ms of work; (6) the first default put one huge flat block or wide screen field across half the
canvas at some seeds, so the default partition biases to even areas (−0.5, 34 cuts) with lower
screen and flat shares. Gutter 0 leaves faint antialiasing hairlines where independent modules
abut (documented, not fixed). Curves show facets above roughly 300 units of cap height.

Timing (Node, null surface, this machine): default first preparation 6 ms, draw 1.6 ms; palette or
weight edit 0.1–0.5 ms; phrase edit 4.8 ms (modules reused, geometry rebuilt); structural edit
1.3–1.6 ms. Largest admitted settings (24×24 grid, type size 24, zoom 0.8, stretch 1.2): first
preparation 52 ms, palette edit 0.5 ms, switching to outline 25 ms, displacement, seed or size edit
26–32 ms, draw 1.5–3.5 ms. A p5 canvas will spend more painting the polygons than the library spends
building them.

## Open concerns

- The real Studio interface, layered use and responsiveness in the app are unexercised.
- The frozen input contract stops at bundled phrases; a host must supply any binding of the
  user's own text.
- Kinds are drawn per module regardless of area, so one large module can become a big screen or
  flat block at some seeds; the default bias reduces this, it is not eliminated.
- `CompositionSurface` has no contour or clip call, so fills use keyholes and strokes are clipped
  geometrically; a p5 host's `beginContour` would be simpler but is not part of the frozen boundary.
