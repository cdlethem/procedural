# ProfileMarks Android draft

This workflow is under native validation and is not yet an accepted Android distribution.
It uses the shared Java radial-profile operation and ProfileComposition, with a local
Processing Android P3D fragment. No source-sketch code or copied assets are required.

Profile selects cylinder, waist or pointed forms. Slices changes angular subdivision;
Start cap and End cap choose independent closures. Palette and Trio reuse the retained
geometry. Reset rebuilds the baseline, and Save writes the acknowledged image to
Pictures/Procedurals without regenerating it.

Edit `packages/java/examples/ProfileMarks/ProfileComposition.java` to supply your own
increasing axial/radius pairs. Edit this Activity's triangle loop to change appearance.
Profiles, palette and placement are editable example choices, not library defaults or
measured parameter recommendations.

Compile the draft using the prepared project toolchain (JDK17, Android SDK33 and
Processing Android Mode4.12):

```sh
python3 tools/build_android_profile_marks.py --stage .work/android-profile-local --build
```

The stage must be fresh. This only compiles an APK; it does not install or render.
See `design/capabilities/profile-marks-android-acceptance.md` for the pending native
editing, MediaStore save and P3D pause/resume checks. Do not infer native acceptance from
a successful APK compilation.
