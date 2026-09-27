# Rounded polyhedra

Refine a coarse 3D source mesh into a softer polyhedral form. Choose a closed tetrahedron or octahedron, or an open patch; stretch the source and lift one vertex before Loop subdivision. The camera stays fixed as the source changes, so proportions remain visible.

| Control | Canvas effect |
| --- | --- |
| Base mesh | Starts from a tetrahedron, octahedron, or open four-corner patch. The patch stays an open surface. |
| X scale / Y scale / Z scale | Stretch, flatten, or mirror each source axis before refinement. |
| Corner lift | Moves one source vertex along the vertical axis before it is subdivided. |
| Refinement | Adds Loop subdivision passes, increasing face density and softening the source form. |
| Camera yaw / Camera pitch | Reveal other sides without altering source vertices. |
| View zoom | Changes the fixed projection scale rather than fitting each revised mesh into the canvas. |
| Face colour | Use direction-based solid shading, bands by source height, or colored triangular facets. |
| Outline weight | Sets visible form edges in solid-lit mode or triangle edges in other modes. Zero hides them. |
| Palette | Recolors the same refined mesh. |

The source vertices and triangle connections are selected in `packages/javascript/examples/materials-b-studies.js` and passed to `loopSubdivideTriangles3D`. In code, substitute another valid manifold triangle mesh to refine a different form. The layer is transparent outside the mesh. Refinement is bounded by a face and work budget rather than silently reduced.
