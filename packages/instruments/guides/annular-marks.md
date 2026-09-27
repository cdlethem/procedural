# Annular marks — selected walls of a core solid

Show a graphic arc from a thick ring, or keep only wire edges and selected walls.

The released `annularSolid3D` produces the retained indexed annular mesh. The four face types and zero-based angular cell number are read from its own metadata; visibility switches filter its triangles **after** generation. Showing only some cells exposes an open graphic fragment, **not** a freshly capped cut solid. There is never a fabricated radial cut face.

| Controls | Canvas effect |
| --- | --- |
| Inner radius, Outer radius | Radii in canvas units: both positive (.001…1000) and Outer must strictly exceed Inner; the central opening stays open. |
| Solid depth | Positive bottom-to-top distance (.001…1000), independent of the two radial dimensions. |
| Angular slices | 3–192 integer angular cells, exactly eight triangles per cell and at most 1,536 faces, inside the 12,000-face instrument ceiling. |
| First visible cell, Visible cells | Zero-based start 0…slices−1, length 0…slices; selects successive core cells around the seam with wraparound. Invalid indices and fractional counts fail instead of clamping. Zero visible cells makes no marks. |
| Top annulus, Bottom annulus, Inner wall, Outer wall | Independently include triangles with the corresponding core face-kind metadata. All disabled yields no marks. Walls do not create cap faces at an incomplete angular wedge. |
| Offset X/Y, Yaw/Pitch/Roll | Canvas center −10,000…10,000 and mesh rotations about Y/X/Z in degrees −36,000…36,000. The starting camera never forces a fit; off-paper placements are valid. |
| Faces, Edges, Edge weight | Independent lit faces, unlit distinct indexed triangle edges, and stroke weight .01…30. Both off produces empty material. Wireframe includes triangulation diagonals. |
| Palette mapping and palette | Solid uses first swatch; Band indexes the core outer/inner/top/bottom face kinds; Angular indexes actual core angular cells; Noise samples local face-center 3D color coordinates. |
| Noise scale, Noise depth offset, seed | Only Noise mode uses these: scale .001…10,000 canvas units per noise coordinate; depth −10,000…10,000 offsets the noise Z sample, **not** ring thickness. Seed changes noise color only, not annular geometry or cell selection. |
| Ambient light, Directional light, Light azimuth/elevation | Face-light intensities 0…255, azimuth −36,000…36,000° and elevation −90…90°. Wire edges are unlit. |

Three contrasting recipes:

1. **Floating outer arc:** Outer radius 90, Inner radius 64, Solid depth 27, Angular slices 48, First visible cell 5, Visible cells 12, Top annulus off, Bottom annulus off, Inner wall off, Outer wall on, Faces off, Edges on, Offset X 170, Offset Y 440, Pitch 70°, Edge weight 1.4. The open ends are deliberate missing cells, not solid cut planes.
2. **Interrupted crown:** Outer radius 180, Inner radius 105, Solid depth 40, Slices 60, First visible cell 52, Visible cells 19, Top annulus on, Bottom annulus off, Inner wall off, Outer wall on, Faces on, Edges off, Palette mapping Angular, Pitch 45°. The angular interval wraps across cell zero.
3. **Recolored nested rim:** Outer radius 130, Inner radius 112, Solid depth 125, Slices 36, First visible cell 0, Visible cells 36, all four face types on, Palette mapping Noise, Noise scale 45, Noise depth offset 1.2, Faces on, Edges on. Reseeding alters colors without changing dimensions, indexed faces, or their normals.

No camera auto-fit, shadowing, backface-specific removal of hidden wire lines, or constructive solid geometry at a partial selection. Input errors include unequal/inverted radii, zero depth and cell count/index outside the actual slice count.
