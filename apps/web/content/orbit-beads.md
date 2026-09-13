# Orbit beads

Arrange beads around nested, softly lobed loops. Every loop is sampled by traveled distance, creating a radial drawing whose mark spacing follows the path instead of equal angle steps.

Increase **Lobe depth** to turn circular orbits into more expressive outlines. **Beads per orbit** controls density independently; inner loops carry the same number of beads in a smaller space.

| Control | Canvas effect |
|---|---|
| Orbits | Adds nested paths between the center and outer ring. |
| Beads per orbit | Changes the number of equally paced marks on every closed path. |
| Lobes | Adds broad radial waves around the outlines. |
| Lobe depth | Strengthens the radial waves; zero makes circles. |
| Bead size | Enlarges each mark without moving its center. |
| Orbit lines | Shows the original closed paths beneath the beads. |
| Seed | Rotates the lobe phase. |
| Palette | Colors successive orbits. |

[Polyline resampling](../catalog/operations/resample-polyline-2d.json) handles each closed outline without appending an extra closing sample. The visible orbit is a supplied polyline approximation of the radial drawing; replace its vertices to explore angular rings or irregular closed shapes.
