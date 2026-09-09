# Turn points into a faceted drawing

FacetMarks connects scattered points into triangles. Draw them as colored faces, a wire
network or grain-filled shapes. Switching the drawing style keeps the triangle arrangement
in place.

[Install the Java library](building-java-from-source.md), then open **FacetMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **M** | Cycle between filled triangles, wire edges and grain points. |
| **C** | Switch palettes without moving the points or triangles. |
| **P** | Show or hide dark dots at the points used to build the triangles. |
| **N** | Switch between fewer points and more points; more points make a finer triangle network. |
| **X** | Switch point placement from a disc to the centers of divided rectangular cells. |
| **R** | Generate a different point arrangement and its triangles. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Start with a list of point positions and use `Delaunay2D` to connect them. Edit the site
creation in `FacetComposition.java` to use a different arrangement. Draw the returned
triangles in `FacetMarks.pde`, choosing fills, outlines or marks within each face.

The point arrangement controls the large shapes in the picture; color and grain change
how those shapes read. More points usually produce smaller triangles and require more work.
Triangulation connects points; it does not pack shapes or produce Voronoi cells.
