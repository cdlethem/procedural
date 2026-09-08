# Compose a banded night landscape

LandscapeMarks combines a noisy horizon, coloured horizontal bands, depth-sized circles,
soft shadows and halos, and a fine triangulated network. It uses existing gradient noise,
cyclic palette, ordered circle filtering and Delaunay operations. Desktop Processing4 P2D
provides vertex-colour interpolation and alpha blending.

C shifts colours; P switches stripe spacing between power4.2 and uniform; R changes seed;
0 resets; S saves the completed canvas to `landscape-marks.png`. Colour and spacing edits
retain circle positions, noise field and topology. The sketch renders on demand.

Start with LandscapeComposition for placement:50 depth-biased proposals are filtered using
radius=diameter/2 and separationScale1.2. This preserves the source's diameter-based clearance
rule; it is not loose packing. Seed42 accepts47 circles and produces81 triangle faces.
The size formula grows circles toward the foreground. Edit LandscapeMarks for the drawing:
three noise strips,1000 sky and1000 ground quads, then mesh, circles and centroid specks.
The nine-entry palette intentionally repeats one blue. A phase mapping supplies the source's
hold-then-change easing through the existing CyclicPalette operation.

The underlying example is `2019/generativos/parapara`. Its note reports a moderate visual
change for stripe power4.2→1, supporting the P edit. Other source presets are authored choices,
not measured general library ranges. Line-opacity changes measured no effect, so opacity
is not a main control. See `survey/out/2019/generativos/parapara/notes.md` and the detailed
mapping in `design/capabilities/parapara-recreation-walkthrough.md`.

This is a reviewed structural recreation, not source-pixel replay. Independent noise/RNG,
canonical triangulation, numeric precision and palette quantization differ. Density1 replaces
the source density2 request. Explicit balanced speck drawing resolves the source's nested
shape lifecycle. Shadow and halo fans retain their defining alpha layering rather than
substituting a sprite. The PDE carries the upstream MIT notice for translated drawing.

Native acceptance covers colour, stripe-spacing, seed, reset and cached save; all four
distinct images were reviewed. Human usability testing and other platform ports remain pending.
