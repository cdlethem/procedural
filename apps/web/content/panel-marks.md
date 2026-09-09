# Divide a grid into panels

PanelMarks cuts an integer cell grid into ordered rectangular panels. Draw nested inset
outlines inside each panel or switch to solid tinted regions. Change the layout by choosing
how many cuts to attempt and how to select the cutting axis.

## Controls

| Control | What changes on the canvas |
| --- | --- |
| Attempts | Choose 80, 240 or 20 cutting attempts. |
| Axis policy | Cut along the longest side or choose the axis randomly. |
| Palette | Recolor the same panels. |
| Decoration | Switch nested outlines to solid panels. |

## Make it your own

The existing example supplies a 60 × 60 grid to `layout.binary-cell-partition-2d`.
The result gives ordered panels that can hold your own drawings. Grid size, attempt count,
colors and decoration are choices for this example, not operation defaults or recommended
ranges. See the example source for its complete cutting configuration.
