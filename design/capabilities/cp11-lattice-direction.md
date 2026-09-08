# CP11 candidate: compose orthogonal paths around occupied cells

Root selects one small evidence/design batch after accepted Java0.10.0. This is a
capability investigation, not an approved operation or permission to implement a
new public signature. Luna retrieves a concise source/candidate/parameter packet;
root decides the public boundary. No rendering or parameter experiment is scheduled.

## Artist task

Fill a rectangular lattice with connected right-angle paths while accounting for
cells already occupied by other paths. Retain the resulting paths so the artist can
change width, colour, shadows and endpoint marks independently of their structure.
A useful transfer draws dots or short marks at the same occupied cells instead of
stroking the paths. These are proposed design checks, not observations of a finished
new implementation.

RegularGrid supplies positions; GradientPath2D follows a continuous noise field.
Neither owns occupied lattice cells or the decisions required when a proposed step
cannot be taken. That missing bookkeeping is the candidate reusable burden. Drawing
parallel shadow/highlight strokes is ordinary example composition and does not need
another catalog entry at this point.

## Decisive source distinctions

Root read the complete tata and guagua notes, then their generate() walk loops in
the pinned upstream checkout. Exact source identities will be in cp11-lattice-evidence.md.

In tata, one used[][] table belongs to the whole arrangement, outside the loop over
90 walks. Starts are chosen independently but are not marked or appended immediately.
Each requested step tries up to four randomly chosen directions, with replacement.
A destination is appended and marked only if in bounds and not previously used.
Four failed proposals do not terminate the outer step loop: another round follows.
Thus a failed round does not prove no free neighbour exists. The initial start and
the first successful destination have different ownership/output semantics.

In guagua, the allocated used[][] is unused. Each iteration appends the current
position before selecting a new axis/sign; there is no boundary or occupancy check.
The walk may revisit cells or leave the original grid. The final chosen move consumes
randomness without producing another displayed vertex. This is a useful contrasting
example, not a second equivalent implementation of occupied-cell walking.

The notes therefore cannot by themselves define a generic self-avoiding walk contract.
We must explicitly decide whether to preserve tata's proposal/round/start rules or
choose a simpler complete path model and record that design divergence. No decision
may silently turn random retry exhaustion into proof of geometric blockage.

## Bounded decision before code

Resolve start ownership, shared occupancy, emitted vertices, blocked/empty results,
work limits and explicit random consumption together. Compare one retained batch
with composition of individual walks; prefer the smallest surface that makes the
artist's task straightforward. Avoid introducing graph frameworks, motion sessions,
callbacks or a new recipe executor for a static path generator.

Use measured count/length changes as evidence that structure controls matter, with
their recorded confounds. Do not turn source literals into defaults or encouraged
ranges, and do not expose masked decoration probabilities as public controls.

Acceptance should distinguish ordinary movement, boundaries, occupied destinations,
retry exhaustion with a free neighbour, shared occupancy, empty output and seeded
continuation. Use the existing deterministic fixture/native pattern. A single editable
Processing sketch with structural edits and retained restyling is the intended delivery
if the operation is admitted. Do not expand this batch to general mazes, hex grids,
weighted graph search, collision physics or unrestricted walk variants.
