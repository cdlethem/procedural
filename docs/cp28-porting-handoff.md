# CP28 Java 0.31 baseline (historical milestone)

For a new assignment, use [the current port handoff](porting-resume.md). Counts and
artifact identifiers below describe this historical milestone, not current main.

Historical baseline: `f43629a931980f8572577380f1a8069f50f9ec56` on main.
This accepted source milestone contains29 Java operations and33 workflows. It adds
`mesh.annular-solid-3d` and AnnularMarks to CP27. The archive identity and extracted
consumer evidence are in `evidence/distribution/cp28-java-review.json`.

Use the frozen annular catalog and26 shared fixtures, including exact topology, face
metadata, field-specific numeric allowances and two arithmetic-failure witnesses.
Preserve welded seams, outward inner-wall winding, scaled flat normals, count preflight,
error precedence, detached exports and atomic indexed reads. No band metadata or general
closed-meridian support is implied. The Java example demonstrates width/depth/facet edits
and retained color/arrangement transfer; it is not a full aros recreation.

Current target support and remaining integration work are in [the port handoff](porting-resume.md).
Later Java completion is recorded in [the completion review](../evidence/distribution/java-completion-review.json).
