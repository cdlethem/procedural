# Install BranchMarks on Android

The Android BranchMarks0.6 starter ZIP is locally packaged and reviewed. In a prepared
checkout, build a fresh output directory:

```sh
python3 tools/build_branch_marks_android.py --output .work/dist/cp6/android-branch2
```

Extract `procedurals-branch-marks-android-0.6.0.zip`. Its README describes Java17,
SDK33/build-tools30.0.3, Gradle7.4.2 and the separately supplied pinned Processing runtime.
The ZIP includes the editable Activity, renderer, shared BranchComposition, GalleryWriter,
core0.6/adapter0.2 JARs and notices.

Seed, More, Narrow, Wide, Binary and Forest rebuild trees. Taper and Palette retain
geometry and ancestry. Reset rebuilds initial settings; Save PNG writes the cached image
through MediaStore to Pictures/Procedurals. These settings are example choices.

The [package review](../evidence/distribution/cp6-android-review.json) covers source/archive
identity and extracted compilation. The [native review](../evidence/conformance/branch-android-native-root-review.json)
covers18 API33 workflow states, the scoped restore regression, HOME/resume and cached save.
No physical-device coverage, source-pixel recreation or registry release is claimed.
