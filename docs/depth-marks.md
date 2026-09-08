# DepthMarks: move through a field and color a form

Open DepthMarks from the Java0.21 examples. It begins with short colored strokes on fixed
grid positions. Changing depth selects another slice of the same three-dimensional field,
so the pattern evolves without changing its seed or moving the stroke origins.

| Key | Edit |
| --- | --- |
| Z | Switch field depth between0.25 and1.25; resample both the grid and mesh. |
| C | Change the palette, retaining geometry and sampled values. |
| M | Switch from planar strokes to coloring a retained rounded mesh. |
| 0 | Restore the original depth, palette and planar view. |
| S | Save the displayed image to depth-marks.png without generating another frame. |

The two depth values are example settings, not recommended bounds. Try smaller depth steps
in the sketch for gentler changes. `GradientNoise3D01` owns only the scalar field; the sketch
chooses how coordinates and values map to a drawing:

```java
GradientNoise3D01 field = GradientNoise3D01.create(42L);
double n = field.sample(x / 96.0, y / 96.0, depth);
double angle = n * Math.PI * 2.0;
double length = 3.0 + 17.0 * n;
```

Increase the coordinate divisor to sample a smaller field region across the same drawing
area; decrease it to traverse more field structure. The divisor96, angle/length mappings,
grid spacing and palettes are authored choices. The field does not read time: an animation
can supply its own frame-derived depth, while reset and replay remain explicit. DepthMarks
itself redraws on edits and does not provide an animation/export controller.

The mesh view samples the same field at each triangle's actual x/y/z center. Its z input
combines spatial depth with the chosen field offset. `RadialProfile3D` constructs the indexed
geometry from a supplied rounded profile; `CyclicPalette` maps cached samples to colors.
The mesh, grid and field stay allocated through all edits. C and M also preserve the sample
arrays. Geometry and color are therefore separate places to change the piece.

Edit the profile values in `makeMesh()` to color another surface of revolution. Keep their
z coordinates increasing and respect the radial-profile contract. Edit the palettes or
scalar-to-phase expression to change color organization; lighting also affects displayed
mesh colors. No noise algorithm or mesh topology needs to be copied into the sketch.

This workflow uses native Processing P3D with the pinned desktop runtime used by the source
bundle checks. The generic render/sweep helper remains JAVA2D-only. The field's results
are independently specified: it does not replay Processing noise and its z=0 slice does
not equal `GradientNoise2D01`. The motivating evidence is
[pelosNoise2](../survey/out/2016/Generativos/pelosNoise2/notes.md) and
[conitos](../survey/out/2018/Generativos/conitos/notes.md); this example is a new composition,
not a pixel recreation. See the [field contract](../design/operations/gradient-noise-3d-contract.md)
for exact arithmetic, accepted coordinates and error behavior.
