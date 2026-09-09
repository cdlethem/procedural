# MaskedPartitionMarks — preregistered native workflow check

Candidate JAVA2D workflow, not yet accepted. Root owns final native and visual review.
Reuse the PathClipMarks source-build/preprocessor/event harness and shared machine lease.

At 720x480 density one, the same four irregular ellipse masks receive (1) retained global
GradientPath2D content, (2) locally anchored marks, and (3) an explicit raster crop. Masks
come from native alpha drawing; no polygon clipping or inferred semantic image selection.
Source artwork is independently authored project content, not a copied corpus asset.

Post actual keys nnmm0s: baseline, shifted layout, restored layout, local content, image
crop, reset. Each change must cause a new cached frame. Source objects and sourceBuilds=1
stay unchanged throughout. Mask list identity changes only for the two layout edits;
maskBuilds by frame are1,2,3,3,3,3. displayBuilds are1..6. Reset must equal baseline pixels;
restored layout must also equal baseline pixels. Save must match the final displayed
pixels, add no build or redraw during a300ms quiet interval, and preserve retained inputs.

Verify all pixels outside every ellipse's enclosing inset rectangle equal the background;
this is a conservative untouched-outside assertion, not an exact native ellipse-edge oracle.
The focused adapter probe separately tests exact supplied mask coverage, holes, frame
independence and fractional alpha. Hash retained source images and trace points across
edits, not just construction counters. Verify actual portable core code source, renderer,
density, dimensions, generated/compiled artifact hashes and current source stability.

Root views baseline, shifted, local and crop images at artist scale. Require a clearly
visible layout edit, legible global path content, visibly local content and an identifiable
image crop. If a view is weak, revise the artwork and preserve the unsuccessful attempt;
passing numerical checks alone does not accept the workflow. Refresh the central gallery
only with the final reviewed outputs. No new operation or original recreation count.

## First visual review correction

Attempt .work/masked-partition-marks-native-root1 passed the numeric sequence, but root
found the global view too sparse: twelve traces starting along one edge left most windows
unreadable. Keep that attempt. Revised authored artwork uses24starts across a6x4layout and
an opaque dark global layer, so mask placement is visible independently of path density.
This changes example composition only, not operation defaults, contracts or useful ranges.
