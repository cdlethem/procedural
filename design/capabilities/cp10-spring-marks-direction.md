# CP10 direction: give an arrangement a responsive, settling motion

Root selects target-driven spring motion as the next capability investigation after
the accepted Java0.9.0 FacetMarks slice. This is a design direction, not an admitted
operation, frozen signature, parameter recommendation or new release. Java remains
first; Sol reviews remain paused. Root owns the eventual public boundary.

## Artist task and why it adds capability

Start from an arrangement of marks. Displace its targets, let the marks follow with
inertia, then release them back toward the original arrangement. Change the mark or
palette while preserving the current motion state. Pause, advance one logical tick,
and replay the same disturbance from the same initial state.

The existing package can build positions, paths and meshes, but it does not own a
continuing position/velocity state driven by changing targets. A field path is a
precomputed trace; it does not answer this task. Asking artists to implement a
simulation loop independently would leave the new capability outside the package.

The proposed SpringMarks workflow first draws independent sites and their return
trails. A transfer uses the same moving sites with fixed indexed triangle edges
derived once from Delaunay2D. This connects motion to existing geometry without
making the motion operation own topology or drawing. It is a package design test,
not a promise to reproduce the source's complete web renderer.

## Decisive source evidence and correction

Root read the complete `araniaaas` report and its two source tabs at AllSketchs
revision `69bdd8513e4482a5e6018e36887d4bc208660eb5`. Candidate
`2018/Generativos/araniaaas#1` motivates the investigation; its current ledger status
is `research_required` in the provisional `motion.spring-drift` family. The
[source audit](physics-evidence-audit.md) records exact hashes and neighbours.

The source retains spawn, target, position and velocity. Each update moves the
target toward spawn, optionally moves it toward the pointer, accelerates toward
the resulting target, advances position using the updated velocity, and only then
damps velocity. There is no mass, collision, point-to-point spring or solver.
The source uses one update per draw call, not elapsed seconds.

The report's “organic slow drift” is misleading: equal spawn/target/position and
zero velocity stay at rest without a disturbance. Root's source diagnostic ran
the original Point tab through Processing's official preprocessor and executed it
headlessly for five cases of 600 updates. The initialized no-pointer case stayed
exactly still; explicit target/velocity disturbances moved and settled; a pointer
at the origin moved a nearby point while leaving a distant point still. These
are state observations, not rendered aesthetic evidence or proof of what pointer
events occurred during the historical survey.

The survey baseline records changing frames1/10/60 but no pointer trace, and its
stderr reports that density2 was unavailable. Its measured variants change web
insets, placement count/margin and colour, not motion coefficients. None justifies
spring defaults or an encouraged damping interval.

The main source triangulates on generation and point insertion, not in draw. Its
intended moving web reuses old triangle objects. Actual imported-library aliasing
has not been verified. Our proposed transfer explicitly retains indices and draws
them using current positions; it must be called deformation of initial connectivity,
not a Delaunay triangulation of the moving sites. Faces may invert or overlap.

## Proposed responsibility boundary

Investigate one coherent retained collection of independent target-following springs.
It should own position and velocity, advance a complete bounded batch by one explicit
logical tick, and expose reusable current values for ordinary drawing. Initial state,
target input and coefficients must be explicit. No global pointer, random source,
wall clock or renderer belongs in this computation.

The source's target-return lerp and pointer falloff are target-generation policies.
Keep them as visible example code initially. Root will reconsider a compound public
target policy only if the walkthrough shows repetitive algorithmic work rather than
a few understandable artistic choices. Do not expose `organicness`, copy unused
`acr` state, or build a general physics engine around this one candidate.

Position-plus-velocity lifecycle, input ownership, reproducible stepping and complete
batch failure semantics are the proposed value of a retained operation. A public
wrapper around a single multiply/add is insufficient. Conversely, an opaque function
that chooses scatter, pointer forces, topology and styling would hide the useful
substitution points. The contract must justify its batch/state design before code.

No public name or count is frozen here. In particular, do not keep the misleading
`springDrift` wording merely because it appears in the report. Do not add a time-in-
seconds argument without defining a different integrator and explaining its evidence.

## Walkthrough and required edits

1. Create a modest site arrangement and retain its initial positions. Start at rest;
   the sketch must explain that disturbance starts movement.
2. Apply a recorded target displacement for a fixed number of logical ticks, then
   release it through the example's explicit target-return policy.
3. Compare spring response and velocity retention while holding that input sequence
   fixed. Public exposure depends on the parameter investigation below, not intuition.
4. Recolour or swap dots for short velocity-oriented marks without resetting state.
5. Draw initial triangle indices using the same current sites; do not triangulate
   again as a hidden side effect. Keep dot and wire treatments independent of stepping.
6. Pause and single-step. Replay a recorded input sequence exactly after reset.
   Saving must capture the completed canvas without taking another simulation step.

Mouse interaction can be offered by the example, but native acceptance must feed
explicit pointer/target events at registered tick numbers. Playback speed may change
how quickly ticks are displayed; it must not silently change the recurrence.

## Before admission and implementation

- Resolve whether the batch step mutates owned state or returns a retained snapshot,
  including validation precedence, complete-batch atomicity, non-finite intermediate
  handling, reset/replay and allocation-free inner loops. Avoid parsing object maps or
  copying a full immutable history on every frame.
- Follow parameter-evidence for spring strength and velocity retention. Distinguish
  valid numeric domains, stability findings, example values and visually useful values.
  No source literal becomes a recommended default. Return lerp and pointer radius stay
  outside the proposed core unless a new decision justifies them.
- Specify exact observable update order and numeric precision. Source Processing
  float compatibility and a future binary64 portable operation are different claims.
  Test damping-before-versus-after-position, equilibrium, impulses, moving targets,
  consecutive ticks, mid-sequence replay, and failures after earlier valid batch items.
- Keep target seeking (`persons06`), field advection (`peces`) and falling/wrap
  (`degradefeo`) separate. They do not supply duplicate spring evidence. Lattice walks
  remain a valuable discrete-layout investigation, not something this motion API covers.
- Complete a written admission/contract and meaningful shared fixtures before library
  implementation. Then register native motion/transfer renders and representative
  per-tick performance measurements. No first-frame-only animation acceptance.

The physics family is being investigated rather than rejected. Other rare-family
work and all downstream milestones remain active; this direction narrows the next
engineering question without narrowing the project's intended outcome.
