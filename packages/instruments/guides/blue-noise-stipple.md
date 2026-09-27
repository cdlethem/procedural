# Spaced Marks: Stipple starting recipe

Spaced Marks is a Poisson-disc placement instrument for drawing at sites at least **Minimum separation** apart. The Stipple starting recipe begins with dots; the Symbols starting recipe begins with square marks, and both can draw any of the five marks. The sampling rectangle is built at its actual width and height: squeezing the footprint does not squeeze already-separated points. An ellipse or annulus filters sampled sites afterward, so the number visible can be less than the source cap. Nothing draws outside the accepted support except a mark centered close to its edge.

| Decision | Controls | What changes |
|---|---|---|
| Source density | Minimum separation, attempts, source cap | Smaller separation allows more sites; attempts changes frontier exploration; cap bounds source points **before** filtering. |
| Locality | Support, annulus opening, footprint width/height, center X/Y, footprint angle | Compose a broad rectangular texture, a small ellipse, or an open ring. Footprint angle rigidly rotates the entire distribution. |
| Material | Mark, mark size, mark aspect, mark angle, angle spread | Dot, square, diamond, cross or short stroke at the **same sites**. Angle spread is independently seeded; changing mark controls does not move sites. Zero size leaves no marks. |

Try a sparse isolated accent: ellipse, width 140, height 85, center (175, 520), minimum separation 23, cap 90, diamond, size 13, aspect 0.5, angle 30°. For an open stippled wreath: annulus, opening 0.72, width 440, height 260, center (360, 360), separation 12, cap 550, dot, size 2. These are examples of support and mark decisions, not alternate algorithms. A very narrow ring with a small cap can retain no points.

Useful slider intervals are shown in the controls; exact entry allows footprint dimensions 1–1600, center coordinates −4000–4000, separation 1–1600, attempts 1–30 and cap 0–600. The attempt × cap limit is 18,000; Poisson computation has an additional 3,000,000-work-unit ceiling. These are execution limits, not recommendations for composition.
