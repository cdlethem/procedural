# Draw trails of letters and numbers

GlyphMarks repeats letters or digits along curved trails. Closely spaced symbols build
up a texture; wider spacing makes individual characters easier to see. The same trails can
also be drawn as dots.

[Install the Java library](building-java-from-source.md), then open **GlyphMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **N** | Show the first 80 positions of each trail instead of 160, shortening the visible trails. |
| **D** | Stamp at every fourth position instead of every position, spacing the symbols farther apart. |
| **G** | Switch digits to letters. |
| **M** | Replace characters with dots at the same positions. |
| **C** | Switch grayscale to color. |
| **V** | Switch the distance between movement steps between 0.75 and 2, changing the trails. |
| **F** | Change the field scale (0.006 to 0.03), so directions vary over a smaller area. |
| **R** | Choose new paths, starting positions, symbol sizes and symbols. |
| **0** | Return to the starting picture and settings. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Change the drawing block in `GlyphMarks.pde` to choose your symbols, opacity and colors.
`GlyphComposition.java` sets the paths and their starting positions. Changing the symbol
or spacing can reuse those paths; changing the movement produces different curves.

The example uses `data/GlyphMarks.ttf`. Keep that font file with the sketch. To use another
font, provide a TTF containing every character in your chosen symbol set. Different fonts
change the size and shape of the overlapping marks. The example reports a missing font
or character instead of substituting another font.

This places text as repeated marks; it does not lay out paragraphs or extract letter outlines.
