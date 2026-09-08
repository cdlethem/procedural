# Give a shape grain

Start with [GrainMarks](installing-grain-marks.md), a working triangle texture that lets you
change colour and replace dots with strokes without moving the points. Press **X** to use
the same sampling with rectangles from RegionMarks, each split into two triangles.

## Choose the distribution, then draw your marks

For even area coverage, provide three ordered vertices, a seed and a count:

```java
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.sampling.TrianglePoints2D;

Map<String, Object> config = new LinkedHashMap<String, Object>();
config.put("triangle", Arrays.asList(
    Arrays.asList(40.0, 600.0),
    Arrays.asList(320.0, 40.0),
    Arrays.asList(600.0, 600.0)));
config.put("seed", 42L);
config.put("count", 15680);
TrianglePoints2D points = TrianglePoints2D.seeded(config);

double[] position = new double[2];
for (int i = 0; i < points.size(); i++) {
    points.pointInto(i, position, 0);
    point((float)position[0], (float)position[1]); // ordinary Processing drawing
}
```

These are example settings, not library defaults. Retain `points` and change the drawing
loop or style whenever you like. `pointInto` reuses your buffer; `pointAt` returns a fresh
`double[]`; `toValues` materializes detached plain `{points: ...}` data when needed.
The core retains binary64 positions and never reads Processing's global random state.

For controlled concentration, call `TrianglePoints2D.map` with the same triangle and an
ordered `unitCoordinates` list of `[u,v]` pairs in the closed interval [0,1]. Replace the
seed/count fields with that list. Mapping uses the square-root construction and consumes
no randomness. Independent uniform pairs give ideal uniform area coverage; caller-chosen
biased pairs change concentration. Vertex order matters to that interpretation.

The editable Java tab demonstrates `(U*V,W)` pairs, concentrating points toward the first
vertex, and a biased second-coordinate product motivated by puntis3. Those are ordinary
example expressions, not permanent library presets. Its caller-side Java Random is seeded
explicitly and differs from the public seeded operation's portable xoshiro stream. Switching
routes changes the points; no source-stream or cross-route pixel replay is promised.

## Controls and what they preserve

| Key | Edit | Effect on geometry |
|---|---|---|
| C | Recolour | Retains the exact points |
| M | Dots or four-pixel horizontal strokes | Retains centres; full strokes can cross boundaries |
| N | Example density 0.1 or 0.2 | Rebuilds; the uniform lower-count sequence is an exact prefix |
| B | Uniform, first-vertex, or second-coordinate concentration | Rebuilds through the selected factory |
| R | Next seed | Rebuilds points and, in cell mode, the partition |
| X | Supplied triangle or divided cells | Rebuilds shape geometry and grain |
| 0 | Restore all baseline controls | Replays baseline geometry and the same-run JAVA2D pixels |
| S | Save displayed canvas | Does not rebuild |

Dots make a fine, pale texture. Strokes make concentration and cell boundaries much clearer.
Colour/alpha and mark size stay in the PDE; count allocation and coordinate expressions stay
in the Java composition tab. This separation is an intentional design improvement over
source sketches that share random streams across geometry, brightness and colour.

## Limits and evidence

Count is explicit. The example uses `ceil(area*density)` on its small authored canvas and
preflights a 160000-point work budget; neither is a universal density recommendation. The
operation's 1073741823-point ceiling is only a packed-storage representation limit, not an
allocation or speed guarantee. Explicit mapping needs materialized input pairs in addition
to retained output. Local measurements cover 15680/40960 mapped points and up to 100000 seeded
points; their timings and payload/object-count limits are in the
[Java report](../evidence/conformance/triangle-points-java.json).

All finite triples, including repeated or collinear vertices, have a defined collapsed
mapping. Uniform area interpretation applies only to nondegenerate triangles; collapsed
segments are not promised uniform arclength spacing. Mapping has exact specified rounded
arithmetic and finite component bounds, not exact real-arithmetic triangle membership at
every floating boundary. The example does not clip entire marks, triangulate arbitrary
polygons, construct Delaunay topology or reproduce upstream pixels.

The motivating [puntis](../survey/out/2018/Generativos/puntis/notes.md),
[puntis2](../survey/out/2018/Generativos/puntis2/notes.md) and
[puntis3](../survey/out/2018/Generativos/puntis3/notes.md) reports contain important shorthand
errors: the active puntis grain uses a product and is not uniform; its uniform helper is
unused. The [source audit](../design/capabilities/grain-evidence-audit.md) records those
corrections and the measured substitutions. Density changes establish impact, with shared
stream confounds; they do not establish a continuously useful range. The public operation
uses independently specified numerics and streams.

The [installed review](../evidence/reproductions/cp5-java2d/root-review.json) covers all 15
states and 16 key events, retained style edits, density prefix, resets, distribution changes,
cell transfer and saving. Other CP5 target ports are deferred.
