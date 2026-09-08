# CP14: control where color transitions happen

Root admits one noncyclic positioned-stop sampler, `color.stop-ramp`, for Java-first
implementation after its contract and fixtures are frozen. This closes the color-ramp gap
left separate from CP13 raster sampling. It does not add a palette generator or renderer.

## Artist task and boundary

Keep an arrangement of marks and its scalar values, then move a color transition without
moving the marks. Unequal stop spacing controls which portions of a field, radial distance
or path progress receive a color transition. Existing CyclicPalette provides equally spaced
cyclic colors, including last-to-first interpolation; expressing unequal noncyclic stops
through it would require another interval-selection algorithm in every caller.

Create an immutable StopRamp from explicitly positioned opaque RGB24 colors; sample one
scalar into an RGB24 value. The sampler owns interval selection and channel interpolation.
Drawing, scalar generation, opacity, random palette construction and editing the stop list
remain ordinary caller choices. A typed Java positions/colors overload makes authored
sketches concise while preserving one parameter-object computation.

## Evidence and limits

Pinned upstream source revision: `69bdd8513e4482a5e6018e36887d4bc208660eb5`.
Root read colorRamp and celular notes and decisive source; reviewed boxDepth and triangleRamp
reports and the bounded source audit. Candidate identities and note/evidence hashes remain
bound in the Phase 2 ledger.

- colorRamp#0: source139–145 constructs four opaque RGB stops at0,1 and two random positions;
  163–194 inserts and samples stops; show196–201 draws scanlines. Random dot colors at57
  are not spatially determined by the vertical background. The full note contains that
  prose/code tension. No tested stop-spacing range is provided.
- boxDepth#0: source17–21 supplies stops0,.2,.5,1; source100 maps noise to ramp colors.
  Source132–170 contains the same insertion/sampling family. The note has no parameter
  experiments and its animated shader rendering is not color-sampler numerical evidence.
- celular#0: source126–134 explicitly selects three unequal intervals0–.3–.8–1;
  radial query generation at64 and opacity at67 are independent. The loops at57–59 extend
  from minus width to width, so do not infer that all queries are limited to visible-canvas
  corner distance. The helper delegates out-of-range behavior to host lerpColor. Existing
  experiments vary geometry/background/blur, not stop positions.
- triangleRamp#0: source112–118 constructs endpoints and two random stops;154–174 samples
  and draws the ramp. The active square grid samples random ramp positions. Its palette
  experiment changes both colors and RNG consumption, hence also grid count; it does not
  isolate stop placement. The triangle branch and raster warp are inactive.

The source ColorRamp insertion keeps a descending list under the actual construction
sequences. It does not establish a robust arbitrary-insertion or duplicate-stop policy.
The library will not claim exact source replay or reproduce accidental insertion behavior.
Opaque RGB24 and channel rounding follow the existing CyclicPalette convention; this is
portable design, not experimental evidence for a color space or perceptual interpolation.

## Frozen architectural decisions for specification

- Input is a nonempty ordered list of records `{position,color}`. Positions are finite
  binary64 in[0,1], strictly increasing; colors are integer RGB24. Reject duplicate or
  unsorted positions rather than silently sorting or choosing a discontinuity policy.
  One stop is a constant ramp. Endpoints0 and1 are not mandatory.
- Query is any finite binary64 scalar. Hold the first color at/below the first stop and
  the last color at/above the last stop, without wrap. Exact stop queries return that color.
  Reject invalid queries even for a one-stop ramp.
- Between stops use t=(query-left)/(right-left), each operator separately rounded binary64;
  interpolate each stored RGB8 channel a+(b-a)*t and quantize once with floor(value+.5),
  matching CyclicPalette's encoded-channel convention. No FMA, easing, gamma or alpha mode.
- Copy input; serialize detached stops. No mutation API, host objects, RNG or callbacks.
  Canonicalize position minus-zero to plus-zero in stored/exported data.
- One named operation: StopRamp.create(Object) or create(double[] positions,int[] colors),
  sample(double/Object), serialize(). Both constructors share validation and query kernel.
  Exact object keys and six Java numeric carriers follow CyclicPalette. Invalid static data
  gives INVALID_INPUT; invalid query gives INVALID_QUERY. Length <=2147483647 is an indexing
  limit, not an allocation promise. Setup/export O(n), binary-search lookup O(log n), no
  allocation per scalar query. No defaults or encouraged artistic parameter ranges.

Strict ordering, constant one-stop ramps, sparse endpoint holds and duplicate rejection are
explicit design decisions. Source evidence establishes the artist capability, not these
edge policies. No new parameter experiment is justified merely to invent a recommendation
for caller-supplied artwork/data.

## Acceptance and bounded implementation batch

Root owns catalog, analytic fixtures and final integration. A fresh Terra task implements
one Java class and focused core checks against the frozen contract. Reuse the existing
palette fixture/query structure and source-bundle tools; no new general validation framework.

Distinguishing cases: unequal intervals versus cyclic indexing; exact interior stop and
endpoint holds; one-stop invalid-query validation; half-up RGB ties; narrowly separated
binary64 stops; invalid ordering/duplicates/carriers; constructor and serialization ownership;
typed/object equivalence. Timing only at small and larger retained ramps, with checksums.

RampMarks should demonstrate a fixed mark grid colored by scalar progress, one interior-stop
edit, recoloring without geometry change, and radial-progress transfer using the same sampler.
Native JAVA2D edits/reset/save plus extracted bundle execution remain required. Authored
example stop choices are not recommended ranges. No original-sketch recreation, P3D shader
support, alpha interpolation or non-Java port follows from this admission.
