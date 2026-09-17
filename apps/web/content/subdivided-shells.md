# Subdivided shells

Build a faceted or softened shell from a small triangle mesh. The initial octahedron makes a closed volume; a tetrahedron changes its starting planes, and the open patch makes a sheet. Shape the source with independent axis scales and one raised corner before refining it.

| Control | Canvas effect |
| --- | --- |
| Base mesh | Switches the starting topology between two closed solids and one open sheet. |
| X scale / Y scale / Z scale | Change source proportions independently; zero flattens an axis and a negative value mirrors it. |
| Corner lift | Pulls one source vertex upward or downward before subdivision. |
| Refinement | Splits and smooths triangles through Loop subdivision; higher levels reveal a denser surface. |
| Camera yaw / Camera pitch | Turn or tilt the view while retaining the same mesh. |
| View zoom | Enlarges the shell at a fixed scale, so large edits can leave the frame. |
| Face colour | Choose solid directional shading, source-height bands, or colored triangular facets. |
| Outline weight | Sets form-edge weight in solid-lit mode or triangle-edge weight in bands and facets; zero hides edges. |
| Palette | Changes the shell colors without changing its vertices. |

The study's small source meshes live in `packages/javascript/examples/materials-b-studies.js`, and `loopSubdivideTriangles3D` refines the selected one. Supply a different valid manifold triangle mesh in code to explore another shell. The Studio document supplies the background; this layer only paints the mesh. Face and work budgets reject excessive refinement combinations.
