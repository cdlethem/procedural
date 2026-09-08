# PanelMarks: decorate an unequal cell partition

PanelMarks is a Processing Java example built around `BinaryCellPartition2D`. It starts
with one 60-by-60 integer-cell region and makes unequal rectangular panels by attempting
80 binary cuts. Each retained panel can then be filled, outlined, or decorated
independently. The example is included in the Java0.20 source distribution.

The example controls are:

| Key | Edit |
| --- | --- |
| A | Cycle attempted cuts through 80, 240, and 20, then rebuild the layout. |
| P | Switch between `LONGEST` and `RANDOM` axis selection, then rebuild. |
| C | Change the palette while retaining the existing layout. |
| M | Change panel decoration while retaining the existing layout. |
| 0 | Restore 80 attempts, `LONGEST`, the first palette, and outline decoration. |
| S | Save the cached displayed frame to `panel-marks.png`. |

The layout result is ordered and retained. `attempts` counts replacement attempts, not the
number of leaves; a failed attempt can leave the leaf count unchanged. `LONGEST` chooses
the longer cell dimension and uses the height on ties. `RANDOM` gives the width and height equal chances. The operation owns integer-cell partitioning; mapping cells to pixels
is ordinary sketch arithmetic. PanelMarks maps `[left, top, right, bottom]` with a 10-pixel
cell scale and a 20-pixel drawing margin.

```java
BinaryCellPartition2D layout = BinaryCellPartition2D.generate(
    42L, 60, 60, 80, "LONGEST");
int[] bounds = new int[4];
for (long index = 0; index < layout.size(); index++) {
    layout.boundsInto(index, bounds);
    float x = 20 + bounds[0] * 10;
    float y = 20 + bounds[1] * 10;
    float width = (bounds[2] - bounds[0]) * 10;
    float height = (bounds[3] - bounds[1]) * 10;
    rect(x, y, width, height);
}
```

`C` and `M` demonstrate the ownership boundary: they reuse the retained layout and do
not regenerate geometry. When `A` or `P` rebuilds geometry, the palette is selected by
the final panel index, so colors may change even when the palette itself does not. `0`
recreates the baseline layout and drawing state; `S` saves the frame already displayed by
the sketch rather than rendering a second frame.

The exact generation, random-consumption, integer arithmetic, output ownership, and error
rules are in the [binary cell partition contract](../../design/operations/binary-cell-partition-contract.md).
The example is independently composed from the panel idioms in `poop` and `barab`; it
does not replay their source RNG or claim pixel reproduction. The values 20, 80, 240,
60, and the drawing scale are example settings, not recommended parameter ranges.
