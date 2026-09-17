# Embossed field

Turn a grayscale field into a raised-looking impression. Light and shadow inks follow the **signed response** of a directional 3×3 convolution. Choose the image beneath the effect, the direction that reveals its changes, and whether each response becomes a tile or a dot.

| Control | Canvas effect |
| --- | --- |
| Pixel size | Sets the source sampling density and the size of printed marks. Smaller values reveal finer relief; larger values produce coarse blocks. The slider covers 6–48, while the study accepts 4–120. |
| Source field | **Waves** gives broad ripples, **mounds** gives two hills and a ridge, and **cutout** gives a disk, arch and sloped band. This changes the image supplied to convolution. |
| Response axis | Vertical, horizontal or diagonal selects which direction of change makes positive and negative relief. |
| Relief strength | Controls ink opacity from no relief at zero to stronger light and shadow. It does not change the source or convolution result. |
| Mark treatment | Full tiles make continuous printed regions; dots expose the sampled structure and vary in diameter with response strength. |
| Seed | Moves the waves or shifts the authored shapes while keeping other controls fixed. |
| Palette | Slots 1 and 2 color negative and positive responses; changing them does not change the source values or mark positions. |

The area outside response marks stays transparent so the Studio document background and other layers remain visible. For a different image, replace the row-major scalar values made by `reliefSource` in `packages/javascript/examples/materials-a-studies.js`; the same `convolve2DSigned` call then processes those values. This is a study composition using the reusable [signed convolution operation](/techniques/convolve-2d-signed).
