# BlurMarks — preregistered D2 artist workflow

Candidate plan before filter implementation, no public or native acceptance. Depends on the
frozen separable-blur contract and an explicit image transport adapter or typed core call.
JAVA2D720x480 density1; no shader/assets. Retain independently generated ARGB source with
thin opaque strokes and a translucent colored shape. Composite over a contrasting ground.

Compute source and three filtered layers once: symmetric soft blur, predominantly horizontal
blur, predominantly vertical blur. Authored positive triangular weight profiles of radius12
for each soft axis and radius24 for the directional axis; delta[1] for the other axis.
These are example choices, not encouraged parameter ranges or Gaussian claims. Set explicit
work budgets from the exact requested dimensions/kernel lengths. Native output must show
alpha spread without hidden-color fringe. Keep the standalone analytic fixture evidence
separate from this artist rendering evidence.

M cycles sharp/soft/horizontal/vertical. B crossfades the selected result with the sharp
source through a retained left-to-right scalar mask. S saves the retained composite.
Mask edits reuse filtered layers rather than filtering again; mixed layer is then composited
over the background with existing source-over. The same source can be swapped for an image
or another Java2DLayers drawing without changing filter/mask arithmetic.

Capture sharp,soft,horizontal,vertical,blended,vertical-restored,sharp-restored;
keys mmmbbms. Retain source, every filter result, mask, kernels and background identity and
values. Mode/mask edits must not run the filter again. Named restores equal original frames;
other edits differ. Save final sharp-restored cache with at least300ms quiet, no rebuilding.
Use real dirty display loop and queued keys, not probe noLoop/redraw substitutions.

Root must inspect all five distinct views: unchanged source, symmetric softening, long
horizontal/vertical footprint and continuous sharp-to-filtered transition. Expected class
origins include filter/compositor/crossfade core versus native layer transport adapter.
Use established source-built runner/extracted-consumer pipeline and shared machine lease.
No full cityPink3d/rgblur recreation: their gain, color styling, per-channel mask sampling,
rotation and fractional shader offsets remain outside this particular workflow.
