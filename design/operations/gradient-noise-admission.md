# Admit a scalar-source dependency for CP1

Root admits `field.gradient-noise-2d-01` as an independently specified capability dependency,
following Sol's semantic review and the [four-render decision](../../evidence/parameter-experiments/cp1-noise-choice/decision.md).
Its capability is repeatable, spatially related scalar values that can drive heading, length
and colour in different targets without reimplementing host noise. Its named seed-only field
supports reordered/repeated queries and reuse across independent marks.

The source evidence is [pelines#0](../../survey/out/2018/Generativos/pelines/notes.md), a
composite consumer. That record stays unresolved in its existing family. It is not kept or
merged as if it computed this new algorithm. The ledger's `dependency_admission` explicitly
binds the motivating note/evidence hashes and accounts for placement, mappings, palette,
segments/clipping, opacity and backgrounds. This avoids inventing a standalone candidate
or hiding unresolved components behind a false equivalence.

The reviewed [design](cp1-noise-proposal.md) names the algorithm and records alternatives.
Host delegation cannot establish cross-target field identity; a generic field DSL is
unnecessary. Processing compatibility, multi-octave accumulation, rectified sums and signed
simplex remain distinct work. `ciserp` supplies interface counterevidence through feedback
integration, not an equivalent noise source. `scicirgold#1` remains reopened because its
second sample consumes a first sampled angle and its report conflicts about dimensionality.

Root inspected all four candidate renders before this admission. Single-octave fields gave
readable coherent stroke regions. The rotated probes did not reveal distracting noise-grid
structure in this bounded example. This is sufficient to proceed with the scalar primitive;
it does not establish universal isotropy, public artistic ranges, exact corpus reproduction,
or the remaining public-API CP1 edits/ports.

Contract work must freeze every arithmetic step, full input/error domain, integer hash
conversion, canonical serialization and distinguishing fixtures. The private experiment's
bounded integer casts must not be reused for the full safe-integer coordinate domain.

Sol also approved the final numeric contract and independently matched all 68 scalar fixture
outputs and every intermediate hash vector in JavaScript. Root froze version 0.1.0 in
`catalog/operations/gradient-noise-2d-01.json`. Native implementations remain separate work.

## Implementation review

Sol approved the three native cores after root integrated the final coverage corrections:
finite y-domain failures, Python positive-zero output assertions, and JavaScript's internal
hash-vector test path. All three execute 68 scalar cases through both query forms, 8 query
errors, 7 mixer vectors and 5 corner vectors; their 250,000-query checksums agree exactly.
Private JS hash helpers are not package entry-point exports; Java test classes are excluded
from the JAR. The generated conformance record is `evidence/conformance/gradient-noise-2d-01.json`.

Root also rendered and inspected the public Java grid/noise composition through the private
JAVA2D probe. Its RGBA pixels exactly match the registered candidate-design image. This
establishes the recorded integration scope, not an upstream corpus baseline, a finished
palette/drawing adapter, or completed p5.js/py5/Android support.
