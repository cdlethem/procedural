# Install GrainMarks on Android

The Android GrainMarks0.5 starter ZIP is locally packaged and reviewed. Build it in a
prepared checkout with a fresh output directory:

```sh
python3 tools/build_grain_marks_android.py --output .work/dist/cp5/android-grain2
```

Extract `procedurals-grain-marks-android-0.5.0.zip`. Its README describes Java17,
SDK33/build-tools30.0.3, Gradle7.4.2 and the separately supplied pinned Processing Android
runtime. It includes editable Activity, renderer and GrainComposition sources,
GalleryWriter, core0.5/adapter0.2 JARs and notices.

Seed, Density, Distribution and Cells rebuild the points. Motif and Palette retain them.
Reset rebuilds the initial configuration; Save PNG writes the displayed image through
MediaStore to Pictures/Procedurals. Example settings are not recommended parameter ranges.

The [package review](../evidence/distribution/cp5-android-review.json) covers archive
contents, source identity and extracted APK compilation. The separate
[native review](../evidence/conformance/triangle-android-native-root-review.json) covers
ten API33 workflow states, HOME/resume and cached save, with the earlier failed attempt
and its diagnostic limits preserved. No physical-device coverage or registry release is
claimed. The triangle distribution batch is complete on all four targets.
