# Interference lace

Two crossing wave families make ribbed ribbons, bead-like islands and cellular lace. Small differences in spacing create broad beats; bending the waves makes those beats gather and separate. The result is a patch of contour strokes with open space around and between them, ready to layer with another study.

Start with a small crossing angle and a frequency ratio near one. Move **Relative phase** slowly: the fine ribs slide while the broad pattern reorganizes. Increase **Crossing angle** toward ninety degrees to trade long ribbons for small cells. Raise **Crest cutoff** to split connected crests into scattered islands, or reduce it to recover their connecting necks.

## Construction controls

| Control | Canvas effect |
| --- | --- |
| Wave count | Sets the fine rib spacing across the source, independently of its canvas size. |
| Frequency ratio | Changes the spacing of the second family. Near-equal frequencies make broad beats; unequal frequencies create finer interleavings. |
| Crossing angle | Turns the second wave family relative to the first. |
| Relative phase | Slides the second wave family through the first without changing the seeded distortion. |
| Wave distortion | Bends the waves with a seeded continuous field. Zero returns clean analytical interference. |
| Distortion scale | Changes the size of the bends rather than the fine rib spacing. |
| Crest cutoff | Selects the part of the positive crests to draw. A high cutoff can leave only a few islands—or no marks. |
| Crest echoes / Echo spacing | Add contours at successively higher crest levels. These are scalar-field levels, not copied or offset outlines. |
| Source width / Source height | Shape the footprint. A narrow height produces a ribbon; two small dimensions produce a local accent. |
| Source X / Source Y | Place the source without changing its internal construction. |
| Line weight | Change ink thickness; zero produces no marks. |
| Seed | Changes the two initial wave phases and the field bending them. Palette and line weight never reroll the field. |

## Building a canvas

Use one or two crest echoes for a spare fragment beneath a branch or a loose gesture. Add another lace layer with a different crossing angle or phase rather than increasing every control in one layer. The source fades smoothly toward its edge: the outer boundary is not drawn, and there is no paper-colored panel hiding lower layers.

The source is an elliptical, softly weighted sum of two waves. Width and height intentionally reshape that source; Caller-owned rotation and scale move the complete result. Sampling adapts to the combined wave count, frequency ratio and distortion. An excessive combination is rejected with a request to reduce those controls, rather than silently changing the pattern.

## How it is made

An explicit wave expression and [gradient noise](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/gradient-noise-2d-01.json) supply scalar samples. [Marching squares](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/marching-squares-2d.json) extracts the selected crest levels. The source shown below is the actual editable library drawing code: replace the wave expression, keep the contour extraction, or draw the resulting segments with another mark.
