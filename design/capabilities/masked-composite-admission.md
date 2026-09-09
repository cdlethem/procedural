# Masked source-over dependency admission

Root admits raster.masked-source-over-2d as an independently specified capability dependency.
This admission permits contract preparation, not implementation acceptance or target support.
Root performs architectural review under the maintainer's paused Sol-review sprint policy.

Artist task: paint image content or a rasterized generated drawing over an existing composition
with spatially varying visibility, preserving the background where the mask is zero. Remove
the repeated alpha arithmetic and image-buffer ownership burden. Output can become the next
input, allowing multiple effects to combine without changes to the generators.

Inputs are two same-sized straight packed ARGB8 rasters and one explicit row-major scalar
mask with a finite [0,1] value per pixel. Output is an owned raster of the same dimensions.
The mask is required, with no artistic default or recommended feather width. Its bounds are
mathematical visibility bounds, not inferred sensitivity recommendations. Placement, crop,
resampling and mask generation are separate computations/adapters.

Use source-over with effective source alpha equal to source alpha times mask. Compute working
color with premultiplied stored encoded RGB, then return straight packed ARGB8. Mask zero
preserves destination bits exactly. No hidden gamma conversion, RNG, rendering state or input
mutation. Contract preparation must fix arithmetic order, byte quantization, degenerate
transparent results, validation precedence and representational array limits before code.

Alternative: Processing native tint/blend is useful adapter machinery but is not a portable
pixel specification and does not remove the per-pixel mask/ownership burden. Alternative:
two-input crossfade is useful but computes a different result with translucent inputs; it
remains a separate next admission rather than an ambiguous mode in this computation.

Root read survey/out/2017/Generativos/Eyes/eyes002/notes.md and upstream
2017/Generativos/Eyes/eyes002/eyes002.pde lines 49–71 at source revision
69bdd8513e4482a5e6018e36887d4bc208660eb5. Candidate #1 imageTrail stamps a photographic
eye with changing tint alpha. The report explicitly identifies interchangeable image/draw
callback content. This motivates alpha-controlled image combination; a spatial mask and
independent pixel computation are project dependency design, not whole-candidate equivalence.
The alpha experiment is subtle, so it supplies no recommended opacity range. Trail motion,
shrinking stamp geometry, placement and the photographic asset remain outside this operation.
The asset's redistribution rights are not established by the source repository code license.

Meaningful edit: replace a hard mask with a gradient while holding both input images fixed.
Transfer: replace the source image with generated marks without changing compositing code.
Validation must include analytic translucent-pixel cases, zero/one masks, hidden RGB,
source immutability and native display of crop/generated-content transitions. This admission
does not claim another original sketch recreated or the complete composition batch delivered.
