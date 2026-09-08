# R2 CityMarks acceptance and ownership

Root owns architecture, PDE drawing, performance admission and final visual/package review.
Terra owns only CityComposition.java and a bounded pure Java diagnostic. Existing package
core and contracts remain unchanged. Read ciscis002-recreation-walkthrough.md for provenance,
source mapping and explicit structural fidelity differences. No coverage credit before run
and review. Stop this batch after an accepted editable Java example and preserved archive;
do not start another capability concurrently.

## Frozen composition helper

Package org.procedurals.examples.citymarks; final class CityComposition; create(long seed).
Use accepted QuadrantPartition2D for 100 replacements on centered 960-square, fraction .5;
Delaunay2D for leaf centers with maxWork50,000,000. Use private java.util.Random(seed) for
retained example policies, separate from layout RNG. All arrays private; no mutable exposure.

Methods: mesh(), leafCount(), heightUnit(face), palettePhase(face), groundVisible(face),
groundGray(face), verticalCount(face), horizontalCount(face), windowCount(),
wallWidthFraction(face,wall), wallHeightFraction(face,wall), windowLit(face,wall,index),
windowGrid(face). heightUnit=u*v; phase=u; grayscale=int(200*u); ground visible=u>=.2.
Every policy consumes fresh independent uniform draws: the u/v notation above does not
share samples across height, phase, visibility or gray, or across wall probability/footprints.
Counts each16+nextInt(7). For each wall probability=(.2+.6*u)*v; fractions=.2+.7*u each;
retain boolean lit decisions in source j-outer/i-inner order. Grid columns verticalCount,
rows horizontalCount, origin(.5/vertical,.5/horizontal), spacing(1/vertical,1/horizontal).
Use RegularGrid for coordinates. Cache one grid per face. windowCount is total all walls.
Getter bounds should fail naturally or explicitly, never silently clamp. Helper retains
O(faces+windows) primitive data, no object per window. Geometry/metadata must replay for
seed42 and differ for43; all window counts positive and exact. Compile against unchanged
accepted JAR; report counts and elapsed construction time, no renderer claims.

## Drawing and acceptance

CityMarks requires desktop Processing4 P3D,960 square,density1, orthographic projection,
black background, source palette and lights, oblique fixed quarter-turn X/Z, scale2.1 and
source-like z translation. Native roof triangle, three wall quads and oriented shallow boxes
per face; balanced begin/end calls. Grid (v,u) maps along wall and down from roof. Palette
uses existing CyclicPalette. MIT notice required for source-derived drawing pattern.

Default heightMax200; H toggles80 while retaining layout/window decisions. C shifts palette
phase while retaining geometry. R changes seed;0 resets;S saves completed cached canvas.
No automatic animation. Retain numeric composition; draw loops use reusable arrays.

First stage/compile then measure ONE complete default-density frame under existing serialized
P3D executor with180s timeout. Record wall-clock and actual box count; timeout is failure,
not permission to reduce source density. Only proceed after root reviews first-frame cost
and image. Then scoped palette/height/seed edits, reset equality and cached save. No new
renderer framework or full core regression campaign for unchanged JAR. Packaging must
preserve old examples and byte-identical core and carry declared fidelity limitations.
