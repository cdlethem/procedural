# Divide a rectangle into unequal panels

[Open the example](../../packages/java-processing/examples/PanelMarks/PanelMarks.pde) in Processing. It divides a rectangle into unequal panels, then colours or decorates them.

| Key / setting | Visible change |
| --- | --- |
| A | Try 80, 240 or 20 cuts; more successful cuts produce more, smaller panels. |
| P | Choose cuts along the longer dimension or choose their direction randomly. |
| C | Changes colours. |
| M | Switch between outlined panels and solid colored panels, keeping the layout. |
| 0 | Restores the starting layout. |
| S | Saves `panel-marks.png`. |

Edit the attempts, seed, cell size, margin, palette, or decoration in the sketch. More attempts do not guarantee more panels because a proposed cut can fail.

## Make it your own

[Install the Java library](../building-java-from-source.md) and save your own copy of
PanelMarks. Edit the starting rectangle and cut settings in the sketch to change the
layout. `BinaryCellPartition2D` returns panel bounds; draw inside each rectangle using
those dimensions, or use them to place your own pictures and marks.

The panels are built on an integer grid. Cell size controls their scale on the canvas;
margin controls the space left around the whole layout. Cut attempts control how many
chances the layout has to become finer, rather than promising an exact panel count.
For selecting and cutting individual regions yourself, use [CutMarks](../cut-marks.md).
