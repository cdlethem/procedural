# CP1: make and reshape a field of marks

Owner: root. Reviewer: Sol (`gpt-5.6-sol`, high reasoning).
Status: architecture direction accepted by root after Sol review; names below are design notation,
with reviewed regular-grid, gradient-noise and cyclic-palette operations linked below. Four candidate visuals and a public-core JAVA2D integration probe have run;
the actual JAVA2D example and three edit/transfer checks now pass. See the
[decision and PDE lifecycle evidence](../../evidence/reproductions/cp1-java2d/decision.md).
Other hosts, portable drawing commands and human usability remain pending.
Evidence revision: `b64fadf8cc484025f58a112b95630a7b0c420ea3`.

Palette continuation: the [current palette direction](../operations/cp1-palette-proposal.md)
accepts Sol's recommendation to sample cycles directly. The reviewed
[contract](../../catalog/operations/cyclic-palette.json) now specifies that operation.

## The piece and the editing task

Start from a complete field of short strokes. Let the artist control where marks sit,
how their orientation and size vary across space, and how colour is applied. The artist
should be able to make longer strokes without reducing the number of positions, recolour
retained geometry, and replace a stroke with a different mark without reimplementing field
sampling. Those design acceptance tasks now have the scoped JAVA2D evidence linked above;
the same edits still need validation on the other hosts.

[pelines#0](../../survey/out/2018/Generativos/pelines/notes.md) supplies the main
composition: fixed grid positions; independent spatial samples for heading, length and
palette position; straight segments with per-mark opacity. Its name `flowFieldLines` does
not mean integration. [ciserp#0](../../survey/out/2019/generativos/ciserp/notes.md) is the
counterexample: each newly advanced position changes the next field sample. Its perpendicular
marks are attached to a path. We share a field-evaluation boundary, not a single algorithm.

## Decisions about the public surface

| responsibility | architectural decision | artist capability and boundary |
|---|---|---|
| Regular placement | A value-producing regular-grid operation belongs in the core | Reuse positions for lines, glyphs or other marks. Grid extent, origin and pitch are independent of mark size; traversal and endpoint inclusion require a precise contract. |
| Coordinate field | A named, versioned scalar-noise field is a core capability | Obtain repeatable spatially related values at arbitrary coordinates. Evaluation is independent of call order and uses explicit field configuration; it does not advance a particle or draw. |
| Field-to-attribute mapping | Keep simple scale/offset arithmetic in native example code initially | A scalar becomes a heading, length or palette coordinate with visible units. Do not create a public generic mapping language to hide a multiplication. |
| Sampling several attributes over positions | Start as a cohesive example helper returning inspectable mark instances | It accepts supplied positions and field configurations, and returns position/heading/length plus a colour phase in cycles. It does not choose placement, select palette entries or emit drawing commands. Promote it to public convenience only if the first example and transfer show repeated wiring worth owning. |
| Cyclic palette interpolation | A distinct colour operation, subject to its existing member review | Recolour stored instances without resampling their geometry. Explicit stop ramps and random palette picks remain different computations. |
| Line/segment construction | Reuse the renderer-neutral command vocabulary; endpoint arithmetic can stay internal to the example helper | The first capability does not need a public function for each trigonometric expression. Segment anchor and total length must nevertheless be explicit. |
| Whole field-of-marks piece | Ship as the first native example/template | It owns canvas, background, chosen palette, fields and mark treatment. It is not an opaque all-in-one primitive. |

The grid's public value is not mathematical novelty; it eliminates repeated boundary,
ordering and placement plumbing and gives later layout methods the same useful position
boundary. That cost is justified only with a small interface. Noise is public because
reimplementing consistent spatial variation across hosts is substantial algorithmic work.
The field-mark helper has a higher admission bar because ordinary native loops may already
be clear enough. We will judge it from complete usage, not expose it to satisfy a function list.

## Concrete usage walkthrough

This is design pseudocode, intentionally not a file an artist is told they can run. All
capitalized configuration names are explicit example inputs; no artistic defaults or
numeric recommendations are being introduced here.

```text
positions = regularGrid({origin: GRID_ORIGIN, spacing: SPACING, columns: COLUMNS, rows: ROWS})

# These are explicit immutable field descriptions, fixed for this piece.
# The independently specified scalar gradient-noise operation is implemented.
# These are explicit field instances, not algorithm-swappable constructors.
headingField = gradientNoise2D01({seed: HEADING_SEED})
lengthField  = gradientNoise2D01({seed: LENGTH_SEED})
colourField  = gradientNoise2D01({seed: COLOUR_SEED})

instances = []
for position in positions:
    instances.append({
        position: position,
        heading: HEADING_OFFSET_RADIANS + HEADING_SPAN_RADIANS * sampleAt(headingField, position, HEADING_FREQUENCY, HEADING_OFFSET),
        length: MAX_LENGTH * sampleAt(lengthField, position, LENGTH_FREQUENCY, LENGTH_OFFSET),
        colourPhaseCycles: COLOUR_CYCLES * sampleAt(colourField, position, COLOUR_FREQUENCY, COLOUR_OFFSET)
    })

# The example's draw helper owns only local mark geometry and explicit style.
palette = cyclicPalette({colors: PALETTE})
for instance in instances:
    colour = palette.sample(instance.colourPhaseCycles)
    command = segmentCommand(instance.position, instance.heading, instance.length,
                             CENTRE_ANCHOR, colour, OPACITY, STROKE_WIDTH)
    adapter.emit(command)
```

`sampleAt` is example-private: it calls `field.sample(offset.x + position.x*frequency,
offset.y + position.y*frequency)`. The field stores only its seed; transforms remain
explicit and no coordinate array is created by this native sampling helper.

Configuration construction must eventually use the shared named-parameter convention;
this notation shows dependencies, not final argument lists. The eventual first native
example supplies one fully specified configuration and a runnable setup/draw/save path.
CP1 uses a centre anchor and total endpoint-to-endpoint length before clipping, a declared
design convention rather than inferred source behavior. Endpoint construction is private
arithmetic; emitted commands carry explicit endpoints and style. It should initially expose a few readable artist controls while keeping the full composition
open to inspection. Do not require nine unrelated noise knobs in the introductory page.

The walkthrough proposed separate explicit field identities. The actual validated example
uses one immutable field with separate coordinates/scales for the three attributes, making
that relationship visible in `MarkField.create`. Either configuration is expressible with
the reviewed field core. The independently specified noise algorithm still diverges from
the host noise facility; neither configuration claims exact `pelines` identity.
Random opacity is not needed to prove the first edit tasks; fixed explicit opacity is an
initial example simplification, with technique-level rather than whole-sketch reproduction.

**Length edit:** change `MAX_LENGTH` or rescale retained instance lengths. Grid pitch and
position count stay fixed. Verify positions and headings before and after the edit.

**Palette edit:** keep instance records and replace only `PALETTE`. The colour field yields
a dimensionless cycle coordinate, independent of palette length. The public sampler takes
that phase directly; duplicate entries still occupy their positions. This is a CP1
ergonomic design choice; the same-length corpus experiment does not validate arbitrary
palette-size changes. The contract rejects empty palettes, handles single entries and
negative phase, and specifies opaque encoded-sRGB8 interpolation. Verify geometry
byte-for-byte or with its declared numeric comparison, and render the colour changes.

**Mark replacement:** replace the example's `segmentCommand` with a local oriented short bar
or another supplied mark, using the same instance position/heading/length. A host-specific
custom mark is allowed in a native sketch; it is not automatically a portable command or
an exporter-supported operation. The shared built-in mark path must be checked on all four targets.

## CP2 boundary: retain movement, reuse the field interface

The first path tracer should consume a start, a specifically named scalar field, affine
angle base/scale in radians, step distance, step limit and explicit termination semantics.
For the signed simplex case the heading is base + scale * signed sample. A separate public
angle-field abstraction is not needed for this initial composition. It repeatedly evaluates at the current position and advances from
there. Its ordered samples need enough information for position, heading and progress;
exact update/sample order and representation remain part of the eventual trace contract.

The first CP1 field family must not pretend that Processing noise and the toxi simplex
noise described in `ciserp` are interchangeable. The protocol is shared: explicit
coordinate input and scalar output with a declared range and units. The algorithms and
their codomains/normalization remain named and independently specified. The CP1 prototype
must bind to one unsigned Perlin specification before implementation; CP2's signed simplex
must not pass through CP1's unsigned mappings unchanged. A signed field cannot be
silently fed into an unsigned mapping. CP1 can use one reviewed algorithm before CP2 is
implemented, without making the field protocol incapable of signed values.

For CP2, `trace → draw path` and `trace → perpendicular marks` must both be expressible.
The sine envelope, dot probability and palette-to-black mix remain visible example choices.
Advancement is reusable algorithmic work; constructing a single perpendicular segment is
simple recipe arithmetic. No `mode = grid | trace | agent` mega-function is approved.

## Placement evidence checked directly

[circlesAlpha#0](../../survey/out/2017/Generativos/circlesAlpha/notes.md) explicitly returns
an inclusive `(cols+1) × (rows+1)` canvas lattice. The kept family representative
[paraisooscuro#3](../../survey/out/2019/generativos/paraisooscuro/notes.md) combines an
`n × n` lattice with point drawing and ADD blend. They support separating positions from
marks, but their count conventions must not be equated. CP1's pitch/extent example needs
explicit boundary rules; a count-driven convenience must translate cell count to point
count visibly. No membership has been automatically promoted from these readings.

## Parameter evidence limits and concrete follow-up

The [verified substitution record](../../evidence/parameter-decisions/cp1-field-marks.json)
binds the five relevant experiments and both note hashes. The `pelines` report combines pitch and mark length under `gri`; changing its literal
cannot isolate spacing. Replacing randomized heading detail with a constant also removes
a random call, potentially shifting subsequent field initialization. Its alpha prose gives
an incorrect upper bound for the quoted product expression. Use the exact stored substitutions,
not the reported arithmetic, to establish input semantics.

No new public artistic default/range is approved by this document. Parameter-evidence work
must separate semantic input validity from visual recommendations and record a bounded
experiment when isolation matters. We can settle topology, value ownership, units and pure
mathematical fixtures now; measuring an attractive opacity interval is not required to reason
about those boundaries. A chosen example configuration must be labelled and visually checked
before it is recommended to artists.

## Cost and representation

The source CP1 grid spans roughly a quarter-million positions; the report's finite CP2
traces can accumulate millions of steps across starts. The walkthrough describes values,
not an allocation strategy. CP1 evaluation takes O(N) work; retaining instances takes O(N)
space. It must not require simultaneous object-per-position, object-per-instance and
object-per-command lists. Choose packed batches or bounded iteration in the operation
contract and keep replay/recolour available from retained values or deterministic recomputation.
The next [drawing-boundary proposal](../drawing-boundary.md) specifies bounded command
consumption independently of the example's retained attribute arrays.
Do not promise full CP2 path retention; sample/advance/emit order and streaming versus saved
path output require an explicit contract. Add the performance workflow at implementation kickoff.

## Sol review and root resolution

Sol found the overall responsibility split sound and requested five corrections. Root accepted
all five: explicit cycles-to-entry-index conversion in the example; a named unsigned CP1
noise contract rather than an algorithm-swappable constructor; scalar-field plus affine-angle
parameters for CP2; renderer-neutral segment commands with a centre/total-length convention;
and explicit work/representation constraints. These changes are integrated above. The sampling
helper remains private. No public `orientedMarks` operation or field-expression DSL is admitted.

Root also directly checked `circlesAlpha` and `paraisooscuro` placement evidence and retained
their different cell/point count conventions, now resolved in the
[regular-grid contract](../../catalog/operations/regular-grid.json). Noise numerics and
palette contracts were still pending at this design review; both are now separately
reviewed and implemented, as recorded in the implementation checkpoint below.

## What is needed to run this, and what root can do now

There is no dependency on a user answer or on 901 reports. Grid, noise and palette
contracts and their Java, JavaScript and Python cores now pass conformance. The complete
Processing JAVA2D example passes its registered length, palette and mark-transfer edits
and actual PDE lifecycle check. The next work is the shared drawing values/adapter
boundary, followed by actual p5.js, py5 and Android example validation.

Acceptance has three separate stages: (1) Sol challenges this usage/boundary design and root
resolves the issues; (2) pure contracts and distinguishing fixtures make implementation
unambiguous; (3) a runnable Processing piece performs the three edits and is then validated
on each additional claimed target. Paper walkthroughs and native renders are not human
usability tests. A four-target claim requires actual four-target evidence.

## Implementation checkpoint

The three core operations have reviewed contracts and passing native conformance in
Java, JavaScript and Python; Java builds a development JAR. The runnable Processing
piece and its edits pass scoped JAVA2D validation; see the
[acceptance decision](../../evidence/reproductions/cp1-java2d/decision.md) and
[getting-started guide](../../docs/getting-started.md). Other hosts, shared drawing
contracts and motivating corpus baseline suites remain unfinished.

## Noise design experiment resolution

Root accepted Sol's corrected `field.gradient-noise-2d-01` direction and inspected all four
registered JAVA2D candidate renders. The single-octave composition supplies readable broad
heading regions; four octaves add fine variation but are not necessary for the introduction.
See [the decision](../../evidence/parameter-experiments/cp1-noise-choice/decision.md).
This permits formal dependency admission and contract work. It does not validate public
ports, artistic parameter ranges, exact pelines reproduction or the remaining CP1 edits.
