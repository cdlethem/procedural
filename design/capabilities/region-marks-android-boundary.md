# RegionMarks Android drawing boundary

The existing portable cell operation remains unchanged and has passed Android ART checks.
RegionComposition remains the shared Java artist model. Its output is geometry, not a
portable drawing-command stream. The native example draws the same rectangles and circles
as Java and py5; no tessellation approximation or new drawing operation is introduced.

Android2DFrame's accepted command vocabulary is segment2/quad2. Use an empty frame only to
obtain the established density-one640-square surface and background with host ownership.
Within AndroidFrameHost.consumeCompleted, synchronously beginDraw, draw the example with
native Processing rect/ellipse calls, endDraw, encode the PNG and display it. The consumer
runs on the animation thread, cannot wait for UI work and retains no surface reference.
The host checks lifecycle admission before and after consumption and releases on all paths.
The example result contains detached PNG bytes plus cell/mark counts; it does not claim
that native drawing was submitted through the portable command vocabulary.

Reuse the accepted Activity's immutable requested state, retained model identity, post-frame
acknowledgment, bounded PNG writer and GalleryWriter. Six edits: seed, split count, source,
selection fraction, motif, palette; plus save. Palette/motif edits retain geometry. Seed,
splits and selection are ignored while authored. Saving uses the displayed PNG snapshot.
No changes to the shared adapter are needed for this example-specific native callback.

Required validation before acceptance: compile complete native Activity; preregister the
bounded seven-state RegionMarks sequence; execute actual button callbacks, retained identity,
cell/mark counts, ignored controls and cached save on API33; inspect representative results.
Exercise pause/resume with the established lifecycle observer as needed for the new native
consumer; prior lifecycle evidence alone does not prove this callback. All emulator access
uses the fixed machine-wide native lock. No current source-only file implies acceptance.
