# Reuse a mask across different drawings

One transparent triangle-shaped mask reveals stripes, then a picture, then a transition between
the two. The same shape can control several finished drawings.

[Install the Java library](building-java-from-source.md), then open **MaskMarks** in
Processing’s contributed-library examples and save a copy.

| Key | Visible change |
| --- | --- |
| M | Cycles masked stripes, a masked picture, and their crossfade. |
| V | Shows or hides the mask view. |
| S | Saves the displayed image. |

Draw a new mask with native shapes or use the alpha from a finished image. Replace either
content image with your own drawing, then composite it through the same mask. Alpha controls
coverage: transparent pixels reveal nothing, opaque pixels reveal fully, and antialiased edges
reveal partially. RGB color does not change mask coverage, so opaque black and opaque white
behave the same.

Images used for mixing must have matching width, height and pixel density of one. RGB images
are treated as opaque and ARGB images retain their alpha. The mask view shows transparency over
gray; it is not a brightness mask. Retain completed layers rather than rebuilding them each
frame. See [composing Java effects](composing-java-effects.md) for more ways to combine images.
