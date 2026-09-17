# Geometric generations

Turn an editable cellular grid into colored square generations. Serve the package examples so `/p5.js` is available, then open `index.html`.

A binary 20 × 20 field is updated synchronously, then live cells become squares. The native controls match the web study's initial-field, update and mark choices. Use **Initial field**, **Source X/Y**, **Source frequency** and **Initial fill** to decide where the simulation starts. **Passes** advances it; the chemical studies expose **Feed/Kill**, while the cellular studies expose **Rule/Boundary**. Cell size, stroke weight and palette change the painted treatment.

Sliders cover useful preview intervals; exact number fields accept the wider supported domain and the same combined cell-update budget. Long chemical runs may become uniform or drop below the mark threshold, and long Life-like runs may empty the grid. The neutral paper is CSS behind a transparent canvas, so PNG export and layered compositions retain transparency.

| Action | Effect |
| --- | --- |
| Original composition | Shows the historical fixed-input drawing; T toggles its historical structural variant. |
| C | Changes the packed RGB palette. |
| 0 | Restores modern defaults and the first palette. |
| S | Saves a transparent PNG. |

`../cellular-quality.js` mirrors the web study composition over the existing p5 core; it is example-private and adds no public operation.
