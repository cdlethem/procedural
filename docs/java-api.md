# Use the Java API directly

Start from a [working sketch](choosing-java-workflow.md) when you want an idiom with editing
controls. To compose the core yourself, open `reference/index.html` inside the installed
Procedurals library. This source-generated Javadoc lists the actual Java packages, classes,
factory signatures, accessors and exception types. It is separate from the
[language-neutral contracts](reference/operations.md).

Create values or retained models first, then draw with ordinary Processing calls. Keep the
model when changing its appearance; recompute it only when its geometric inputs change.
`pointInto`-style methods let you reuse a small output array while drawing many points.
Some factories take maps of named inputs; typed overloads are listed in each class's Java
reference. The operation contract supplies the precise input and failure rules. Do not
assume every class uses the same export or restore method name.

## A complete small sketch

With the library installed, paste this into a new Processing Java sketch. It uses the public
core directly and needs no example-specific Java tabs or drawing adapter. These dimensions,
spacing, colors and mark length are authored example settings, not recommended ranges.

```java
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.layout.RegularGrid;
import org.procedurals.color.CyclicPalette;

RegularGrid grid;
CyclicPalette palette;
double[] point = new double[2];
float markLength = 12.0f;

void settings() { size(320, 320, JAVA2D); pixelDensity(1); }

void setup() {
  Map<String, Object> layout = new LinkedHashMap<String, Object>();
  layout.put("origin", Arrays.asList(20.0d, 20.0d));
  layout.put("spacing", Arrays.asList(20.0d, 20.0d));
  layout.put("columns", 15);
  layout.put("rows", 15);
  grid = RegularGrid.create(layout);

  Map<String, Object> colors = new LinkedHashMap<String, Object>();
  colors.put("colors", Arrays.asList(0x173F5F, 0xE9C46A, 0xE76F51));
  palette = CyclicPalette.create(colors);
  noLoop();
}

void draw() {
  background(248, 245, 238);
  strokeWeight(2.0f);
  for (long i = 0; i < grid.size(); i++) {
    grid.pointInto(i, point, 0);
    int rgb = palette.sample(i / (double)grid.size());
    stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
    line((float)point[0], (float)point[1],
      (float)point[0] + markLength, (float)point[1] + markLength);
  }
}
```

Run it, change `markLength` to `6.0f`, and run again. The positions and palette phases stay
the same. Replace `line` with `ellipse` to use the same positions for another mark. To change
the arrangement, edit the grid's input map instead. Palette phases are cycles: one full unit
traverses the entire supplied list. RGB24 values need the explicit channel unpacking shown
above when passed to Processing's color calls.

For editable geometry, study CutMarks' `RetainedRectangles2D` calls. For explicit motion,
PointerMarks supplies target coordinates to `TargetSprings2D`; its drawing mode does not
advance the simulation. BodyMarks retains `GradientPath2D` values while changing taper or
centerline drawing. These are composition examples, not additional core operations.

For spatial composition, `Java2DRegions` supplies rectangular content callbacks in local or
canvas coordinates. `Java2DLayers` retains callback drawings as images and transports image
alpha into reusable mask values. Feed the same mask to source-over compositing or two-input
crossfading. See [LayerMarks](layer-marks.md) and [MaskMarks](mask-marks.md); callbacks draw
with their supplied target, and completed images can be reused without rerunning generators.
These adapters require JAVA2D at density1; crop/fit selection remains explicit.

Javadoc is generated from the accepted source inventory. Some older members still lack
individual comments or parameter/return tags; the build records those warnings and does not
present them as a clean documentation audit. Class-level evidence and linked contracts
remain necessary for semantics and provenance. Generated documentation does not certify a
new target or change any operation's accepted behavior.

## Query the scalar field directly

`GradientNoise2D01.create` takes a map with exactly one key, `seed`, containing an unsigned
integer from0 through4294967295. Use a Java `long` for seeds above2147483647. Its numeric
interchange methods accept Byte, Short, Integer, Long, Float or Double; they do not coerce
strings or booleans. `sample(x, y)` uses field lattice coordinates, while `sample(point)`
requires a `List` of exactly two values. Each coordinate must be at least-9007199254740991
and strictly below9007199254740991 so both lattice corners remain representable. These are
engineering limits, not useful artistic ranges.

The sample is a pure value in `[0,1]`: querying it does not advance random state. Convert
canvas positions into field coordinates explicitly, for example `x * frequency + offsetX`.
The field is independently specified and does not reproduce Processing's `noise()` values.
