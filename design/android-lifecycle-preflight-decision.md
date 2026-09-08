# Android lifecycle preflight decision

Root accepts Sol's actual Activity protocol for the pinned Android runtime. This is
permission to execute the registered first lifecycle part, not a passing result or an
Android support claim. The accepted pixel and injected-failure parts are not repeated.

The final test app uses full-screen JAVA2D, real touch input, three CoverActivity/BACK
cycles, and UI-thread finish for destruction. The runner verifies the cover is resumed
before sending BACK, verifies the same nonce and increasing phase sequence, and captures
the fourth pause as well as onDestroy/dispose. Broadcast output is diagnostic; only
asserted in-app markers establish completion.

The original UI polling proposal was corrected before execution: the pinned core's
looping field is unsynchronized, so the animation-thread observation after a handled
special draw establishes restoration idle. Inputs only record plain state and request
redraw. Each actual input must precede its animation-thread pre/draw; restoration alone
must leave the host closed to new work.

The package-peer test factory subclasses only to count native clearing and observe the
exact allocated Bitmap. It does not override drawing or lifecycle behavior. A native
clear count of one plus the captured Bitmap's recycled state is the release-idempotence
proxy; the harness does not instrument Android's final Bitmap.recycle implementation.
Read-only reflection checks host closure and empty ownership maps after final disposal.
No production observation API was added for these tests.

The concurrent consumer uses a bounded 30-second test-only poll of the host's atomic
pre-lock admission state. It returns immediately after observing closure; it never waits
for UI callback completion. Live resource checks inside the callback, the exact final
lifecycle rejection, and subsequent detached/recycled facts distinguish the two lock
orders. Real cleanup must leave no diagnostic errors. The timeout accommodates runner
and software-emulator scheduling, without changing any correctness assertion.

The first build passed. A later build correctly rejected inputs edited concurrently;
this consumed no native execution. The final source is rebuilt after review before the
registered first run. CP1 images, the editable Android example, and final independent
support review remain separate requirements.
