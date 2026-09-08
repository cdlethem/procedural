# Private three-coordinate field study

This probe is excluded from the library. It supports the CP18 decision in
`evidence/parameter-experiments/cp18-noise3d/decision.md`; it is not an approved public API.
Its input-domain bound is deliberately narrower than a future portable field contract.
The mixer is reused from GradientNoise2D01; its existing lowbias32 attribution is in
THIRD_PARTY_NOTICES.md. No upstream sketch code is copied.

From the repository root:

```sh
.work/toolchains/jdk-17.0.20.1+1/bin/javac --release 8 -d .work/cp18-core-check packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java tools/diagnostics/noise3d/DepthStudy/Noise3DProbe.java tools/diagnostics/noise3d/Noise3DCheck.java
.work/toolchains/jdk-17.0.20.1+1/bin/java -cp .work/cp18-core-check org.procedurals.fields.Noise3DCheck
python3 tools/render_java.py tools/diagnostics/noise3d/DepthStudy/DepthStudy.pde --library .work/cp17-consumer-root1/extract/procedurals/library/procedurals.jar --seed 42 --param surface=0 --sweep depth=0.25,0.5,1.25 --output .work/FRESH-depth-study
```

Use surface=1 and depth=0.25 for the hemisphere transfer. The helper obtains the shared
machine lease itself. Fresh output directories preserve prior evidence. The Java tab
reuses package-private mixer methods from the explicit accepted JAR. Software projection
in the study does not establish native3D support.
