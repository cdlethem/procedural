# Pinned waves

Shape wave contours around cells that must remain still. The starting composition has one positive disturbance and a pinned perimeter; you can move the constraint inside the field, replace it with a disc or line, or remove it while keeping the same source pulse.

The wave advances on a fixed 26 × 26 grid. Pinned cells hold exact zero displacement and velocity at every step. Colored interior rows trace the resulting displacement, while optional small dots reveal the pin mask. The source, constraints, evolution and drawing can be edited independently.

| Control | Canvas effect |
| --- | --- |
| Impulses | Uses one, two or three independently placed starting disturbances. |
| Impulse X/Y | Moves each disturbance; exact positions outside the frame are allowed for cropped waves. |
| Impulse spread | Controls how broadly that disturbance begins. |
| Impulse amplitude | Sets positive or negative initial height; zero intentionally disables a site. |
| Pin geometry | Chooses a still perimeter, vertical or horizontal line, circular region, or no pins. |
| Pin X/Y | Moves line or disc constraints in normalized frame coordinates. |
| Pin radius | Sets the circular constraint's radius in grid cells. |
| Show pins | Reveals the pinned cells as small dots; hiding them leaves the same simulation. |
| Passes | Advances from the same source and pin mask. Zero shows the initial constrained field. |
| Cell spacing | Changes contour spacing on the canvas without changing the grid or simulation. Large values intentionally crop. |
| Line weight | Changes contour thickness only. |

To isolate a constraint, keep the impulse settings fixed and compare perimeter, vertical and disc pins at the same pass count. Set the amplitude to zero to inspect the pin drawing alone. This layer paints no palette-colored paper behind its marks.
