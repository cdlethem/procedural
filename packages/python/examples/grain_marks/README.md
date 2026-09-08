# GrainMarks py5 example

Draft native workflow; acceptance and standalone packaging are pending. In the prepared
checkout, use JDK17 and the pinned py5 environment to run `sketch.py` on a display.
The editable model builds triangles and samples; the sketch draws their retained points.

R changes seed, N density, B cycles uniform/first-vertex/edge concentration, X transfers
to quadrant cells, M toggles dots/strokes, C palette, 0 resets and S saves the displayed
canvas under `output/`. M/C retain samples. Marks can extend beyond triangle boundaries;
this example does not clip them. Settings are choices, not recommended artistic ranges.

Motivated by `survey/out/2018/Generativos/puntis/notes.md` and `puntis3/notes.md`.
Biased pairs use example-only Java Random semantics for comparison with GrainComposition;
they do not change the library's independent seeded uniform operation or claim source replay.
