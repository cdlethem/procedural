# Perceptual bands

An Oklab color ramp becomes staggered horizontal bands. Band coverage leaves transparent gaps between the samples.

| Control | Canvas effect |
| --- | --- |
| Bands | Number and height of colors along the ramp. |
| Edge phase | Horizontal shift of each band’s side edges; large angles repeat the cycle. |
| Band coverage | Painted fraction of each band; zero leaves the canvas transparent. |

The page provides sliders for quick exploration and exact number fields for supported values. **T** applies alternate settings, **C** swaps the palette, **0** resets, and **S** saves a transparent PNG. The canvas shows paper through CSS for preview only.

The reusable computation is [`color.oklab-ramp`](../../../catalog/operations/oklab-ramp.json). The generated source field and mark treatment remain editable drawing choices in `../materials-a-studies.js`.
