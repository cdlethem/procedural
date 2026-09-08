# PlacementImageMarks native plan

Root preregisters workflow acceptance before rendering. Actual candidate PDE in JAVA2D,
720x480 density1; independently generated320x160 source, no copied assets. Adapter contract:
java2d-image-placement-adapter.md. Root owns acceptance; implementation remains candidate.

Capture a bounded sequence using queued real key events and actual dirty draw loop:
baseline(CONTAIN,uncropped,center); F cover; F stretch; F contain-restored;
C cropped; A aligned-end; M masked; M unmasked-restored; S cached save.
IDs baseline,cover,stretch,contain-restored,cropped,aligned-end,masked,unmasked-restored.
Keys fffcamms. Eight captures, followed by save quiet period at least300ms.

Do not substitute noLoop/redraw or repair the example's lifecycle in the probe. Retain
source/ground images and their pixel arrays' values throughout. Retain mask/fullCoverage
array identity and values. Switching M must preserve placed-image identity/pixels; switching
fit/crop/alignment deliberately recomputes it. Cached save must not rebuild anything.
Final saved PNG equals the final unmasked cached output, not the initial baseline.

Check baseline==contain-restored and aligned-end==unmasked-restored. Contain,cover,stretch,
cropped,aligned-end and masked must differ at appropriate steps. All result images are
opaque when composited over ground; outside Frame(80,60,560,360), displayed pixels equal
ground in every state. Within the frame, contain margins expose ground. The mask changes
visibility of placed content without changing its source selection/placement.

Runtime origins: Java2DImagePlacement and Java2DLayers from expected adapter JAR;
MaskedComposite2D from expected core JAR. Candidate runner may combine them in one JAR;
extracted-package consumer must check separate JAR origins. Capture all state PNGs and
source/artifact bindings using existing runner patterns. No new runner framework.

Root inspects the content boundaries and source feature proportions: contain retains all
source with margins, cover selects overflowing content, stretch changes proportions, crop
changes selected features, alignment relocates the square crop, mask reveals the ellipse.
Native boundary pixels are scoped to this runtime. This is technique-level placement
composition, not a recreation of eyes002 or terrainCollage and not portable resampling.
