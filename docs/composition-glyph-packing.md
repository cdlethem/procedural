# Glyph Packing (brief 37)

Status: **implemented on branch `w2/glyph-packing`, unreleased. Reviewed from rendered output and package tests only; not
exercised through the real Studio interface.** It composes the planar-domain foundation ([composition-domains.md](composition-domains.md))
with the owned outline font and the stock motif vocabulary under the frozen [composition boundary](composition-reference-slice.md):
a container domain, a ranked set of candidate placements, exact collision rejection between glyph outlines, and a replaceable glyph
consumer. Code: `packages/instruments/src/composition/{glyph-sources,glyph-containers,glyph-pack,glyph-pack-draw,domains-contact}.ts`,
`src/adapters/glyph-packing-instrument.ts`. Tests: `tests/composition-glyph-packing.test.ts`.

## Artist-facing brief

Words and ornaments fill a silhouette, largest first, with a controlled density, orientation and size hierarchy. Each glyph is
placed only where its real outline (grown by a gap proportional to its size) clears every neighbour and the container's edge,
holes and any protected space, so small glyphs sit in the notches and corners of big ones. Glyphs follow the nearest boundary or an
angle. Counters (the hole of an o) are not packing space unless the artist opens them. A request the shape cannot hold returns a
partial packing and a reported unplaced set.

## Frozen input contract

Library values are typed, deeply frozen and resolved; nothing is fetched or decoded. A saved layer holds a technique id, scalar
params and a palette, and selects **bundled** containers (`bundledContainerIds`), vocabularies (`bundledVocabularyIds`) and, through
them, words and dingbats, all validated `select`s. The direct API accepts any caller's word (`wordSource`: 1–20 printable ASCII,
unshaped Latin, no kerning table/ligatures/scripts), polygons with holes (`symbolSource`), vocabulary (`glyphVocabulary`) and container
(any `PlanarDomain` in `packingField`). **Host binding of a user's own text, silhouette or mask is future host work.**

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Exact contact predicates on flat rings, ring-in-shape, region contact | `composition/domains-contact.ts` (**added to the foundation**) | kernel `orient`, `edgeIndex`/`locateIndexed` |
| Words, dingbats, vocabularies, footprints (counters solid/open, grown by the gap) | `composition/glyph-sources.ts` | `typeLine`, `ringsDomain`, `planarRegion`, `offsetDomain`, `keyholeRing`, `domainDifference` |
| Silhouettes, placement, protected space, margin (the field) | `composition/glyph-containers.ts` | `planarDomain`, `textDomain`, `domainDifference`, `offsetDomain` |
| Plan, free cells, attempts, orientation, statistics | `composition/glyph-pack.ts` | `componentSeed`, `edgeIndex`, the contact predicates |
| Recipe, products, consumers, preparation | `composition/glyph-pack-draw.ts` | `atEach`, `color`, `keyholeRing`, the run budget |
| Instrument, controls | `adapters/glyph-packing-instrument.ts` | `numeric`, `choice`, `toggle` |

Shared files carry small additive hunks only (`index.ts`, `metadata.json`). No existing drawer changed, so no existing drawing changed.
Exports that would collide are aliased at the export site (`GlyphMark as GlyphPackMark`, `glyphTone/glyphFill/glyphOutline` as `packed…`).

## Semantics

- **Units.** Canvas units; a glyph's `scale` is canvas units per glyph unit, the glyph unit being the cap height of a word and the
  longer ink side of a symbol; glyph coordinates are y-down about the middle of the ink box. Option angles are degrees, frame angles radians.
- **Plan** (`planDemands`). `count(size > s) = C·(s^−D − largest^−D)` with `D = falloff`; demand `j` has size
  `(largest^−D + j/C)^(−1/D)` from `largest` down to `smallest`; the entry of demand `j` is drawn by frequency times a rank affinity
  `(1−h)² + h·exp(−((u − rank/(n−1))/0.22)²)` where `u` is the size's position on the log scale and `h` the hierarchy. `C` is found by bisection so the
  demanded footprint area is `coverage × available area` (to 10⁻⁴ of `C`, overshoot below 2%). Demands are ranked large to small and named `d<j>`; a
  seed changes the entries drawn (so sizes and `C` shift slightly), and a new coverage re-solves the schedule.
- **Free cells.** A grid of side `h = max(0.4·smallest, √(bbox area / 20,000))`; a cell is free while its centre or a corner lies in the field and
  its centre is in no placed grown footprint. A candidate anchor is a seeded free cell plus a seeded offset in it. It is a sampling device: it can
  skip a location a glyph could fit, and it never accepts anything.
- **Attempts.** `retries` attempts per demand; attempt `k` of demand `j` draws from `componentSeed(seed, "d<j>/a<k>", purpose)` (cell, x, y, angle): no shared
  stream. Order of tests: anchor inside the field (exact), containment of the ink outer rings (`ringWithin`: no contact with the field's boundary and
  no field ring enclosed), collision of grown footprints with placed ones through a 40 × 40 grid of part boxes (`regionsContact`: ring contact, then a vertex
  of each region inside the other; regions inside a counter do not count when counters are open). Touching counts as contact everywhere.
- **Gap.** A footprint is the ink parts grown by `gap/2` glyph units with the exact round offset (inscribed polygons, chord error ≤ `gap/16`, so the
  real clearance is at least 87.5% of the stated half gaps). Two placed glyphs are therefore at least `0.875·(gap_a + gap_b)/2` apart (`gap_i = gap · size_i`, tested
  independently by brute-force segment distance).
- **Counters.** `solid`: a part's holes are ignored, so the footprint is the filled outline and no glyph can be in a counter. `open`: holes stay, and a
  grown glyph fitting the shrunken counter can be placed in it (tested with analytic ring geometry).
- **Field.** (container − protected space), inset by `margin` with the exact round-join offset. A region whose box is not wider and taller than `2·margin` is dropped
  before the offset (nothing in it is `margin` from its boundary), an oversized offset reports `Margin`, and an empty field is a valid empty packing.
- **Orientation.** `aligned`: `angle`. `boundary`: direction of travel of the nearest field edge (brute force over the field's edges), flipped by half a turn when `upright`
  and it points left, plus `angle`, plus a seeded ±`spread`. `random`: `angle` ± `spread`.
- **Output.** `GlyphPacking { instances, unplaced, stats }`. An instance is a `Site` (id `d<j>`, `seed = componentSeed(seed, id, "glyph")`, position at the ink-box centre,
  angle, scale, `tone` = its size quartile) with `glyph`, `rank`, `demand`, `tier`, `size`, `bounds`, footprint `area`, `attempts`; `instanceInk` gives the outlines in
  canvas coordinates. `unplaced` names every demand that did not fit, with `reason` (`collision`, `outside`, `no-room`) and rejection counts. `stats`: planned, placed,
  attempts, rejections by kind, `noRoom`, exact tests, planned and achieved coverage (footprint area over the field's area; ink coverage as well), placed by tier, cell size.
  Every attempt is a placement or a counted rejection; instances and unplaced partition `d0…dN−1`.
- **Ownership and caching.** Every value is deeply frozen. The container, field and packing are cached by their construction inputs (identity of the container and protected-space
  domains, margin, seed, vocabulary, every packing option), never by appearance: palette, ink style, weight, colour rule and how the container is shown are not inputs, and
  identical constructions return the identical object. `check` (cancellation) is not part of a key, and a cancelled packing is never cached.
- **Limits** (each an error naming the controls): 4,000 planned glyphs (`Coverage`, `Smallest size`, `Size falloff`), 300,000 attempts = glyphs × `Retry budget`
  (`Retry budget`, `Coverage`), 80,000,000 exact segment tests (`Retry budget`, `Coverage`, `Smallest size`), 20,000 free cells, a margin whose offset exceeds the planar work
  limit (`Margin`). `retries ≤ 10,000` per demand, `falloff` in [0.25, 6], `gap` in [0, 2], `coverage` in [0, 1).
- **Decisions on undecided boundaries.** Touching counts as collision and as leaving the container. A `Smallest size` above `Largest size` is capped to it by the instrument
  (the direct API throws). Coverage is the share of *footprint* area asked, not ink area (solid counters count as covered). Gap is a fraction of size, not canvas units,
  so a footprint is computed once per (glyph, gap, counters) rather than per size.

## Controls

| Group | Controls |
|---|---|
| Container | Container, Margin; **Protected space**: protected space, size, X, Y |
| Placement | Center X/Y; **Size** (proportional): width, height; rotation |
| Vocabulary | Vocabulary, Hierarchy, Counters |
| Packing | Coverage; **Size** (proportional): largest, smallest; Size falloff, Gap, Retry budget |
| Orientation | Orientation, Angle, Spread, Keep upright |
| Ink | Ink, Outline weight, Color by, Show container |

Proportional groups: container width/height and largest/smallest size (both canvas units, zero meaning none, scaled together is one edit). Other candidates mix units
(fractions with canvas units, counts with lengths, angles) and are not proportional. Inline `visibleWhen`: protected size under any protected space, protected X under disc or ring,
protected Y under any, spread under boundary or random, keep upright under boundary, outline weight under outline ink. The measured control audit (28 controls, 966 probes, 30 driver contexts) reports 0 violations, no dead controls and no further conditions to declare. Slider intervals are narrower than `hardMin`/`hardMax`
throughout (coverage 0.05–0.7 of 0–0.95, largest size 12–120 of 3–600, retry budget 4–200 of 1–2000, margin 0–40 of 0–300).

## Checks

`tests/composition-glyph-packing.test.ts` (19 tests), expected values from independent arithmetic and geometry: the contact predicate against a BigInt evaluation of 34,000 dyadic segment pairs
(touches, collinear runs, 2⁻⁴⁰ nudges); ring contact against an all-pairs BigInt test; point location against the kernel; ring-in-shape against every one of 11,025 axis-aligned rectangles against a
square with a hole (analytic); region contact against closed-set intersection on a lattice (nesting in a hole included); word and dingbat areas from polygon formulas; footprint growth (a unit square
to 1 + 4h + πh²); container areas, placement, negative space and the margin as an exact inset (`n·(a − m)²·tan(π/n)`); the plan (ranked, equal area per octave at D = 2, the count law, the area target);
hierarchy and frequency by statistics of the draws; then packings checked pairwise by **brute-force segment distance** (the gap guarantee), by Boolean region intersection (no overlap of any kind,
including nested), by vertex location and distance to the container and protected space (containment and margin), and by interlocking counts (pairs whose bounding boxes overlap while outlines do not: a box packer
would produce none); solid and open counters from analytic ring geometry; orientation against the nearest of four edges of a rectangle; accounting (`placed + unplaced = planned`, coverage
from shoelace areas); an impossible request and an emptied field; producer sharing, structure and seeds; deterministic ids; drawing counts and stroke widths; hidden controls leaving the
drawing fingerprint unchanged; cancellation. Mutations each fail a test: touching not counted as contact (3 tests), enclosed holes ignored in containment, nesting without contact ignored, margin ignored
(3), upright ignored, hierarchy ignored (2), boundary tangent ignored, and the stamp bug below.

## Review record

Rendered through a throwaway SVG surface under Chromium and read: the default at seeds 42, 7 and 1234; twelve strongly different settings (annulus with aligned garden words on a wash, crescent tide words
along the boundary, star of ornaments at random angles, archipelago of open-counter letters, outlined ampersand, slab with holes and margin 16, disc with a ring moat, disc with a band, a sparse hierarchy,
a 1,487-glyph dust of ornaments, a stretched rotated disc, big letters with nesting); three default candidates; one layered set with unmodified Contour Scores, Motif Ecologies and Optical Plates in both
orders (the layer is transparent; glyphs stay legible over contour lines, dots and rosettes either way).

Defects found by looking or by the tests, fixed: (1) glyphs touched and overlapped in the first render although the pairwise tests looked plausible; the independent distance test caught that the
"already visited" stamp was shared by every letter of a word, so only the first letter of a candidate was tested against a neighbour (letters of one word were never compared with neighbours seen earlier).
The stamp is now per candidate part, and a test pins it. (2) Very large heavy dots and drops appeared in the biggest size band of the mixed vocabulary (the hierarchy floor was linear): the floor is now
`(1 − h)²` and the default hierarchy 0.9. (3) A margin larger than a small container caused an offset work-limit error: small regions are dropped before the offset and any remaining work-limit
message names Margin. (4) The first default was thin (40 retries, gap 0.14: neighbours read as one word, e.g. "seedmoss"): 100 retries, gap 0.16, coverage 0.6. (5) The plain nearest-edge
angle is discontinuous along the container's medial axis, so the interior of a convex container is a swirl; kept, because it is what "along the boundary" means, and the aligned and random rules exist
for calm fields.

Timing (Node 22, null surface, this machine): default first preparation and draw 320 ms, repeat draw 3 ms, appearance-only edit (ink, colour, wash) 2 ms, structural edit (new seed or gap) 255–310 ms,
container change 100 ms, a large setting (ornaments, coverage 0.7, smallest 5, 1,500 glyphs) 830 ms, words at coverage 0.9 with 75 retries 1.0 s, palette-only edit of that 3 ms. A p5 canvas will spend
more time painting the polygons than the library spends building them.

## Open concerns

- The real Studio interface, layered use and responsiveness in the app are unexercised; the reported statistics (placed, unplaced, achieved coverage) are not yet shown anywhere in the UI.
- Achieved coverage saturates around 0.3–0.45 whatever is requested: the greedy largest-first strategy with a fixed schedule leaves the gaps the smaller sizes cannot reach. A request for a large glyph that
  cannot fit anywhere (largest size above what the container holds) leaves its area demanded but empty, so a sparse request can draw nothing (reported, not hidden).
- Orientation along the boundary uses the nearest edge at the anchor only; a long word bends around no curve (it stays straight), so near tight curves its ends can sit closer to the boundary than its
  anchor (containment is still exact, so it never touches). Type shaped along a path is Path Typography's job.
- The free-cell sampler removes cells whose centre is under a grown footprint, so it never tries to nest a glyph in a notch narrower than a cell (at most 0.4 × the smallest size).
- `maxTests` (80 million) is not reachable by any admitted slider combination within the 300,000-attempt limit on this machine (the heaviest measured case, words at coverage 0.9 with 75 retries, spent about 2.7 million); it is enforced, not exercised.
