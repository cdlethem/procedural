# Inversion Gardens (brief 26)

Status: **implemented on branch `w4/inversion-gardens`, reviewed from rendered output only (2026-09-29).**
Not yet exercised through the real Studio interface, so not accepted as a finished study. Code:
`packages/instruments/src/composition/inversion*.ts`, definition in
`src/adapters/inversion-gardens-instrument.ts`, guide `packages/instruments/guides/inversion-gardens.md`,
tests `packages/instruments/tests/composition-inversion.test.ts`.

## Artist-facing brief

Nested circles, arcs and distorted, correctly mirrored motif families made by **exact circle
inversion**, in two constructions chosen by one select:

- **Descartes gasket:** a bounding circle and two seed circles, then every gap between three mutually
  tangent circles filled with its one Descartes circle. Radii and centres are exact; the classic seed
  has integer curvatures.
- **Inversion group:** up to eight inversion circles (on a ring, or orthogonal to the frame circle so a
  tangent set is a hyperbolic reflection group), a bundled source (rings, polar net, grid, letter outline
  or p4g wallpaper motif) and a rule (every reduced word, or a repeating word applied in order). Straight
  edges become true circular arcs, circles become circles, and each image is one inversion further from
  the source with the orientation that implies.

Outputs are circle and arc paths for `pathMaterial`, oriented sites for `motif`, bounded discs for a
disc fill (the `regionFill` analogue for circles) and guides. The original source stays available as a
faint reference layer.

## Frozen semantics

`inversion.ts` is the algebra; the rest is producers on top of it.

- **Clines.** An oriented generalized circle is `(a, bx, by, d)`, the region `a|p|² + 2b·p + d < 0`
  with `b² − a·d = 1`: `a` is signed curvature (negative: the outside of a circle), `a = 0` is a half
  plane. Inversion in a normalized circle `O` is the Lorentz reflection `v − 2⟨v, O⟩O`, with
  `⟨u,v⟩ = ub·vb − (ua·vd + ud·va)/2`. One formula gives every image rule (circle through the pole →
  line, line missing it → circle through it, orthogonal circles fixed) and keeps track of which side
  is the image of the region. `⟨u,v⟩` is preserved, so tangency and angles are. A circle above 10⁹ units
  is a line (`LINE_CURVATURE`).
- **Points and frames.** `invertPoint` is `o + r²(p−o)/ρ²`; null at the pole. `invertFrame` carries a
  `Site` frame exactly: scale × r²/ρ², axis `2φ + π − θ`, mirror flag flipped. This is the exact
  Jacobian; a numeric Jacobian test agrees. Fold Atlas's `spherical` map is the same point map for
  `r² = radius²/k` (a test asserts it); it is not used at run time because it has no circle images,
  frames or pole policy.
- **Exact pieces.** A straight edge's image is the arc through the images of its endpoints and
  midpoint (`arcThrough`); a circle's is a circle. Pieces are cut in the **source plane** by
  pulled-back constraints (below) and then mapped, so the only approximation is sampling to
  polylines (`tolerance`, the largest chord sag).
- **Valid domain.** For a word `w = l₁…lₖ` a source point survives if at every step it stays at least
  `exclusion × r` from the next pole and its final image lies in the clip disc. Each condition is a
  cline region pulled back through the preceding letters (`wordConstraints`, `inWordDomain`), so cuts
  are analytic (`segmentIntervals`, `circleIntervals`); no coordinate is ever unbounded, nothing is
  clamped, and no arc is interpolated across a removed piece. Pole clearance only binds when the clip
  disc is larger than `r / exclusion`; at the default clip radius the clip already bounds a point near
  the pole (the audit lists Pole clearance as dead at the defaults for this reason).
- **Group.** Letters `A…H` name the circles in ring order. A word applies its letters in order:
  `AB` maps `p` to `B(A(p))`. `tree` enumerates reduced words (no letter beside itself), `n(n−1)^(g−1)`
  per length before cutoffs; `word` applies the typed word cyclically, one image per prefix, and rejects
  a letter beside itself including the wrap. Generation 0 is the source (`src`). Ids `w:<letters>` and
  `<image>/<piece>#<n>`.
- **Cutoffs.** In the tree, a word is not expanded when the disc enclosing all its extensions (the
  image of its first letter's disc under the rest of the word) is smaller than `minRadius` or misses the
  clip disc. With disjoint circles that is exact; with overlapping ones it is a declared heuristic.
  Retention keeps a word when its own id draws below it and drops its extensions in the tree, only itself
  in the word rule.
- **Gasket.** `(Σk)² = 2Σk²` for four tangent circles, `k′ = 2(k₁+k₂+k₃) − k` for the fourth
  circle on the other side, applied to `(k, kx, ky)` alike: exact arithmetic. Generation 1 uses complex
  Descartes filtered by tangency. Counts: 3 seed circles, 2 in generation 1, `2·3^(g−1)` afterwards.
  Each step equals inversion in the circle through the other three tangency points (`duals`, a line when
  the three points are collinear); tests derive the dual circle independently and compare. Ids
  (`O A B C0 C1 C0.2.1 …`) depend only on address, so raising Generations renames nothing. Retention is
  per gap id. Not everything recursive is inversion evidence: the gasket is Descartes' construction and the
  guide says so.
- **Colour and marks.** `generation`, `branch`, `parity` (even/odd inversion count = orientation) and
  `octave` are producer attributes; colour is chosen by the consumer, entry 0 stays the ink of guides and
  faint outlines. A mark's natural size is `extent × |scale|`; a negative scale mirrors. A mark is never
  cut: one whose diameter circle would leave the clip disc is left out. Stroke weight of marks is a canvas
  width, capped at 12 % of the diameter, not scaled with the map.
- **Ownership and caching.** `gardenProducts(options)` returns a deeply frozen value cached by
  construction only (JSON of the structural options; colour, style, marks, original, guides never enter).
  Appearance edits reuse the same object (tested). Hidden controls are inert. Seeds come from
  `componentSeed(seed, id, purpose)` (retention per address, jitter per circle); `usesSeed` is true only
  for retention below 1 or, in the group, jitter above 0.
- **Failure.** Invalid values throw naming the field; work bounds throw naming controls.

## Measured work bounds

`GARDEN_LIMITS` / `ORBIT_LIMITS` / `GASKET_LIMITS`: 20,000 gasket circles, 6,000 images, 150,000
source pieces in images, 500,000 vertices, 12 generations, 8 circles, drawing budget 400,000 units
(per run, message names Station spacing / Generations / Circles). Sampled on the review machine
(Node, one process, first call includes JIT):

| Case | Prepare | Draw (counting surface) |
|---|---|---|
| Default, first | 115 ms | 13 ms |
| Colour / line style / marks / fill edit | 1–3 ms | 11–42 ms |
| Generations 6 (structural) | 104 ms | 4 ms |
| 8 circles, letter R, Generations 7, Minimum radius 0.5 (1,169 images) | 128 ms | 6 ms |
| 3 circles, wallpaper density 8, Generations 8, Minimum radius 0.3 (766 images, 11,490 paths) | 359 ms | 13 ms |
| 5 circles, wallpaper density 8, Generations 7, Minimum radius 0.1 (4,086 images, 61,290 paths) | 1.1 s | 37 ms |
| 5 overlapping circles, net density 8, Generations 5 (444,691 vertices) | 176 ms | 33 ms |
| Gasket 5 / 9 (Minimum radius 0.3) / 10 (0.15) | 5 / 25 / 50 ms | 1–6 ms |
| Gasket 12, Minimum radius 0.05 | throws: over 20,000 circles, names Generations and Minimum radius | |

These are observations, not certified ranges. The slider intervals (Generations 1–7, Minimum radius
0.5–8, circles 2–8) are well inside them; hard limits are the semantic and work bounds above.

## Controls

Groups (each control in one group; `proportional` in bold):

- **Construction:** `construction`; *Gasket* {`first`, `second`}; *Inversion circles* {`circles`,
  `arrangement`, **Size** {`ringRadius`, `circleRadius`}, `spread`, `twist`, `jitter`}.
- **Growth:** `rule`, `word`, `generations`, `minRadius`, `exclusion`, `retention`.
- **Source:** `source`, `density`, `glyph`, `sourceSize`, `sourceX`, `sourceY`, `sourceTurn`.
- **Placement:** `centerX`, `centerY`, `radius`, `rotation`, `clipShare`.
- **Lines:** `stroke`, `weight`, *Stations* {`spacing`, `beadSize`}, `tolerance`.
- **Discs:** `fill`, `fillOpacity`, `fillRings`. **Marks:** `marks`, `markSize`, `markWeight`.
- **Reference:** `original`, `guides`. **Color:** `colorBy`.

`Size` is the only proportional cluster (two lengths in one unit, shares of the frame radius; scaling both
scales the arrangement about the middle). `radius` is alone in Placement (one member cannot be proportional).

`visibleWhen` (inline): gasket controls on `construction = gasket`; group, growth-specific and source
controls on `construction = orbit`; `ringRadius`/`circleRadius` on `arrangement = ring`, `spread` on
`orthogonal`; `word` on `rule = word`; `density` on `source ∈ rings/net/grid/wallpaper`, `glyph` on
`glyph`; `spacing` on stitch/beads, `beadSize` on beads; `fillOpacity` on flat/rings, `fillRings` on rings;
`markSize`/`markWeight` on any mark. Validation runs only for visible values (an invalid Word under
*Every reduced word* is retained but not an error). The control audit reports 0 violations; it lists
`exclusion` as irrelevant at the sampled configurations (see above) and `generations`, `retention`,
`weight`, `fill` as disjunctive (relevant under some selections), which are left visible on purpose.

The authored default is five circles orthogonal to the frame, touching (`spread` 1), reflecting the
letter R five generations deep, colour by generation, construction circles shown.

## Tests

`tests/composition-inversion.test.ts` (28 tests, expected values independent of the code under test):
point involution and product identity, and equality with Fold Atlas's spherical map; circle/line image
rules with exact expected lines and circles and orientation of the image region; random cline properties
(image contains the images of its points, involution, normalization); tangency and the complex cross
ratio (conjugated); frame images against a numeric Jacobian; arcs through segment images against
sampling; interval cutting against dense sampling (over 50,000 comparisons); gasket generation counts
`[3,2,6,18,…]` and `2+3^g`, integer curvatures for the classic seed, exactly three touching older
circles for every circle and the Descartes relation, no overlaps and area coverage rising toward the
disc, dual-circle inversion equivalence, cutoffs and retention stability, error text naming controls;
tree counts `n(n−1)^(g−1)`, word order (composition checked by hand, `AB` ≠ `BA`, wrap rejection),
winding and mirror parity per generation, every image vertex mapping back onto the source outline
(exactness of arcs and sampling), pole clearance and the analytic domain, clip-rim cutting, the tree
cutoff losing nothing larger than the minimum radius, work limits, frozen/shared garden, id stability
under deeper generations, hidden controls inert, seeds only where chance belongs, marks contained in the
clip disc, budget error text.

Mutations proven to fail tests (run, then reverted): frame mirror flag not flipped (2), Descartes step
without the doubling (4), image circles from an unnormalized reflection (6), a letter allowed beside itself
in the tree (6), word applied in reverse order (1), pole-clearance constraint omitted (1), clip
constraint omitted (1). The last two initially were **not** caught; the tests were strengthened (a clip
large enough for the clearance to bind; a configuration where only the clip keeps images finite).

## Review record

Rendered through a throwaway SVG surface under the native lease: defaults, three seeds on seeded
constructions, more than nine strongly different structural settings, sparse (Generations 1–2, hidden
original) and dense (gasket 9 with beads, wallpaper density 8), extreme (overlapping circles, a pole inside
the letter) and combined settings, and layers with three unmodified instruments (Wallpaper Motifs, Contour
Scores, Motif Ecologies) in both orders. Defects found by looking and fixed:

- Mark strokes scaled with the mark, so gasket arrows were 18 units thick: weight is now a canvas width
  capped at 12 % of the diameter.
- Marks on large circles protruded through a smaller clip disc: a mark that would leave the clip is
  dropped (documented) rather than cut or clamped.
- The first default (four circles, thin letter `k`, ring 0.8 / 0.45) was sparse and the ring and word
  rules showed only specks: the default is now five touching circles reflecting a large R; ring defaults
  fit the source in the gap between circles; the word rule is best shown with the orthogonal circles
  (`AB` marches toward the touching point, `ABC` and `ACB` diverge).
- Minimum radius 1.5 cut so much that Generations above 4 changed nothing: default 0.8.
- The gasket's seed triple on a diameter has a straight dual, silently dropped from the guides: a line dual
  is now drawn as a chord.
- Overlapping circles are a legitimate tangle (a non-free group), and are documented as such rather than
  hidden; nothing escapes the clip disc.

Not done / open: no real-interface acceptance; the word rule draws one image per generation and is sparse by
nature (Schottky-like contraction shrinks each step); glyph, wallpaper and grid sources are bundled only
(host binding of user outlines or patterns is future work); no PlanarDomain conversion of the valid-domain mask
(it is per-word constraints, testable pointwise); disc fill covers bounded discs only (a region containing a
pole has an unbounded image and is skipped); `docs/visual-review.json` was not edited.
