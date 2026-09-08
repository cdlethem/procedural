# BranchMarks port boundary and model comparison

Root reviewed the frozen endpoint-branch behavior and accepted Java BranchComposition/PDE
for batch04. This is a port specification, not target acceptance. The artist controls a
root and generation rules, then independently selects line/taper treatment and terminal
marks. Preserve the public tree's nominal lengths, headings, parents, generations and actual
child counts; reconstructing topology from endpoint coincidence is neither necessary nor
correct for collapsed segments.

The JavaScript core entry is seededEndpointBranches2D(config), with BranchTreeError and the
catalog's size property/camelCase retained accessors. Keep exports local to branch-tree.js
until root implementation review. The example entry is createBranchComposition(seed,
moreGenerations,narrowing,binary,wider,forest), returning size, totalSegments and treeAt.
This names target bindings without changing the frozen language-neutral operation.

Port the accepted Java rule construction literally: absolute-generation narrowing, two or
three independent child slots, one shared scale per parent, bounded explicit root count and
seed+rootIndex modulo2^32. Forest roots come from accepted circle placement; they reserve
root space, not nonoverlapping canopies. Retain the20000-segment example preflight. Palette,
taper, terminal dots and canvas coordinates remain example choices, not operation defaults.

The source and model reference is packages/java/examples/BranchMarks/BranchComposition.java;
its motivating reports are 2018/Generativos/arbolito3 and arbolito4. Contract conclusions and
source-law divergences are recorded in cp6-branching-selection.md and the CP6 contract review.
This does not replay the source RNG or claim source-pixel recreation.

## Model comparison before native rendering

Compare eight fixed compositions: baseline, extended generations, narrowing, wider spread,
binary slots, forest, extended forest and changed forest seed. Compile/run actual Java
BranchComposition; do not copy Java expected counts from labels. Compare every tree and
segment, exact topology, headings and nominal lengths. Verify exact endpoint attachment
within each target, independently tally child counts, and check same-runtime rule-extension
prefixes for geometry/ancestry. Child counts and terminal membership are excluded from that
prefix claim because formerly terminal segments can acquire children.

For these finite model cases, compute coordinate allowances from actual Java tree values
using the existing tools/generate_branch_tree_fixtures.py coordinate_comparison function
before comparing JavaScript. Reuse its outward-rounded propagated parent intervals and
explicit two-neighbor trig engineering margin. Bind the helper hash; do not regenerate
shared fixtures or substitute a universal absolute epsilon. A failure requires numeric
review, not a larger tolerance. Fixture conformance remains a separate requirement.

## Native workflow scope

After core/model review, adapt the existing p5 GrainMarks harness for the actual editable
BranchMarks sketch. Preregister its final state sequence before rendering. Cover added
rules, narrowing, spread, slot count, seed, forest transfer, geometry-retaining style edits,
actual terminal dots, reset and cached saving. Use nominal length for taper and actual
childCount==0 for terminal markers. The existing Java draw treatment is the reference;
retain native float conversions at the renderer boundary rather than narrowing core data.
Root must inspect single-tree growth, terminal treatment and forest output. Runtime core,
native workflow, local packages and source recreation stay distinct acceptance layers.
