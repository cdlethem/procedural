# Install RegionMarks on Android

The Android RegionMarks0.4 ZIP is now locally packaged and reviewed. Build it in a
prepared checkout with a fresh output directory:

```sh
python3 tools/build_region_marks_android.py --output .work/dist/cp4/android-region2
```

Extract `procedurals-region-marks-android-0.4.0.zip`. Its README explains Java17,
SDK33/build-tools30.0.3, Gradle7.4.2 and the separately supplied pinned Processing Android
runtime. The ZIP includes editable Activity, Renderer and RegionComposition sources,
GalleryWriter, core0.4/adapter0.2 JARs and notices. It excludes the SDK, runtime and keys.

Seed, Splits and Selection rebuild seeded regions; Source switches to authored cells.
Those three geometry controls are ignored for authored cells. Motif and Palette reuse
regions; Save PNG saves the displayed composition through MediaStore.

The [packaging review](../evidence/distribution/cp4-android-review.json) covers extraction,
source identity and APK compilation. The separate
[native review](../evidence/conformance/quadrant-android-native-root-review.json) covers
API33 composition edits, HOME/resume and cached save. Neither establishes physical-device
coverage or a registry release. JavaScript and Python quadrant packaging remains pending.
