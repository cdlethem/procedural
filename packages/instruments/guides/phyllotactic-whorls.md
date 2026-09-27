# Phyllotactic whorls

Arrange leaf-like marks, discs or bars around a spiral whorl; adjust divergence to change its visible arms and optional rank links.

This is an **indexed drawing construction**, not random point packing or a botanical growth model. For each rank $r=0,\ldots,\text{count}-1$, the absolute index is `starting index + r`. Its baseline radius is `inner radius + radial scale × index ^ exponent`, and its baseline angle is `index × divergence`. Angular and radial disorder separately perturb those values when enabled; radial disorder cannot push a site inside the inner radius. X anisotropy stretches the local X coordinate, then source rotation turns the whole arrangement around the chosen center. The inner radius describes source sites *before* anisotropy, not the painted mark edge. Nothing is scaled to fit the canvas; changing the starting index genuinely selects a later part of the spiral.

| Source control | Effect |
| --- | --- |
| Ranks / Starting index | Number of sampled sites (0–5,000) and first absolute index (0–100,000). Zero ranks paints nothing. |
| Divergence ° | Continuous angle step per absolute index; fractional degrees matter. |
| Radial scale / Radial exponent / Inner radius | Radius formula in canvas units. The exponent must be positive; zero radial scale is legal and may superpose sites. |
| X anisotropy / Center X, Y / Source rotation ° | Source construction and placement, independent of mark orientation; off-canvas centers are allowed. |
| Angular disorder ° / Radial disorder | Independent seeded perturbations, each zeroable; the latter is in canvas units and is clamped at the inner radius. |

| Material control | Effect |
| --- | --- |
| Primitive | Disc, ellipse, bar, or pointed curved leaf. Shapes are individually authored marks, not collision footprints. |
| Mark orientation / Mark angle ° | Radial (actual center-to-site direction), tangent (+90°), or fixed canvas direction, plus the mark angle. A disc looks identical under rotation. |
| Mark size / Mark aspect / Last rank scale | Size is disc diameter or other mark length; aspect scales breadth. Size progresses linearly by rank from full size to the last-rank multiplier. Size zero removes marks without removing links. |
| Mark outline weight | Zero gives filled-only marks; positive weight inks a second palette color around the mark. |
| Retained ranks | Seeded fraction of ranks shown in the drawing. Zero shows nothing; one shows all. It never changes source coordinates. |
| Connection stride / Connection weight | Stride zero or weight zero disables links. Otherwise a link runs **only from rank $r$ to rank $r+\text{stride}$** when both survive retention and that second rank exists; no wrap-around closing chord. Links remain visible when mark size is zero. |

| Recipe | Settings | What changes |
| --- | --- | --- |
| Ordered compact seed | Ranks 850, start 1, divergence 137.508°, radial scale 10.8, exponent 0.5, inner radius 19, center (320,320), both disorders 0, retention 1 | Dense ranked ellipse marks; changing seed does nothing. Change palette, taper or outline without moving sites. |
| Sparse oblique strands | Ranks 230, start 40, divergence 99.5°, radial scale 6, exponent 0.67, anisotropy 1.6, center (180,390), rotation -30°, bar marks size 8, taper 0.25, stride 13, link weight 0.8, retention 0.72 | Off-center directional ribbons with true forward-only rank connections; seed changes which sites survive, not their coordinates. |
| Disordered open leaves | Ranks 180, start 0, divergence 141.2°, radial scale 14, exponent 0.48, inner radius 38, angular disorder 12°, radial disorder 8, center (470,230), leaf marks size 11, aspect 0.7, radial orientation, stride 0 | Partial whorl with distinct radial and angular random perturbations and no drawn framework. |

Fixed seed reproduces disorder and retention. Geometry draws from separate radial and angular streams, so adjusting palette, mark material, connection weight, or retention never moves source sites; retention has its own stream. Seed has no effect when both disorder controls are zero and retention is one. The source radius is limited to 10,000,000 canvas units before building sites, in addition to the individual control limits. Marks can overlap or leave gaps: there is **no nonoverlap guarantee** and no botanical claim.
