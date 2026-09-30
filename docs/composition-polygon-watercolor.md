# Polygon Watercolor (brief 08)

Status: **implemented on branch `w2/polygon-watercolor`, unreleased. Reviewed from rendered output only; not yet
exercised through the real Studio interface, layered in the app, or reviewed for responsiveness there.** It builds on the
frozen [reference slice](composition-reference-slice.md) and the planar-domain foundation
([robust planar domains](composition-domains.md)). Guide: `packages/instruments/guides/polygon-watercolor.md`.

## Artist-facing brief

Translucent washes with correlated ragged boundaries and uneven layered coverage. The artist supplies a shape (a blob with
reserved holes, a ring, letterforms, Region-Quilt-like compartments including non-convex merged ones). The instrument lays
related passes over it, every pass the same parent shape carried through a ragged boundary of its own, so pigment builds up
where passes overlap and thins to feathered rims. A light partial wash (few pale patch-shaped passes) and a dense overpainted
patch (many passes stacked on one focus) are the same instrument with different settings. This is a geometric wash
model, not a fluid simulation; the wet-pigment brief (09) is a different computation.

## Producers and consumers

| Piece | Where | Contract |
|---|---|---|
| `washPasses(parent, options, run?)` | `composition/wash.ts` | Frozen `WashPasses`: for every region of the parent and every pass index a `WashPass { id, region, index, domain: PlanarDomain, reserved, edges, fills }`, pass-major order. Cached per region object and structural options. |
| `washOutline(parent, options, regionId, pass)` | same | The raw displaced outline (and patch outline) before the fold policy; not cached. For inspection. |
| `washOffset`, `washLaw` | same | The displacement law itself: the vector pass `k` applies at (x, y), and the octave wavelengths, amplitudes and shared/own weights. |
| `washWork`, `checkWashOptions`, `WASH_LIMITS`, `prepareWashPasses` | same | Explicit work bound, validation naming the control, cooperative preparation. |
| `washParentDomain(spec, placement, seed)` | `composition/wash-shapes.ts` | Frozen cached bundled parents: `blob`, `ring`, `letters` (`textDomain`), `quilt` (`partitionRegions` + `rectangleRegion`, merges, gutters), or `{ kind: "domain" }` for any resolved `PlanarShape`. |
| `polygonWatercolorComposition`, `polygonWatercolorParent`, `polygonWatercolorPasses`, `drawPolygonWatercolor`, `preparePolygonWatercolor`, `washPainter`, `washTone` | `composition/polygon-watercolor.ts` | JSON-compatible descriptor, its producers and the replaceable painter (`consumers.pass`). |
| Definition and controls | `adapters/polygon-watercolor-instrument.ts` | Parameters, groups, `visibleWhen`, defaults. |

Reused, not rewritten: `PlanarDomain` construction, exact Booleans (`domainIntersection`, `domainDifference`, `unionDomains`),
`offsetDomain` (creep and reserve margins), `clipPath` (paper-facing edges), `ringsDomain` (fold resolution), `keyholeRing`
(fills), `textDomain`, `rectangleRegion`, `partitionRegions` (quilts), `gradientNoise2D01`, `componentSeed`, the composition
run budget.

## Frozen semantics

- **Displacement law.** The outline is resampled at a third of the finest ripple's wavelength (per edge, canonical from the
  lexicographically smaller end, after inserting every other ring's vertex that lies exactly on the edge, so regions that
  share an edge get bit-identical points). Each sample moves by a vector field of **position only**: octave `o` of `octaves` has
  wavelength `S / 2^o` (`S = swell x` the smaller side of the parent's bounds) and rms amplitude
  `min(0.1 x variance x S x 2^(-(1 - 0.8 roughness) o), 0.3 x wavelength)`, each component a unit-variance gradient noise
  (`(v - 0.5) / 0.1334`, the measured standard deviation). Being a function of position, it does not depend on ring, start
  vertex, orientation or how the parent was digitised: a 729-vertex type outline and a 96-vertex blob obey the same law.
- **Shared versus independent.** Pass `k` displaces by `sqrt(1 - rho_o) shared_o + sqrt(rho_o) own_{k,o}` per octave, where
  `shared` and `own_k` are independent fields of equal variance and `rho_o = independence x t_o`, with `t_o = 1` for
  `divergence: all`, `o / (octaves - 1)` for `fine` (broad ripples shared) and `1 - o / (octaves - 1)` for `coarse`. So two
  passes' displacements at one point have correlation exactly `sum A_o^2 (1 - rho_o) / sum A_o^2`, measured in the tests.
- **Passes.** `creep` offsets pass `k` by `creep x k` (exact round-join offset; 0 skips it). With patches, pass `k` is the
  displaced parent intersected with a displaced 32-gon ellipse: radius `size x halfDiagonal x (0.75 + 0.5 u)`, aspect
  `0.6 + 0.4 u'`, rotation `2 pi u''`, centre `focus_point + (site - focus_point)(1 - focus)`, where `focus_point` is one
  stable interior point of the region and `site` one stable interior point per pass (rejection sampling in the region's
  bounds, 32 tries, then the last candidate). `holes: "open"` washes the parent's outer rings only.
- **Fold policy.** The displaced rings of a region (outer and holes) are resolved by `ringsDomain(..., { fill: "positive" })`.
  A fold produces a loop of reversed winding, which paints nothing, so every pass is a valid `PlanarDomain` for any
  setting; nothing is accepted unchecked. Tested against an independent winding-number oracle on outlines that really fold.
- **Reserves.** The reserve of a region is its holes reversed to regions (when `holes: "reserved"`), grown by `margin`, united
  with the part of `reserve` near it (also grown by `margin`). The exact Boolean difference is the last step. `pass.reserved`
  is that domain and `pass.domain` never intersects it (a rounded crossing vertex can leave slivers of about 1e-14).
  Hole edges are displaced like the outer edge, so they retreat raggedly and never advance.
- **Edges and fills.** `pass.edges` are the boundary rings of the pass minus the stretches that lie on the reserve
  (`clipPath(..., keep: "outside")`); `pass.fills` are the `keyholeRing`s. Both are producer output, so appearance edits
  cost only drawing.
- **Seams.** With one field (`coupling: "one"`, or a single-region parent) touching regions sample their shared edge
  identically and abut exactly **while nothing folds**; a fold on a shared edge is dropped from one side and kept on the
  other (loops have opposite orientation from opposite sides), which opens a small overlap. `separate` gives each region
  its own fields (scope = region id).
- **Ids and seeds.** Pass `k` of region `R` is `R.id/p<k>`; its domain has the same id, its regions `R.id/p<k>/<n>`.
  Seeds are `componentSeed(seed, scope, purpose)` with scope `wash` (one field) or the region id; own fields use
  `<scope>/p<k>`; patches use `<R.id>/p<k>`. Nothing depends on the pass count, palette or ink: adding passes only
  appends, and recolouring returns the same pass objects (tested by identity).
- **Painting.** Pass-major: for each pass, one keyholed fill per region at `opacity`, then the darker (0.65 x) edge
  strokes. Pigment: one (palette 1), two (pass `k` uses colour 2 when `unit(seed, "pass:k", "pigment") < mix`, all regions
  alike) or per region (`componentSeed(seed, region.id, "pigment") % palette.length`). Transparent: no background, no
  full-canvas shape.
- **Units.** Canvas units; `swell` is a fraction of the parent's shorter side; angles degrees.
- **Limits and failure.** `passes` 1 to 64; `octaves` 1 to 8; the finest ripple at least 0.5 units; **boundary samples
  summed over passes, regions and patch outlines at most 600,000** (`washWork`), checked before any pass exists, error
  naming Detail, Passes, Patch size and Swell. A quilt gutter wider than a compartment throws naming Gutter; an
  unplaceable blob hole throws naming Hole count / Hole size. Empty parents, patches off a region and washes shrunk away are
  valid empty domains, not errors.
- **Not modelled.** No pigment flow, granulation, backruns or edge diffusion; a pass is a flat translucent polygon and
  paper texture is not part of it.

## Controls and groups

Sections in order: **Parent shape** (shape; lobes, hole count, hole size; ring hole; word; compartments, merged, layout,
gutter), **Placement** (center X/Y; proportional *Size*: width and height; rotation), **Boundary** (swell, detail, roughness,
edge variance), **Correlation** (independence, independent at, regions), **Passes** (passes, reach, patch size, patch focus,
pass creep), **Reserve** (holes, reserve margin), **Pigment** (pigment, second pigment, pigment opacity, *Edge*: edge
pigment and weight). The only proportional group is *Size*: width and height share one unit and zero means none of it.
Opacity and edge weight are different quantities, so *Edge* is not marked.

Inline `visibleWhen`: lobes, hole count and hole size by blob; ring hole by ring; word by letters; compartments, merged and
layout by quilt; gutter by quilt and gapped layout; rotation and holes by blob, ring or letters; regions by letters or
quilt; patch size and focus by reach patches; reserve margin by holes reserved; second pigment by two pigments. Slider intervals
are narrower than hard limits: passes to 40 (64), detail 1 to 6 (8), swell .08 to .6 (.005 to 4), compartments 2 to 24 (150).
The audit (`tests/helpers/audit-controls.ts polygon-watercolor`: 34 controls, 1,532 probes) reports 0 violations, no dead, disjunctive or numeric controls. It proposes one further condition, `height` only for blob, ring and quilt (a word's ink is fitted by width in the default box); it is not adopted because a wide word in a short box is limited by height, so the control matters there (measured at one configuration only).

## Checks

`tests/composition-polygon-watercolor.test.ts` (16 tests): displacement correlation between passes equals `1 - independence`
(0, .36, .75, 1) and the octave-weighted formula for all three divergences, with rms amplitude against the documented law;
edge variance scales the displacement and 0 returns the parent exactly (symmetric-difference area 0); reserved holes never
painted on a ring (analytic radius, with and without margin, and passes do reach just past the reserve), type counters and an extra
`textDomain` reserve; open holes are washed; wild outlines really fold (planarRegion rejects them) while every pass is a valid domain and
its interior equals the positive-winding oracle; touching quilt compartments abut exactly (no overlap, no gap, one union) under one field
and overlap under separate ones; ids and pass objects stable when passes are added, recoloured or restyled, vertices
unchanged when only ink changes; patches are the analytic ellipse polygon (area against the shoelace of the patch outline
and its analytic bounds) and focus gathers them linearly; creep against the Steiner area formula, growing and shrinking, and
vanishing to a valid empty pass; the sample count against an independent formula and every invalid option's message; bundled
parents (areas, tiling of the box, merges, gutters, rotation, errors); descriptor as plain data and replaceable painter over the same
objects; edges never inside the mask; cooperative preparation and cancellation; every control that matters changes the
drawing and hidden ones do not. Mutations confirmed to fail (each killed by 1 to 3 tests): reserve shrunk by 3 units, linear instead of
square-root correlation weights, non-canonical edge sampling, nonzero instead of positive fill, own field ignoring the pass index, creep off
by one pass, focus reversed, no touching-vertex insertion, reversed fine-divergence ramp, separate fields ignored. The existing
conditional-controls property test also runs over this instrument.

## Foundation change

`keyholeJoin` (`domains.ts`) found the nearest outer/hole vertex pair exhaustively with closures; at a few thousand boundary
samples per pass this dominated first preparation (about 5 s at the largest settings). It now skips an outer vertex whose
distance to the hole's bounding box cannot beat the best pair so far (only a strictly smaller distance replaces a pair, so the result
is the exhaustive search's): identical rings on 468 regions with 456 holes, first preparation at the same settings 0.7 s. No other
foundation code changed.

## Review record

Rendered with a throwaway SVG surface: defaults at three seeds on the blob, the ring, four letter words, quilts at three seeds;
light partial wash, dense overpainted patch, independence 0 and 1, all three divergences, torn and smooth boundaries, creep both
ways, ring masks with and without margin and washed over, six holes, sparse (5 small patches), 64 passes, combined settings, giant
lobes and fine noisy edges; layered under and over Region Quilts, Dry Bristles, Contour Scores and Typographic Rhythm (unmodified)
in both orders. Defects found by looking and fixed:

- the first defaults (18 whole passes, half independence, fine-only divergence) read as one flat, saturated blob: the default is now
  20 patch passes gathered on a focus, independence .75 at every scale, lower opacity;
- swell and detail as canvas units mangled letters at the blob's settings: they are now scale free (swell a fraction of the shape's
  shorter side, detail a number of octaves), so the same settings suit a blob and a word;
- torn and smooth boundaries were indistinguishable because a 0.1 x wavelength cap made fine ripples invisible: the cap is 0.3 x
  wavelength, the broad amplitude keeps its 0.1 x;
- a dark ring at reserved holes, because every pass strokes the identical mask edge: `pass.edges` leaves out the stretches on the mask;
- drawing dominated by keyholing (4 s per draw at a large setting): fills are producer output and the nearest-pair search is pruned;
- (from the hidden-control tests) the Regions choice changed the drawing of a single-region parent: one region always uses the shared scope;
- (from the tests) a second pass count overwrote the cached result of the first: results are cached per pass count.

Timing (Node, null surface, this machine; canvas drawing costs more): default first preparation 100 to 130 ms, structural edit
(a new seed) 80 to 95 ms, appearance-only edit (opacity, pigment, colour) 1 to 6 ms. At large settings: 40 passes at Detail 6 on
the blob 0.7 s (98,000 drawn vertices), a quilt of 24 compartments with 40 passes 1.7 s (500,000 samples, 309,000 vertices),
type with 40 passes at Detail 5 1.6 s (480,000 samples), the sample limit itself about 2 s; appearance-only edits stay under 20 ms at
all of them.

## Open concerns and decisions to confirm

- Persisted instruments name only bundled shapes and words. Binding a user's silhouette or type needs a host asset field; the
  descriptor (`{ kind: "domain" }`) and `washPasses` already accept any `PlanarShape`, and a `reserve` shape.
- A wash behind type or broad Flow Trace ribbons are direct-API compositions (parent = a region, `reserve` = type; ribbons need a path-to-region
  producer, which does not exist yet); Region Quilt compartments enter through `rectangleDomain(partitionRegions(...))` or the bundled quilt.
  No optional raster material is produced: the output is geometry, and appearance is a painter callback.
- Seams stay tight only while nothing folds (documented and tested at gentle settings).
- The instrument's ink colours come from the palette by position (1: pigment, 2: second pigment); a per-region palette cycles through all entries.
- Real-interface acceptance, layered work in the app and interaction cost are root's to exercise.
