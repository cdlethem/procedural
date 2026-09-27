# Signed edge print

Extract two-ink edge marks from seeded, editable grayscale source geometry. The existing directional signed 3×3 convolution distinguishes opposite sides of each source change; an edge cutoff decides which responses survive. Make one isolated contour, a cluster of overlapping rims, or a broken distributed field.

| Control | Canvas effect |
| --- | --- |
| Pixel size | Sets source sampling density and printed mark size, not feature positions or radii. Slider 6–48; exact values 4–120. |
| Source field | **Cutout** makes sharp oval boundaries; **mounds** make softer contours; **waves** make local striped edges inside a soft, explicitly bounded envelope. |
| Features | Number of seeded source elements. One can give a lone mark; several can overlap or spread across the canvas. Slider 1–24; exact values 1–64. |
| Feature radius | Typical radius as a fraction of the 600-unit drawing area. Slider .03–.36; exact values .01–1.5. |
| Spread | Extent of feature centers about the selected center; zero stacks centers, 1 spans the drawing area, and exact values can reach 2. |
| Center X / Center Y | Moves the source region in canvas fractions, including off-canvas crops with exact values −1–2. |
| Aspect ratio | Elongates features without substantially changing their area. Slider .35–3.5; exact values .1–10. |
| Orientation | Rotates the source axes in degrees with small seeded variation between elements; exact values extend to ±3600. |
| Source contrast | Scales source heights before convolution. At zero, no edge remains; stronger contrast can bring fainter slopes past the cutoff. Slider 0–3; exact values 0–10. |
| Response axis | Vertical, horizontal, or diagonal chooses the edge direction emphasized by convolution. |
| Edge cutoff | Retains only responses exceeding this magnitude in convolution units. Zero keeps every *nonzero* response; higher values isolate sharper boundaries. |
| Mark treatment | **Tiles** print full edge cells; **bars** break them into short horizontal ink strokes. |
| Seed | Regenerates feature placement, individual sizes, angular variations, and wave phases. |
| Palette | Slots 1 and 3 color opposite response signs without changing source structure. |

For a compact supporting layer, try one small cutout with low spread and move Center X/Y to the desired accent. For a sparse edge texture, increase Features and Spread while decreasing Feature radius; for interlocking printed bands, use elongated waves. Blank source pixels and their neighboring empty cells have zero response, including at the image boundary, so unused space stays unpainted above other layers. The source is composed in this instrument and passed to the reusable [signed convolution operation](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/convolve-2d-signed.json). Older saved compositions retain their earlier source construction.
