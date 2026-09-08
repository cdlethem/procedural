# Processing image filters — root boundary decision

This adapter transports completed Processing images through the reviewed portable filter.
It supplies no separate blur algorithm and does not invoke PImage.filter or a shader.
The artist can filter a retained drawing or image crop, then feed its result to existing
Java2DLayers compositing/crossfade or Java2DRegions callbacks. No filter-chain executor is
needed: each call returns an ordinary independently owned PImage.

Frozen entry point: org.procedurals.processing.ProcessingImageFilters.separableBlur(
PApplet parent, PImage source, double[] kernelX, double[] kernelY, long maxSamples).
Returns a density-one ARGB PImage with unchanged dimensions. Processing Java only;
no renderer support beyond completed CPU-readable PImage transport is asserted. Source must
be complete and stable; end drawing before supplying a PGraphics. No decoding or asset IO.

Validate non-null parent/source, positive dimensions/product <= signed32 maximum,
density one, matching physical/logical dimensions, RGB or ARGB format, then loadPixels
and require exactly width*height pixels. Invalid image transport throws
IllegalArgumentException. ALPHA images and higher densities are explicitly unsupported,
with the same exception, rather than reinterpreted or resampled. RGB pixels become opaque
in a detached temporary buffer; ARGB bits retain their meaning. Source buffers are never
written. Delegated core validation/error codes and work limit propagate unchanged.
The core preflight covers filter allocations; the adapter's RGB normalization may allocate
one input-sized buffer before that preflight. This is not a total memory budget.

Call SeparableBlur2D.blur exactly once; create a fresh ARGB image and copy its owned output.
Do not retain input, kernels, parent or result globally. No mutable renderer/style changes,
no implicit resizing, no native fallback, and no artistic defaults/ranges. Caller images
and output are independently mutable after return. Allocation/lifecycle failures propagate.

Motivation and deviations: design/capabilities/separable-blur-admission.md and its bound
cityPink3d/rgblur evidence. Premultiplied normalized filtering is a project design decision;
this is not a recreation of either complete shader. Tests must use real PImage objects,
cover RGB opacity, ARGB/core parity, ownership, invalid format/density/count and delegated
work-limit failure. BlurMarks provides the separate artist workflow/native review.
Implementation, native validation and packaging remain pending at this decision checkpoint.
