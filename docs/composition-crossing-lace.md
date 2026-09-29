# Crossing Lace (brief 48)

Status: **implemented on branch `w2/crossing-lace`, unreleased. Reviewed from rendered output and
package tests only; not exercised through the real Studio interface, not layered in the app.** It
is a composition under the frozen [composition boundary](composition-reference-slice.md) and the
[structural operator conventions](composition-structural-operators.md). It is visual knot
construction, not a knot-invariant engine: nothing claims that a drawing *is* a given knot.

## Artist-facing brief

Arbitrary interlacing paths, woven where they actually cross: every crossing is found exactly, given
an over and an under strand by an explicit rule (alternating along each strand, a seeded coin per
crossing, or path rank) with an editable list of exceptions, and the under strand is cut open around
it. Bundled path families: a braid-closure knot (the trefoil diagram and its relatives), a Celtic
plait (with blockable edges that turn it into knotwork), the contours of two height fields, seeded
random loops and arcs. Woven Strands and Registered Screens remain the fixed-grid weaves and are not
duplicated: the shared *gap and cutting* geometry was extracted from Woven Strands and both call it.

## Frozen input contract

Instruments persist a technique id, scalar params and a palette. The **library** defines the typed
values: `Path[]` in, `CrossingSet`, `CrossingOrder`, `Strands` out. The instrument names only
**bundled, seeded families** through validated selects; nothing is a URL, an asset or a decoded file.
Any `Path[]` (harmonic traces, text baselines, graph routes) is accepted by `findCrossings` directly.
Host binding of a user's own paths to a Studio layer is **future host work**.

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Gap length, travel distances, gap deletion and cutting (extracted) | `composition/strands.ts` | called by Woven Strands (`weave-screen-instruments.ts`) and Crossing Lace |
| Crossing detection, degenerate policy, near misses | `composition/crossings.ts` | nothing (exact integer predicates) |
| Over/under assignment, alternation check | `composition/crossing-order.ts` | `componentSeed` |
| Strand pieces, conflicts, free ends | `composition/lace-strands.ts` | `strands.ts`, `componentSeed` |
| Bundled path families, smoothing | `composition/lace-families.ts` | `contourPaths`, `chaikinPolyline2D`, `memoized`, `componentSeed` |
| Composition, consumers, overlays, preparation | `composition/crossing-lace.ts` | `strokeWith`, `atEach`, `pathMaterial`, `motif`, `color` |
| Instrument, controls, groups, conditions | `adapters/crossing-lace-instrument.ts` | |

Woven Strands' own drawing was re-run through the extracted functions: 34 fingerprints (11
configurations including extreme widths, clearances, skew and a one-row strip, × 3 seeds, plus
Registered Screens) are identical before and after (`tests/helpers/draw-fingerprint.ts`). The only
behavioural addition is that `retainedSegments` sorts the gap intervals it is given; Woven Strands
already produced sorted ones.

## Semantics

- **Resolved geometry.** Coordinates must be finite and within ±8192. Every vertex is snapped to a
  1/256-unit grid, consecutive duplicates (and a closing vertex equal to the first) are dropped and
  every test runs on those integers: orientation determinants stay below 2⁵³, so **every predicate
  is exact**, with no epsilon and no dependence on path order or direction. A path with fewer than
  two (closed: three) distinct points is an error naming it. Ids must be unique.
- **What is a crossing.** Segments of every pair of paths and non-adjacent segments of one path
  (self-crossings) are tested; adjacent segments share a vertex and never cross. `transversal`: open
  segments cross at an interior point of both. `vertex`: paths meet at a vertex of at least one and
  the four rays leaving that point alternate in angular order (one path really passes from one side
  of the other to the other side). Each physical meeting is reported once.
- **Degenerate cases are contacts, not crossings**, in `CrossingSet.contacts`: `tangent` (touch,
  rays do not alternate), `terminal` (an open end on another strand, a T), `overlap` (some pair of
  rays leaves in the same direction: a shared stretch, reported at each vertex on it; never woven,
  so an overlap also cannot change which side a strand ends on). Stated limit: overlapping paths
  must be separated by the caller.
- **Near misses** (only with `nearMiss > 0`): non-intersecting stretches closer than the tolerance;
  connected runs are one entry; a run touching an intersection belongs to that crossing; one path's
  own curvature is ignored (a part must be ≥ 4 × tolerance further along the same path). A near
  miss is not a contact and not a crossing.
- **Ids and parameters.** Crossing `<pathId>@<s>~<pathId>@<s>` (arc length, 3 decimals, path order
  then arc length), sorted by first path then arc length; each side carries `path`, `s`, `segment`,
  `t`, unit `tangent`. A crossing's `sine` is |sin| of the angle between the tangents.
  **Units** are canvas units, radians. Ids depend on geometry only: appearance edits never rename or
  move them; changing sampling or smoothing may replace them.
- **Order.** `alternate`: over, under, over… along every strand, cyclic for closed strands. It is a
  system of parity constraints solved exactly with union-find with parity; each component has two
  consistent weaves, chosen by a seeded coin from the component's smallest crossing id. Where the
  constraints are contradictory (**a closed strand with an odd number of passes**, typically an open
  arc entering a loop) the contradictory constraints are dropped deterministically and reported as
  `unavoidable` breaks; `feasible` is false. `seeded`: a coin per crossing id. `rank`: higher rank
  over (ranks per path index, equal ranks fall back to the coin). `flips` (crossing ids) reverse
  single crossings after the rule; `invert` reverses all. `breaks` lists every consecutive pair of
  passes with equal state and its cause (`exception`, `unavoidable`, `rule`).
- **Pieces.** The under strand loses `(upper + lower) / (2 sin θ) + clearance` of travel on each side
  (the Woven Strands rule; `lower` is the extent of the marks actually drawn, for stitches larger
  than the weight). Crossings shallower than `minAngle` are unwoven (`flat`) instead of consuming
  the strand. Overlapping gaps merge and are reported (`merged`), gaps past an open end shorten it
  (`end`), a closed strand with nothing left is `consumed`; nothing is silently hidden. Pieces are
  `<pathId>#<u>` with `u` the number of under-crossings before the piece, so widths, clearance and
  trim never rename a surviving piece; an uncut closed path is one closed piece. Free ends become
  sites `<pathId>:end0|end1`.
- **Failure and limits.** Above 60,000 vertices (after corner cuts), 2,000 paths, 30,000 crossings,
  40 million segment-pair tests or 3 million grid entries, construction throws before allocating
  more, naming what to lower (`CROSSING_LIMITS`, `MAX_LACE_VERTICES`); the instrument checks the
  vertex bound from its controls alone (validation names *Corner cuts* and the family controls).
  Nothing is truncated.
- **Randomness.** All seeds come from `componentSeed(seed, id, purpose)` (loop cell rank and jitter,
  plait edge block rank, contour field B, alternation phase, per-crossing coins). Braid knots and an
  unblocked plait read no seed; `usesSeed` builds the crossings to answer exactly for the rank rule.
  Raising Loops, Open arcs or Blocked edges never moves what already existed.
- **Caching.** `findCrossings` is cached on the identity of its (frozen) input array,
  `orderCrossings` on the crossing set and options, `strandPieces` on the order plus widths, reach,
  clearance, trim and minAngle. The path families use the repository's small LRU (six recent
  constructions). All results are deeply frozen.

## Controls, groups and conditions

Groups: **Paths** (family; nested *Braid*, *Plait* with a proportional *Grid* of columns/rows,
*Fields*, *Loops*; Corner cuts), **Placement** (center, proportional *Size*, rotation),
**Crossings** (rule, rank by, invert, exceptions), **Strands** (style, proportional *Line weights*
A/B, casing, clearance, shallowest woven crossing, *Stations*, bead mark), **Color** (coloring,
*Palette* slots), **Ends**, **Diagnostics** (overlay). Inline `visibleWhen`: family-specific controls
follow `family`; Rank by follows `rule` = rank; casing and casing colour follow `style` = cased;
spacing and phase follow stitch/beads; bead mark follows beads; colour slots follow coloring =
families; end size follows an end mark; end controls follow family ∈ contours, loops (the only
families with open strands). The control audit
(`tests/helpers/audit-controls.ts crossing-lace`, 3,061 probes, 46 controls) reports **0 violations**;
it leaves three controls visible: `widthB` (relevance is a disjunction over family and other
choices), and `minAngle`, `coloring` (numerically dead in some configurations).

## Checks (`tests/composition-crossing-lace.test.ts`, 28 tests)

Independent expected values: braid diagrams have exactly *twists × (strands − 1)* crossings and
gcd(strands, twists) loops (trefoil 3, figure-eight diagram 4, cinquefoil 5, Hopf 2, (3,3) 6, (4,6) 18,
(9,12) 96); hand-built Hopf link, three overlapping rings, n-ring chains 2n, concentric and nested
circles; Celtic plaits 2·c·r − c − r crossings and gcd(c, r) strands; blocked edges remove exactly
one crossing and leave one tangent touch each; an independent brute-force reference agrees on 60
random integer polylines full of degeneracies; classification is invariant under reversal, restart,
reordering, rotation and mirroring; the degenerate table (X at vertices, chevrons, T, collinear
overlap, edge-sharing squares, corner-touching diamonds); near misses vs contacts vs crossing
neighbourhoods; trefoil alternation for six seeds (six passes strictly alternate, the seed only
chooses the mirror weave); an exception breaks exactly four neighbouring pairs; odd closed
alternation is `feasible: false` with matching `unavoidable` breaks; rank and seeded rules; gap
lengths at 90°, 60°, 30° against hand values; flat crossings; merged and end conflicts; length
conservation across the closing seam; identity of `set` and `order` under every appearance edit;
the seed only where it is read; work bounds naming controls. Eight mutations were each caught by at
least one test: gap ignores the angle; alternation parity flipped; vertex-touch treated as a
crossing; closed seam not joined; phase ignores its seed; blocked plait edges do not turn; numbers
off by one; exceptions off by one. Package build and the whole suite pass.

## Review record

Rendered through a throwaway SVG surface under the native lease, three seeds of the default, nine
structural settings (trefoil, figure-eight diagram, (5,4) knot, 8 × 6 plait, blocked rotated plait,
hills/noise contours, random loops, rank-by-family ribbon, seeded rule), six sparse settings (2 × 2
plait, one family hidden, three loops, two-level contours, small off-centre knot, off-centre bead
plait), six dense/extreme settings (24 × 24 plait, 24 loops at reach 3 and wobble 1, 12 × 70
contours, (7,9) knot, strokes far too wide for the plait, 12 × 8 stitched plait), three combined
overlay settings, all styles, and two layered pairs in both orders (Contour Scores, Motif Ecologies
above and below). Defects found by looking and fixed:

1. Link components of a braid with gcd > 1 coincided (phases 2πk/g repeat): overlap contacts and
   spurious crossings. Phases are now 2πk/p.
2. Loops spilled outside the frame (cell grid + radius not fitted): the pitch is now chosen so the
   scatter fits the box.
3. Shallow crossings ate whole strands into dashes on contour and loop families: crossings under a
   stated angle are now unwoven (`minAngle`, reported as `flat`), default 20°.
4. Crossing numbers were tiny and unreadable over dark strands: larger, with a pale halo.
5. The braid (3,2) diagram at default depth was unreadable (angles 22–33°); the guide recommends
   depth 0.6.
6. The default was coloured by parity family, which looked arbitrary on a plait; it is now coloured
   by strand.
7. The vertex limit (45,000) refused an ordinary dense contour setting; raised to 60,000 after
   timing (first build 154 ms at the limit).

Measured on the review machine (build plus first draw; drawing after preparation is 0.3–5 ms):
default first preparation 9.4 ms; appearance-only edit 2–3 ms (crossing table and order reused);
structural edit 3.5 ms. Large settings: 24 × 24 plait 45 ms first, 13 ms after a width edit, 28–34 ms
after a structural edit; 24 loops with 3 corner cuts 42 ms first, 5.6 ms appearance, 27–31 ms
structural; 12-level 70-resolution contours (about 40,000 vertices) 154 ms first, 13 ms appearance,
121 ms structural. These are observations, not certified bounds.

## Open items

- Real Studio interface exploration, layered review in the app and responsiveness were not done.
- Contour families are dense to the point of clutter with waves and many levels; the controls allow
  it deliberately, the defaults do not.
- `crossing-lace` is registered in the first `return` of `canPrepareInstrument` in `index.ts`; that
  function on `main` has a second, unreachable `return` left by an earlier merge, which root may
  want to delete.
- A tangent contact where two strands touch exactly (plait apex at a blocked edge with no corner
  cuts) is reported but drawn as two touching round caps; corner cuts separate them.
