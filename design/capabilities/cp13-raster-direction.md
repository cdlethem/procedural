# CP13 raster warp direction — architecture investigation

Root selects this next Java capability; no public contract or implementation is accepted yet.
Artist task: draw a pattern once, deform the raster using supplied spatial coordinates, and
reuse the same source image when changing displacement or appearance. Bilinear sampling
and safe source/destination ownership are the algorithmic burden removed.

Root read the complete `2016/Generativos/colorRamp` note and pinned source lines69–99 at
upstream69bdd8513e4482a5e6018e36887d4bc208660eb5. The active computation captures the
canvas, then each destination pixel samples the captured source at its own coordinate plus
an angle-derived displacement. This is pull resampling, not moving/splatting source pixels.
Source noise/trig and the grain before/after resampling are separate computations.

The report proposes colorRamp#1 noiseWarp and #2 getSmooth. Keep their composite versus
extracted status distinct. The companion triangleRamp warp is commented out and is not a
second active reproduction. Sabanas warps point positions twice and is not raster sampling.
A second supplied coordinate field is an explicit transfer design test, not another original
already recreated by this addition.

## Boundary under review

One retained packed source raster, explicit dimensions and source-sampling coordinates;
row-major output independent of source mutation. No PGraphics/PImage in the portable core,
no implicit noise, palette, RNG, callback or renderer state. Processing pixel import/export
belongs to the example or a justified adapter, with explicit density and ARGB transport.
Whether point-sampling and batch remapping need separate public entrypoints is unresolved;
do not multiply operations before the complete example shows a need.

Freeze coordinate centers, edge clamping, interpolation order/quantization, alpha convention,
finite/overflow handling, output ownership, and work/memory bounds before implementation.
Do not adopt a different algorithm just to make tests easier, or advertise source replay
when portable channel arithmetic differs from Processing color interpolation.

## Source-audit correction

Worker initially inferred negative-coordinate extrapolation from raw `%1` fractions.
Root rejects that inference: for negative coordinates both clamped integer taps collapse
to the same edge index; additionally the inspected Processing Android PGraphics implementation
clamps lerp amounts. This does not by itself prove desktop bit equivalence. Read the actual
desktop lerpColor path before documenting differences. Source intermediate color lerps may
quantize between axes; a proposed single final quantization must be named as a design choice.
No source defect or visual artifact is claimed from the raw-modulo expression alone.

## Parameter evidence and acceptance

The colorRamp report records moderate whole-image changes for det=.01 and dd=40. These
control the example field, not bilinear interpolation. Randomized nested defaults and
surrounding dots/palette/grain confound recommended ranges. Publish no inferred encouraged
ranges. Dimensions, buffers and sample coordinates are caller data with semantic validity
constraints; any resource limit must be explicit and justified separately.

Before implementation: resolve alpha/interpolation and review ledger admission, then freeze
one language-neutral contract. Before shipping: distinguishing analytic pixel fixtures,
ownership/error checks, bounded representative-size performance, native JAVA2D WarpMarks,
identity/translation/nonuniform field edits and a second source-pattern transfer. Root views
actual outputs. New whole-original recreation count stays zero until a complete composition
is implemented and reviewed at declared fidelity; colorRamp also has a distinct color-ramp
computation that the existing cyclic palette does not reproduce exactly.
