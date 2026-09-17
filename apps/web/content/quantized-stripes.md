# Quantized stripes

Generated stripe colors are reduced to a smaller palette, then printed as horizontal bands. Narrow the band coverage to leave clear gaps that show layers underneath while keeping the same quantized colors.

| Control | Canvas effect |
| --- | --- |
| Stripes | Changes how many source colors are sampled and how tall each output band is. |
| Colors | Requests the number of colors retained by median-cut reduction. Similar source colors may collapse into fewer distinct colors. |
| Band coverage | Sets how much of each band's height is painted. One fills the stripe field; zero leaves the layer clear. Intermediate values center colored bands in transparent gaps. |
| Palette | Supplies the source colors before reduction. |

Place this layer above a line or dot study and lower **Band coverage** to let those marks show through the gaps. The surviving bands remain fully colored; overall layer opacity fades both the bands and their colors instead.

The study uses `color.median-cut-quantize` on a generated stripe source. Change the source color construction in the editable example to try another quantized sequence.
