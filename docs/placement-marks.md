# PlacementMarks

Arrange differently sized forms, then change what occupies each place. This starter
keeps placement separate from drawing: recolouring the piece or replacing rings with
diamonds uses the same retained centres, radii and original proposal indices.

The local Java 0.3.0 package has passed core conformance and installed Processing
JAVA2D validation. [Install PlacementMarks](installing-placement-marks.md) to try it.
JavaScript, Python and Android delivery is deferred to the porting batch.

## Start with an arrangement

The [Processing sketch](../packages/java-processing/examples/PlacementMarks/PlacementMarks.pde)
starts with 5,000 proposals on a 640×640 surface. Each proposal has a centre and a radius;
it survives if the spacing rule permits it alongside all earlier accepted circles.
The console reports the number accepted. The proposal budget is work to attempt, not
the number of forms requested.

The [example composition](../packages/java/examples/PlacementMarks/PlacementComposition.java)
calls `CirclePlacements2D.seeded` with an explicit seed, attempt budget, centre rectangle,
radius interval and separation scale. The library returns geometry and does no drawing.
The example's ring construction, stroke treatment and colour choices remain editable.

| Intention | Key | What changes |
|---|---|---|
| Try another arrangement | R | Advance the seed and rebuild placement |
| Continue filling available gaps | N | Toggle 5,000/10,000 proposals; the longer successful run preserves the shorter accepted prefix |
| Give forms more room | G | Toggle separation scale 1/1.2 and recompute acceptance |
| Remove the smallest proposed forms | I | Toggle minimum radius 4/8 and rebuild |
| Reduce the largest proposed forms | O | Toggle maximum radius 64/32 and rebuild |
| Replace rings with diamonds | M | Redraw the same retained placement |
| Recolour | C | Redraw the same retained placement with another palette |
| Author the arrangement instead | X | Switch between seeded proposals and explicit radial bands |
| Keep the displayed piece | S | Save the cached canvas without generating another arrangement |

These settings describe this piece. They are neither library defaults nor a recommended
continuous range. I, O, N and R apply to the seeded arrangement; the radial example has
its own editable bands and sizes in `PlacementComposition.radial`.

## Understand the spacing control

Separation scale multiplies the sum of two radii. A scale of 1 permits computed tangency;
values below 1 allow overlap, while values above 1 reserve clearance relative to form size.
It is not a fixed pixel gap. Earlier accepted proposals influence which later proposals
survive, so proposal order is a composition choice.

The rectangle describes where centres are proposed. It does not guarantee whole-circle
containment. This starter insets its centre rectangle by the maximum baseline radius;
edit the rectangle if you want forms to extend beyond the canvas.

## Supply your own proposals

`CirclePlacements2D.filter` accepts parallel `centres` and `radii` lists plus a separation
scale. The radial example constructs five bands and sends those proposals through the
same exclusion rule. Replace those lists with your own geometry without reimplementing
collision checks. The returned `sourceIndexAt(i)` identifies the original proposal, so
you can join the accepted geometry to your own colours or other per-proposal information.

Walk the result with `size()`, `pointInto(i, buffer, 0)`, `radiusAt(i)` and
`sourceIndexAt(i)`. Reuse the two-number buffer during drawing. `pointAt` and `toValues`
provide detached copies when you need them. Keep the original configuration if you want
to reconstruct the arrangement later.

The algorithm uses a finite proposal budget and checks each candidate against previously
accepted circles. It makes no promise of maximal packing, a requested accepted count or
uniform running time. Adjust the budget deliberately and reuse the result for style edits.

## Evidence and scope

The ordered exclusion mechanism is motivated by
[caramelo](../survey/out/2018/Generativos/caramelo/notes.md),
[candy](../survey/out/2018/Generativos/candy/notes.md) and
[studio](../survey/out/2017/Generativos/studio/notes.md). Their proposal domains, random
preludes and appearance differ. The package's seeded rectangle, small-form-biased radius
mapping and separate styling are independent design choices, documented in the
[architecture decision](../design/capabilities/cp3-architecture-decision.md).

The private visual investigations established useful changes for the selected spacing,
minimum/maximum radius and attempt-budget edits. They do not establish arbitrary parameter
ranges or reproduce the original sketches pixel for pixel. See the
[placement experiment](../evidence/parameter-experiments/cp3-placement/decision.md) and
[control supplement](../evidence/parameter-experiments/cp3-placement-controls/decision.md).
