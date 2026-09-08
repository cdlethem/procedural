# Let an image control the marks

Included in the accepted Java0.29 source bundle; native workflow and extracted-package checks passed.

ImageFieldMarks keeps one grid and samples two generated pictures at its positions.
M switches between brightness-controlled dot size and brightness-controlled visibility.
I substitutes the picture while retaining the grid; C uses sampled image colors; S saves
the cached result. Replace a generated picture with a completed RGB/ARGB image to use your
own source. Fit it to the desired canvas first when its dimensions differ.

ProcessingImageField.snapshot owns an image copy; later edits to the original do not change
it. sample accepts packed x,y positions in source pixel-center coordinates and returns
immutable attributes. Capture and sample once, then reuse the values when changing marks.

maxRgb01 is the largest RGB channel divided by255, independent of alpha. It is not weighted
luminance. alpha01 provides separate visibility information; transparent white has brightness1
and alpha0. This example uses opaque source images. For transparency-aware controls, choose
explicitly how alpha affects the size or visibility rule instead of treating hidden RGB as ink.

The sampler uses the existing clamped straight-channel bilinear RasterRemap2D contract.
An image field queries stored color data; it does not use the alpha-aware native scaling of
Java2DImagePlacement. Coordinates outside the image clamp to its edge. Crop, fit and source
selection remain explicit, and no automatic feature recognition is involved.

The16-pixel spacing, dot diameters and0.65 visibility threshold are authored example choices,
not recommended ranges inferred from the corpus. The motivating crb sketch uses image
brightness in its size and stroke decisions; this workflow does not reproduce its packing
or endpoint-selection algorithm.
