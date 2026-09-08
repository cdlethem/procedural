# ImageFieldMarks native acceptance plan

Root candidate workflow, JAVA2D720x480 density1. Uses accepted RegularGrid and RasterRemap2D
via candidate ProcessingImageField, then Java2DLayers for cached display. Two generated
opaque sources; no copied photo. Preregister before native rendering.

Capture baseline(size/source0), M visibility, M size-restored, I alternate-image,
C sampled-colors, C colors-restored, I baseline-restored, then S cached save.
IDs baseline,visibility,size-restored,alternate-image,sampled-colors,colors-restored,
baseline-restored. Keys mmiccis. Actual dirty loop, no noLoop/redraw substitutions.

Retain grid identity, all packed positions, both source images/pixels and both Samples
identity/values through every edit. Assert1350 grid/sample positions. Mode edits must not
resample or move marks. Named restored frames equal originals; every other adjacent edit
changes the rendered result. Cached PNG equals restored baseline and save causes no rebuild
for at least300ms. Check opaque framebuffer equals retained display image.

Runtime code origins: RegularGrid/RasterRemap2D from core; ProcessingImageField/Java2DLayers
from adapter. Combined candidate JAR allowed; extracted consumer uses separate JAR origins.
Root inspects that size encodes both shapes, threshold selects darker areas at unchanged
positions, source replacement changes appearance without layout change, and sampled colors
transfer to dots. Exact scalar semantics belong to the standalone image-field probe, not
pixel resemblance. No original-portrait recreation or parameter-range claim.
