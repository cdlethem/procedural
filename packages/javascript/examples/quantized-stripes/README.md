# Quantized stripes

Generated stripe colors are reduced to a smaller palette. Band coverage controls how much of each output stripe is painted, revealing the transparent canvas between bands.

| Control | Canvas effect |
| --- | --- |
| Stripes | Number and height of source/output bands. |
| Colors | Requested number of reduced colors. |
| Band coverage | Painted fraction of each band; zero leaves the entire canvas transparent. |

The page provides sliders for quick exploration and exact number fields for supported values. **T** applies alternate settings, **C** swaps the palette, **0** resets, and **S** saves a transparent PNG. The canvas shows paper through CSS for preview only.

The reusable computation is [`color.median-cut-quantize`](../../../catalog/operations/median-cut-quantize.json). The generated source field and mark treatment remain editable drawing choices in `../materials-a-studies.js`.
