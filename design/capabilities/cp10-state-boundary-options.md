# CP10 spring-state boundary options

This is a bounded design comparison for the target-following motion direction. It
neither admits an operation nor proposes a signature, coefficient, tick rate, or
parameter range. The decisive source is `2018/Generativos/araniaaas#1`, identified
and bounded in [physics-evidence-audit.md](physics-evidence-audit.md) and
[cp10-spring-marks-direction.md](cp10-spring-marks-direction.md). Its meaningful
observation is a retained position/velocity collection advanced once per draw with
an explicit update order; the initialized state remains still without a disturbance.

## Option A: mutable owned spring batch

A batch owns fixed-length position and velocity buffers after construction. A complete
step validates its target values and scalar inputs, computes every next position and
velocity into scratch buffers, then commits all buffers together. The caller retains a
reference to the batch and invokes an explicit logical tick. A reset replaces current
state from owned initial values; replay starts from that same owned state and applies
the same explicit target/tick sequence.

This corresponds most directly to the artist loop: keep one motion object, draw its
current values, change targets, then advance when the sketch chooses. Styling consumes
current positions and optionally velocities without invoking a step, so changing a
palette, dots, trails, or fixed Delaunay edges cannot advance the simulation. A
pause is simply no step; a single-step is exactly one requested transition. The
example can retain initial connectivity while drawing current positions, making the
source's intended deformation explicit rather than silently re-triangulating.

The boundary needs strong ownership rules. Input positions, velocities, and targets
must be copied or otherwise detached at successful construction/target admission;
accessors should return fresh values or fill caller buffers. Complete-batch failure
must not expose a prefix: static target/carrier validation precedes calculation, and
nonfinite or arithmetic failure during the prospective step discards scratch results
and leaves the existing batch intact. The same rule protects replay and rendering
from half advanced state.

This option can keep the inner recurrence allocation-free after construction: two
owned state buffers and reusable validation/scratch storage can swap on commit. Its
cost is that the public value is mutable over time, so an artist must understand the
lifecycle and must not expect an earlier reference to describe an earlier frame after
later steps. A contract would need to state explicit tick numbering, exact update
order, reset source, target admission timing, and what state observations are stable
between calls. It must also separately bound batch length and account for scratch
allocation before admitting a step; those are representation/work concerns, not
artistic ranges.

## Option B: immutable one-step state values

A step receives a complete state value and complete targets, validates them, and
returns a separate state value containing next positions and velocities. Reset/replay
are naturally visible: preserve the initial value, reapply the recorded state
transitions, and retain any value needed for comparison. Styling can consume a value
without advancing it, so this also cleanly separates drawing from motion.

Its main advantage is referential clarity. An artist can hold the displayed value,
render a second treatment from it, and know that later computation cannot alter it.
A future persisted recipe could name an initial state plus an ordered sequence of
explicit target/tick events, with each transition producing the next state value. That
is only a representation observation: it does not require an executor, serialization
format, history store, or recipe feature now.

The cost is material. A literal immutable batch normally allocates and copies complete
position/velocity arrays every tick. That is at odds with a continuously drawn batch,
and can make a simple pause/single-step loop pay for history-like copies it does not
need. Structural sharing or hidden mutation with snapshots could reduce copying, but
would create a more complicated ownership and lifetime contract before the artist
benefit is established. It also still needs all-or-error semantics: an invalid target
or an intermediate arithmetic failure cannot return a partially updated value.

## Shared obligations before choosing

Both choices require explicit, target-independent logical time: no wall clock,
frame-rate estimate, Processing global, pointer read, renderer, or hidden random
stream. The source supplies per-draw ordering only; it does not establish elapsed-time
normalization. Fixtures therefore need equilibrium, a disturbance, moving targets,
consecutive ticks, a reset/mid-sequence replay, damping-after-position distinction,
and an invalid late batch item. Numeric policy must name binary64 intermediate and
nonfinite behavior rather than infer it from Processing `PVector` mutation.

For either boundary, the batch should be one coherent owned collection. Target-return
lerp, pointer falloff, scatter generation, colour, trails, and connectivity selection
remain caller/example policies. The source's web can consume fixed retained indices and
current values, but it cannot turn the motion batch into a renderer, topology owner, or
general physics engine.

The mutable batch has the smaller continuing-allocation footprint and clearest direct
sketch loop, provided its explicit reset/replay and detached read semantics are made
prominent. The immutable value has cleaner historical identity, but its full-batch copy
cost and possible snapshot machinery need a concrete use case before they are chosen.
This comparison does not select either option; root must choose after contract and
fixture work.
