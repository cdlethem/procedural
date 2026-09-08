# RegionMarks Android native attempt

Preregister one initial API33 emulator execution, using the shared machine render lock.
Compile first. The native runner has240 seconds including cleanup; the outer emulator
session has500 seconds including startup/shutdown. Use the existing AVD and toolchain.

Seven actual Activity button-callback compositions: baseline301 single marks; grid301
cells/2709 marks; alternate palette with retained cells; selection fraction1 with301
cells;200 splits with601 cells/5409 marks; seed43; authored11 cells/99 marks. Preserve
exact geometry for style edits and replace it for geometry edits. The probe invokes actual
Button.performClick on the UI thread; it does not simulate physical taps or claim touch UX.

After the palette state, send Android HOME, then bring the existing Activity back to front.
Require actual onPause/onResume callbacks and the same retained snapshot/geometry before
continuing. One lifecycle redisplay is permitted; no extra composition is allowed. This
exercises the new native rect/ellipse consumer through the existing host lifecycle.

After authored mode, seed/count/selection buttons must produce no composition or frame.
Save through the actual asynchronous writer and MediaStore route; read the resulting URI,
verify finalized PNG metadata and byte identity with the cached displayed snapshot. Check
300ms quiet periods after ignored edits and save. Capture seven PNGs and saved bytes.

Require source/staged/APK hashes unchanged, API33, exact cell/mark counts, no probe failure,
proper640-square output, native consumer cleanup, and root inspection of baseline/grid/
layout/authored. Record source hashes and runtime facts. No pixel identity across platforms,
source recreation, physical-device, other renderer or distribution acceptance claim.
On failure retain evidence; do not tune counts or redraw-budget expectations to pass.

## Corrective attempt2

Attempt1 stopped after1.1 seconds because adb exec-out returned exit0 with a missing-file
message before the Activity published its first result. The runner mistakenly parsed that
message as JSON. Preserve native1 failure evidence. Recognize only that precise startup
condition as pending; all other malformed payloads still fail. Run the same seven-state
suite once more with a fresh output directory and unchanged APK/acceptance criteria.

## Corrective attempt3: resume acknowledgment

Attempt2 reached the palette frame and returned to the same resumed Activity, but all
controls stayed disabled. dumpsys and UI hierarchy were retained under native2. The
Activity set busy onResume and waited for a noLoop frame acknowledgment that need not
occur. Queue acknowledgment of the still-valid cached snapshot after onResume completes,
checking activity state and requested version. This does not regenerate geometry or
repaint. Rebuild and rerun the same seven-state/lifecycle/save suite in fresh native3.
The inherited pattern in other Android starters warrants a separate focused audit; their
previous evidence is not rewritten or presumed to cover this newly observed case.
