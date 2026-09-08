# Existing Android starter resume audit

After RegionMarks exposed disabled controls after HOME/return, inspect the three existing
local-distribution APKs without modifying their source. One baseline composition per app:
FieldMarks0.1, PathMarks0.2, PlacementMarks0.3. APK SHA values must match the recorded
extracted-consumer distribution builds. No recompilation or extra edit sequence.

On existing API33 emulator, install each exact APK, launch its Activity, require all4/6/9
buttons enabled, send HOME, confirm the starter is no longer the active UI, bring the same
Activity to front, then inspect buttons over a bounded10-second observation period.
Record before/after XML and window screenshots; do not treat a disabled UI as accepted.
A result can reproduce the defect, show recovered controls, or fail to establish the audit.
The source-level identical busy-onResume pattern is a hypothesis, not proof per app.

Use one shared machine lease, at most600 seconds including emulator boot/shutdown;
runner execution360 seconds including cleanup. No rendering parallelism. Any key conflict
is handled only for these project-owned demo packages in the dedicated test emulator.
No source files, shared support attestations or old evidence records change during audit.
