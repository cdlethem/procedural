# Android actual-activity lifecycle validation

Independent Sol plan, 2026-09-07. This registers the actual Activity lifecycle part of
the first Processing Android drawing adapter validation. It applies only to the pinned
Android Mode 4.6.0 `android-412` core and API-33 emulator recorded by
`android-adapter-validation.md`. It does not repeat the pixel or injected-failure parts,
render an artist image, or establish Android support by itself.

## Pixel-suite review

`AndroidFramePixels.java` covers the four registered native pixel groups without a
blocking omission. It executes all six profile dimensions against real mutable
ARGB_8888 bitmaps, the coordinate and width boundary cases, clipping, alpha and winding,
single-fill seam behavior, round-cap/style behavior, and parent pixel/matrix/clip/color
isolation. Its exact-position pixel assertions exercise an identity output transform,
while `Android2DFrame.initialize()` performs a live full-clip assertion before any batch.
The invalid later record proves portable count/state atomicity; the native-call spy and
phase failures belong to the separately registered injected-failure part. The passing
pixel report therefore needs no repeat for this review.

## Test application and signals

Use one cold `MainActivity` containing the Processing `PFragment` and one opaque,
otherwise empty `CoverActivity` in the same test APK. Starting `CoverActivity` with an
explicit `am start -W` must make the existing `MainActivity` and fragment pause. Pressing
BACK only while `dumpsys activity` identifies `CoverActivity` as the resumed top activity
finishes the cover and resumes the same main instance. Every marker includes a random
main-instance nonce; recreation or a new nonce fails the part rather than silently
starting a new host.

Do not use `am force-stop`, process killing, or APK reinstall as a destroy stimulus:
Android does not promise `onDestroy()` for those actions. For the final destruction,
have a test-only explicit control receiver post `MainActivity.finish()` to the UI thread.
The receiver and any retained weak activity reference exist only in this probe APK. Wait
for the fragment's registered `onDestroy` and `dispose` observations before reading the
result, then the runner may clean up the package.

Publish each phase as its own app-private JSON file by writing a temporary file, syncing
and atomically renaming it. Each marker contains a monotonic sequence number, instance
nonce, callback name, Java thread id/name, frame state, host counters, and captured
surface facts. The runner deletes stale markers before launch and waits for the exact next
sequence with a deadline. Logcat and `dumpsys` are supporting diagnostics; neither may
substitute for an in-app assertion. There are no correctness sleeps. A runner phase may
use the registered emulator deadline, while every in-app latch/poll has a much shorter
bounded timeout and records timeout as failure.

Construct `AndroidFrameHost` in `setup()` on the animation thread, then register a
test-only lifecycle observer on the PApplet. Registration order is material: the host is
first and the observer is second for `pause`, `resume`, `pre`, `onDestroy`, and `dispose`.
The observer can consequently inspect post-host cleanup on pause/destroy/dispose and
post-host admission on pre. It catches and records all assertions instead of throwing
through Android lifecycle dispatch. A package-peer test helper may read `epoch()` and
`ready(epoch)` and retain test surface/bitmap references; it must not modify host state.
Read-only reflection of `closed` is acceptable solely for the final destroyed-host
assertion if no package-private test snapshot is added. Bind that probe and host source in
the evidence report.

The Probe overrides `protected boolean handleSpecialDraw()` only to call `super` exactly
once, record each handled restoration frame after it returns, and assert that the host is
still non-accepting. It must return that result and must not alter Processing restoration.
For the current resume generation, `handled && !isLooping()` on this animation thread is
the exact `restore-idle` predicate: `PGraphicsAndroid2D.restoreSurface()` has reached
`PGraphics.restoreSurface()`, which synchronously reapplies `parent.noLoop()` on the last
special restoration frame. Publish the marker once at that point. Do not poll
`isLooping()` from the UI thread; its underlying field is neither volatile nor read under
the synchronized `loop()`/`noLoop()` monitor. Do not assume an exact special-frame count.

## Registered sequence

Run these phases in one same-instance application session.

1. **Active lease paused.** In frame-zero `setup`, construct the host, begin a real
   density-one frame and leave it active. Retain its `AndroidSurface` and bitmap through a
   package-private test factory or observation seam, then call `noLoop()` and publish
   `active-ready`. Start the cover activity. The observer following `host.pause()` must
   see the frame in `aborted`, host readiness false, canvas/pixels/native/parent detached,
   and the exact captured bitmap recycled once. No completed output exists.

2. **Resume waits for ordinary pre.** Finish the cover and require the same instance
   nonce. The observer following `host.resume()` must see readiness false. Every handled
   restoration-only frame must also see readiness false and no increment to the ordinary
   pre counter. After `restore-idle`, use `adb input tap` at the center of the Processing
   surface and override only `public void touchStarted()`. The handler records its thread,
   changes only a plain atomic stage value, and calls `redraw()`; it performs no adapter or
   native drawing call. Leave `mousePressed()` inherited: this core posts a mouse event
   before the touch event for the same `MotionEvent`, so handling both would advance the
   stage twice. Do not override `surfaceTouchEvent()`. The next frame must record the host's
   `pre()` on the captured animation thread before `draw()`, see readiness true there,
   and successfully begin a fresh frame. This is the required noLoop reopen path.

3. **Stop wins an unconsumed lease.** In that ordinary draw, complete a fresh frame but
   retain the returned surface without consuming or releasing it, then publish
   `completed-ready`. Start the cover. The post-host pause observer must see its canvas,
   pixels, native bitmap and parent detached and its captured bitmap recycled. After the
   same instance resumes, restoration becomes idle, and input requests the next ordinary
   frame, attempt to consume the old surface on the animation thread. Require
   `IllegalStateException`, zero consumer invocations, unchanged one-time release facts,
   and an idempotent explicit `releaseCompleted(old)`.

4. **Consumption wins the lock but lifecycle wins completion.** Create another completed
   surface and enter `consumeCompleted()` on the animation thread. Its test-only consumer
   publishes `consumer-entered`, retains no reference after return, and holds the host
   lock while it polls the captured epoch with a strict timeout. The runner starts the
   cover only after that marker. `AndroidFrameHost.stop()` changes `stops`, `accepting`
   and generation before waiting for the lock, so the consumer can observe
   `!host.ready(ticket)` and return without waiting for the UI callback to finish. The
   final transfer check must throw `IllegalStateException` for lifecycle change; its
   `finally` must detach/recycle the surface exactly once. Then pause acquires the lock and
   completes. Require one consumer invocation, no bitmap access outside the callback, no
   completed registry entry left for pause, and no deadlock.

   This bounded poll is a white-box race fixture, not a supported integration pattern.
   Production consumers remain synchronous and must not wait for another or UI thread.
   The fixture is valid specifically because it waits only for the host's pre-lock atomic
   admission change, then immediately returns.

5. **Destroy closes and conserves ownership.** Resume the same instance, wait through
   restoration, and request one ordinary frame. Leave one frame active and a separate
   completed surface unconsumed, retaining both exact bitmap references. Publish
   `destroy-ready`, then invoke the test receiver's UI-thread `finish()`. The normal
   Activity sequence may release these resources during `onPause`; by the observer after
   `onDestroy`, both must be aborted/released, detached and recycled exactly once, the
   completed consumer count must remain zero, diagnostics must be bounded, and the host
   must be permanently closed. The later observer after `dispose` must see the same
   release counts and closed state, proving the fallback is idempotent. Publish the final
   result from that dispose observation using the application context.

The consume-race phase deliberately tests the concurrent lock ordering. The earlier
unconsumed phase tests the opposite order, where pause removes the lease before any
consume call. A simple consume followed by a later pause would only prove sequential
cleanup and does not satisfy this registration.

## Required assertions and evidence

For each captured surface record its identity label, logical/pixel dimensions, original
bitmap identity, `Bitmap.isRecycled()`, canvas presence, pixels presence, native value,
parent presence, frame state, consumer count and explicit release count. Assert all
adapter calls and `consumeCompleted` attempts occur on the single setup animation thread;
record that actual pause/resume/destroy callbacks occur on Android's UI thread. Record
the ordered counts for resume, restoration-only draw, pre, ordinary draw, pause,
onDestroy and dispose.

The part passes only if every named phase passes, all expected markers share the cold
instance nonce, no unexpected Activity recreation occurs, every owned bitmap ends
recycled exactly once, no callback uses a bitmap after release, the event handler performs
no native work, and the final ownership inventory is empty. Preserve the APK hash,
packaged Processing core hash, adapter/core/test/runner/manifest hashes, emulator identity,
complete marker journal and final JSON. Label the real Activity events separately from
the test-only consume barrier and any package-private observation seam.

This evidence establishes the scoped host lifecycle and ownership behavior on the pinned
runtime only. It does not establish background-process death recovery, configuration
change recreation, multi-window behavior, other Android versions/devices, or a renderer
support claim before the remaining registered CP1/example work and final review.
