# B1: explicit P2D/P3D render-helper profiles

Root implementation brief. Extend tools/render_java.py, preserving JAVA2D default behavior,
existing assets, single/sequence report compatibility and all work/time budgets.

Add --renderer choices JAVA2D(default),P2D,P3D. This declares the required renderer; it must
not rewrite a sketch's settings or silently substitute another renderer. Generated wrapper
checks sketchRenderer and actual g class against Processing PGraphicsJava2D/PGraphics2D/
PGraphics3D respectively. Density1 and32-million-pixel ceiling apply to all profiles.
Record renderer/profile and native observed renderer for opt-in OpenGL modes. Existing
JAVA2D metadata may remain unchanged for compatibility.

Reuse tools.run_depth_marks_java.check_runtime(), P3D_RUNTIME, JARS, KNOWN_STDERR and
SHUTDOWN_STDERR. It already audits pinned JOGL/native dependencies; Curvespace proves reuse
for P2D. Import current symbols from their actual owner (CP7 diagnostics exports JARS and
KNOWN_STDERR). Include all runtime files and imported validation source files in before/after
input binding. No copied checks, downloader, runtime selection framework or new executor.
Only OpenGL mode adds dependency JARs and LIBGL_ALWAYS_SOFTWARE=1. Continue shared lease
and xvfb-run. Hash provenance reports must identify actual software-render profile; no GPU
performance/support claim. Arbitrary extra jars/shaders remain outside this task.

Capture subprocess stdout/stderr/exit status for the OpenGL native call. Successful stderr
must be empty or match one established full diagnostic regex; unknown diagnostics fail,
not silently swallowed or broadly ignored. Preserve current JAVA2D run return interface;
a small optional diagnostics collector/validator is sufficient. Bind successful diagnostic
text in report. No shell command interpolation from user parameters.

Single and sequence captures must be completed framebuffers, including P3D depth testing.
Use existing synchronous PImage snapshot saving for sequence. If actual OpenGL lifecycle
exposes an issue, fix that path and rerun focused checks; do not change acceptance to allow
blank captures or renderer fallback.

Terra owns tools/render_java.py, tests/test_render_java.py and docs/rendering-java.md.
Root owns native representative fixtures/tests. No native render before handback/source
freeze. Root will validate a colored overlapping P2D composition and a depth-occluded P3D
scene, one selected-frame sequence, and an intentional renderer mismatch failure. Actual
library origin remains explicit through supplied JAR and source bindings. No source-sketch
reproduction inferred. Existing Java helper tests cover regressions; no huge matrix.
