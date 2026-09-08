# Root decision: advance compact line-pool contract design

Root reviewed all five full960P2D captures from the registered seed42 one-pool experiment.
The original preregistration bytes are preserved in the run directory; result.json binds
them and the prototype/renderer/runtime. Four variants attempted, all completed. RGB means
and changed-pixel fractions are recorded per case in experiment.json; no threshold labels
were invented. A Pillow API deprecation warning occurred during postprocessing, not rendering.

At9000 attempts the form has long sparse connectors and much less fine branching. At90000
it has dense small branch clusters while retaining its larger silhouette.180000 adds fine
texture but much less structural change than the earlier increase. In the numeric baseline,
81384 of90000 attempts skip short segments. At180000,170310 skip. Thus attempts are a work
budget with diminishing returns, not a linear density parameter.

Angles.7,1.4,2.1 all preserve recognizable branching. The smaller angle tightens first-cut
branches; the larger angle spreads them laterally. Revisit-angle policy remains unchanged.
Retain first-cut angular scale as a candidate artist control; do not name it maximum angle
because source multipliers and later divided-branch angles have distinct semantics.

Decision: advance to a compact operation contract, not implementation approval. Required
inputs should include explicit seed stroke, RNG seed, attempted work and first-cut angular
scale, with final ordered endpoints/divided flags reusable for styling. Preserve mutation
and selection semantics, including attempts that skip. Keep other source distributions
internal for this scope rather than expose a policy callback framework.

No library default or continuous encouraged range is established. The three angle samples
and three count samples are observed useful example configurations for one seed/stroke,
not universal bounds. A public work bound must be justified separately by memory/execution
limits. The prototype's timing excludes array allocation and is not a full performance claim.
A second seed/stroke transfer and source30-pool workload remain required before complete
workflow or whole-brotes recreation acceptance. Portable numerical/RNG semantics and fixtures
must be designed explicitly; the current prototype intentionally uses Processing float/RNG.
