# Orbit Beads: Orbital Brush starting recipe

Arrange beads around editable closed orbits. Orbit Beads now opens the Orbital Brush instrument with nearly circular lobed paths: radii, path spacing, center offsets and orientation are independent, rather than forcing every drawing into the same nested rings.

| Controls | Canvas effect |
| --- | --- |
| Path shape; Horizontal/Vertical radius; Lobes; Wave depth | Construct elliptical or radially waved source paths. Zero depth gives ellipses. |
| Paths; Radius step | Repeat paths while growing or shrinking their radii. Negative steps require all resulting radii to remain nonnegative. |
| Center X/Y; Center step X/Y | Place the first orbit and separate later orbits. The family's 720-unit drawing frame scales to the 640-unit canvas; (360,360) is its center. |
| First angle; Angle step | Rotate the first orbit and successive paths independently. |
| Samples per path; Mark spacing | Retain equal-distance samples and select stations by traveled distance. Zero spacing marks every retained sample. |
| Marks; Mark size; Mark opacity | Use beads, connected ribbons or transverse dashes without changing the paths. |
| Path guides | Show the retained closed centerlines beneath the material. |

Try **three accents** with Paths 3, radii 35/22, center (150,470), center step X 90, radius step 0 and depth 0. Try **crossing ellipses** with Paths 6, radii 140/45, angle step 27 and radius step 0. Try **nested dashes** with Paths 8, radii 160/110, radius step -12, Marks dashes and mark spacing 16.

`resamplePolyline2D` retains the closed paths. Combined path/sample work is bounded; exact entry permits off-frame positions and scales beyond slider intervals. The revised source is deterministic and has no cosmetic seed button.
