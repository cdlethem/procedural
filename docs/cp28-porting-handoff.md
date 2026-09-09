# CP28 Java 0.31 baseline

Pin the porting checkout to `f43629a931980f8572577380f1a8069f50f9ec56` on main.
This accepted source milestone contains29 Java operations and33 workflows. It adds
`mesh.annular-solid-3d` and AnnularMarks to CP27. The archive identity and extracted
consumer evidence are in `evidence/distribution/cp28-java-review.json`.

Use the frozen annular catalog and26 shared fixtures, including exact topology, face
metadata, field-specific numeric allowances and two arithmetic-failure witnesses.
Preserve welded seams, outward inner-wall winding, scaled flat normals, count preflight,
error precedence, detached exports and atomic indexed reads. No band metadata or general
closed-meridian support is implied. The Java example demonstrates width/depth/facet edits
and retained color/arrangement transfer; it is not a full aros recreation.

Port integration remains paused. Other targets are explicitly unvalidated for this
operation. Workers may propose implementations and native evidence, but root reviews
semantics and representative output before merging or writing shared support attestations.
Workers must not write root acceptance records. Every native render, across all checkouts,
uses `tools/with_native_render_lock.py` and the shared machine lease.

Pending Java work includes public-method documentation, remaining family/discovery
reconciliation and the final completion audit. The Android ProfileMarks draft is preserved
separately and unaccepted. See `docs/porting-resume.md` for integration obligations.
