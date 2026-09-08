# BandMarks: keep wandering lines near a noise level

BandMarks is included in the Java0.18 source bundle. Distribution review records identify
accepted archive bytes. Java0.17 does not include this operation.

A band path remembers the noise value at its starting point. It proposes a short move,
accepts it only when the new noise value is close enough, and keeps trying after rejection.
The result is a retained path that you can draw as a line or use to place other marks.
This differs from PathMarks, which advances every step along a noise-derived heading.

| Key | Edit |
| --- | --- |
| T | Switch tolerance between .002 and .008; regenerate paths. |
| C | Change the palette while keeping the same path objects. |
| M | Place short perpendicular marks along the retained paths. |
| 0 | Restore the original paths, palette and line view. |
| S | Save the retained display to band-marks.png. |

Change the start grid in rebuildPaths() to choose where lines begin. Each trace has its
own explicit seed. Changing colors or mark shape uses the retained result and consumes no
walk randomness. Change fieldScale or fieldOffset to sample a different part of the noise
field; these changes regenerate geometry.

Tolerance measures difference in **noise value**, not distance in pixels. Wider tolerance
can produce more tangled strokes; it does not simply make the same line thicker. Because
an acceptance changes the position and heading used by later proposals, even a small edit
can change the whole trajectory. The fixed proposal policy attempts nested random turns,
with a separate small heading perturbation on rejection. This is not a complete contour
extractor: loops, full contour coverage and collision avoidance are not guaranteed.

Attempts bound computational work. A rejected proposal does not add a vertex; accepted()
and rejected() report what happened. size() includes the original starting point, and
headingAt(i) describes the accepted segment from point i to point i+1. maxVertices bounds
retained output; reaching it on an accepted append raises an error instead of returning a
silently truncated path. In this example2049 vertices permit all2048 attempts to succeed.

The [venas report](../survey/out/2018/Generativos/venas/notes.md) motivates the acceptance
mechanism. Its .002→.008 tolerance experiment changes the whole scene. The independent
[prototype decision](../evidence/parameter-experiments/cp15-band-prototype/decision.md) also
found a visible narrow-versus-tangled change, but neither establishes a recommended interval.
All example numbers are authored settings. This package uses its own gradient field and
seeded stream; it does not reproduce Processing noise/random state or the original image.
