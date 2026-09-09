# Grow fine branches from a stroke

CutBranchMarks repeatedly cuts and branches an initial line, building a fine, tree-like
drawing. The starting stroke sets the overall direction; branch angles and the amount of
growth change its character.

[Install the Java library](building-java-from-source.md), then open **CutBranchMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **C** | Cycle the drawing color without changing branches. |
| **A** | Switch to narrower branch angles, or restore the wider spread. |
| **W** | Switch between 9,000 and 90,000 cutting attempts for sparse or denser growth. |
| **T** | Replace the vertical starting stroke with a diagonal stroke. |
| **R** | Grow a different drawing from the current settings. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Change the starting endpoints in `CutBranchComposition.java` to aim and place the growth.
Use `LinePool2D` to perform the cuts, then draw its returned segments with your preferred
colors and stroke widths in `CutBranchMarks.pde`.

| Setting | Visible effect |
| --- | --- |
| Starting segment | Places and aims the initial growth. |
| Cutting attempts | Gives the drawing more opportunities to develop fine branches. |
| First-cut angle scale | Controls the spread of new branches. |
| Minimum cut length | Stops very short segments from being cut again. |

An attempt may leave the drawing unchanged, so the attempt count is not a branch count.
For a tree described by explicit generations of children, use [BranchMarks](branch-marks.md).
