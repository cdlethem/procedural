# Pack elongated shapes without overlap

PolygonMarks fills the canvas with colored, rotated forms. Switch between rounded
convex shapes and diamonds, or make them thinner to leave a different pattern of gaps.

[Install the Java library](building-java-from-source.md), then open **PolygonMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **A** | Reduce thickness relative to length from 0.8 to 0.2, then find which thinner shapes fit. |
| **M** | Switch rounded forms to diamonds and recalculate which shapes fit. |
| **C** | Change colors without moving or replacing shapes. |
| **R** | Try new positions, lengths and angles. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

The sketch first proposes shapes, then `ConvexPolygonPlacements2D` keeps those that
fit without overlapping earlier accepted shapes. Edit the proposal construction for
your own outlines and the PDE’s drawing loop for their appearance.

Changing thickness or shape reuses the proposed positions and angles, but can change which
proposals fit. Proposal order matters: earlier shapes get first choice of space. Supply
strictly convex outlines, without dents or inward corners. Concave shapes need a different
approach. If adding thick outlines or decorative marks, leave enough room for that extra
paint beyond the shapes used for spacing.
