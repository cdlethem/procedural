# Android editable field-marks example

Root architecture and validation registration, independently challenged by Sol before
implementation. This completes the Android artist-facing CP1 slice after the accepted
native pixel, injected-failure, lifecycle-v2 and four-edit composition parts. It adds no
public library operation. The fixed composition values remain example choices from the
accepted CP1 plan, not recommended parameter ranges.

## Artist interaction

Provide a native Activity with a fitted square Processing viewport and four buttons:
Length, Palette, Marks, Save PNG. A short status line names the current choices. Length
toggles 16/32 (the actual accepted CP1 values); Palette toggles the original/neon lists
in `evidence/reproductions/cp1-java2d/plan.json`; Marks toggles lines/bars. Controls are
independent: changing palette preserves length and mark choice. Keep the 25,600-record
MarkField created once in setup. Show the complete piece fitted into available space;
the exported original remains 640×640 regardless of display size.

Use Android2DFragment and an immutable versioned EditState in an AtomicReference. Drawing
inputs change that plain state and request redraw. Disable edit controls while a frame
is pending and acknowledge completion from Processing's registered post callback, after
its redraw flag was cleared. If a newer version is still requested at post, request another
redraw there. Enable controls only when the acknowledged version remains current. This
keeps native drawing on the animation thread and preserves the latest requested state.

The drawing helper independently applies the accepted CP1 command construction to the
retained MarkField through Android2DFrame. Inside consumeCompleted, display that surface
on the parent and encode its original Bitmap to PNG bytes. Only after successful display
and encoding publish an immutable rendered snapshot with version, options, model/command
hashes and bytes. Keep no completed Bitmap/PGraphics member or lease across callbacks.
If work fails, retain the last successful snapshot and show a clear error; no failed
revision is acknowledged as rendered. Encode before display; if display or lifecycle
transfer fails, disable Save and request a single restoration render of the last
successful options. A failed restoration waits for another edit instead of retrying
indefinitely. Save is enabled again only after a valid displayed snapshot is acknowledged.

Save takes the currently acknowledged snapshot and writes its bytes on a single bounded
background executor. It neither requests redraw nor recomputes the composition. For this
example require API29+, with native validation on API33. Insert an app-owned MediaStore
image under Pictures/Procedurals with IS_PENDING=1, write/close its stream, then publish
with IS_PENDING=0; delete that inserted row on failure. Use application context for I/O
and avoid retaining a destroyed Activity in completion callbacks. Do not request unrelated
storage permissions. Android documents this app-owned media route in its
[shared media guide](https://developer.android.com/training/data-storage/shared/media#add-item).
Report “Saved to Pictures/Procedurals” after success. Save failure preserves the current
piece and allows retry. This example does not claim process-death recovery or a lossless
history of every intermediate input during a running frame.

## Registered editable native execution

Retain the original editable-part allowance: one initial execution and one corrective
only after a documented failure/repair. The initial reserves eight composition renders
plus one export of existing bytes, in this order:

1. Initial base.
2. Length toggle: long32 lines, original palette.
3. Length toggle: base again.
4. Palette toggle: short16 neon lines.
5. Palette toggle: base again.
6. Marks toggle: short16 original bars.
7. Length toggle: long32 original bars.
8. Palette toggle: long32 neon bars.
9. Save PNG: export checkpoint8 without a ninth composition or Processing frame.

Use actual native button clicks after explicit post-frame readiness, never a separate
configuration backdoor. Observe one retained model hash, option/version transitions,
command count, cached original PNG and button state. Checkpoints1–6 must match the
corresponding accepted Android CP1 PNG pixels and command/model hashes exactly. The last
two verify preserved independent settings, retained model, nonempty opaque640² output,
and visible edits; root inspects the displayed example and combined results. Check that
the saved MediaStore row is published and has PNG MIME/type, the decoded saved PNG has
the expected 640×640 dimensions (provider width/height metadata is recorded separately), and its
bytes exactly equal the final snapshot while composition/frame counts do not advance.

A test-only observer may capture immutable state and snapshots for evidence; it must not
supply alternative drawing, edit or save behavior. The ordinary installable example must
run without test instrumentation. Bind all example/test/runner sources, staged original
MarkField, accepted CP1 evidence, pinned runtime and APK. Keep generated images/builds
ignored. Native UI automation is execution evidence, not a completed human usability study.
Do not repeat passing native suites when updating documentation or catalog metadata.
