# Standalone sequence export

Status: root-approved Java prototype implementation direction. Reuses bounded sequences,
explicit frame context, the existing binary build resource and fresh JAVA2D renderer.
No real-time scheduler, simulation, asset sink or other-target export is accepted.

Build an existing exported project with optional `--contexts /path/contexts.json`. The
file is a closed object with a `contexts` array. The array is an ordered list of existing
catalog frameContext records; Java performs authoritative schema admission before rendering.
The standalone Python reader enforces existing duplicate/nonfinite/depth/value/byte bounds,
closed envelope and maximum32 contexts before compilation. It does not duplicate context
field domains. The recipe must contain frameContext; schedule values override that snapshot.
The input file is read once; record raw and canonical hashes and encode a separate sealed
sequence-data.bin resource. Generated identity includes its SHA256 or null for single-frame
builds. Existing builds without --contexts retain their single-PNG command.

With --contexts, print RecipeSequenceExport and a fresh directory argument. The Java entry
point loads both identified resources, calls RecipeSequence with default per-frame limits,
and aggregate limits equal to the default profile except work=2000000, maxFrames=32. These
are provisional engineering limits, not artistic ranges; evaluate every frame before
requesting any renderer. Empty sequences are valid. No output directory is created for
admission/evaluation failure. Existing output directories must never be overwritten.

After successful command evaluation, create the fresh directory and write manifest.json
with status incomplete. Record recipe/sequence resource identities, contexts, aggregate
counters and completed frames. Render ordinal filenames frame-000000.png etc., preserving
repeated caller indices without collisions. Reuse the single-frame renderer and cleanup.
After each save record ordinal, context, command count, retain reuse and PNG SHA256. Update
the manifest atomically in its owned directory. Mark complete only after every render and
hash succeeds. Failure or external interruption leaves incomplete output; a prefix is never
advertised as a complete sequence. Run under the shared render lock and external timeout.
The export/build manifests already bind code, operation support and JDK/core identities.

Root owns Java runner/reader changes, failure semantics and representative native review.
Luna may implement the frozen Python build option and focused reader checks. Verify a
four-frame zero/later/repeated/backward sequence against independently exported snapshots;
inspect representative native results. Check no-context invocation, malformed schedule and
existing output refusal. Empty and late-render-failure handling need distinguishing probes.
Keep all PNGs and compiled outputs outside Git. Sequence export remains prototype-scoped.
