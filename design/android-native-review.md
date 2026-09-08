# Scoped Android native review

Accepted by root after Sol's independent final review, 2026-09-07. Mark
`drawing.fresh-raster-2d` v0.1.0's Processing Android implementation
`native_adapter_implemented` and `validated-scoped`. Keep conceptual backend `ANDROID2D`;
the pinned Processing token is `JAVA2D`, concrete class
`processing.a2d.PGraphicsAndroid2D`. This metadata does not change portable drawing semantics.

The five complementary native parts establish the registered scope:

- Four pixel groups cover fresh opaque density1 surfaces, dimensions through2048²,
  clipping/bounds, widths, caps, alpha, winding and parent-state isolation.
- Nineteen injected failures cover phase/precedence, no-repair acquisition, atomic
  validation and encounter indices, thread/reentry, cleanup, ownership and transfer rollback.
- Lifecycle v2 uses the real Activity and corrected Android2DFragment carrier. Actual
  pause/resume/destroy transitions establish idle noLoop restoration, one redraw per
  observed input, both stop/consume orders and conservation of owned native resources.
- CP1 matches all four accepted model/geometry/colour/count outputs exactly for25,600
  marks. Root inspected the four images in `android-cp1-decision.md`.
- The editable example passes seven edit taps, eight acknowledged compositions and
  independent combined edits. Save publishes the exact cached eighth PNG without another
  composition/frame. Root inspected the screen and combined results in
  `android-example-decision.md`.

The source-bound review record is `evidence/conformance/android-native-review.json`.
The guard verifies required implementation/runtime bindings, reviewed evidence hashes,
unchanged profile semantics, coverage and the linked UI/CP1 outputs without requiring
the ignored SDK or PNG checkout. Generated native reports retain their execution-time
profile hash; catalog metadata refresh does not require repeating passing native suites.

Preserve both failed lifecycle v1 reports and `android-redraw-integration-finding.md`.
They document why the plain PFragment carrier was insufficient and why v2 was a new
registered experiment. The earlier pixel report binds the then-current version of
`tools/run_android_adapter.py`; its later harness-selection expansion does not change
the pixel harness, drawing implementation, runtime or executed result. Current adapter
and core source hashes match their relevant accepted reports. No historical result is
relabeled as a pass or regenerated to conceal a source delta.

This accepts one pinned Android Mode4.6.0 android-412/API33 software-emulator configuration
and the Android2D route. It does not establish physical-device behavior, execution on
API29, other runtime/core/renderer versions, spontaneous resource loss, process recreation,
lossless queued input, installation usability or full-corpus reproduction. The example
requires API29+ for its MediaStore route, with actual execution proven on API33 only.
Distribution remains unfinished I1 work under `i1-distribution.md`.
