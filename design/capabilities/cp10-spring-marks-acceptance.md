# SpringMarks implementation and native acceptance

Root selects this Java-first workflow before implementation and rendering. The
motion contract and shared fixtures are approved; native implementation and artist
acceptance remain pending. This is a 640 by 640 JAVA2D, density1 example with no
external fonts, shaders, images or geometry dependencies. Sol remains paused.

## A visible input and a reusable response

The example starts paused, with 49 sites in a 7 by 7 regular arrangement. Initial
positions are (128+64*column,128+64*row), row-major. Velocity is zero; strength is
0.025 and retention 0.7. These are authored example choices informed by the CP10
source diagnostic, not library defaults or recommended continuous ranges. The
canonical initial state is retained separately from the owned TargetSprings2D
batch. Targets are an editable packed array, initially equal to initial positions.
There is no random source and no implicit motion at equilibrium.

A small editable SpringComposition Java helper owns the batch, initial positions,
current targets, fixed initial Delaunay topology and a bounded trail ring. It is
example glue, not another catalog operation. The helper exposes the motion batch,
current targets, initial topology, tick count and trail access. Its explicit tick
first applies the authored target-return policy, then calls the core once, then
appends the completed position sample and increments the logical tick. The policy
is target += (initial-target)*0.04 for each coordinate. No elapsed seconds enter
this recurrence. A display frame while paused never calls tick.

D applies a local target displacement: for each initial site within radius200 of
(320,320), add (80*w,-40*w) to its current target, where w=1-distance/200. This
finite radial influence is an authored input policy, not the source's pointer
falloff and not a new public force function. D changes targets only; it does not
advance positions or clear trails. It works while paused, making cause and
response inspectable. T draws target crosses and line segments from current sites
to targets. Drawing these does not affect any simulation values.

Keep at most121 complete position samples (initial plus120 ticks), stored in a
preallocated ring. Draw chronological polylines per site without connecting the
last sample back to the oldest. Every tick replaces the oldest sample after the
ring fills. The core retains no trail/history. Trails, target indicators and the
initial-position rings are independent drawing layers.

Triangulate initial sites once using Delaunay2D with maxWork50000000. Connect its
unique edges using current motion positions. Use mesh original-input mappings
explicitly rather than assuming vertex order equals body order. This is deformation
of initial connectivity; it is not the Delaunay triangulation of current sites.
No retriangulation, collision avoidance or non-inverting-face promise is made.

## Controls and retention

Space toggles running. Period advances one tick only while paused. D disturbs
current targets. M cycles dots, velocity segments and fixed-connectivity wire;
C cycles the palette; H toggles trails; T toggles target indicators. All style
edits preserve the exact batch, targets, topology, history and tick. Rendering
always uses reusable accessor buffers and makes no extra step calls.

K alternates strength0.025/0.05; V alternates retention0.7/0.9. These controls
export current state, edit the selected coefficient for every body and import a
new independent batch. Preserve positions, velocities, current targets, topology,
trail samples and tick exactly. Document that changing response mid-motion is
intentional; use reset/replay to compare coefficients under identical inputs.
No hidden method in the core changes coefficients.

0 resets initial state, targets, tick, trails, coefficients, style and paused mode.
S saves a copy of the last completed canvas and must not advance, rerender or
change any composition state. Native key handling and display scheduling must
keep controls responsive while paused. The visible piece starts still; the guide
starts with D then Space, and explains Period for inspection.

## Required native acceptance sequences

Use the actual officially preprocessed PDE and current core, not a drawing
lookalike. Before rendering, bind sources, runtime, contract, fixture and executor
hashes and register exact commands/captures in the native plan. Keep every attempt
in a fresh ignored directory. Root serializes all Processing launches.

1. Baseline at tick0, then20 display frames while paused: exact unchanged state,
   history, targets and pixels. D then capture tick0 with target indicators on:
   targets changed, state unchanged. Advance and capture ticks1,10,30,60,120.
2. At tick30 in a separate identical replay, capture each M mode, C, H and T.
   Verify state/target/topology/history object retention and unchanged tick;
   inspect every distinct drawing. The wire must use the original unique edges.
3. Replay the baseline event sequence twice from0: compare all121 states, targets,
   retained history and tick exactly. Captured equal states/styles must match
   pixels exactly on the same renderer. Save at tick30 while running through a
   controlled event boundary: cached saved pixels match the completed canvas and
   the save action takes no additional tick.
4. Repeat the recorded target sequence from initial state with strength0.05 and,
   separately, retention0.9, holding all other settings fixed. Capture ticks
   1,10,30,60,120 and compare trajectories with the baseline. Do not infer the
   source-float experiment's precise magnitudes for this binary64 composition.
5. At tick30 change K and V separately: verify imported position/velocity bits,
   targets, history and tick unchanged immediately; subsequent ticks follow the
   changed coefficients. Reset must restore baseline coefficients and behavior.
6. Run260 ticks with disturbances before ticks1 and141. Check ring capacity121,
   oldest/newest tick mapping, no wraparound connecting line, finite state and
   exact replay. Capture120,121,140,141,260, including wire after the second event.

The registered run must include all event/capture states above; reuse identical
images only with byte-hash evidence. Observe actual emitted line/ellipse/style
arguments and geometry counts, not only helper snapshots. Step count must equal
explicit animation ticks and must exclude style/save/paused display events.

## Claim and remaining gates

Success is technique-level evidence that explicit changing targets drive retained
spring motion, with inertial response, target return, reusable positions and
fixed-connectivity transfer. The source is araniaaas/Point.pde as audited in
cp10-source-motion.json and the accepted parameter experiment. Only this report
supplies the admitted recurrence; unrelated physics reports do not increase its
support. Binary64, regular sites, local impulse, controlled input sequence, owned
state, explicit indices and bounded trails are declared design differences. No
source-pixel reproduction or historical pointer behavior is claimed.

First pass native core fixtures, ownership/atomicity checks and measured packed
stepping performance. Then implement/check the helper and PDE, register/render
this complete sequence, inspect all distinct images and resolve usability issues.
Only after acceptance add the tenth starter and thirteenth operation to a new
Java package, preserving all nine accepted starters. New target ports stay deferred.
