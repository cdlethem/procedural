# Reduced mosaic

A seeded source field is quantized into colored tiles. A high or low mask chooses which tiles remain visible after quantization, so their colors stay the same.

| Control | Canvas effect |
| --- | --- |
| Cell size | Tile size and sampling density. |
| Colors | Requested number of colors in the reduced mosaic. |
| Show source values | All tiles, high-valued source cells, or low-valued source cells. |
| Source cutoff | Threshold that partitions high and low source values. |

The page provides sliders for quick exploration and exact number fields for supported values. **T** applies alternate settings, **C** swaps the palette, **0** resets, and **S** saves a transparent PNG. The canvas shows paper through CSS for preview only.

The reusable computation is [`color.median-cut-quantize`](../../../catalog/operations/median-cut-quantize.json). The generated source field and mark treatment remain editable drawing choices in `../materials-a-studies.js`.
