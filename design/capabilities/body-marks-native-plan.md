# BodyMarks native draft plan

Status: prepared for root review. This is a bounded JAVA2D probe plan, not permission for a
native run or an acceptance claim.

The probe builds a candidate JAR, officially preprocesses `BodyMarks.pde`, and compiles the
generated sketch with the probe. `GradientPath2D`, `GradientNoise2D01`, `CyclicPalette`, and
`RegularGrid` must load from that candidate JAR. The target runtime is JAVA2D, 640 by 640, at
density 1.

It records six frames: baseline, changed tapered body, centerlines, restored tapered body,
one advanced tick, and reset. Posted keys are W, M, M, ., 0, and S. W and both M changes must
keep the exact retained head and spine objects and their serialized values. W changes an
interior half width and pixels; M draws centerlines from the same points; the second M restores
the tapered pixels. The posted period invokes exactly one logical tick, replacing head and
spine values; each new spine point zero must equal its corresponding new head. Reset restores
baseline values and pixels, and S saves the cached completed image without a meaningful extra
render.

Before the visible scenario, the probe directly calls `advanceTick()` 24 times, records elapsed
nanoseconds, resets, repeats those 24 calls, and compares heads and serialized spine values.
This is a non-render verification phase. It reports 300 path steps per tick
(`12 * (1 + 24)`) and the measured elapsed time only; it makes no FPS or allocation guarantee.

BodyMarks deliberately keeps its Processing display loop active. The probe returns before
counting or rendering when `!running && !dirty`, so continuous idle callbacks do not look like
meaningful frames. All six controls are posted Processing key events; the cost/replay phase is
a direct method call before the visible sequence. The plan establishes no distribution,
port-support, recreation, or release claim.
