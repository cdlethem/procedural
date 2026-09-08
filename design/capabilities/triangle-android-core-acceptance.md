# Triangle core API33 ART execution

Run the unchanged accepted Java TrianglePoints2D core with the existing generated59
seeded/mapping fixtures, prefix/equivalence checks and extracted ownershipAndAccess test.
Exclude desktop workload benchmarks. Supplement with five fixture RNG vectors using
reflection into the actual compiled private stream: initial/post states, uint32 outputs
and unit conversion. This is test-only reflection, not a public operation or source rewrite.

Before execution, verify prepared source/class/dex and toolchain hashes. Require actual
API33 ART app_process execution of both mains:59 cases/209 assertions in vectors,
356 assertions in access plus stream checks. Compare the pushed device dex hash and
remove the exact temporary dex on exit. Reject a changed local dex before device access.
Use the existing runner210-second execution/240-second cleanup limit and one shared
500-second machine lease including emulator boot/shutdown. No app install or rendering.

This proves only the executed core scope. No Android GrainMarks workflow, public package,
performance, allocation-failure injection or source-image reproduction claim follows.
Zero-count initialization absence and generation draw placement remain source-reviewed;
the actual generated output bits, including collapsed cases, execute in the vectors.
