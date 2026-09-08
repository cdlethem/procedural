# BranchMarks Android starter

This native example draws retained endpoint trees with the shared Java
`BranchComposition`. It preserves the Java example's generation colours, nominal-length
taper and actual terminal dots. Root placement uses circle placement to reserve root
space; tree canopies may overlap. The scoped native workflow is validated; standalone packaging is tracked separately.

Controls: Seed (R), Generations (N), Narrow (G), Wide (W), Binary (B), Forest (X),
Taper (M), Palette (C), Reset (0), Save PNG (S). Taper and palette retain geometry;
growth controls rebuild it. Reset rebuilds even when defaults are already selected.
Save writes the cached displayed PNG to `Pictures/Procedurals` through GalleryWriter.

The rule schedule, root poses and colours are example choices, not operation defaults
or measured recommended ranges. Motivation: `survey/out/2018/Generativos/arbolito3/notes.md`
and `survey/out/2018/Generativos/arbolito4/notes.md`. This independently composed example
does not replay the source random stream or claim source-pixel reproduction.

Compile an isolated project using the prepared local Android toolchain:

```sh
python3 tools/build_android_branch_marks.py --stage .work/examples/android-branch-marks-build1 --build
```

Compilation does not establish native support. All emulator rendering must use the
repository's shared machine lock; generated APKs, toolchains and images stay outside Git.
