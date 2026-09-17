# Embossed field

Serve this directory so `/p5.js` is available and open `index.html`.

| Control | Effect |
| --- | --- |
| Source field | Changes the scalar image: waves, mounds, or cutout. |
| Response axis | Reveals vertical, horizontal, or diagonal changes in that image. |
| Mark treatment | Prints full tiles or response-sized dots. |
| Pixel size | Changes sampling density and mark size from 4 to 120 pixels. |
| Relief strength | Changes light and shadow opacity from 0 to 20. |
| Seed | Moves the source pattern while keeping other choices fixed. |
| Palette | Recolors the positive and negative response inks. |
| Reset | Restores the baseline controls and image. |
| Save PNG | Downloads the marks on a transparent canvas. |

The scalar image is processed through [`convolve-2d-signed`](../../../catalog/operations/convolve-2d-signed.json). Edit `../materials-a-studies.js` to supply another row-major scalar image or change how response marks are drawn.
The page shows paper behind the canvas for preview; the exported PNG retains transparent space around the marks.
