# Android drawing integration decision

Root decision before implementation, 2026-09-07. Adopt the independently investigated
`android-adapter-boundary.md` with the following explicit ownership interfaces. Native
bootstrap passed; this decision does not establish drawing conformance.

Use an internal `AndroidFrameHost` per PApplet, constructed in setup on the animation
thread. It registers pause/resume/onDestroy/dispose/pre callbacks once. Pause closes
admission and advances an epoch before taking the ownership lock, then aborts active
frames and releases outstanding completed surfaces. Destroy closes permanently. Resume
only marks pending; ordinary-frame pre reopens after primary beginDraw/restoration.
NoLoop sketches may need a subsequent explicit redraw. Input callbacks change plain
model state and request redraw; they never call the adapter from a UI thread.

`Android2DFrame(host)` shares that host's lock and portable DrawingFrameState. Its
begin/batch/end/abort calls require the captured animation thread. Native stages check
the host epoch before committing. Lifecycle invalidation causes RENDER_FAILURE in an
in-progress native phase; subsequent use of the aborted frame is INVALID_STATE.
Invalid environment still precedes static capability checks. A paused host cannot
start a new native frame. No shared portable state or drawing policy changes.

`end()` transfers the exact native surface to the host's completed registry under
the same lock. Integration must call `host.consumeCompleted(surface, consumer)` to
display/save it synchronously under that lock; it always releases in finally. A raw
surface used outside this guard could race lifecycle recycling and is outside this
internal integration contract. The consumer is an Android-only host callback, not
portable recipe data or a generic rendering executor. It must finish synchronously
and must not wait on the UI thread. Callback/cleanup errors preserve their primary
cause. Explicit host release remains idempotent, including after lifecycle release.

An owned PGraphicsAndroid2D subclass exposes only protected readiness/primary state;
it adds no drawing semantics. Production construction follows inspected makeGraphics:
new instance, setParent, setPrimary(false), setSize. Supplied test factories receive
no readiness repair. Full clip is verified on the fresh Canvas, not expanded with
Android's deprecated Region.Op.REPLACE. Detach canvas/pixels/bitmap/parent before
recycling the captured bitmap.

Internal integration-method misuse may throw IllegalStateException; frame methods
retain the portable FrameError codes/indices. Keep this API internal until native
pixel, failure, actual activity lifecycle and complete CP1/example tests pass and
Sol independently reviews it.

Implementation review resolved the end-operation race: its final successful epoch
check is the completion linearization point. Transfer stores that captured epoch,
never a freshly read generation. A later pause blocks consumption and sees the
completed lease after acquiring the ownership lock. Registry insertion occurs while
the frame still retains its surface; insertion/state-commit failure rolls back the
registry so the normal unfinished cleanup can release the bitmap. Completed state
is committed only after registry insertion succeeds.

For this pinned APK, compile/D8 linkage against the exact core plus primary renderer
type checks establish static method availability. Do not duplicate this with reflective
method enumeration. JAVA2D is a compile-time alias assertion, not runtime version
detection; evidence must bind the packaged core hash. Lifecycle iteration retains an
unfinished registry entry until the frame takes its owned surface and explicitly
forgets itself, so an earlier failure cannot silently orphan the lease.
