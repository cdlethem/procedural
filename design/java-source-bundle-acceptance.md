# Java source bundle: clean-checkout acceptance

The pushed source baseline is e5a604acc42e9e47f5d843888350a8672d786485. Historical package
builders preserve prior archives by design, but cannot bootstrap a new checkout without
those ignored archives. Add one source builder so a Processing user can build the current
accepted library without replaying the development history. This changes distribution
plumbing, not operation contracts, fixtures or target support.

Inputs: project sources/catalog validation, explicit JDK and Processing core JAR, explicit external GlyphMarks font
and its license, fresh ignored output. No running renderer, prior staged
sketch/archive or network service may be required to assemble the bundle. The external font
and license must match accepted hashes; never silently omit GlyphMarks, substitute a font,
or copy assets into Git. Preserve upstream/project licensing inside the output.

The builder must reject stale/unaccepted Java source bindings before packaging. It compiles
the portable core for Java8, assembles the15 accepted PDE/helper-tab workflows, contracts,
support metadata and documentation, and writes a deterministic archive plus input/output
hash report. Explicitly distinguish source assembly from native acceptance and publication.
Do not include CLI/test drivers as Processing tabs or label an unvalidated new operation
accepted merely because a source file exists.

Root acceptance compares all77 compiled class payloads, all accepted example tabs and font
payloads against the accepted Java0.15 archive. The preliminary baseline javac --release8
compilation already matches all77 class files byte-for-byte. If the completed builder also
matches these executable/input payloads, reuse existing source-bound native acceptance;
no additional render is warranted. Differences require explanation and affected validation
before acceptance. Documentation/package metadata may differ explicitly.

Validation: focused input/admission/overwrite/archive tests plus actual clean-output build,
repeat build for deterministic bytes, final payload comparison. No142-test rerun unless
shared code changes. Simulate the clean checkout with inputs restricted to tracked sources
and supplied external resources; verify no earlier .work archive/stage dependency remains.
Root reviews implementation and artifact before committing/pushing this integration checkpoint.
Terra owns builder/tests; root owns acceptance/docs. Separate porting checkout remains untouched.

## Correction after initial review

The first review compared only the portable core JAR, leaving the desktop adapter absent.
The corrected acceptance must compare the exact set of library JAR paths with Java0.15,
then every class in each JAR. Compile extracted FieldMarks and PathMarks Java tabs against
only the extracted library JARs plus the declared external Processing core. Missing adapter
classes must fail this consumer check. Keep the core and desktop adapter separate.
