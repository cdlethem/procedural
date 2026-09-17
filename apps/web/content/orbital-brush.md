# Orbital brush

Shape a family of closed paths, then draw equal-distance samples as beads, connected ribbons or short perpendicular dashes. A few broad loops can cross; small radius steps and many paths can build a dense nested field. The paths remain the same when you change their marks or palette.

| Control | Canvas effect |
| --- | --- |
| Path shape | Makes ellipses or adds radial waves to each ellipse. |
| Center X / Center Y | Moves the first path's centre across the canvas. |
| Center step X / Center step Y | Offsets each later path from the previous one, creating separated or crossing families. |
| Horizontal radius / Vertical radius | Sets the first path's width and height independently. |
| Paths | Adds or removes closed trajectories in the family. |
| Radius step | Grows or shrinks both radii for each later path; negative values nest inward while radii remain nonnegative. |
| First angle / Angle step | Rotates the first path and each later path independently, changing how elongated loops intersect. |
| Lobes / Wave depth | Sets the count and signed strength of radial waves when Path shape is wave; zero depth gives a smooth ellipse. |
| Samples per path | Sets how many equal-distance points describe each closed path. More samples resolve tight turns and place marks more precisely. |
| Marks | Draws the retained samples as ribbons, beads or dashes perpendicular to the path. |
| Mark size | Sets ribbon width, bead diameter or dash length. |
| Mark spacing | Sets travel distance between beads or dashes. Zero uses every sampled point. |
| Mark opacity | Fades or strengthens the foreground marks. |
| Path guides | Shows the current sampled centreline beneath the selected marks. |
| Palette | Recolors marks and guides while retaining all path positions. |

The source path is sampled by traveled distance with `resamplePolyline2D`; changing the palette or mark treatment leaves that sampled record intact. Center positions and path sizes can extend outside the slider's convenient span through exact entry. A combined path and sample budget keeps large settings responsive.
