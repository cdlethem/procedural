# Chord looms

Two **independent source curves** are constructed as ellipses, radially lobed closed loops, or open arcs. Each has its own center, horizontal and vertical radius, angular phase, rotation, lobe count/depth, and arc sweep. The toolkit's `resamplePolyline2D` samples each by arc length; a chord joins A sample `i` to B sample `round(i * stride + phase + modulation * sin(2π * i * waves / N)) modulo N`. Rounding keeps every unperturbed endpoint on an actual sampled site. For an open arc, the index mapping still wraps: this can create a visible seam in the *connections*, not a closing stroke in the source. Seeded omission and endpoint disorder are separate from the ordered mapping, both zero/off by default. No source outlines are drawn unless **Show source guides** is enabled.

| Experiment | Settings | Result to look for |
|---|---|---|
| Overlapping string-art envelope | A ellipse centered (290, 350), radii (165, 100), B ellipse centered (415, 350), radii (120, 180); 180 samples, stride 3, phase 0, modulation 0, retained 1 | Dense ordered crossings and smooth envelopes with no guide rings. |
| Narrow bridge | A arc center (240, 330), radii (65, 80), phase -60°, sweep 120°; B arc center (465, 330), radii (65, 80), phase 120°, sweep 120°; 75 samples, stride 1, phase 0, retained 0.7 | A partial fan linking two small separated local curves. Turn guides on to see the open sources. |
| Broken lobed cage | A lobed, 5 lobes/depth 0.3, center (350, 350), radii (180, 135); B lobed, 7 lobes/depth 0.2, center (350, 350), radii (110, 185); 220 samples, stride 5, phase 17, modulation 24/waves 3, retained 0.55, endpoint disorder 2 | Interleaved partial bundles; remove modulation, omission and disorder to recover an ordered modular construction. |

Radius and center are **source geometry**, not a final canvas fit. Sample count allows exact entry 2–900; the joint site budget `2 * (97 + N) + N + (guides ? 2 * N : 0) ≤ 4500` is checked before building the source curves. Retained fraction 0 gives no connections; optional guides remain independently visible. Zero chord weight also removes connections. Guide weight is separate from chord weight. Color and weights do not affect arc-length samples or mapping; only omission and endpoint perturbation depend on seed. Stroke marks are transparent outside their geometry: no paper, title or automatic frame.

The seed control appears only when omission or endpoint disorder is active. Fully retained, unperturbed chords are a deterministic construction: change either source curve or the mapping instead of reseeding it.
