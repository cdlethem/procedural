# Android GrainMarks drawing boundary

Reuse the accepted RegionMarks Activity/host lifecycle, immutable UI request publication,
animation-thread generation, cached snapshot acknowledgment after resume and bounded PNG
writer. Keep the accepted GrainComposition unchanged. Geometry edits (seed/density/
distribution/cell transfer/reset) rebuild; palette and motif retain points. Reset explicitly
rebuilds even from default settings; it does not silently become a style-only edit.

The portable core remains triangle sampling/mapping and quadrant bounds. GrainComposition
owns canvas/density/count allocation and caller-side concentration sequences. Native
point/line primitives, density1, colors, bitmap capture and presentation belong to this
Android example. Use a blank Android2DFrame for ownership and draw synchronously inside
AndroidFrameHost.consumeCompleted, as in RegionMarks. No new portable point command,
approximate segment trick or shared adapter extension. Release/abort on all failure paths.

Draw the Java example's native point or4px line using float coordinates, color alpha150
and the accepted palettes. Do not copy p5's1px disk correction without Android evidence.
Native acceptance must inspect dot coverage as well as counts, both concentration modes,
cell transfer, retained style edits, real HOME/resume and cached MediaStore save. Root owns
the bounded acceptance plan and representative images before any support attestation.
