# Grow trees and branching sprays

BranchMarks starts with a trunk and grows smaller branches from its endpoints. Change
the branching angles and depth to make a broader tree, a narrow spray or a group of trees.
Colors and line treatment can change without regrowing the branches.

[Install the Java library](building-java-from-source.md), then open **BranchMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **N** | Add or remove a generation of branches. |
| **G** | Make the spread narrow in later generations, or keep it constant. |
| **W** | Use wider branching angles. |
| **B** | Switch between three possible children and two narrow side branches. |
| **R** | Grow a different random tree. |
| **X** | Switch from one tree to a group of trees. |
| **C** | Change colors along the generations. |
| **M** | Switch thin lines to tapered widths with dots at branch tips. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Edit `BranchComposition.rules` to shape the growth. A starting branch has a position,
direction and length. Each generation describes how short its children become and where
they may turn. An upward direction in Processing is `-PI/2`.

| Rule | Visible effect |
| --- | --- |
| Child length scale | How quickly branches become shorter. |
| Turn interval | How far children spread from their parent’s direction. |
| Child probability | How often a possible branch actually appears. |
| Number of generations | How many levels of smaller branches can develop. |

`BranchMarks.pde` draws the resulting segments. Change its stroke widths, colors and tip
marks for a different treatment. Adding generations can increase the amount of geometry
quickly. For branches made by cutting into existing strokes, try [CutBranchMarks](cut-branch-marks.md).
