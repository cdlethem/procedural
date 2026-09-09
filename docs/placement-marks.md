# Scatter shapes with room between them

PlacementMarks fills the canvas with differently sized rings. It finds places for them,
then lets you change their colors or replace them with diamonds without moving them.

[Install the Java library](building-java-from-source.md), then open **PlacementMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **R** | Try a new random arrangement. |
| **N** | Try 10,000 placements instead of 5,000, giving more shapes a chance to fill gaps. |
| **G** | Increase spacing between shapes; switch between touching-distance and extra clearance. |
| **I** | Raise the smallest proposed radius from 4 to 8 pixels. |
| **O** | Lower the largest proposed radius from 64 to 32 pixels. |
| **M** | Replace rings with diamonds at the same positions. |
| **C** | Change the palette; keep the arrangement. |
| **X** | Switch between random placements and a supplied arrangement in radial bands. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Start with shape size and spacing, then choose the drawing treatment. `PlacementComposition.java`
sets the possible positions and radii. `PlacementMarks.pde` draws the rings or diamonds;
replace that drawing code to use the same places for your own forms.

| Setting | How it affects the arrangement |
| --- | --- |
| Radius interval | Sets the smallest and largest shapes to try. |
| Placement attempts | Gives the sketch more chances to find space; it is not a requested number of visible shapes. |
| Separation scale | At 1, circles may touch. Above 1, they have extra space proportional to their sizes. Below 1, they may overlap. |
| Center rectangle | Chooses where shape centers may fall; large shapes can extend outside it. |
| Seed | Makes the random arrangement repeatable. |

R, N, I and O affect the random arrangement only. Edit `PlacementComposition.radial` for
the supplied bands. Restart the sketch to restore the starting settings. Keep your marks
within the circles used for spacing if you want the painted forms to stay apart.
