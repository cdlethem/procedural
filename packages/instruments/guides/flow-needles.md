# Flow needles

Look at the directions of a seeded scalar curl field as individual vector marks rather than advected paths. This shares the potential and curl construction with Swirling particles, but samples only the local field: useful as an airy directional texture or an inset region over other layers.

| Control | What to explore |
| --- | --- |
| Field frequency, anisotropy | Alter eddy size and aspect. Frequency, anisotropy, region extent, and column count together must leave four samples per shortest wavelength. |
| Noise mix, Seed | Blend regular waves with portable seeded gradient noise; seed selects a new field realization independently of appearance. |
| Source center, source extent | Move and resize the square area sampled for needles. A small region inspects local directions; a wider region shows the whole flow. |
| Sample columns | Change the number of marks per axis and their spacing, without directly setting their length. Up to 128² marks keep drawing bounded. |
| Mark length, Stroke weight, Palette | Control each needle's length and appearance separately from sample spacing or field structure. |

For a light accent, try 12 columns, source extent .35 and mark length 12; for an interwoven field, use 38 columns, extent .9 and length 30. Increasing sample columns can resolve shorter waves, but does not increase the field frequency by itself.
