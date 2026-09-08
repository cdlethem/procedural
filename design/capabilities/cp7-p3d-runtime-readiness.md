# CP7 P3D runtime readiness

This is a read-only readiness inventory for a future private profile-mesh experiment. It
neither starts a Processing sketch nor establishes P3D availability, mesh semantics, or
renderer support. The existing validated drawing profile is explicitly JAVA2D-only;
its reports cannot be repurposed as P3D evidence.

## What is locally available

The checked-in runtime used by current Java2D work is the Maven core JAR:

| item | location | binding / fact |
| --- | --- | --- |
| Processing core | `.work/toolchains/processing-4.5.6/core-4.5.6.jar` | SHA-256 `88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4`; contains `processing.opengl.PGraphics3D`, `PGraphicsOpenGL`, `PJOGL`, and `PGL` classes |
| desktop Processing archive | `.work/toolchains/processing-4.5.6/processing-4.5.6-linux-x64-portable.zip` | SHA-256 `ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c`; not currently extracted as a CP7 runtime |
| Java compiler/runtime | `.work/toolchains/jdk-17.0.20.1+1` | the pinned JDK used by all recent Java/PDE tools |
| X server wrapper | `/usr/bin/xvfb-run` | available; its documented default is a 1280×1024×24 virtual screen and `-a` chooses a free display number |
| host libraries/devices | `libGL.so.1`, `libGLX.so.0`, `libEGL.so.1`, `libX11.so.6`, `libXext.so.6`; `/dev/dri/{card0,card1,card2,renderD128,renderD129,renderD130}` | presence only; no GLX/EGL query or rendering test was run |

The portable desktop archive contains the missing JOGL/GlueGen pieces needed for a
Linux-amd64 P3D attempt. Relevant archive members are:

- `Processing/lib/app/resources/core/library/core-4.5.6.jar`;
- `.../gluegen-rt-2.6.0.jar` and
  `.../gluegen-rt-2.6.0-natives-linux-amd64.jar`;
- `.../jogl-all-2.6.0.jar` and
  `.../jogl-all-2.6.0-natives-linux-amd64.jar`.

The archive also has hashed app-level equivalents (`core-4.5.6-...jar`,
`jogl-all-2.6.0-...jar`, and `gluegen-rt-2.6.0-...jar`). A future runner should use
one coherent set, preferably the `resources/core/library` set Processing distributes,
not mix that set with the Maven core JAR or the separately installed py5 native trees.
The py5 environments do contain Linux-amd64 `libjogl_desktop.so` and
`libgluegen_rt.so`, but those are a separate dependency layout and do not prove a
Processing P3D classpath.

## Minimal future experiment setup

After the private experiment and a one-attempt plan are reviewed, materialize the
already-pinned desktop archive into a new ignored CP7-only directory, for example
`.work/toolchains/cp7-processing-4.5.6`. Do not download a new Processing or JOGL
release. Bind the archive SHA above and record SHA-256 values of the five selected core,
JOGL, and GlueGen JARs after extraction.

Compile the experiment and its PApplet probe with the pinned JDK 17 against that exact
five-JAR classpath. Run the probe under one serialized `xvfb-run -a` process with a
repository-local `-Duser.home=<ignored-build-home>`, an isolated working/output
folder, and a process-group timeout. The experimental PApplet must request P3D in
`settings()` through `size(width,height,P3D)` and `pixelDensity(1)` before surface
creation. It must save/inspect one completed frame only after the P3D surface exists.
No Java2D fallback, offscreen Java2D substitution, or browser/py5 renderer can satisfy
this setup.

The runner should follow the existing native-execution discipline visible in
`tools/run_grain_marks_pde.py` and `tools/run_branch_marks_pde.py`: source hashes before
and after, an exclusive `.work/processing-render.lock`, one `attempt.json`, bounded
stdout/stderr capture, kill the process group on timeout, and preserve failures rather
than retrying. Those runners currently exercise JAVA2D examples. They are a lifecycle
pattern, not P3D evidence or a drop-in P3D classpath.

## Required capability observations and failure classification

A future first probe should publish, before any pixel interpretation:

1. exact JDK, OS/architecture, archive and selected-JAR hashes, `xvfb-run` invocation,
   display, and command classpath;
2. `width`, `height`, `pixelDensity`, `g.getClass().getName()`, and an assertion that
   `g instanceof processing.opengl.PGraphics3D` after setup/draw;
3. whether a `PGL` session can be acquired on that actual renderer, without treating a
   class-load success as a context success;
4. a saved PNG’s existence, dimensions, alpha/background facts, and a small declared
   topology/pixel predicate appropriate to the later private experiment.

Terminal capability failures include `UnsatisfiedLinkError`/native-loader errors,
`NoClassDefFoundError` for JOGL or GlueGen, `com.jogamp.opengl.GLException`, AWT/X11 or
GLX context failures, an unexpected renderer class, context loss before capture, timeout,
or a missing/invalid saved frame. Report the original stderr/exception type and the
exact JAR/native bindings. Do not catch these failures and continue with `JAVA2D`, do
not relabel an Xvfb-only result as hardware/GPU support, and do not infer normals,
lighting, tessellation, depth, or shader behavior from class presence.

## Existing evidence boundary

`tools/check_processing_runtime.py` performs a pinned actual **JAVA2D** smoke test under
Xvfb. CP1–CP6 PApplet/PDE runners and the scoped adapter evidence likewise name JAVA2D;
for example CP1’s registered exclusions explicitly list `P2D/P3D`. Existing CP5 and
CP6 rendered examples are Java2D technique-level evidence. The corpus survey also marks
shader sketches rendered under Xvfb as suspect in `tools/report.py`. Therefore the local
archive and host-library inventory only remove an obvious dependency-discovery blocker.
A future P3D process must still complete a new capability-specific probe and a separately
reviewed visual experiment.
