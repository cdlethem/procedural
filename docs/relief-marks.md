# Build a faceted relief

ReliefMarks creates a tilted, lit surface of triangular wedges and thin spikes. Uneven
subdivision produces clusters of different sizes, while height and lighting bring out
the relief. This example uses Processing’s P3D renderer.

[Install the Java library](building-java-from-source.md), then open **ReliefMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Cycle four surface colors; keep the shapes and spike positions. |
| **H** | Switch relief height from 4 to 12 for a more pronounced surface. |
| **R** | Create a new arrangement of cells, faces and spikes. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit `ReliefComposition.java` to change the subdivision and where spikes are placed.
The centers of the cells become points for the triangulated surface; cell size also
influences the spikes. `ReliefMarks.pde` draws the raised faces and sets the lights and view.

Try the height control before changing the layout so you can see its effect on the same
surface. Change camera angles and lighting in the PDE to explore how the planes overlap
and catch light. The drawing builds these particular wedges and spikes; it is not a
general tool for extruding arbitrary shapes.
