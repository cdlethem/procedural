# Optional engineering composition: triangle stippling

Priority revision, 2026-09-07: this is no longer the first artist-facing milestone or
the automatic next assignment. [CP1 and CP2](artist-capabilities.md) now lead the work.
Retain this bounded sampler/portability investigation where it helps those capabilities;
do not freeze universal geometry, RNG or command interfaces around this example alone.

Status: a reviewed-evidence implementation scope, **not a frozen contract or support
claim**. The operation catalog does not exist yet. Keep behavioral schemas there when it
is introduced; this document assigns work and records the evidence needed to reach it.
The source binding and authored dispositions remain in
[the candidate ledger](../design/phase2/cluster-decisions.json).

This proposed engineering composition chooses one colour per supplied triangle, samples its points,
and joins those positions with the triangle colour and explicit style to emit dot marks.
This follows the `puntis` colour-before-inner-loop ordering; related `puntis3`/`puntis4`
stipple layers use per-dot grayscale and must remain distinct recipes. It exercises stochastic geometry, colour,
command output and all four adapters without first depending on triangulation, a noise
algorithm, fonts or shaders. This is a design choice about dependency order. The corpus
motivation is [puntis](../survey/out/2018/Generativos/puntis/notes.md),
[puntis2](../survey/out/2018/Generativos/puntis2/notes.md) and
[puntis3](../survey/out/2018/Generativos/puntis3/notes.md): their notes separate uniform
triangle sampling from triangulation and area-proportional stippling.

Supplying a triangle is only the development milestone. Reproducing the whole surveyed
compositions later requires their site generation, Delaunay topology and other layers.
A passing primitive scene must not be reported as a complete sketch reproduction.

## Computation boundaries

| investigation | reviewed evidence | responsibility | excluded from this responsibility |
|---|---|---|---|
| `sampling.point-in-triangle` | `puntis2#1`, `puntis4#1` under `2018/Generativos` | One uniform point from three triangle vertices and explicit stochastic state | Triangle generation, density/count, colour, drawing |
| `color.palette-pick` | `2014/Generativos/circulosdentrocirculos2#1`; reviewed palette membership in ledger | Select an existing palette entry, preserving duplicate entry weights | Background-colour exclusion, retry, shuffle, interpolation |
| `mark.stipple-triangle` | `2018/Generativos/puntis#0`, `puntis3#1` | Investigate area-proportional point-mark emission as composition of sampler and sink | Delaunay and a fixed palette or alpha |
| dot sink / command representation | The point stamping described in the three motivating notes | Carry explicit position and mark style to each target | Host-global style and implicit pixel density |

A dedicated public stipple wrapper is still a D2 decision. If repeat/sample/attribute/mark
composition covers its behavior clearly, retain it as a recipe or helper instead of
adding a redundant public operation. The sampler itself has repeated independent evidence.

## Work packages and handoffs

1. **Integration owner — establish the shared contract authority.** Settle catalog format,
   colour representation, point/triangle representation, parameter objects, explicit errors,
   state threading and immutable ownership. Record design choices as design choices rather
   than corpus facts. Add catalog-surface-synchronization only when its first derived
   consumer exists, before any duplicated target metadata. Do not mirror schemas here.
2. **Terra — stochastic semantics investigation.** Compare the actual random consumption
   and sample mapping described in the motivating notes. Propose one named portable source
   and an explicitly separate compatibility path if exact Processing reproduction needs it.
   Deliver seed/state normalization, interval mappings, consecutive transitions and invalid
   input/empty-call behavior to the integration owner. No host RNG may silently define the
   portable result.
3. **Luna — parameter evidence investigation.** Trace triangle density, mark size/alpha and
   palette changes to exact parameter substitutions and measured results. Separate sample
   count from density-times-area and determine whether rounding is documented. Report
   useful observations, masking and RNG confounds; neither an endpoint nor a large diff
   establishes a recommended range. Keep unsupported defaults absent. A mathematical
   invalid-input bound is distinct from an artistic range.
4. **Integration owner — freeze one operation at a time.** Read every accepted cluster
   member and relevant unresolved neighbours, record whole-computation versus extraction
   scope, and pass `tools/check_phase2_design.py --contract-cluster <id>` before contract
   preparation. This is structural eligibility, not semantic approval. Settle degeneracy
   and ordering, and enter the operation contract and fixture
   references in the catalog. Sampling fixtures must distinguish uniform area sampling
   from a plausible corner-biased implementation, verify exact next state, and cover
   reversed/collinear/coincident vertices. Define tolerances per observable coordinate;
   indices, state and command counts remain exact.
5. **Native implementation, after freeze.** Root integrates the Java portable core and
   common fixtures. Terra handles the independent JavaScript/p5.js path; Luna handles
   Python/py5. Android shares only deliberately portable Java core and receives its own
   adapter/lifecycle verification. A Java wrapper alone does not verify the JS/Python
   implementations. Add generative-performance before the first count-sensitive loop.
6. **Command and adapter validation.** Apply capability-and-adapter-boundaries for pixel
   density, colour conversion, alpha, mark rasterization and renderer ownership. All four
   targets consume the same canonical input fixtures. Confirm native execution separately
   from exact pure values and from renderer-dependent pixels.
7. **One serialized reproduction executor.** Register explicit development scenes and their
   acceptance level before rendering. Use the external full survey-output checkout for
   reference images; preserve seeded baseline identity and captured frames. For a reduced
   primitive scene, claim technique-level validation only. Introduce Delaunay/site generation
   later to reproduce a whole motivating sketch, then broaden toward the full release suite.

## Decisions that still block this slice

- No catalog entry, canonical RNG, geometry/colour/command schema or native fixture set
  is approved. These are concrete design deliverables, not a request to wait for 901 notes.
- Uniform triangle sampling has computational support; arbitrary density, dot radius,
  default palette, alpha and runtime work limits are not thereby established.
- A palette edit can shift downstream random consumption when it replaces random calls.
  [triangleRamp](../survey/out/2016/Generativos/triangleRamp/notes.md) explicitly reports
  this confound; preserve consumption when investigating visual controls.
- The checked-in text can support design and pure fixtures. Actual renderer conformance
  needs the separately stored PNGs and native runtimes. Do not record planned adapter tests
  or expected renders as completed evidence.

This micro-slice cannot establish architectural adequacy for the whole package. Use the
composition checks in [the revised API architecture](api-design.md) for each capability
actually selected for delivery; unselected families remain explicit future work.
The [decision audit](audits/phase2-architecture-review.md) records the course corrections
and reopened memberships that must be resolved before dependent contracts.

The [roadmap](roadmap.md) remains library-first, with working artistic examples developed
alongside capabilities. A scoped delivery requires its declared reproduction suite and
claimed target evidence. Full-corpus certification remains a separate, stronger claim.
