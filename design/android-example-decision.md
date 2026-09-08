# Android editable example acceptance

Root inspected the initial native execution and its images on 2026-09-07. Accept the
registered editable CP1 example scope in `android-editable-example.md`. Evidence:
`evidence/reproductions/android-field-marks-ui/result.json`. This is automated native
interaction plus root visual inspection, not a completed human usability study.

The ordinary example and observation subclass compile on the pinned SDK33/Gradle/Android
Processing environment. The actual Activity received seven edit-button taps and one Save
tap, each gated on foreground Activity and window focus. Eight post-frame acknowledgements
have versions0–7, composition counts1–8 and completed-frame counts2–9. All registered
length/palette/mark combinations pass, with one retained 25,600-record model.

The first six cached PNGs match the accepted Android CP1 decoded pixels and command/model
hashes exactly. The combined long-bar edit changes397,079 pixels from short bars while
preserving colour samples. Recolouring those long bars changes409,477 pixels while keeping
geometry exactly; its colour samples match the accepted neon palette. All images are
nonempty, opaque640×640 snapshots.

Root viewed `example-screen.png`, `frame-7.png` and `frame-8.png` from the ignored execution
output. The screen shows the complete square piece centred in the available viewport,
all four readable controls and the successful save location. The combined images retain
the spatial field and overlapping bar structure while changing extent and then colour.
Images1–6 have exact decoded identity with the previously inspected four CP1 images.

Save publishes the app-owned MediaStore row with PNG MIME and pending0 under
`Pictures/Procedurals/`. Both decoded dimensions and observed provider dimensions are640².
Saved bytes equal frame8 exactly (SHA256
`91f887bb5d2a32f4d97e0284a84df834138ec92c50dc7f05aaa8d9e346b34b10`),
and composition/frame counts remain8/9. A final foreground/focus gate binds the screenshot
to the example. The app is force-stopped after successful evidence collection.

The initial editable allowance is consumed successfully; no corrective run is needed.
The runtime claim remains the pinned API33 emulator and Android2D Processing carrier,
with the API29+ MediaStore example requirement. Physical devices, other Android versions,
GPU renderers, process-death recovery and a human twenty-minute installation study are
not established by this run. Distribution remains separate unfinished I1 work.
