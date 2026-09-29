# Crossing Lace

Strands are woven wherever they actually cross. The study finds every crossing of a set of paths,
decides which strand passes over at each one, and cuts the under strand open around it, so the
picture reads as thread going over and under rather than as lines drawn on top of each other. The
starting study is a Celtic plait: a 6 × 4 grid of cells whose diagonal strands cross at the middle of
every interior edge, a few edges blocked so strands turn back and reconnect, each closed strand its
own colour, every crossing alternating over and under along its strand, outlined in dark ink. It is
not the fixed grid weave of Woven Strands or Registered Screens: the paths can be anything that
crosses, and the weave follows the crossings that are really there.

Crossings, their order and the drawn widths are separate steps. Changing widths, colours, style or
clearance never changes where the crossings are or which strand is over; it only cuts the strands
differently (a wider stroke needs a wider gap). Changing the rule, Invert or Exceptions changes who
is over, not where anything is. Changing the family or its controls, Corner cuts, Placement or the
seed builds new paths.

## Choose the paths

| Controls | What changes on the canvas |
|---|---|
| **Path family** | **Braid knot**: the closed-braid diagram of a knot or link. **Celtic plait**: 45° strands through the edge midpoints of a cell grid. **Two-field contours**: the level sets of two height fields, one strand family each. **Random loops**: seeded wobbly rings that overlap. |
| **Strands**, **Twists**, **Radial depth**, **Vertices per turn** | Braid knot. The curve winds around the centre *Strands* times and swings in and out *Twists* times; the crossing count is exactly *twists × (strands − 1)*. 2 strands, 3 twists is the trefoil diagram; gcd(strands, twists) separate loops appear (2 and 2 is a Hopf link). Radial depth widens or crowds the band the crossings sit in (small depth means shallow crossings). Vertices per turn only matters when Corner cuts are low. |
| **Columns**, **Rows** | Celtic plait grid. Crossings: 2·columns·rows − columns − rows; gcd(columns, rows) separate strands when nothing is blocked. |
| **Blocked edges** | Share of interior edges where the strands turn back instead of crossing. Each blocked edge removes one crossing and reconnects strands, so a plait becomes knotwork with more, shorter strands. Raising it only blocks more edges. |
| **First field**, **Second field**, **Frequency**, **Second frequency**, **Levels**, **Level step**, **Grid resolution** | Two-field contours. Contours of one field never cross; the two families weave. Level step crowds or thins each family; the frequency ratio sets how the fields cut each other. Two identical unseeded fields (waves/waves, saddle/saddle) need a ratio other than 1, or their contours would coincide. |
| **Loops**, **Reach**, **Wobble**, **Open arcs** | Random loops. Loops sit on a seeded 6 × 6 cell grid: raising *Loops* adds loops and moves none. *Reach* is the radius in cell pitches (and rescales the layout to fit). *Open arcs* cuts that share of loops into arcs with free ends. |
| **Corner cuts** | Chaikin passes on every path. 0 keeps the source polygon; each pass rounds it more. Crossing positions shift a little; a plait or knot keeps its crossing count. |
| **Center X/Y**, **Width/Height**, **Rotation** | Where the lace sits and the box it is stretched to (an intentional stretch, not aspect-preserving). Contour fields are sampled over the box. |

## Decide who is over

| Controls | What changes on the canvas |
|---|---|
| **Crossing rule** | **Alternate**: each strand goes over, under, over… along its length wherever that can be satisfied; the seed only chooses which of the two consistent weaves you get. **Seeded**: an independent coin per crossing. **Rank**: the higher-ranked strand is over everywhere. |
| **Rank by** | Rank rule only: the later path, the second colour family, or the longer strand is over. Equal ranks fall back to a seeded coin. |
| **Invert** | Swaps over and under at every crossing: the mirror weave, same geometry. |
| **Exceptions** | Crossing numbers to reverse after the rule, for example `3, 7, 12-14`. Turn on the **Numbers** overlay to read the numbers. Each exception breaks the alternation at that crossing. |

Alternation is exact, not approximate. It can be impossible: a closed strand crossed an odd number of
times (an open arc that enters a loop and stays there) cannot alternate with itself. The rest of the
weave is still alternating, and the overlay's **Breaks** view rings every crossing where two passes
in a row are both over or both under.

## Draw the strands

| Controls | What changes on the canvas |
|---|---|
| **Strand style** | **Ink** a solid stroke; **Cased** a dark outline around a coloured core; **Stitch** dashes; **Beads** a chain of dots or rings. All read the same cut pieces, so the gaps are identical. |
| **Width A**, **Width B** | Full stroke width of the two strand families (even-numbered and odd-numbered strands). It also sets the gap each cuts in the other and the bead size. Width 0 hides a family, which then cuts no gaps: a way to show one family alone. |
| **Casing** | Outline thickness on each side of a cased strand, inside its full width. |
| **Clearance** | Extra empty travel each side of a crossing beyond the stroke widths and round caps. |
| **Shallowest woven crossing** | Crossings meeting at less than this angle (degrees) are left unwoven: both strokes overlap with no gap, because weaving a near-tangent crossing would cut the whole strand away. |
| **Station spacing**, **Station phase**, **Bead mark** | Stitch and bead stations along each piece. |
| **Colouring**, **Colour A/B**, **Casing colour** | **By strand** gives every strand its own palette entry (from entry 1) so you can follow one through the weave; **by family** uses the two slots. The casing uses its own slot (0 by default). |

Wide strokes on close crossings can leave no strand between two gaps; the gaps then merge into one
longer gap rather than leaving a stray dot. That is reported by the producer (`conflicts`), not
hidden.

## Open ends and reading aids

| Controls | What changes on the canvas |
|---|---|
| **End mark**, **End size**, **End trim** | Contours and loops only (braids and plaits are closed). A dot, ring or arrow at each free end, and a length removed from each end. |
| **Overlay** | **Numbers**: each crossing's number beside it. **Breaks**: rings on crossings where alternation fails (unavoidable ones and your exceptions). **Near misses**: rings where two strands pass closer than the stroke width plus clearance without crossing. Overlays draw above the lace and change nothing else. |

## Things to try

| Setting | Result |
|---|---|
| Braid knot, Strands 2, Twists 3, Corner cuts 3 | A trefoil, three crossings, six passes alternating over/under. |
| Braid knot, Strands 3, Twists 2, Radial depth 0.6 | Four crossings: the figure-eight knot's diagram. Turn on Exceptions `2` and the Breaks overlay to see the alternation break exactly there. |
| Celtic plait 8 × 6, Blocked 0 | Two strands, fully alternating, 82 crossings. Raise Blocked to 0.3 for knotwork. |
| Contours, Second field Noise, Width 5, Style Ink, Levels 3 | Two families of thin contours weaving; Near misses shows where they graze. |
| Random loops, Open arcs 0.4, End mark Ring, Overlay Breaks | Open arcs that enter loops cannot alternate; the rings show where. |
| Rule Rank, Rank by Second family | Every strand of one family lies over the other: a woven ribbon look instead of a knot. |

## As functions

The producers are ordinary functions; the instrument is one composition of them.

```js
import { lacePaths, findCrossings, orderCrossings, strandPieces, strandRoles,
  pathMaterial, strokeWith, createCompositionRun } from "@procedurals/instruments";

const paths = lacePaths({ seed: 7, smoothing: 3, frame: { centerX: 320, centerY: 320, width: 480, height: 480, rotation: 0 },
  shape: { kind: "knot", strands: 2, twists: 3, depth: 0.42, detail: 30 } });
const set = findCrossings(paths);                          // crossings: ids, points, both strands' arc length and tangent
const order = orderCrossings(set, { rule: "alternate", seed: 7 });   // over[i]: 0 first side over, 1 second; breaks; feasible
const strands = strandPieces(set, order, { widths: [12], clearance: 2 });   // frozen Path pieces `<path>#<n>`, gaps, conflicts
strokeWith(p, strands.pieces, pathMaterial({ kind: "ink", weight: 12, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1f2a33]), createCompositionRun());
```

Any array of `Path` values works as the source, so your own interlacing paths (harmonic traces, text
baselines, graph routes) go straight into `findCrossings`. The instrument itself only names bundled,
seeded families; binding a user's own paths to a Studio layer is future host work. `drawCrossingLace`
takes `{ strand, end }` callbacks to replace the strand material and the end mark while the
crossing table, order and pieces stay the same cached objects.

## Limits

Coordinates are snapped to 1/256 of a canvas unit before any test, so the answer is exact and cannot
depend on rounding. Crossings are found by segment intersection; the bounds are 60,000 vertices,
2,000 paths, 30,000 crossings and 40 million segment-pair tests, and a lace over the vertex limit
after Corner cuts is refused with the controls to lower named. Touching without crossing, a strand
ending on another, and two strands sharing a stretch are reported as contacts, never woven. This is
visual knot construction, not a knot-invariant calculator: it never claims that a drawing is a
particular knot.
