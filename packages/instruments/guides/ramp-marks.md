# Ramp Marks

A local mark grid samples a **positioned RGB palette ramp** through `stopRamp`. This is a color coordinate field, not a raster gradient: source marks have their own editable grid and the color field has its own origin. Neither is fitted to the canvas. A palette of just one color is valid; it yields a constant-color field, with its one stop at position zero when stop positions are blank.

| Control | What it changes |
| --- | --- |
| Columns / Rows | Counts of marks in the local rectangular grid. At most 10,000 marks jointly. |
| Column spacing / Row spacing | Independent pitches in canvas units; neither controls mark width. |
| Source X / Y / Grid rotation | Center and orientation of the mark grid. Bars and strokes follow grid rotation. Off-canvas fragments are allowed. |
| Mark / Mark width / Mark length / Stroke weight | Dots use width as diameter; bars use width as thickness and length as their segment extent; strokes use weight and length. Zero active thickness or length leaves no ink. |
| Retention / Position disorder | Retention is the fraction of independently selected marks; disorder jitters positions by up to half a pitch on each local axis. A complete ordered grid (retention 1, disorder 0) has **no seed dependency**. |
| Color coordinate | Linear projected distance, radial distance or angle measured from the independent color-field center. |
| Color-field X / Y / Color axis | Origin of color sampling, and linear projection direction or zero angle. Moving the field does not move the marks. |
| Color span / Color phase | One full ramp spans the given **canvas units** for linear/radial or **degrees** for angular; phase adds ramp cycles. Linear and angular start at phase + 0.5 at their origins, radial starts at phase. |
| Stop positions | Blank places colors evenly over [0, 1]. Otherwise enter exactly one normalized value per palette color, comma- or whitespace-separated, strictly increasing in palette order; for example `0, .12, .8, 1`. Invalid counts and order are rejected, never sorted. |
| Ramp mapping | Clamp holds endpoint colors outside the range, repeat wraps every cycle, mirror reverses alternate cycles. |
| Palette | One to 256 RGB colors in the supplied order; interpolated colors come from actual `stopRamp` samples. Changing palette colors or stops never moves mark geometry. |

Try **a local radial burst**: 17 × 17 dots, 15-unit horizontal and vertical spacing, source (320, 320), width 9, radial field at (295, 340), span 130, phase 0, mirror mapping, and a three-color palette. For **sparse oblique bars**, use 28 × 8, pitch (17, 25), source (330, 315), rotation 37°, bar width 4, length 25, retention .48, disorder .23, linear color axis −28°, span 300 and repeat mapping. For **broad ordered dots**, use 21 × 12, pitch (29, 34), source (320, 320), zero rotation and disorder, full retention, dot width 16, linear span 600, phase .5 and clamp: reseeding cannot change this grid. Tighten stop positions to `0, .2, .65` with a three-color palette to shift color transitions without changing the marks.
