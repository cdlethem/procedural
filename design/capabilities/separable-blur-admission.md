# Separable weighted blur — D2 capability dependency admission

Root admits an independently specified normalized separable blur, not equivalence to either
source shader. Use a supplied image or retained drawing, soften it horizontally/vertically,
then reuse its output with existing masks and crossfades. Two small one-dimensional weight
arrays determine the blur footprint independently of content. A delta axis[1] leaves that
axis unspread; symmetric binomial example weights demonstrate softening without prescribing
an artistic default. Unequal axes demonstrate directional transfer.

Evidence: cityPink3d#2 actively computes a weighted3x3 filter, and rgblur#0 applies successive
horizontal/vertical filters. Root source review establishes the former's gain/divisor15 and
opaque output, and the latter's per-channel RGB-mask modulation/fractional shader samples.
Those are not normalized alpha-safe filtering. Root's native PImage BLUR study additionally
shows visible hidden-RGB contamination. The new operation supplies the missing reusable
component; source vignette, scanlines, gain, fractional directional offsets and texture-modulated
kernel selection remain separately unimplemented source behaviors. No complete original
recreation or recommended kernel range follows from this admission.

Inputs: same-size output from straight ARGB8 source, two odd nonempty finite nonnegative
weight arrays with at least one positive entry per array, explicit safe-integer maxSamples.
Outputs: detached ARGB8 raster. Computation: normalize each axis, edge-clamp, filter horizontal
then vertical in premultiplied encoded RGB with no intermediate byte quantization, finally
unpremultiply and quantize. Normalized blur preserves constant visible color; alpha can spread
without a hidden-color fringe. This is encoded RGB, not linear-light filtering.

Alternatives: ordinary drawing masks change visibility rather than soften content;
RasterRemap2D chooses one spatial sample rather than accumulating a neighborhood; native
PImage BLUR fails the desired alpha behavior. A monolithic vintage filter would entangle
source-specific colors/gain with useful filtering. Gaussian parameter synthesis and arbitrary
2D kernels are not needed for this first composable filter; supplied separable weights are
an explicit reusable control, not source constants baked into the implementation.

Root owns numeric order, fixtures and final review. Follow operation-contract,
deterministic-generative-semantics and generative-performance skills. No production code
until catalog contract and distinguishing fixture plan are frozen. No per-pixel objects;
O(pixels*(kernelX.length+kernelY.length)) declared work, preflight caller work budget before
raster/intermediate allocation, O(pixels+kernel lengths) live storage. Weight-zero taps count
toward declared work so a budget does not depend on an optimization. Avoid a full2D convolution.

Native acceptance: transparent colored shape softened over a contrasting ground, horizontal
versus vertical footprint, and same retained filtered result mixed through an independent
mask. Standalone tests cover identity, constant fields, impulse footprints, hiddenRGB,
alpha quantization, edge clamp, axis ordering/intermediate precision, normalization overflow
resistance and input/budget failures. Port support deferred; exact operation semantics remain
language-neutral. Source code and photographic assets are not copied.

Authoritative evidence hashes and candidate remainder accounting are in the dependency
admission in design/phase2/cluster-decisions.json and filter-source-review.json. Kernel
weights and work budget are caller data; no measured artistic parameter ranges available.

## Numeric brief for catalog drafting (catalog becomes normative on freeze)

Object form exactly {source:{width,height,pixels},kernelX,kernelY,maxSamples}. Dimensions
positive signed32, product<=2147483647; pixels exact count unsigned32. Kernels are odd,
nonempty lists, length<=2147483647, finite binary64 nonnegative entries with a positive
maximum. maxSamples is required integer in[1,9007199254740991]. No defaults.
Typed Java form blur(int width,int height,int[] pixels,double[] kernelX,double[] kernelY,
long maxSamples), plus blur(Object). Return immutable result with width,height,
pixelAt(Object/long), pixels() detached, toValues() detached; use existing raster index rules.
Object numeric carriers are the established six only; stable passive inputs, no mutation.

Validate source/dimensions/product/count/values, X length/values, Y length/values, then
maxSamples representation. INVALID_INPUT precedes WORK_LIMIT. Compute exact declared work
P*(lenX+lenY) using wide integer arithmetic. If above maxSamples fail WORK_LIMIT before
allocating normalized kernels/output/intermediates. Count all taps, including zeros and
identity axes; this is an explicit upper-bound contract, independent of optimizations.
Pixel-index INVALID_INDEX precedes INDEX_OUT_OF_RANGE. Resource allocation failures propagate
as host resource errors, not input errors or partial output.

Normalize each axis independently: m=max supplied weights; in index order q[i]=w[i]/m;
S starts+0 and adds q[i] in order; normalized[i]=q[i]/S. This avoids overflow from summing
large supplied weights. Underflow follows binary64; no epsilon, compensated sum or fast-math.
If both kernel lengths are1, after all validation/budget checks return detached original
packed bits exactly (including hidden RGB). Other kernels follow filtering even if their
only nonzero weight is central; alpha0 output is canonical transparent black.

For each horizontal output pixel in row-major order, zero four accumulators A,R,G,B.
Visit X taps in array order, index offset i-floor(lenX/2), clamp source x+offset in integer
arithmetic without overflow. Let a=sourceAlpha/255.0. Compute A += a*weight. For each byte
channel c, compute premult=c*a; R/G/B += premult*weight as separate operations. Store the
four binary64 horizontal results without byte quantization. Transparent RGB contributes0.
Then visit output pixels row-major and Y taps in array order, clamp source y+offset. Sum
each stored component times normalized Y weight into four new accumulators. Do not clamp
or quantize between passes. Horizontal then vertical is observable and fixed.

Let Q(v)=floor(min(255,max(0,v))+0.5). If final A==0, output0. Otherwise alpha=Q(A*255);
if alpha==0 output0. For each channel output Q(component/A). Pack ARGB. Every arithmetic
step is separately rounded IEEE binary64 ties-to-even, no FMA/reassociation, no gamma
conversion. Kernel normalization precedes passes. No zero-tap shortcut may change output.
Implementation uses four P-length double arrays for the horizontal pass and an owned
P-length int output; never allocate per-pixel objects or a full2D kernel. Numeric parity
and work count are preserved under later output-preserving optimizations.

Fixture plan: identity hiddenRGB and budget-before-identity; normalized constant opaque
and partial-alpha fields; 3x1 red impulse with X[1,2,1]/Y[1] -> alpha64,128,64 with redRGB;
hidden-color invariance; clamped edge impulse; vertical transpose; asymmetric kernels to
prove tap orientation; fractional-alpha 2D case distinguishing intermediate quantization;
large weights normalized without overflow; zero kernel/even kernel/nonfinite/carrier/count
errors; resource budget short-by1 versus sufficient. Independently compute small expected
outputs; do not generate expectations by calling the Java implementation under test.

## Root contract freeze

The authoritative catalog is now catalog/operations/separable-blur-2d.json version0.1.0.
Root reviewed all numerical steps and note bindings; the catalog checker passes. Shared
fixtures contain20 scenarios including13 successful vectors independently evaluated in
Python. Root corrected asymmetric-tap prose to alpha85,128,43, added the vertical asymmetric
case, zero-tap work accounting, and invalid-input precedence over work rejection.
The faint2x2 red impulse distinguishes final-only quantization from a plausible rounded
intermediate implementation. Native-only NaN/disallowed-carrier and ownership/index cases
remain mandatory implementation checks, not pseudo-JSON fixtures.
Contract approval does not attest implementation, native results or a packaged operation.
Terra owns the bounded core and focused probe; root owns adapter boundary and final review.
