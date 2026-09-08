# MaskMarks native plan

Root preregisters actual PDE validation before acceptance. Java2DLayers candidate and
MaskMarks remain unaccepted until native/source review. JAVA2D density1,720x480, no external
assets; upstream eye image is not copied. Retained ellipse/triangle native alpha mask controls
independently generated stripe and picture layers, then the same mask controls crossfade.

Use established registered starter runner and shared machine render lease. Capture six states:
baseline stripes-through-mask; M image-through-mask; M crossfade; V mask view; V restored
crossfade; M restored baseline; S cached save. IDs baseline,image,crossfade,mask-view,
crossfade-restored,baseline-restored; keys mmvvms. Keep the actual dirty-frame display loop;
probe must not substitute noLoop/redraw or otherwise repair the example's interaction logic.

Retain identity and values of ground/source/marks/maskImage and coverage through all modes.
Verify mode/visibility transitions, restored results, core/adapter JAR origins, cached final
save and no rebuild on save. For composite modes, samples with mask0 equal ground; for
crossfade, weight0 equals marks and weight1 equals source. Do not require unchanged background
outside the mask in crossfade mode: the first content intentionally occupies those pixels.

Mask view displays a transparent PImage over gray; its framebuffer is intentionally not
identical to its raw ARGB pixels. Verify the retained raw mask and view mode, plus a known
clear-mask pixel showing the gray background. Keep that separate from opaque-result
framebuffer checks. Final save occurs after baseline restoration, not during mask view.

Root inspects mask view and all three content modes; acceptance must show genuine shape
boundaries and partial visibility in the triangle. This is native raster-alpha coverage,
not analytic polygon membership or a luminance mask. Half-alpha black triangle contributes
128/255 regardless of RGB. No automatic semantic image extraction or font support claim.

One bounded run and cached-save check; repeat only for changed inputs or a concrete failure.
Separate adapter probe covers lifecycle, malformed dimensions/density, ownership and exact
pixel fixtures. Distribution/extracted-consumer acceptance remains a later integration step.
