# CP13 admission: retained raster remapping

Root admits one independently specified raster-remapping dependency for WarpMarks. This is
not a merge of the complete noiseWarp candidate or a claim of exact Processing source replay.
Java implementation follows a frozen contract; ports remain deferred.

## Artist capability and boundary

Draw a pattern, then bend the captured image using a supplied source-coordinate field.
Changing the field does not mutate the source raster. Return an owned output raster that
can be displayed, saved or used as another input. The core performs the four-tap sampling
and ordered reconstruction; example code chooses the field, displacement strength, pattern,
lighting-free drawing and palette. No host callback, noise generator or PImage enters core.

One batch operation is sufficient: RasterRemap2D.remap. Do not add a separately counted
single-pixel sampler until an independent workflow needs one. A typed Java packed-buffer
overload performs the same operation as its portable parameter-object entrypoint and avoids
hundreds of thousands of boxed coordinate pairs for normal artist use.

## Decisions for the contract

- Source and output dimensions are positive integer pixel counts, products limited only by
  Java-compatible signed32 array indexing (coordinate buffer needs twice output pixel count).
  This is representational, not a recommended image size. Allocation failure is not partial
  success or an input error. No arbitrary performance default or maxPixels parameter.
- Source is row-major packed ARGB8 with unassociated (straight) stored channels, top-left
  origin. Integer sample coordinates designate pixel centers. Output has one source[x,y]
  query per row-major destination pixel, supporting different output dimensions.
- Require finite binary64 coordinates. Clamp each whole coordinate to the source's closed
  center bounds before floor/fraction; repeat edge taps. One-pixel dimensions work normally.
- Interpolate A,R,G,B independently in their stored encoding. For each channel: top=a+(b-a)*fx,
  bottom=c+(d-c)*fx, value=top+(bottom-top)*fy, with each operation separately rounded binary64;
  clamp value to[0,255], then floor(value+0.5) once. No intermediate integer color lerps,
  FMA, gamma correction or premultiplication. Integer-coordinate identity preserves all32bits,
  including hidden RGB in transparent pixels. Straight-channel filtering may expose hidden
  RGB at translucent edges; this is documented behavior, not physically linear compositing.
- Copy/own completed output; do not retain caller pixels or coordinates. No in-place writes.
  Validate all input shape/values before output allocation. Source mutation concurrent with
  a call is outside contract; later mutation must not affect the result.
- Result exposes width/height, detached packed ARGB Java int[] copy, checked pixel access,
  and portable value export. Avoid a general image object with decoding/color-mode state.
- Typed Java overload accepts int[] pixel bit patterns and packed double[] XY coordinates.
  Portable object form uses unsigned32 integer pixels and coordinate pairs. Both share one
  arithmetic kernel and the same static validation order; no alternative algorithm.

The channel decision preserves stored-color interpolation and exact identity without adding
color-space modes. It is a project design choice, not an experimentally established visual
recommendation. If future workflows need linear-light/premultiplied filtering, evaluate a
separate explicit semantic revision rather than silently changing this result.

## Evidence and remainder accounting

Root read the complete colorRamp note and pinned active source69bdd8513e4482a5e6018e36887d4bc208660eb5,
lines69–99. Candidate#1 supplies capture plus pull-sampling use; candidate#2 describes bilinear
sampling. Noise frequency/strength, dots, shadows, grain, random stop selection and the
positioned color ramp are outside this dependency. Keep their original candidate statuses;
this generic remapping is not whole-computation equivalence.

triangleRamp's disabled warp is not an active second example. Sabanas transforms points,
not raster pixels, and remains a counterexample. A radial/analytic displacement field and a
second pattern are explicit transfer tests. No additional original recreation is counted.
The existing source uses nested Processing color lerps; single final quantization here is
an explicit divergence. Do not claim source negative-modulo extrapolation: collapsed edge
taps invalidate that earlier worker inference.

## Acceptance before delivery

Focused exact pixel fixtures: identity (including alpha/hidden RGB), two-axis interpolation
that distinguishes intermediate rounding, half ties, edge clamp/extreme finite coordinates,
one-pixel axes, different output dimensions, row order, complete ownership and atomic input
errors. Compare portable and typed Java entries through the same fixtures. Benchmark small,
640-square and larger representative packed inputs with bounded memory, no per-pixel object
allocation. Native JAVA2D WarpMarks demonstrates zero/changed displacement, a second field,
source reuse and save. Root reviews actual output and consumer install; compile alone is
not acceptance. No ports, shader renderer, general color ramp or full-original recreation
claim follows from this admission.

## Distinguishing pixel examples for fixture authoring

These are analytic expectations, not native observations:

- A2×2 grayscale raster with channel values0,1 on the top row and1,2 on the bottom,
  sampled at(.5,.5), yields channel1. Quantizing horizontal lerps first yields2 and fails.
- Opaque red and transparent hidden-blue pixels sampled halfway yield ARGB0x80800080
  under the chosen straight-channel rule. Premultiplied filtering would differ; this case
  makes the documented choice observable. Sampling the transparent pixel's exact center
  preserves its hidden blue bits.
- Identity coordinates return every source pixel exactly; coordinate pairs are ordered by
  destination row, regardless of whether neighboring source samples reverse direction.
- Queries at finite extremes clamp before indexing or fractional subtraction, avoiding
  overflow/narrowing. A1×1 source repeats its only pixel for every finite coordinate pair.

Golden fixture authors must calculate channel expectations independently of the Java
implementation. Tests must not simply regenerate their expected results from its kernel.

## Root contract review

The catalog contract and 13 analytic shared cases are reviewed for implementation. Root
added explicit product limits, passive Java carrier types, unsigned export versus signed
packed access, safe-index bounds and validation order to the initial worker draft. The
seven successful vectors are hand-derived (including two-axis channels 0xff104020); six
invalid configurations exercise shape, value and product rejection. Native-only cases
cover nonfinite values, ownership and typed carriers that JSON cannot represent.
This approves the specification only. Java core, native workflow, performance and extracted
package evidence are pending; no delivered operation or target support is added here.
