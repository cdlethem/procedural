# Corrected JavaScript retained-output packages

The local BranchMarks0.6.1 and GrainMarks0.5.1 patch builds correct ordinary-array output
validation in endpoint branching and both triangle-point operations. Invalid destinations
are rejected before any slot is written. Geometry generation and the native drawing path
remain unchanged.

Build with the prepared checkout's existing Node/npm infrastructure:

```sh
node tools/build_retained_output_javascript.mjs --build --output .work/dist/retained-output-local
```

The output directory must be new. Each branch/grain subdirectory contains its npm tarball
and installable browser starter ZIP. Extract a starter and follow its README to install
the adjacent local package and pinned p5 dependency, then start its local server.
The patch bundles retain the ten-operation surface; ProfileMarks packaging is pending.

The [package review](../evidence/distribution/javascript-retained-output-review.json)
records archive manifests and installed/extracted consumer checks. These are reviewed
local artifacts, not a registry release. Historical CP5/CP6 package records remain available.
