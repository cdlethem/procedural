# Split and remove regions by hand

CutMarks starts with a divided rectangle. Click a region to select it, cut it into two,
or remove it to leave an opening. Other regions stay where they are, letting you develop
a layout one edit at a time.

[Install the Java library](building-java-from-source.md), then open **CutMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **Mouse click** | Select a rectangle; a darker outline marks the selection. |
| **X** | Split the selected rectangle into left and right halves. |
| **Y** | Split it into top and bottom halves. |
| **Delete / Backspace** | Remove the selected rectangle, leaving a hole. |
| **A** | Switch the starting cut arrangement; this rebuilds the layout and replaces manual edits. |
| **D** | Switch solid fills to outlined regions with cross marks. |
| **H** | Switch the preset holes on or off; this also rebuilds the layout. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Use `RetainedRectangles2D` to start with a rectangle and cut a chosen live region at
a supplied coordinate. The example’s keyboard controls cut at the midpoint, but your
code can choose another interior position. A split replaces its rectangle with two
children; after splitting, the example selects the first child.

Replace the decoration loop to draw different content in each region. Region IDs let
you keep colors or other choices attached to regions that have not changed. If no region
is selected, split and remove controls do nothing. Extremely small regions may no longer
have room for a midpoint cut.

For automatic unequal panels, try [PanelMarks](techniques/panel-marks.md). For pictures
inside your regions, continue with [LayerMarks](layer-marks.md).
