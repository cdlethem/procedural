# RegionMarks Android starter

This is an experimental native Android RegionMarks example. Its native runtime and
renderer evidence are unvalidated; the builder checks staging and compilation only.

The controls are **Seed**, **Splits**, **Source**, **Selection**, **Motif**,
**Palette**, and **Save PNG**. Seeded and authored region generation establish the
retained region composition; motif and palette changes reuse that retained geometry,
while source, selection, and split changes rebuild it. Save writes the displayed PNG.

The renderer draws native circles and rectangles in a guarded completed-surface
callback. Those Processing calls are presentation code and are outside the portable
command vocabulary. The shared `RegionComposition.java` remains the editable geometry
source; the Activity and Renderer remain ordinary Android example code.

Prepare or compile the isolated project with:

```sh
python3 tools/build_android_region_marks.py --stage .work/examples/android-region-marks-build1
python3 tools/build_android_region_marks.py --stage .work/examples/android-region-marks-build1 --build
```

Processing Android runtime, SDK, signing keys, and local build properties remain
external to the example and are not claims of native support.
