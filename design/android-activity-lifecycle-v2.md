# Android lifecycle protocol v2: fragment scheduling integration

Root registration before execution. This protocol changes the integration under test:
use the reviewed internal Android2DFragment instead of the pinned base PFragment.
The production frame drawing and ownership classes stay unchanged. This follows the
actual redraw failure and independent decision in `android-redraw-integration-finding.md`.
The original initial and corrective reports remain immutable failed evidence; neither
passing pixels nor passing injected failures is repeated.

The pinned core/SDK/emulator, same-instance nonce, actual CoverActivity/BACK/finish,
thread and ownership assertions, source hashes, actual focus gates and 30-minute part
deadline remain as registered in `android-activity-lifecycle-validation.md`. The earlier
runner-only correction remains in `android-lifecycle-correction.md`. Allow one initial
execution of this revised integration and one corrective only after a documented failure
and repair. Use distinct v2 attempt/report paths; do not reopen v1 allowances.

## Scheduling assertions added to the complete lifecycle sequence

PApplet's initial redraw flag remains true through setup; its handleDraw clears the flag
only after an ordinary draw (pinned PApplet.java:1911). The corrected fragment therefore
permits one default startup draw even though setup called noLoop. This is native behavior
and must not be bypassed by clearing a protected flag or suppressing that draw. Construct
the host and first active lease in setup. Publish active-ready only after the complete
startup draw dispatch returns: exactly one pre/draw, no input, and frameCount=2.

Preserve all three subsequent cover/resume/input cycles and both lease-lock orders. After
each restoration reaches same-thread handled && !isLooping, observe at least four
subsequent completed super.handleDraw dispatches. Require unchanged pre count, ordinary
draw count and frameCount, with host admission closed and no input. Publish idle-polls-N
only after those assertions. These are observed dispatches, not elapsed sleeps. The runner
waits for that marker before sending its real touch.

The Probe override calls super.handleDraw exactly once and observes before/after counters;
it never substitutes a native draw or modifies Processing flags. The next real touch
changes only plain input state and requests redraw. Require exactly one ordinary pre/draw
and one frameCount increment. Relative to the observed startup frame, the three edit
pre counts are [2,3,4], and the final ordinary pre/draw totals are four. Inputs remain
exactly three. Restoration specials must never invoke ordinary pre/draw.

Publish completed-ready and destroy-ready after the full dispatch and its post-frame
assertions. The consumer-entered marker necessarily remains inside the synchronous
consumer to exercise actual concurrent pause admission. Pause may win admission before
that draw returns; the post-dispatch observer must preserve this intended race and not
require the host to remain open. All five captured leases must still be released, with
empty final ownership maps, no cleanup diagnostics, four actual pauses, three resumes,
and final actual onDestroy/dispose. Existing phase-failure assertions are not relaxed.

The fragment acquires/releases the sketch monitor before returning from canDraw, pairing
with synchronized redraw/loop/noLoop requests. It does not hold the monitor through native
drawing. PSurfaceNone already polls at the configured frame interval; idle dispatch must
not become continuous native rendering. This establishes idle redraw scheduling, not a
lossless queue for input racing an already-running draw, other renderers/devices, process
death or configuration recreation. CP1 and the editable example remain separate gates.
