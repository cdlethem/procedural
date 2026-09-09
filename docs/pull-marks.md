# Fold grids and contours around chosen centers

PullMarks deforms a grid around circular areas of influence. Switch to closed contours
to see the same deformation applied to another kind of drawing. Lines may fold and cross
as they are pulled.

[Install the Java library](building-java-from-source.md), then open **PullMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **R** | Increase the influence radius from 120 to 180, affecting a larger area. |
| **P** | Switch power from 2 to 0.5, changing how the pull is distributed across each circle. |
| **C** | Change colors without changing the deformation. |
| **M** | Switch between the grid and closed contours. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit the influence centers in `rebuildFieldAndOutputs()`. Each influence has a radius
and power; `RadialPull2D` maps your supplied points to new positions. Draw those positions
as lines or attach your own marks to them.

Move the centers to relocate the folds. Change the radius to widen their reach, then
compare power settings on the same input drawing. More closely sampled lines follow
sharp changes more faithfully; a long segment can jump across a fold.

This effect does not keep shapes apart or guarantee a smooth, reversible deformation.
For a full luminous grid composition, see [Curvespace](curvespace-recreation.md).
