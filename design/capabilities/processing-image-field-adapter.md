# Processing image field — frozen D1 adapter brief

Root admission: an image snapshot and batch sampling convenience over accepted
RasterRemap2D, not a second sampler or a new portable computation. Artist capability:
reuse a loaded image/retained drawing as a source of mark color, size or visibility at
positions generated independently. Later substitute the image without changing positions.
No source-sketch reproduction or recommended artistic parameter range is claimed.

Evidence: survey/out/2019/generativos/crb/notes.md, candidate#0 poissonScatter. Root read
upstream crb.pde lines55–77: image.get at supplied integer positions, brightness/255 maps
size. Lines112–120 gate strokes. Source lines142–154 shrink trial radii while brightness
difference>30; this is not a gradient/edge detector and is not admitted here. Source
photograph and source code are not copied. Fractional clamped batch sampling is project
composition design reusing the separately accepted RasterRemap2D semantics.

## API and ownership

Final org.procedurals.processing.ProcessingImageField:

- static ProcessingImageField snapshot(PImage image).
- int width(), int height().
- Samples sample(double[] packedXY).
- immutable nested Samples with int size(), int argb(int index), double alpha01(int index),
  double maxRgb01(int index). Index failures throw IndexOutOfBoundsException.

Do not add aliases, channel selectors, luminance constants, scalar remapping curves or
per-point convenience allocations. Callers decide size ranges/thresholds/alpha weighting.
The immutable snapshot owns canonical ARGB pixels. Samples owns its packed result and
returns only values, never mutable internal arrays. Once captured, no PImage/parent remains
retained and sample performs no native calls or RNG consumption.

Snapshot requires nonnull completed RGB/ARGB PImage, positive dimensions, density1,
pixelWidth==width and pixelHeight==height, long product<=Integer.MAX_VALUE. Synchronize
loadPixels and require exact array length. Copy pixels; force RGB alpha255 in the copy,
preserve ARGB stored bits. Fail invalid input with IllegalArgumentException. Input pixels
never change (loadPixels may synchronize its buffer). Sketch-thread snapshot only; stable
completed inputs as with other image adapters. No renderer/font/decoding support follows.

## Sampling and scalar interpretation

packedXY length is even; each pair is a supplied x,y in source pixel-center index units:
(0,0) is first pixel center, (width-1,height-1) last. Reject null, odd length or nonfinite
coordinates with IllegalArgumentException before output. Empty input yields empty Samples.
For nonempty pairs call RasterRemap2D.remap(width,height,ownedPixels,pairCount,1,packedXY)
and retain the returned owned pixel result. Do not reimplement interpolation or bounds.
The Java array length and existing remapper limits bound pair count; do not invent a cap.

Sampling clamps to source edges and interpolates stored straight ARGB channels with the
accepted remapper's quantization. It is intentionally distinct from native alpha-aware
image fitting. Colors underneath alpha0 can affect sampled RGB. This is image data querying,
not rendering. Users who want visibility-aware values combine the explicitly separate alpha.
maxRgb01(index)=max(red8,green8,blue8)/255.0 using the sampled, quantized color; alpha ignored.
alpha01(index)=alpha8/255.0. Both in[0,1]. No parent colorMode influence or luminance inference.
A red/green interpolation midpoint distinguishes max of interpolated channels from
interpolated max values. The former is the specified behavior.

Work: O(source pixels) snapshot and O(query count) batch sampling, using existing bounded
core allocation. No per-query objects or repeated whole-source copy in sample. Snapshot
once and reuse across batches; caller retains results when editing mark rendering.

## Acceptance scenarios and delegation

Root implements the small adapter directly. Terra owns one focused standalone/native probe after this freeze.
Root reviews source and exact scenarios; no worker root acceptance/catalog/manifest edits.
Use existing pinned Java8/Processing environment and shared native lease. Test:

1. Asymmetric2x2 ARGB at integer centers and clamped outside coordinates matches exact colors.
2. Fractional coordinates exactly agree with the accepted remapper for a small varied-alpha
   input; red/green midpoint has maxRgb128/255 rather than1 (quantization matters).
3. Alpha0 bright RGB yields maxRgb1 and alpha0; RGB raw high-byte0 becomes opaque.
4. Source mutated after snapshot does not change samples; query-array mutation after sampling
   does not change retained Samples. Repeated batch calls preserve prior results.
5. Empty input, all invalid snapshot forms, odd/null/nonfinite queries, bad indices.
6. Small existing RegularGrid positions feed the field; retained maxRgb drives authored mark
   sizes, then the same sampled data controls mark visibility. No actual photograph needed.

Use assertions that distinguish wrong behavior; no sampled nonzero check as substitute for
an expected layout/color. Keep files readable. Record exact argv/source/runtime hashes and
outputs in fresh ignored .work path. Root owns one native artist workflow and transfer
review before acceptance, then packages D1 with the subsequent accepted D2 filter slice.

Evidence hashes: note `54b121c67aa97560449bac46cf72b5c91d595f0ed3ad982895b89b17e1a4645b`; upstream source `58c81c64d3b1a9433dc3ea9f0b142ce76b220db85b0a768298f8f681a54d564f`.
