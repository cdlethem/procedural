# Android native drawing validation registration

Root registration before adapter rendering. Runtime: Processing Android4.6.0 release
android-412, bundled core recorded in `android-environment.json`, SDK33/build30.0.3,
Android13/API33 Google APIs x86_64 image revision17, emulator37.1.11 with TCG and
SwiftShader, Vulkan disabled. Reuse the booted isolated emulator at ADB5038/serial5580.
The successful bootstrap is prerequisite evidence only.

Reserve separate parts: pixels, injected failures, actual activity lifecycle, CP1
four-edit composition, editable example. Each gets one initial execution and one
corrective execution only after a documented failure/repair. Preserve initial reports.
No passing part is repeated for source metadata; judge any later source delta explicitly.
Keep APK/build/image/log/runtime output ignored and serialize native execution.

Pixel groups 1–4 retain the shared acceptance thresholds and identities:

- Six fresh opaque exact-RGB backgrounds: 1×1,640×640,1920×1080,2048×1,1×2048,2048².
  Require logical/physical/bitmap/Canvas dimensions and density1. Android's density1
  is native allocation behavior, not desktop's inherited-density repair.
- Binary32 coordinate and width bounds/ULP edges, fully clipped unchanged background,
  visible central crossings, maximum width and convex boundary quads. Record minimum
  width coverage without a guaranteed visible pixel count.
- Byte alpha/order/source-over interior tolerance2, exact opaque RGB, alpha0 no-op,
  both windings and a single translucent fill without a diagonal seam.
- Independent round caps and segment/quad styles, full fresh clipping and identity
  transform, unchanged primary bitmap/matrix/clip/style.

Injected failures must exercise real owned Android bitmaps, explicitly labelled as
injections: environment/static precedence, allocation/readiness without supplied-surface
repair, initialization/draw/end errors including misleading portable exceptions,
whole-batch atomicity and absolute index through prior batches/noops, wrong-thread and
reentrant calls, detach/recycle/cleanup failures, no output after abort, live completed
ownership, consume/release reentry, callback exceptions, and failed registry transfer.
Empty/noop batches still observe lifecycle invalidation.

The actual activity part must pause/resume/destroy the app, verify active and unconsumed
completed leases are released, suppress consumption after a stop wins, and restore
admission only at ordinary-frame pre after primary restoration. Synchronize race probes
with explicit signals/latches and timeouts. NoLoop input handlers must update plain
state/redraw only; native drawing stays on the captured animation thread.

CP1 reuses the public Java grid/noise/palette and retained 25,600-record model. Compare
its four model/converted-geometry/colour streams with accepted Java fixtures (existing
2e-4 trig-coordinate tolerance only if exact hashes differ and are investigated), then
require opaque nonempty640² images, visible edits and root inspection. The Android
example must demonstrate real input-handler edits and saved-current-image behavior.

Software-emulator latency is operational evidence, not a relaxed visual threshold.
Allow a bounded 30-minute part deadline with periodic live process/ADB observations;
timeouts preserve evidence and trigger diagnosis. Compilation alone or one passing
part cannot validate the target. Sol reviews the complete scoped result before catalog
support changes. Physical devices, other versions/renderers and full corpus reproduction
remain outside this first scope.
