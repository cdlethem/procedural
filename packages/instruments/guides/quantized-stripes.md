# Quantized stripes

The source is an editable RGB color sequence. Real median-cut quantization reduces it to the requested palette; each original source color then receives a reduced color. The colors remain in source order, are grouped by reduced color, or are shuffled with the layer seed. Their **weights** set actual painted area: row heights follow their combined weights, and widths follow each color's share within its row. One column makes weighted horizontal strips; multiple columns make weighted tiles. The field remains transparent between painted cells, so a layer underneath can show through.

| Control | Canvas effect |
| --- | --- |
| Color source | **Palette-ramp** samples encoded RGB along *all* layer palette stops. **Sequence** uses the authored JSON color/weight rows instead. Neither mode invents extra alternating colors. |
| Ramp samples | Number of input colors along the palette ramp; one sample uses the first palette stop, zero paints nothing. Ignored in sequence mode. |
| Weighted color sequence | JSON rows `["#hex", positiveWeight]`, e.g. `[["#172842",3],["#4b7788",1],["#a1c5ad",2],["#f8d494",1],["#d97960",4],["#694665",1],["#b6a4c4",2],["#315b74",1]]`. Use 3- or 6-digit hex and 1–512 rows; weights must be positive and at most 10000. |
| Retained colors | Requested median-cut palette size. Fewer distinct colors may survive when the source contains repeated or similar colors. The reduction has a 3,000,000-work limit; the instrument rejects oversized combinations rather than silently changing counts. |
| Color order | **Source** preserves row order, **grouped** sorts by reduced-color bucket while preserving order *within* each bucket, and **shuffle** permutes the source rows reproducibly using the layer seed. Only shuffle responds to reseeding. Grouping can change width placement because weights travel with their colors. |
| Columns | Maximum cells per row. One gives full-width horizontal strips; more gives weighted tiles. The final row may have fewer cells, but still occupies the full field width. |
| Width, height, center, rotation | Set the total unshifted field footprint and its placement/orientation in 640-unit canvas coordinates. Row heights follow their combined source weights. |
| Alternate row shift | Displaces odd rows by a fraction of the *nominal* column width (`field width / columns`); even rows are unchanged. |
| Horizontal and vertical coverage | Paint a centered fraction of each weighted cell and each row; the remainder stays clear. Either at zero paints nothing. |

Try the JSON sequence with **Columns** set to 4 and **Horizontal coverage** around 0.85 for staggered tiles; adjust the color weights to make individual cells wider or narrower. Set **Columns** back to 1 and lower **Vertical coverage** to lay translucent-gap strips over a dot or line study. Changing retained-color count changes reduced RGB and grouping, not the original cell geometry in source or shuffle order. Overall layer opacity fades every surviving mark; coverage makes actual transparent holes.
