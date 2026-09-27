# Depth marks — Revolved Profiles, noise-color preset

Make faceted, tapered forms with colored patches that can change without deforming the mesh.

Depth marks is the **same Revolved Profiles instrument** as Profile marks: both pass the editable multiline axial profile through retained core `RadialProfile3D`. This preset starts with a tapered tip and **Noise palette mapping**, not a distinct deformation or a simulated depth field. **Noise depth offset** is a coordinate of the 3D color noise, never an extrusion or geometric depth.

| Controls | Canvas effect |
| --- | --- |
| Axial profile | Enter 2–48 `position, radius multiplier` pairs, one per line, with strictly increasing positions −8…8 and radii 0…8 (interior radii strictly positive; two zero endpoints cannot be the only two knots). Out-of-0…1 positions are valid dimensionless positions, not silently reordered. |
| Axial scale and Radial scale | Multiply axial position minus .5 and radius multiplier independently by positive canvas-unit scales (.001…1000). The visible starting profile is not an immutable cone. |
| Angular slices, Start cap, End cap | 3–192 integer cells; two independent cap switches close only nonzero-radius end rings. At most 12,000 actual triangles, accounting for knot bands, pole reductions and enabled caps. |
| Offset X/Y; Yaw, Pitch, Roll | Canvas placement (−10,000…10,000) and Z-axis mesh orientation via rotations about Y/X/Z (degrees −36,000…36,000); off-paper fragments are legal. No auto-fit. |
| Faces, Edges, Edge weight | Independent lit triangle faces and unlit wire edges; line weight .01…30. No forced outline or background; both off is empty. Indexed triangle diagonals are visible when edges are on. |
| Palette mapping and palette | Solid picks first swatch; Band reads actual radial-band/cap metadata; Angular reads core cell metadata; Noise chooses swatches from 3D samples at face centers. Changing swatches never rebuilds or perturbs the mesh. |
| Noise scale, Noise depth offset and seed | Relevant **only** in Noise mode. Scale .001…10,000 controls spatial color variation, additive noise depth −10,000…10,000 moves through color volume, and seed chooses that color field. Non-noise mapping has no purposeful seed. |
| Ambient/Directional light, Light azimuth/elevation | Independent face-light levels 0…255 and directional heading/inclination (elevation −90…90°); edges remain unlit. |

Three contrasting parameter recipes:

1. **Quiet tapered fragments:** start from this preset, set Palette mapping Band, Faces off, Edges on, Angular slices 18, Start cap off, Offset X 485, Offset Y 360, Pitch 88°, Edge weight 1.3. Reseeding now does nothing; knot edits still change the core geometry.
2. **Shifting chroma:** keep the tapered default profile, set Noise scale 35, Noise depth offset −2, Faces on, Edges off, Radial scale 125, Ambient light 160, Light azimuth 80°. Reseed to change only face colors, and scan depth offset to view other color slices of the same shape.
3. **Broad flared cone:** Axial profile `−0.2, 0.12` / `0.2, 0.36` / `0.6, 0.65` / `1.2, 1.25` (one pair per line), Axial scale 180, Radial scale 115, End cap on, Start cap off, Palette mapping Angular, Angular slices 24, Offset X 240, Offset Y 400, Roll 30°. This shape genuinely differs from the default source.

This is a flat-shaded triangular surface, not a filled volume or a height map. Valid profile values outside normalized 0…1 can carry the result off canvas; no hidden camera correction occurs.
