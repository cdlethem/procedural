# Android injected failure and ownership result

The first registered failure execution passed all 19 groups on the pinned Android
runtime. Evidence: `evidence/conformance/android-adapter-failures.json`. No corrective
execution is needed; the adapter source is unchanged from the passing pixel part.

Root reviewed the harness before execution. It uses actual AndroidSurface/Bitmap
resources with explicit fault overrides. The checks include invalid environment before
controlled static absence/allocation; allocation/readiness/init/draw/end phase mapping
with deliberately misleading FrameErrors; supplied parent/density mismatch without
repair; full-batch validation with zero native calls; prior-batch/noop absolute index;
wrong-thread and reentrant frame rejection; primary error preservation through cleanup;
bitmap/canvas/pixels/parent detachment and idempotent release; live completed ownership;
guarded consume/release reentry and consumer exceptions.

The coordinator rollback case calls its package-visible transfer transaction with a
throwing completion callback. It verifies registry rollback and retained unfinished
ownership until explicit abort/recycle. This is an injected coordinator transaction
failure, not a spontaneous out-of-memory or device-loss event.

Root accepts this injected-failure scope. Actual activity pause/resume/destroy, both
orders of the pause/consume race, resume admission, CP1 and the editable example remain
separate requirements. Do not infer those results from these 19 groups.
