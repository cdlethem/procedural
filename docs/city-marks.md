# Build a faceted city

CityMarks draws a dense cluster of triangular buildings with rows of small windows.
Colored walls and lit windows give the city depth. The example uses Processing’s P3D
renderer and can take a moment to draw its many windows.

[Install the Java library](building-java-from-source.md), then open **CityMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Shift building colors while keeping the city layout. |
| **H** | Lower the height ceiling from 200 to 80, or restore the taller skyline. |
| **R** | Generate a different city layout and window pattern. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

`CityComposition.java` chooses the building sites, heights and window patterns.
`CityMarks.pde` draws a roof and three walls for each triangular building, then places
windows along the walls.

| Setting to edit | What changes |
| --- | --- |
| Site arrangement | The footprint and mix of building shapes. |
| Building heights | The skyline and how much of each wall is visible. |
| Window rows and columns | The scale and density of the facade pattern. |
| Window width and height | The gaps between windows. |
| Palette and lighting | The colors of walls and their shading. |

Color and height controls keep the underlying layout and window choices. Reduce window
rows and columns while experimenting if drawing feels slow, then increase detail for
your final image.
