# Perceptual bands

An Oklab ramp turns the palette into a run of colored bands. Their side edges shift with phase, and band coverage can open clear space between the ramp samples.

| Control | Canvas effect |
| --- | --- |
| Bands | Sets the number and height of colors sampled along the ramp. |
| Edge phase | Shifts the small side-to-side offset of the band edges. Values beyond one turn repeat the motion. |
| Band coverage | Sets the painted fraction of each band's height. One makes a continuous color field; zero leaves the layer clear. |
| Palette | Supplies the ramp's three color stops. |

Try a low **Bands** count with partial coverage for broad colored bars, or increase the count to make finer strokes. Put another layer below to see it through the unpainted gaps. Layer opacity changes the colored bars too; coverage changes their spacing.

The ramp colors come from `color.oklab-ramp`. The bands are a drawing choice made after those colors are computed.
