# CP11 lattice-path evidence brief

**Scope.** This is a focused retrieval for a possible lattice-walking capability. It
records what the two 2019 sources compute and what the checked-in measurements can and
cannot establish. It does not select an API, define a contract, add fixtures, or admit an
operation. The two walkers must remain separate: they share a cell-coordinate output
shape, but their transition, occupancy, and emission semantics differ.

## Evidence identity and candidate accounting

Both notes describe deterministic 960×960 P2D sketches. Notes were read from the checked-in
survey snapshot; source was read with `git show HEAD:` from the pinned investigation
checkout at revision `69bdd8513e4482a5e6018e36887d4bc208660eb5`.

| source | note SHA-256 | pinned PDE SHA-256 | candidate evidence SHA-256 |
| --- | --- | --- | --- |
| `2019/generativos/tata/tata.pde` | `66d58d804843d0aeda177cc6f32405078e4bcb7ab8f5812424f47c9dabb795a2` | `7e7090ed7525f87e75c5d3bbba4ea77b046416ded31e24f3a653d76ead558d37` | `45447ac269b308ceba89d8b6e21066f75169ae05c4b8311c63172300471d571b` |
| `2019/generativos/guagua/guagua.pde` | `97932a0e075e532013621d793748277d5b2331a3143b04143c66eead782cc9bd` | `bad2aefb91083769fc2d6ae9ebac0e410165e02d2c629eb53236cd9aefd5c5c9` | `297e6252c6f6684277efdf1517959e216335689fd4b1389d5f780d5b9bf9568b` |

The current authored ledger state keeps every candidate below in `review_required`; the
status and cluster explain the present boundary.

| candidate ID | exact candidate | current status / cluster | recorded reason |
| --- | --- | --- | --- |
| `2019/generativos/tata#0` | `gridRandomWalk(cols, rows, maxSteps, avoidUsed: boolean[][]) -> PVector[]` | `reviewed_defer` / `path.grid-walk` | Four-neighbour, bounded retry and shared occupancy affect termination and RNG consumption. |
| `2019/generativos/tata#1` | `tripleStrokePath(pts, weight, shadowOffset, highlight: float, endColor) -> void` | `reviewed_provisional` / `review.path-mark-style` | Stroke style is separate and awaits command-style design. |
| `2019/generativos/guagua#0` | `gridCells(count, gap, corner) -> void` | `reviewed_defer` / `review.unresolved-computation` | Rounded cell marks are separate from lattice bounds. |
| `2019/generativos/guagua#1` | `gridRandomWalks(cellSize, walkCount, steps, strokeW, palette, shadow) -> void` | `reviewed_defer` / `path.grid-walk` | The candidate's orthogonal walk does not establish equivalence to other neighbour topologies. |

## What the source actually does

**Tata (`tata#0`).** `used[cc][cc]` is allocated once before the 90-walk outer loop
(`tata.pde:70-72`) and is therefore global across walks. Each walk chooses a random in-bounds
start (`74-75`), but does not mark or emit that start. Its requested length is
`int(random(60) * random(1))` (`76`), hence a stream-dependent value from 0 through 59.
For each requested step, the inner loop makes up to four independent random proposals
(`77-87`), with replacement. A proposal is a four-neighbour move, and only an in-bounds,
previously unused destination is accepted (`88-93`); the destination is then marked and
emitted. If all four proposals fail, that step emits nothing and the outer requested-step
loop continues. Exhaustion of four tries does not terminate the walk. This is a global
destination-occupancy walk with bounded retries, omitted initial vertex, and potentially
short output.

**Guagua (`guagua#1`).** `used[cc][cc]` is allocated (`guagua.pde:66`) but never read or
written. Each of 60 walks chooses an integer in-bounds start (`68-71`), then repeats 20
times (`72`). On every iteration it emits the current position before selecting one of
the four axis/sign moves (`73-80`). The move is unrestricted and may leave the canvas; the
move after the twentieth emission is still performed, so the final moved position is not
rendered. Paths therefore contain 20 emitted positions, including the start, and may
contain repeated or out-of-bounds coordinates. The source's two-pass shadow/colour drawing
(`82-98`) is composition style around this path, not path semantics.

The notes' imports of triangulate and SimplexNoise do not participate in either walk.
`tata`'s later endpoint, ring, and stipple draws consume the same random stream; `guagua`
also chooses a colour after path generation. A reusable path computation would need to
state whether those scene-level draws are outside its stream and output.

## Parameters, controls, and confounds

The database has six parameter records for `tata`: `cc` `random(18,26)`→`12` (large,
mean diff `.4439`, changed `.645`); `walks` `90`→`30` (large, `.2039`, `.249`);
`walkMaxSteps` `60`→`20` (large, `.4266`, `.576`); `strokeWeight` `0.2-0.9 of cell`→
`0.6-0.9 of cell` (moderate, `.0721`, `.146`); `cellDiscProb` `.1`→`.4` (none,
`.0021`, `.003`); and `stippleSize` `.08 of cell`→`.2` (subtle, `.0125`, `.029`).
Only the first three are direct controls of walk density/length; all scores include the
full raster composition and shared random-stream effects. In particular, `walkMaxSteps`
also changes how much global occupancy is consumed by later walks.

`guagua` has no parameter records in `parameters`. Existing generated controls, recorded
in `survey/out/2019/generativos/guagua/variants/cc_36/result.json`,
`steps_60/result.json`, `walks_120/result.json`, `weight_025/result.json`, and
`shadow_80/result.json` respectively, measured `cc` 12–36→36 (large, mean `.3331`,
changed `.704`), steps 20→60 (large, `.2694`, `.615`), walks 60→120 (moderate,
`.1196`, `.285`), stroke weight `.5`→`.25` of cell (moderate, `.0640`, `.181`), and
shadow offset 4/3→8/6 (subtle, `.0155`, `.065`).
These are whole-sketch raster controls; none isolates path topology, occupancy, or the
unrendered final move. `guagua`'s unrestricted walk also makes canvas-bound policy an
unmeasured decision.

## Reuse burden and minimum distinguishing scenarios

The evidence supports a potentially useful occupancy-aware bounded walker from `tata`,
but only if its shared occupancy ownership, four-proposal retry policy, RNG draw ordering,
failed-step continuation, and omitted start are explicit. It supports a separate ordinary
orthogonal walk from `guagua` only as an unrestricted emitted-position sequence with
start-before-move ordering and possible out-of-bounds coordinates. A single “grid walk”
abstraction would hide artist-visible differences and should not be inferred from the
shared candidate names.

Before any operation decision, the smallest distinguishing witness set should include:

1. A one-step path with a known start: verify tata emits no start and only a successful
   destination, while guagua emits the start before moving.
2. A blocked tata start with all four destinations occupied: verify four proposals are
   consumed, no vertex is emitted, and the next requested step still runs.
3. Two tata walks sharing an occupancy map: a destination accepted by walk one must be
   unavailable to walk two; resetting occupancy must change that result.
4. A guagua walk whose final move crosses each canvas edge: verify the twentieth emitted
   position can be in bounds while the post-emission move is out of bounds and absent from
   output, with repeated positions allowed.
5. Equal seeds and parameters with path output captured before rendering, then a separate
   rendering/style pass, to expose whether scene palette/marker draws have accidentally
   become part of path semantics.

These scenarios distinguish the two computations without claiming a public signature or
recommended ranges. Root should decide whether the occupancy-aware burden earns a separate
next operation or remains example-specific composition glue.
