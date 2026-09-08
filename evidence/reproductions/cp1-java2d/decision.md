# CP1 JAVA2D example decision

Root accepts the native Java helper, actual PDE lifecycle and edit/transfer checks. Sol independently
reviewed the implementation, checker and four images. This is the first executed
artist-facing composition slice; it does not complete four-target CP1 delivery.

The [plan](plan.json) and generated [result](result.json) bind the example,
three public operations, native recorder, runtime and image hashes. The first four
renders passed; review then identified a tolerance check that could accept NaN and
incomplete drawing-state coverage. Root tightened the checks and preregistered four
corrective renders with the same artwork settings and tolerance. All eight attempts
succeeded, and the corrective images are byte-identical to the first four.

## What ran

`tools/run_field_marks.py` compiles the actual example-owned `MarkField.java` against
the built core JAR and Processing 4.5.6. A recorder intercepts its real line/quad
calls and forwards them to JAVA2D. It does not reimplement the drawing loop.

One model retains 25,600 sets of x, y, heading, length factor and colour phase in five
named arrays (1,024,000 numeric bytes). This example-owned editable storage is a
clarity choice, not a new public operation. Every paint leaves its hash unchanged.
Positions are exactly the expected x-fast lattice from (2,2) through (638,638).

- Recolouring preserves every recorded line endpoint exactly and changes colours.
- Doubling maximum length preserves positions/headings/colours and doubles endpoint
  displacement within the predeclared 0.0002px binary32 drawing-coordinate tolerance.
- Bars retain centres, long axes and colours; 25,600 quads replace 25,600 lines.
- Recorded coordinates are finite. Paint restores the full caller matrix and the
  colour-mode ranges, fill/stroke enablement, colours, weight and cap that it changes.

## Direct visual inspection

Root inspected all four final 640px images. Sol inspected the identical first set.
The base reads as separate short strokes arranged into broad related directional
regions. Doubling length visibly extends and overlaps the marks, making the same
regions denser. The alternate palette replaces greens/oranges with purple, cyan,
yellow and pale areas while leaving that structure fixed. Bars make the marks
heavier and the underlying regular spacing more apparent, preserving orientation.

| edit | mean absolute RGB difference | changed pixels |
|---|---:|---:|
| length | 0.10420 | 92.76% |
| palette | 0.09997 | 76.42% |
| bar | 0.16026 | 99.65% |

These metrics describe the inspected edits; they are not public parameter ranges or
universal aesthetic thresholds. Images remain under `.work/reproductions/cp1-java2d/`.

The mechanism is motivated by [pelines](../../../survey/out/2018/Generativos/pelines/notes.md).
Separating colour progression from geometry also has evidence in
[mountain4](../../../survey/out/2018/Generativos/mountain4/notes.md). The portable
noise, canvas, opacity, background and bar substitution are deliberate design choices,
not exact reproductions of those sketches. No human usability, P2D/P3D, other host,
portable command-stream or full-corpus claim follows from this result.

## Actual PDE build and lifecycle

The [PDE build record](pde-build.json) verifies the actual `FieldMarks.pde` using the
official Processing 4.5.6 production preprocessor, then compiles its generated Java
with the unchanged drawing tab and package JAR. The published Maven preprocessor
references a `utils` artifact that was unavailable there; the checker obtains the
shipped dependencies from the SHA-256-verified
[official portable distribution](https://github.com/processing/processing4/releases/tag/processing-1434-4.5.6).
SDK binaries and generated Java remain under `.work/`.

The build checker now always compiles the current core into a private JAR and records
its source, compiler and binary hashes; the lifecycle runner consumes that recorded JAR.
The current `pde-build.json` is a fresh compilation check. The lifecycle result below
retains its original embedded build evidence; no additional frame was rendered for this
tooling hardening. Current PDE and lifecycle-harness compilation both passed.

A separately [registered one-frame check](pde-plan.json) then executed the generated
sketch's actual settings/setup/draw and S-key handler in JAVA2D. Its validation
subclass delegates drawing to the unchanged sketch and exits after saving. The
[result](pde-result.json) records a 640px saved PNG with no runtime stderr. Root
inspected that image and verified every RGBA pixel matches the helper's base image.
Sol independently confirmed zero differences: both decoded RGBA buffers contain
1,638,400 bytes with SHA-256
`d534f2fd76c5efba72c3b6bb3f967f3d1589b81213b0be9d30714ebf203f7ce4`.
This checks the save handler programmatically, not physical keyboard event delivery
or a human usability session.
