# Pack noncircular outlines with PolygonMarks

PolygonMarks proposes rounded elongated polygons, filters them with
`ConvexPolygonPlacements2D`, then draws the retained outlines. Replace those proposals with
rotated diamonds without rewriting overlap rejection. This example passed [native workflow review](../evidence/workflows/polygon-marks/root-review.json);
Java0.23 includes it in the [reviewed source bundle](../evidence/distribution/cp20-java-review.json).

Open `packages/java-processing/examples/PolygonMarks/PolygonMarks.pde`. The seed determines
600 centers, lengths and angles. Those descriptors remain unchanged while you edit thickness
or shape. Filtering can select different source indices after a shape edit; color is attached
to the original proposal index so a surviving proposal keeps its assigned color.

| Key | Edit | Retained state |
|---|---|---|
| A | Toggle thickness ratio0.8/0.2 | Centers, lengths and angles |
| M | Rounded polygons / diamonds | Centers, lengths and angles |
| C | Shift the four-color assignment | Same placement and descriptor objects |
| R | Increment seed and regenerate | Style settings |
| 0 | Restore the starting piece | Recreates seed42, rounded outlines, ratio0.8 |
| S | Save `polygon-marks.png` | Saves the cached completed frame |

These values are authored example settings, not library defaults or recommended ranges.
The local Java Random is explicit sketch state; the filter consumes no randomness.

## Supply your own shapes

The operation accepts ordered finite polygon vertices:

```java
ConvexPolygonPlacements2D placed = ConvexPolygonPlacements2D.filter(
  new double[][][] {
    {{20,20}, {100,20}, {80,60}, {30,70}},
    {{70,30}, {130,30}, {130,80}, {70,80}}
  });
for (int i=0; i<placed.size(); i++) {
  int source = placed.sourceIndexAt(i); // join to your colors or other metadata
  beginShape();
  for (int j=0; j<placed.vertexCountAt(i); j++)
    vertex((float)placed.xAt(i,j), (float)placed.yAt(i,j));
  endShape(CLOSE);
}
```

Only the first polygon above survives. Earlier accepted proposals win; changing proposal
order can change the composition. Extending a valid input preserves the retained prefix.
The result owns its coordinates. It does not retain your mutable arrays, and `toValues()`
returns an independent collection if you need portable data.

Polygons must be strictly convex vertex cycles in either winding. Do not repeat the first
vertex at the end. Collinear, concave, repeated or self-crossing geometry fails explicitly;
the filter does not silently repair or skip it. Touching edges/vertices, crossing and either
direction of containment count as overlap. Geometric signs are exact for the supplied
binary64 coordinates; drawing still uses the renderer's precision and antialiasing.

The example draws precisely the retained vertex cycle. If you draw a larger shape, add
strokes or decorate outside that outline, the visible marks may overlap despite the
collision regions being disjoint. Canvas clipping remains ordinary renderer behavior.

This closes the noncircular rejection-filtering gap illustrated by the `celular` sketches.
It deliberately corrects their asymmetric containment routine rather than preserving nested
source shapes. It is not a general polygon Boolean tool or a faithful source recreation.
See the [contract](../design/operations/convex-polygon-placement-contract.md) and
[design evidence](../design/capabilities/cp20-convex-placement-direction.md).
