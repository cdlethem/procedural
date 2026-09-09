# Compose a banded night landscape

LandscapeMarks combines a wavy horizon, colored horizontal bands and circles that grow
larger toward the foreground. Soft shadows, halos and a fine triangle network add layers
to the scene. It uses Processing’s P2D renderer.

[Install the Java library](building-java-from-source.md), then open **LandscapeMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Shift the palette while keeping the arrangement. |
| **P** | Switch between uneven and evenly spaced horizontal bands. |
| **R** | Generate a new scene. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit `LandscapeComposition.java` to change the circle placement, sizes and horizon field.
Edit `LandscapeMarks.pde` for the band drawing, shadows, halos and fine network.

| Setting to edit | What changes |
| --- | --- |
| Horizon field | The rise and fall of the landscape edge. |
| Circle size by depth | How much larger circles appear toward the foreground. |
| Band spacing | Where horizontal stripes gather or spread apart. |
| Palette | The colors running through the sky and ground. |
| Shadow and halo treatment | The soft layers around the circles. |

Palette and band-spacing edits preserve the circle positions and connecting network, making
it easier to compare treatments on the same scene. Keep the seed fixed when you want to
return to an arrangement.
