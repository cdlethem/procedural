# Annular fixture and access review plan

Draft; no public implementation acceptance. Root generated26 cases through
`tools/diagnostics/annular/build_fixture_draft.py`. Six successful cases use exact topology,
face metadata and signed-zero expectations, with separately computed per-component
position/normal allowances from existing profile interval tooling. Eighteen cases cover
static input and exact budget rejection; two exercise the existing scaled-normal failures.

The axial-edge-overflow witness has finite bottom/top values but an infinite first-face
edge difference. The rounded-cross-collapse witness uses radius1e308 and depth5e-324;
scaled edge arithmetic loses the axial component, giving zero cross scale. Both require
MESH_ARITHMETIC_INVALID at faceIndex0 with the exact stage. A small successful case cannot
justify claiming all finite input combinations generate valid triangles.

Before public fixture acceptance, bind the final catalog hash and source generators;
confirm the checker dispatch supports this mesh shape rather than silently skipping it.
No global tolerance, widened acceptance threshold or copied native output as golden.

## Required Java access scenarios

Use the minimum mesh and a successful offset read into sentinel-filled arrays. Check
vertex/triangle/normal triples and that slots outside the write remain unchanged. Then
check each of these independently, with the entire destination unchanged on failure:

- invalid negative or unsafe Object index before range and output validation;
- valid integer index equal to the retained count before destination validation;
- null destination, negative offset and insufficient destination slots;
- offset Integer.MAX_VALUE without offset-plus-three overflow;
- both long and Object index overloads, with forbidden Boolean, string, BigDecimal and
  custom Number carriers rejected by Object overloads;
- detached At results and toValues exports cannot mutate retained geometry;
- input-map edits after generation do not alter retained results;
- repeated reads and recoloring do not regenerate geometry.

Factory checks include complete static validation before budget computation/allocation;
near-maximum slices with tiny budget must fail promptly without attempting mesh storage.
Nonfinite Java carriers require native cases because strict JSON cannot encode them.
Per-face output has no bandAt alias: kinds and angular cells describe the annulus directly.

These are meaningful scenario obligations for the implementation agent, not a claim that
they are already executable or passing. The private study's mutable objects are not the
production ownership design. Root reviews complete tests before accepting the operation.
