# Build and arrange annular forms

AnnularMarks has passed root-reviewed public-core P3D validation, including11 interaction
states, retained appearance edits and cached save. It is included in the Java0.31 source
manifest; consult the distribution review for extracted-package acceptance. The earlier
accepted Java0.30 bundle does not contain this example.

The mesh supplies a ring with a hole, its inner and outer walls, and top and bottom faces.
You supply dimensions and angular subdivisions, then use the retained triangles and flat
normals in ordinary Processing P3D drawing. The example shows one ring or three transformed
copies without rebuilding the geometry for each copy.

| Key | Edit | What stays fixed |
| --- | --- | --- |
| W | Change the inner radius and band width | Outer radius, depth, slices and styling |
| D | Change axial depth | Both radii, slices and styling |
| F | Change angular subdivisions | Radii, depth and styling |
| C | Switch the face palette | The retained mesh |
| M | Switch between one ring and an arrangement | The retained mesh |
| 0 | Reset controls | Geometry is rebuilt only if its inputs changed |
| S | Save the displayed frame | Geometry and drawing are not rerun |

Start in `rebuildMesh()` to change the geometry. `maxFaces` is an explicit work limit;
the example allows384 triangles for its48 angular cells. It is not a resolution setting.
Use `paintMesh()` to change drawing: `faceKindAt` distinguishes the walls from the two
annular surfaces, while `cellAt` can identify angular sectors for another color treatment.
The reusable scratch arrays avoid allocating a new point or normal for every drawn face.

These dimensions are authored example choices, not recommended ranges. The motivating
[aros report](../survey/out/2017/Generativos/aros/notes.md) has no measured variants.
The independently specified mesh corrects the source's winding and duplicate interior
faces; it does not reproduce the source animation, colors or global noise stream.
See the [private study decision](../evidence/parameter-experiments/annular-mesh/decision.md)
for the visual evidence supporting this boundary.
