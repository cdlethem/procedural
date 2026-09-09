# Make a field of marks

FieldMarks covers the canvas with small strokes whose direction, length and color vary
across the picture. It is a useful first sketch for exploring how a simple mark becomes
a larger texture.

[Build and install the Java library](building-java-from-source.md), then open
**File → Examples → Contributed Libraries → Procedurals → FieldMarks** in Processing 4.
Save a copy into your own sketch folder before editing.

## Try these changes

Edit the constants at the top of the first tab, then run the sketch again.

| Setting | Try | What changes on the canvas |
| --- | --- | --- |
| `MAX_LENGTH` | Change `16` to `32`. | Strokes become longer, with the same centers, directions and color pattern. |
| `COLORS` | Use the alternate palette shown in the comment. | The picture changes color without moving or resizing marks. |
| `DRAW_BARS` | Change `false` to `true`. | Thin strokes become heavier bars in the same places. |
| `SEED` | Choose another integer. | The direction, length and color patterns change; the grid stays in place. |

| Key | What happens |
| --- | --- |
| **S** | Save the displayed picture as a PNG in the sketch folder. |

Keep the seed fixed while comparing length, color and mark choices. The example settings
are starting points to explore, not limits on what looks good. You can
[compare saved variations side by side](comparing-variants.md).

## Draw your own mark

Open `MarkCommands.java` and find `mark()`. This is the small piece of drawing code to
replace with your own shape. Each mark already has a position, direction and length;
you can use those values to draw a dash, a bar or something more elaborate.

`MarkField.java` chooses the values across the grid. Change its field scale to alter how
quickly neighboring marks vary. Keep the computed values when you want to redraw the same
arrangement with another palette or mark.

To start from an empty sketch, use the [Java API guide](java-api.md). To connect movement
into flowing lines, continue with [PathMarks](path-marks.md). For other ideas, browse
[the example guide](choosing-java-workflow.md).

## Other versions

[The p5.js example](../packages/javascript/examples/field-marks/README.md) runs in a browser
with length, palette and mark controls. Its **Save PNG** button downloads the current image.
The [py5 example](../packages/python/examples/field_marks/README.md) and
[Android example](../packages/java-android/examples/FieldMarks/README.md) have their own
setup instructions and controls.
