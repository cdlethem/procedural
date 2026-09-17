# Signed edge print

Turn a grayscale field into a two-ink edge print. A directional signed convolution distinguishes the two sides of each change. Adjust the cutoff to keep subtle changes or isolate the sharpest borders.

| Control | Canvas effect |
| --- | --- |
| Pixel size | Changes source sampling and printed mark size. Smaller values retain finer outlines; larger values form coarse, broken edges. The slider covers 6–48, while the study accepts 4–120. |
| Source field | **Waves** gives repeated flowing edges, **mounds** gives soft contours, and **cutout** gives defined disk, arch and band edges. |
| Response axis | Vertical, horizontal or diagonal changes which directional edges are emphasized. |
| Edge cutoff | A lower value keeps faint edges; a higher value leaves only strong signed responses. The value is in convolution response units, with zero including every nonzero response. |
| Mark treatment | Tiles make solid patches along edges; bars break them into short printed strokes. |
| Seed | Moves the waves or shifts the authored shapes while keeping other controls fixed. |
| Palette | Slots 1 and 3 color the two response signs. Recoloring does not change edge membership or mark positions. |

The empty areas remain transparent over the Studio document background. For a different image, replace the row-major scalar values made by `reliefSource` in `packages/javascript/examples/materials-a-studies.js`; the same `convolve2DSigned` call then extracts its signed changes. This study uses the reusable [signed convolution operation](/techniques/convolve-2d-signed).
