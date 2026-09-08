# py5 pixel suite correction

Initial evidence: `evidence/conformance/py5-adapter-pixels-initial.json` (preserved
before correction); diagnostic: `evidence/conformance/py5-acquisition-diagnostic.txt`.
All four groups failed in readiness: JPype resolves `raw.image` as the overloaded
drawing method. Access the public PGraphics image field through Java Field.get/set,
without accessibility overrides. Apply this to readiness, cleanup and test inspection.
Retain full chained tracebacks in group results.

Also add Sol's static wrapper-method/constant preflight and assert fresh unallocated
backing before density configuration. These strengthen failures without changing drawing.

The virtual display initially rejected public pixel_density(2). Launch the test JVM
with `-Dsun.java2d.uiScale=2`; an isolated AWT query confirms its display transform is
2× in both axes. Installed ShimAWT bytecode derives density from this transform.
Assert actual parent sketch density and physical dimensions before running any group.
No private parent-density mutation or relaxed density acceptance is used.

Consume the one registered corrective pixel execution after these changes; preserve
the initial report and exclusive initial/corrective attempt records. No threshold changes.
