# GrainMarks Android starter

This experimental native Android example retains geometry through the shared
`GrainComposition` model, then draws dots or short strokes through its native renderer.
The model has one triangle or transfers grain to the thirteen CP4 cells as two triangles
per cell. Density and the two biased coordinate expressions are example settings.

The two rows contain **Seed**, **Density**, **Distribution**, **Cells**, then **Motif**,
**Palette**, **Reset**, and **Save PNG**. The equivalent keyboard controls are R, N, B,
X, M, C, 0, and S. Motif and palette preserve retained geometry; reset deliberately
rebuilds initial geometry even when it is already selected. Save writes the displayed
PNG to `Pictures/Procedurals` through the bounded pending-MediaStore route.

Prepare or compile an isolated project without installing, launching, or rendering it:

```sh
python3 tools/build_android_grain_marks.py --stage .work/examples/android-grain-marks-build1
python3 tools/build_android_grain_marks.py --stage .work/examples/android-grain-marks-build1 --build
```

The Android runtime, SDK, signing material, and generated build files are external to
this example. Preparation and compilation do not establish Android native support.
