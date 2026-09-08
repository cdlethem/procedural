# BlurMarks — retained image filtering

Draw once, filter that drawing, then decide where the filtered version appears. This
workflow demonstrates a transparent drawing softened in both directions or stretched
horizontally/vertically by independent blur kernels. Its output remains an ordinary image
that can be placed inside a region, cropped, or combined with another drawing.

Open `packages/java-processing/examples/BlurMarks/BlurMarks.pde` after installing a build
containing ProcessingImageFilters and SeparableBlur2D. Both are included in the accepted
Java0.29 bundle; native and extracted-package workflow checks passed.

- **M** cycles sharp, soft, horizontal, and vertical filtering.
- **B** mixes the selected filtered image with the original through a left-to-right mask.
- **S** saves the cached composition without recomputing the drawing or blur.

The four layers are retained. Editing the blend or selecting a layer only recomposes them.
Replace the initial Java2DLayers drawing with a completed density-one RGB/ARGB image to use
an input image; retain the same filter and blend calls. To filter a snip independently,
first crop/place it with Java2DImagePlacement. Filtering a whole drawing before clipping
lets neighboring content contribute across the eventual region boundary; filtering an
isolated snip uses the snip's own clamped edges. Choose this ordering intentionally.

`kernelX` and `kernelY` are explicit odd nonnegative weight arrays. A one-element `[1]`
axis contributes no spread. The package normalizes weights, uses clamped boundary samples,
filters premultiplied encoded color, and rounds to ARGB8 after both passes. This avoids
transparent hidden-color fringes; it does not claim linear-light filtering. The example's
triangular radius12/radius24 profiles are authored settings, not measured recommendations.
`maxSamples` counts pixels times the sum of kernel lengths; it bounds requested tap work,
not total memory or elapsed time.

Motivation: the active filters in
[`cityPink3d`](../survey/out/2015/Generativos/cityPink3d/notes.md) and
[`rgblur`](../survey/out/2020/generative/01_04/rgblur/notes.md).
The normalized alpha-safe algorithm is a project design choice. Their complete shader
color treatments, fractional offsets and spatially varying kernels are not reproduced.
See the [contract](../catalog/operations/separable-blur-2d.json) and
[native review plan](../design/capabilities/blur-marks-native-plan.md).
