# CP16: smooth closed paths for shapes and repeated marks

Status: root investigation, not public contract or implementation acceptance. Java0.18
still supplies18 operations. Ports and Sol remain paused.

## Artist task and missing computation

Supply a handful of control points, make a smooth closed outline, and place marks at
chosen distances along it. Move one control point without rewriting interpolation, then
replace the mark while retaining the curve. A second use fills sampled outlines with
editable fans. This connects shape construction and path decoration through reusable data.

GradientPath2D, NoiseBandPath2D and OccupiedLatticePaths2D construct paths through movement
or occupancy. None interpolates supplied controls. Processing curve drawing can display
a curve but does not give the artist a retained distance lookup for independent marks.
The existing GlyphMarks is a composition over GradientPath2D, not a general path-layout
operation. A spline should not acquire glyph/font responsibilities to enable this transfer.

## Evidence read by root

Pinned upstream revision: `69bdd8513e4482a5e6018e36887d4bc208660eb5`.
Root read the complete blobs and databol notes and PDEs. Source is provenance; the private
probe is independently specified, not copied source. The note identities below bind this
investigation. These are not new support attestations.

| note under survey/out/2018/Generativos | note SHA256 | pinned PDE SHA256 |
| --- | --- | --- |
| blobs/notes.md | da8a424b12faee472927627a3770aa5234093656951289a7925da435224910a4 | 22387099e124b0e76c936a739ef0d661588833a5f772e7ced058931dbe6bcc23 |
| databol/notes.md | 4f178f5ddda1c4740f47380174f24afe50b5e803088678b173bd15a5985aaed7 | 770888556a8548881cb1980975858b81e481d868dff4cf3128d70e41822fa4ce |

blobs#0 names the generic Spline; blobs#1 is the complete layered fan composition and
must not be merged wholesale. databol#0 constructs randomized polar controls as well as
the spline; databol#1 stamps variable-size rectangles along it. Extraction must leave
control generation, size scheduling and rectangle treatment in the composition.

Both sources evaluate a uniform Catmull-Rom curve through cyclic controls. They approximate
each span's length with10 chords, but retain only cumulative totals at control boundaries.
getPoint then maps distance linearly to parameter within that entire span. This is not
uniform arc-length sampling within the span. blobs draws with getPointLin (direct segment
parameter); its length estimate chooses fan density. databol actually uses getPoint for
outlines and stamps and estimates direction with samples at normalized distance +/-0.01.
Negative remainder at the seam can extrapolate; a new operation must specify periodic
wrapping deliberately rather than inherit that behavior by accident.

blobs' control-count3-to5 experiment reports a large image change. databol's randomized
3-to20 controls versus8 also reports a large change, confounded by changed downstream RNG
consumption. Neither establishes a useful interpolation-resolution range. No public
defaults, recommended control count, accuracy claim or resource bounds are frozen here.
The source seed field is not itself passed to randomSeed in either generate method;
survey harness repeatability does not make that field a portable seed contract.

## Proposed boundary and deliberate divergence

Investigate one retained closed uniform Catmull-Rom curve from explicit 2D controls,
with direct periodic parameter evaluation and approximate distance-based evaluation.
Retain every sampled chord's cumulative distance, invert that table, then evaluate the
cubic at the interpolated parameter. This deliberately improves the source's coarse
per-span lookup. It is still approximate arc length; subdivision is numerical resolution,
not an aesthetic smoothness parameter or a promised error tolerance.

Analytic tangent information would avoid the source's arbitrary +/-0.01 look-ahead.
The zero-derivative convention, duplicate/coincident controls, minimum control count,
seam endpoints, negative distances, overflow, immutable ownership and work limits must be
resolved in a contract before public code. Uniform splines can overshoot or self-intersect;
neither a valid simple polygon nor a safe triangulation fan is promised. Do not silently
substitute centripetal interpolation or add tension/open-curve modes without evidence.

Control placement, center averaging, palette interpolation, mark spacing choices and
fan drawing remain explicit composition. Do not add a generic polygon primitive just
because s90s names one: its trigonometric vertex loop is ordinary drawing glue. Likewise
oilan's structural displaced-ring workflow can use field samples and supplied vertices
(without claiming its source simplex-field compatibility); absent
a stronger topology burden it does not outrank the spline lookup. The retrieved animated
quad candidate mixes color-target selection, lifetime and drawing; it is not admitted
as a general temporal engine from that one report.

## Marginal recreation coverage

Before: blobs and databol lack spline evaluation and distance lookup. Existing palettes,
fields and ordinary drawing cover much of their remaining composition, but this read is
not a completed original recreation. Projected gain: two different uses, filled smooth
forms and tangent-aligned stamps, become possible without a custom spline class. Exact
Processing RNG, float and distance-lookup replay is expressly not the proposed fidelity.
Full composition walkthrough and native execution are still required before either can
be counted as demonstrated or fully supported.

formsbirds is a possible subsequent transfer case, not held-out evidence: root has read
its note, whose frontmatter is malformed and has no measured substitutions. Its full
composition/source mapping remains unassessed. No whole-corpus percentage follows.

## Bounded delivery order and stopping conditions

1. Terra owns only a private Java numerical probe comparing per-span and per-chord
   distance inversion on an uneven four-control loop. Root reviews actual computations
   and results. No new render infrastructure or full corpus audit.
2. Root decides admission and records extracted-member/remainder treatment in the existing
   ledger, then passes the operation-contract prerequisite check. Freeze numeric behavior
   and fixtures, including the difference between direct and distance evaluation.
3. Delegate Java implementation against that frozen contract. Use a small distinguishing
   suite: control interpolation/seam, nonuniform spacing, duplicates/stationary tangent,
   invalid/overflow input, ownership and bounded representative workload.
4. Build one native LoopMarks example with a control edit and mark transfer. Root reviews
   representative images and retained-data behavior under the shared native render lease.
   Only then integrate the catalog, docs and extracted source distribution.

Stop this investigation if retaining distance mapping does not materially help placing
marks or its public accuracy/work controls require an opaque interface. Reassess the
boundary rather than copy the source class and call it accepted. No worker may write root
acceptance or increment the shipped count.

## Root numerical review

Root reviewed and corrected the private probe: prebuilt tables instead of rebuilding at
every query, explicit uniform parameterization, equal normalized progress for resolution
comparison, and checks at both endpoints of all four spans. The worker's final prose had
a stale maximum-difference value; only the root run below is authoritative.

Command (JDK17.0.20.1+1, compiling Java8-compatible bytecode):

```sh
.work/toolchains/jdk-17.0.20.1+1/bin/javac --release 8 -d .work/cp16-spline-probe-root/classes tools/diagnostics/closedspline/ClosedSplineProbe.java
.work/toolchains/jdk-17.0.20.1+1/bin/java -cp .work/cp16-spline-probe-root/classes closedspline.ClosedSplineProbe
```

Probe SHA256: `773ad3fb2cc95d834ed5cbaa6832b41ffdb290a48c8ea1f0727fc17edf32ef16`.

| chords per span | approximate length | per-span spacing CV | per-chord spacing CV |
| --- | --- | --- | --- |
| 10 | 759.626700 | 0.256526 | 0.050606 |
| 32 | 760.468209 | 0.256097 | 0.020711 |
| 128 | 760.552942 | 0.256056 | 0.018706 |
| 1024 | 760.558514 | 0.256054 | 0.018673 |

For the fixed four-control loop, maximum position difference at256 equal normalized
queries between32 and1024 chords/span is 0.094346062 drawing units.
All eight control endpoints and the closed endpoint seam compare exactly. These are
checks on this nondegenerate input, not a general error bound or periodic-query test.

CV measures straight-line spacing between adjacent samples, including the closing pair.
Curvature makes chord spacing differ even for equal true arc lengths; the residual CV
is not all integration error.1024 chords/span is a convergence reference, not an exact
length oracle. No timing or maximum-size performance claim follows from this probe.

Decision: proceed to a contract for retained per-chord distance lookup alongside direct
uniform evaluation. Increasing integration resolution alone leaves the source strategy's
spacing variation essentially unchanged; keeping interior chord distances materially
improves this mark-placement case. No general numerical resolution default is justified.
Public admission still needs the ledger extraction/remainder review and contract gate;
this experiment does not increment shipped operations or original recreations.
