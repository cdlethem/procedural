# Woven Strands

Two families of ink paths share **one lattice of junctions**. Each row and column goes through the very same seeded node, rather than approximately crossing two separately perturbed grids. At a crossing, the lower path is divided into retained pieces with a real empty interval. No background-colored eraser, white patch or pane is painted, so marks in older layers remain visible through the opening. These are flat graphic strands, not a model of fiber contact, tension or textile manufacture.

## Control map

| Controls | Canvas effect |
| --- | --- |
| Horizontal / Vertical strands, Cell spacing / aspect | Set row and column path counts and the horizontal and vertical pitch of their shared junction lattice. |
| Lattice skew, Broad warp / Warp scale, Junction disorder | Lean the lattice or seed smooth and local displacement of the same shared junctions. |
| Source width / height, Source X/Y | Crop to a transparent rectangular footprint and position both it and the lattice on the canvas. |
| Over/under sequence, Pattern repeat, Sequence phase, Binary repeat | Choose which strand passes over at each junction and shift the crossing pattern without moving nodes. |
| Crossing clearance, Row / Column ink width | Open a real gap in the lower stroke and size each family's ink; width zero leaves that family unpainted. |
| Row / Column palette slot | Choose each family's ink color from the current palette. |

## Build the source

**Horizontal strands**, **Vertical strands**, **Cell spacing** and **Cell aspect** set the original grid. One row and many columns make an unbroken sparse line strip (vertical crossing strands require at least two rows); keep at least two rows and columns for actual woven crossings. **Lattice skew** leans columns while preserving shared junctions. **Broad warp** moves common nodes through a seeded low-frequency field; **Warp scale** changes the wavelength. **Junction disorder** adds a smaller independent seeded nudge to each common node. Zero warp and disorder give a regular grid. The allowed displacements (at most 0.06 plus 0.04 of the smaller cell pitch per coordinate) and limited skew/aspect keep adjacent cells from folding. Seed changes the lattice; palette, widths, clearance and crossing order do not.

**Source width/height** crop that lattice into a local rectangular footprint; **Source X/Y** move both the grid and that footprint in canvas coordinates. A narrow footprint creates a strip; a small one can select only a few cells; a larger one makes a field. The crop has no drawn outline and leaves the rest of the layer transparent. If the footprint misses all the paths, it produces no marks.

## Arrange the crossings

**Over/under sequence** offers seeded, checker, twill and binary. The default **seeded** mode builds a square tile of crossing decisions; **Pattern repeat** sets its side length and Seed replaces its over/under structure, independently of the small lattice perturbations. Checker alternates every junction. Twill advances a diagonal over a cycle of Pattern repeat. **Sequence phase** shifts the ordering without moving the lattice. In binary mode, **Binary repeat** accepts only 1–32 characters of `0` and `1`: `0` puts the row above, `1` puts the column above. The string repeats across columns and advances one character per row. Try `0001` for a mostly horizontal face or `0111` for its inverse.

**Crossing clearance** adds an explicit open interval beyond the intersecting stroke widths. A shallow crossing angle needs a longer gap; the actual angle between the two local path tangents is used. Round end caps on lower fragments are included in the gap length. Hiding the upper strand with zero width leaves the other path intact.

**Row ink width** and **Column ink width** independently set strokes, including zero for no ink. **Row palette slot** and **Column palette slot** select zero-based colors from the current palette, wrapping when the slot exceeds palette length. Ink widths change the crossing openings but not any lattice node. Draw a mostly open mesh with counts 12×12, spacing 35, aspect 1.3, width 450, height 430, row width 3, column width 2, clearance 3. For a dense biased twill use counts 23×23, spacing 22, aspect .85, skew .3, broad warp .04, sequence twill, repeat 5, row width 9, column width 5. For an isolated interrupted ribbon use rows 3, columns 9, spacing 32, a 320×45 crop centered on the middle row, checker, widths 7/4; enlarge source height to reveal more of the vertical strands.

Exact entry permits 1–64 paths per family but no more than 1600 shared nodes in total; it never silently thins rows or columns. Crop dimensions range 1–1600 pixels and spacing 3–200 pixels. Strand lines are composed from the common junctions and the retained path intervals, then [clipped to the source footprint](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/clip-segments-simple-polygon-2d.json). Crop edges can trim visible stroke ends; they do not mask other layers.
