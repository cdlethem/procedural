# CP12 investigation: paths constrained to a noise band

Root selects a bounded investigation, not operation admission or implementation.
The artist task is to grow retained winding paths near a starting scalar-field value,
then restyle those paths independently. This differs from assigning noise-derived headings
to positions or integrating those headings through space. Existing GradientPath2D does not
perform proposal acceptance against a starting level; CP11 occupies discrete cells instead.

Root read survey/out/2018/Generativos/venas/notes.md and the exact pinned upstream PDE from
.work/investigations/cp3-source/repo. The note describes contour-like bands, with reported
large changes from scale, tolerance, walker count and attempt-count substitutions. These
are whole-scene observations, not recommended ranges for a new independent operation.

Decisive source details to preserve in the evidence review:

- Each walker stores its initial noise value. A proposed unit step is accepted only when
  its noise differs by strictly less than tolerance. There is no canvas-boundary rejection.
- The inner loop counts attempts, not successful moves. Rejection leaves position unchanged.
- Proposal direction uses nested random draws. The separate small heading drift draw occurs
  on every attempt, but an accepted step overwrites that drift with the proposal direction.
  Describing drift as accumulated on every step would therefore be wrong.
- Starts, heading, colour and proposals share host RNG. The seed variable is not itself
  passed to randomSeed/noiseSeed in this source. Distinguish harness seeding from source logic.
- The nominal source workload is ten million proposals. Retaining every attempted state
  would impose unnecessary output and memory costs; accepted path geometry and explicit
  work admission need deliberate consideration if a reusable operation is admitted.

The modularisation prose calls the tracer generic while calling randomly rotated steering
a one-off choice. Resolve that tension explicitly: neither turn the entire scene into an
opaque helper nor silently substitute a different contour algorithm and claim equivalence.
No marching-squares evidence was established by the current targeted search. Analytic level
sets, complete contour extraction, closed-loop guarantees and collision avoidance are not
implied by this report.

Next Luna retrieves exact evidence and a few computational neighbours. Root then decides
whether band-constrained proposal tracing earns a public operation, belongs in an editable
workflow, or should be deferred. Frozen signatures, new code, rendering and broader candidate
adjudication are not authorized by this investigation. Sol remains paused; ports deferred.

## Initial recreation-coverage question

Under docs/recreation-coverage.md, venas is currently unsupported as a complete noise-band
recreation: the package lacks its proposal/acceptance traversal. A candidate band walker
might close this gap, but that is projected coverage of one named sketch, not demonstrated
support. No additional original is counted until neighbour evidence shows a complete match.
The choice between preserving its proposal semantics and independently specifying a new
steering policy directly affects that claim. Do not count arbitrary noise-heading paths
as newly enabled merely because both techniques sample noise.

CP11 provides a useful caution: its accepted LatticeMarks workflow changes tata's start,
retry and stopping policies. It demonstrates the occupied-path capability; it does not
prove source-equivalent recreation of tata or support guagua's unrestricted revisiting walk.
Those original identities cannot be credited solely from the starter's successful render.
