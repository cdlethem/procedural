# Java documentation completion batch

Baseline: Java0.31 f43629a931980f8572577380f1a8069f50f9ec56. Root inspected the actual
source-bundle Javadoc diagnostics, not only the aggregate warning count. This work improves
API discovery and does not change operation semantics or expand support.

First bounded slice: AnnularMesh3D public documentation (50 warnings). Luna edits comments
only against the accepted annular catalog. Root checks each public member description,
particularly detached exports, vertex versus face index ranges, and atomic Into failures.
No inferred defaults, ranges or general-solid claims. Then address composition adapters
and other core classes in bounded independent slices; no bulk boilerplate generation.

Validation for a documentation-only source change: compare comment-stripped Java tokens,
compile old and new source without debug metadata and compare all resulting class bytes,
and generate Javadoc for the changed class to check resolved links/tags. A line-number-only
class difference in a normal debug build is not a semantic difference, but must be explained.
Existing runtime evidence may be carried forward only with an explicit root review linking
old/new source hashes and this equivalence check. Do not silently rewrite historical
reports, weaken hash validation or rerender unchanged algorithms by default.

Before publishing a new source archive, refresh manifest source bindings and affected
support records under root ownership, keeping historical validation records intact.
Rebuild/reference validation must pass; a new operation is not added by documentation.
The whole-package completion audit still needs all five original requirements.

## Observed warning concentration

- `Delaunay2D.java`: 62 warnings.
- `RadialProfile3D.java`: 53 warnings.
- `AnnularMesh3D.java`: 50 warnings.
- `BranchTree2D.java`: 45 warnings.
- `TargetSprings2D.java`: 41 warnings.
- `NoiseBandPath2D.java`: 30 warnings.
- `OccupiedLatticePaths2D.java`: 29 warnings.
- `LinePool2D.java`: 28 warnings.
- `DrawingFrameState.java`: 25 warnings.
- `QuadrantPartition2D.java`: 25 warnings.
- `ClosedSpline2D.java`: 24 warnings.
- `RetainedRectangles2D.java`: 23 warnings.

Most frequent categories:

- `no @return`: 227.
- `no comment`: 208.
- `no @param for index`: 114.
- `no @param for offset`: 38.
- `no @param for output`: 20.
- `no @param for destination`: 20.
