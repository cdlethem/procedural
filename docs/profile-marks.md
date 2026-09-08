# ProfileMarks: build a form from its silhouette

Start with a list of heights and radii. `RadialProfile3D` connects the circular rings,
wraps their seam, handles pointed ends and optional caps, and retains triangles with
flat normals. Processing draws and lights those triangles. Colour and placement remain
editable without generating the geometry again.

The Java core and installed Processing example have passed scoped validation: 43 shared
cases, native ownership/access checks, and 13 rendered edit/reset states. The P3D run used
a Mesa software context; other platform ports remain deferred.

Open the `ProfileMarks` example and its `ProfileComposition.java` tab. The Java tab builds
three profiles: a cylinder, a waist and a pointed form. Replace the radius expressions,
or supply your own pairs. Each pair is `[z, radius]` in local distance units. Heights
must strictly increase; interior radii must be positive. A zero endpoint radius creates
one pole. Two zero radii alone do not describe a surface.

| Key | Edit |
| --- | --- |
| `P` | Select the next retained profile. |
| `D` | Switch between 8 and 32 angular slices. |
| `B` / `T` | Toggle the first / last endpoint cap independently. |
| `C` | Change the palette while retaining geometry. |
| `X` | Arrange the three retained forms side by side. |
| `0` | Restore the starting composition. |
| `S` | Save the displayed canvas. |

The settings are choices for this piece, not recommended library ranges. The accepted
private comparison showed the silhouette changes and the difference between 8 and 32
slices. Source `cilindros` uses 128 slices, but that does not establish a preferred
resolution. Its size parameter also changes height; the source `fieeee` resolution
changes multiple dimensions of work and random consumption. See the
[source review](../design/capabilities/cp7-profile-neighbour-boundaries.md).

The mesh exposes positions, triangle indices and one flat normal per face. Use
`vertexInto`, `triangleInto` and `normalInto` with reusable buffers in the drawing loop.
`bandAt` identifies the two input profile points joined by a side face; `cellAt` identifies
the angular cell. Both triangles of a side quad share these labels. `faceKindAt`
distinguishes sides and endpoint caps. This lets a palette follow the bands without
embedding colour decisions in the geometry generator.

The example composes this metadata with `CyclicPalette`. Its palette and arrangement
controls reuse existing meshes. Caps and subdivision change topology and regenerate the
composition. At a pole the corresponding cap flag has no effect: there is already one
closing vertex. A pointed form therefore does not acquire a separate disk at its point.

Keep the mesh in local coordinates and use ordinary Processing transforms to position
it. The example translates before rotating so each object turns around its own origin.
It supplies each retained normal inside `beginShape(TRIANGLES)`, before that face's
vertices, and uses an orthographic camera and Processing lights.

`maxFaces` is an explicit work budget. Generation fails rather than returning a partial
surface when the requested topology exceeds it. Its large representation ceiling is not
a memory guarantee. Extreme finite inputs can also produce unrepresentable edges or
rounded degenerate triangles; those fail explicitly rather than returning invalid normals.

This operation covers single-valued radial profiles along increasing Z. Annular solids,
arbitrary closed meridians, general triangulation, smooth normals, textures and source RNG
are outside its scope. The motivating mechanisms and deliberate differences are recorded
in the [capability selection](../design/capabilities/cp7-profile-selection.md).

Full data and error semantics: [operation contract](../catalog/operations/radial-profile-surface.json).
