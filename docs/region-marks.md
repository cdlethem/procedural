# Divide a surface into smaller regions

RegionMarks divides a rectangle into a patchwork of smaller rectangles, then decorates
each with a dot or a small grid of marks. You can change the decoration without changing
the layout.

[Install the Java library](building-java-from-source.md), then open **RegionMarks** from
Processing’s contributed-library examples. Save a copy before editing.

## Controls

| Key | What changes on the canvas |
| --- | --- |
| **N** | Switch between 100 and 200 splits; more splits produce more, smaller regions. |
| **G** | Change which part of the evolving region list can be selected for another split; this changes the mix and placement of sizes. |
| **R** | Generate a different layout. |
| **M** | Switch each region between a central dot and a 3×3 group of marks. |
| **C** | Change the palette while keeping the regions. |
| **X** | Switch to an editable arrangement of eleven supplied rectangles. |
| **S** | Save the displayed picture as a PNG. |

## Make it your own

Each split replaces one rectangle with four smaller ones. Edit the starting rectangle,
split count and selection settings in `RegionComposition.java`. The drawing loop in
`RegionMarks.pde` receives each rectangle’s position and size: use those to place a pattern,
a symbol or another drawing inside it.

N, G and R affect the generated layout only. Restart to restore the starting settings.
More splits require more work and can create very small cells; they do not guarantee an
even grid. For cuts at positions you choose, see [CutMarks](cut-marks.md). For interchangeable
images and drawings inside regions, see [MaskedPartitionMarks](masked-partition-marks.md).
