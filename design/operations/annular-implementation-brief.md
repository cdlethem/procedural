# Annular Java implementation brief

Pending root contract acceptance. This brief does not authorize implementation while
catalog/operations/annular-solid-3d.json remains draft. Once frozen, the catalog and shared
fixtures are normative; this document defines the bounded execution task and validation.

Own one new core class, AnnularMesh3D, and focused tests/runner. Reuse the current Java
factory and index-carrier conventions. Do not modify RadialProfile3D or its accepted
source hashes merely to share private helpers. A small independent implementation avoids
coupling accepted geometry to this new topology. Read the source-normal method for the
established arithmetic but preserve separate operations and their public identities.

Store positions and normals in double[] and triangle indices in int[]. Derive angular
cell and face kind directly from face index (eight faces per cell; pairs in kind order)
when this preserves the frozen order. Do not allocate per-vertex/per-face objects during
generation or indexed Into reads. At and toValues deliberately allocate detached exports.
Generate only after complete validation and exact face-budget preflight. Every factory
failure returns no result; Into errors must not partially overwrite destinations.

The public class and methods need readable Javadocs: input units, invariants, errors,
ownership, source note and private study provenance. Link the class-level provenance from
accessors where appropriate. Do not invent recommended radii or resolution ranges.

Run all26 shared cases through the actual Java implementation, with exact topology,
metadata, errors and canonical zero, field-specific allowances for trig-derived values,
and exact same-runtime repeatability separately. Execute the access/ownership scenarios
in annular-fixture-plan.md, including forbidden numeric carriers and nonfinite inputs.
Do not count generated assertions as independent tests or expand unrelated suites.

Performance: slices3 (24faces),48 (384faces), and10000 (80000faces). Use two warmups and
three measured generations, recording retained checksums and native allocation if the
existing ThreadMXBean path is available. Inputs/maps and checksum traversal are outside
the allocation measurement. Reuse a small scratch triple for checksums. These are bounded
observations, not a latency SLA or target-independent limit. No new benchmark framework.

Root will separately own the native artist example and representative visual review.
It must change inner radius, axial depth and slices, then recolor and arrange retained
geometry; a saved image must match the cached frame. Reuse the established P3D runtime,
shared machine lease and extracted-package workflow. The private study is not a substitute
for native execution of the public class. Ports and root attestations remain out of scope
for execution agents.
