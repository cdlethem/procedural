# Harmonic Traces

Draw Lissajous rosettes, damped tangles or ordered stitches by combining editable oscillators.

Harmonic Traces draws ordered, sampled curves of an editable oscillator sum. It is a **parametric drawing**, not a simulation of pendulums or forces. Each comma-separated line in Oscillator terms has `axis, amplitude, frequency, phase, decay`: `x` or `y`; signed amplitude in canvas units; signed frequency in cycles per unit of parameter time; phase in degrees; nonnegative exponential decay per unit of elapsed time. The horizontal and vertical terms are summed **separately**. For trace index `k`, the formula on either axis is `sum(amplitude × exp(-decay × (t - start)) × cos(2π × frequency × t + (phase + k × phaseStride) × π/180))`. A single source rotation and center translate the resulting `(x, y)` pair. Negative amplitudes and frequencies are meaningful. A frequency of zero creates a constant or decaying offset. Decay begins at the chosen start time, but the oscillator phase uses absolute time `t`.

| Control | Visible effect |
| --- | --- |
| Oscillator terms | One to twelve lines, at least one nonzero amplitude; edits to any term alter the actual sampled source, not just the marks. |
| Start time, Duration | First and last formula parameters; the span must be positive. Both endpoints are retained. |
| Samples per trace | Straight segments between formula samples, with at least eight segments per fastest oscillator cycle. The line is polygonal, not an analytically smooth curve. |
| Phase traces, Phase stride | Up to 32 separately sampled curves; each successive curve adds the given phase angle to **every** oscillator. Zero stride overlays them exactly. |
| Center X/Y, Source rotation | Position and orientation in canvas coordinates, without clipping or auto-fitting. |
| Material | A continuous polyline, dots at equally spaced traveled distances, or short line segments normal to the local polyline tangent. |
| Material spacing, Mark size | Approximate arc-length spacing between dots/stitches and their diameter/length. These do not change the retained formula curves. |
| Stroke weight | Width for the line or stitches; does not change dots. Weight zero hides stroke materials and mark size zero hides sampled marks. |

**Rosette:** Terms `x, 160, 3, 0, 0` / `y, 160, 2, 90, 0` / `x, 40, 7, 30, 0` / `y, 40, 5, -20, 0` (put each on its own line), Start time 0, Duration 1, Samples 1300, Phase traces 3, Phase stride 18, Center 320/320, Material line. The integer-related periods make a dense, repeatable local motif.

**Decaying spray:** Terms `x, 155, 2.5, 0, 0.6` / `y, 100, 3.5, 90, 1.15`, Start time 0, Duration 3, Samples 1500, Phase traces 6, Phase stride 30, Material dots, Material spacing 12, Mark size 3. The decays shrink both directions at different rates.

**Open beat:** Terms `x, 150, 1, 10, 0` / `y, 120, 1.4142, 45, 0` / `y, 25, 3.7, -20, 0`, Start time -1, Duration 2.5, Samples 1700, Phase traces 2, Phase stride 55, Material normal-stitches, Material spacing 14, Mark size 7, Stroke weight 1. These incommensurate frequencies do not imply a closed orbit.

Limits: amplitude magnitude ≤3000, frequency magnitude ≤200, phase magnitude ≤36000°, decay 0–20; 2–20000 samples per trace, at most 30000 aggregate source vertices, and at most 30000 arc-length material stations. Increase spacing if a long line needs too many dots/stitches. Palette choices affect ink only, never source coordinates. There is no random seed, automatic background, source guide, physical simulator, or new SDK oscillator operation. Dot and stitch positions use the released `geometry.resample-polyline-2d` operation.
