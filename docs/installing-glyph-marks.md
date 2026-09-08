# Install GlyphMarks on Processing Java

For the local Java 0.8.0 archive at
`.work/dist/cp8/java/procedurals-processing-0.8.0.zip`, extract its `procedurals`
folder into your Processing sketchbook's `libraries` folder. Restart Processing,
then open `GlyphMarks` from the library examples. This is a local package, not a
registry publication.

The archive contains eight editable starters and eleven reusable operations.
GlyphMarks adds a workflow using the existing path and palette operations; it
does not add a font or text-layout operation to the core.

Keep all three tabs together: `GlyphMarks.pde` draws the piece,
`GlyphComposition.java` creates its retained paths and mark attributes, and
`GlyphFont.java` loads the explicit font file. Keep the `data` folder too: it
contains the unchanged DejaVu Sans TTF and its license notice. No system font
installation is required. The example requires Processing desktop JAVA2D.

Try **D** to make the stamps sparser, **G** to use letters, and **M** to reveal the
same paths with small dots. **V** changes integration distance and **F** changes
field scale, both rebuilding the paths. **0** resets and **S** saves the displayed
image to the sketch folder. The [workflow guide](glyph-marks.md) explains all
controls and the drawing block to replace with your own marks.

The staged sketch passed official Processing 4.5.6 compilation, native font
preflight, 17 actual edit/reset states and a save-image comparison. Its nine
distinct images were directly reviewed. These checks establish this Java
workflow's scope; they do not establish human usability testing, other font
behavior, cross-platform text equivalence, or source-pixel reproduction.
