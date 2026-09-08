# Recreation coverage as an admission measure

The maintainer proposes evaluating additions by how many original sketches become practical
to recreate from scratch using package-native operations. Use this as evidence of value,
alongside API clarity and maintenance cost. It is not a function-count quota or a score that
can override architectural judgment.

## What counts

Assess a named original sketch's complete relevant computation, not a technique tag or a
single extracted helper. Ordinary host drawing, palette choices, layout constants and
composition loops are allowed artistic glue. A custom contour tracer, triangulator, physics
solver or equivalent missing algorithm means the recreation still has a package gap.
A sketch-specific callback that hides such an algorithm does not close that gap.

Declare the intended fidelity before counting: structural/technique recreation may permit
independent random streams and a different palette; exact source behavior may not. Changing
the defining algorithm, dropping a difficult component or calling every path an equivalent
recreation is not coverage. Explain material divergences individually.

For each investigated sketch record:

- evidence path and revision, defining computations, and current package composition;
- missing algorithms and whether a proposed operation actually closes all of them;
- ordinary artistic glue remaining and API concepts introduced;
- fidelity target, current evidence status, and the next check needed.

Use **demonstrated** only for an implemented, run and reviewed recreation at its declared
fidelity; cite its evidence. **Plausibly supported** means a report/source walkthrough maps
all defining computations to existing accepted operations and ordinary glue, but execution
is pending. **Unsupported** identifies a known missing algorithm. **Unassessed** covers
insufficient reading; it must not silently become supported or rejected.

A validated starter proves its scoped workflow. It does not automatically establish a
recreation of every motivating sketch. An unimplemented proposal has projected coverage,
not current support. Keep these separate in reporting.

## Compare marginal value without overfitting

For a candidate addition, list exact sketches plausibly unlocked and remaining gaps. Count
unique source identities once; separately describe how many distinct computational or
composition patterns they represent. Ten near-duplicates are useful reach but weaker
transfer evidence than several different uses. Check one contrasting neighbour that should
remain unsupported. When practical, use a sketch not used to shape the API as a transfer
check, with its status explicit.

Compare that gain to new concepts, required parameters, dependencies, algorithmic glue
removed, implementation/validation work and ongoing maintenance. Keep these dimensions
visible rather than inventing weighted numerical precision. A rare, difficult idiom can
justify an operation even with few examples; a large apparent count cannot justify a
confusing API or per-sketch switches.

Start with the active capability and its immediate neighbours. Do not require a fresh
901-sketch audit or rendering campaign before every addition. Any reported percentage must
state both the assessed denominator and full snapshot denominator, distinguish unknowns,
and avoid projecting selected examples over the whole corpus. Broaden the coverage map in
bounded evidence batches as useful; never describe11 starters as11 recreated originals.

## Decision and delivery report

Include a short before/after statement in each existing capability brief, without adding
a separate reporting system:

- **Before:** named originals already supported and precise algorithmic gaps in others.
- **Projected gain:** originals whose last gap this addition closes, separately from those
  only partly helped; group near-duplicates by computational pattern.
- **Cost:** new public concepts, parameters, dependencies and continuing maintenance.
- **Transfer:** a use outside the motivating composition, preferably an original withheld
  from API design, and a meaningful artist edit requiring no algorithm rewrite.
- **After validation:** newly demonstrated originals at the declared fidelity, remaining
  plausible cases and failures. A partial component earns no whole-sketch count.

Prefer additions that close complete workflows and transfer cleanly. When existing operations
already suffice, deliver composition guidance or an example instead of another operation.
Root may admit a rare but valuable capability with low raw coverage, recording why its
algorithmic burden and clarity justify the cost. Coverage informs judgment; it is not a
single weighted score to maximize.
