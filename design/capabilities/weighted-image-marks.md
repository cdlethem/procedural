# Image-weighted marks

Root admits two independent computations: weighted point draws and one synchronous
pixel-mass centroid step. An artist can place editable marks according to an image's
relative density, then redistribute the same marks without tying that geometry to dot
radius or ink. Outputs are positions, source pixel indices and masses; ordinary mark
drawing and luminance/alpha/gamma conversion remain editable caller decisions.

Sighack's [Simple Stippling Using Circle Packing](https://sighack.com/post/simple-stippling-via-circle-packing),
corpus record `graphic-v2-c0357bdac268`, maps brightness to packing radius; it motivates
image-sensitive marks but does not prove the weighted-centroid algorithm. Secord's
[Weighted Voronoi Stippling](https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf)
is a separate research precedent for density-sensitive centroidal placement. Our discrete
pixel-center assignment and finite integer weights are explicit design choices, not a
reproduction of its continuous integrals or GPU method. Manifest
`evidence/external-art/2026-09/corpus.json` SHA-256:
`c25caa8edf07e11bf1f97cc5a1d70dd65a915620992bc0b3d3746c80ae59d209`.

Poisson disc sampling has fixed separation, geometric Lloyd relaxation uses polygon
area, and bilinear remapping samples colors at existing positions. None removes weighted
selection and pixel-mass assignment. Conversely these new operations do not pack circles,
guarantee minimum spacing or compute vector Voronoi cells. Sampling is with replacement;
centroids may coincide and empty sites retain their positions. No hidden repair/jitter.

Demonstrate a locally authored raster and an independent thermal/height mask with equal
mark count, inverted density, optional fixed centroid steps, and independent dot/ink edits.
The same points must support a contrasting stroke or shape treatment. Input photographs
from the reference corpus must not be redistributed. Controls are example configurations,
not source-derived defaults or recommended ranges. Exact work budgets bound events, not
runtime; exact comparisons may be costly at high pixel/site counts. Measure study and
larger test configurations before native acceptance.

No complete external original is accepted by admission. Source circle packing retains
its separate radius/packing algorithm. Related watercolor layers remain separate E work:
shared-parent recursive polygon variants are not supplied by either weighted primitive.
The output boundary adds a raster-relative coordinate convention and integer mass/RNG
concepts; this cost buys independent, substitutable geometry rather than an opaque renderer.
