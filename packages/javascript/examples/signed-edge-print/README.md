# Signed edge print

Serve this directory so `/p5.js` is available and open `index.html`.

| Control | Effect |
| --- | --- |
| Source field | Changes the scalar image: waves, mounds, or cutout. |
| Response axis | Selects vertical, horizontal, or diagonal edges. |
| Mark treatment | Prints full tiles or short bars along the edges. |
| Pixel size | Changes sampling density and mark size from 4 to 120 pixels. |
| Edge cutoff | Keeps responses above the chosen magnitude from 0 to 4. |
| Seed | Moves the source pattern while keeping other choices fixed. |
| Palette | Recolors the two edge inks. |
| Reset | Restores the baseline controls and image. |
| Save PNG | Downloads the marks on a transparent canvas. |

The scalar image is processed through [`convolve-2d-signed`](../../../catalog/operations/convolve-2d-signed.json). Edit `../materials-a-studies.js` to supply another row-major scalar image or change how response marks are drawn.
The page shows paper behind the canvas for preview; the exported PNG retains transparent space around the marks.
