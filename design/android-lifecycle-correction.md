# Android lifecycle runner correction

The registered initial run reached `active-ready` and `pause-1` successfully. It stopped
before BACK because the runner searched only for `mResumedActivity:`. The actual pinned
Android 13 diagnostic uses `topResumedActivity=` and identified the correct CoverActivity.
The failed initial report and observed top activity are preserved in
`evidence/conformance/android-adapter-lifecycle-initial.json`; the complete diagnostic
is ignored under `.work/environments/android/adapter-lifecycle/initial-activity-dump.txt`.

A subsequent read-only window diagnostic showed a SystemUI ANR dialog held input focus.
Root captured and inspected that screen, force-stopped the already-failed probe, and
selected the system dialog's Close app button to restart SystemUI before a corrective
cold launch. This is emulator prerequisite cleanup, not a substitute lifecycle stimulus.
No BACK, touch, or finish stimulus was sent to continue the failed probe.

The corrected runner recognizes the pinned diagnostic field and requires BOTH the
expected top-resumed Activity and its actual focused window before any BACK or tap.
It polls the two predicates within the registered part deadline. A foreign dialog never
receives the intended test input. The correction also preserves the initial report and
uses a separate exclusive `native-attempt-corrective.json`, selected by `--corrective`.
The adapter, lifecycle helper and app are unchanged. Sol accepted this runner-only
correction before the corrective execution. All original native assertions remain.
