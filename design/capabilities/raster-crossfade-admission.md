# Raster crossfade dependency admission

Root admits raster.crossfade-2d for the maintainer's explicit effect-to-effect blending
requirement. This admits contract preparation, not implementation or release acceptance.
Root retains architecture review under the paused Sol-review sprint policy.

Artist task: mix two independently produced raster layers using a spatial scalar weight.
Replacing either input with a photo, image snippet or rasterized generated drawing must not
require rewriting alpha arithmetic. Output is reusable as another raster input.

The private partition study demonstrated a concrete counterexample: fading every region
over the background makes background-visible gutters; it does not crossfade two contents.
Source-over and crossfade have different alpha equations for translucent inputs. Keep them
separate operations with explicit names rather than an overloaded mask or blend-mode enum.

Use two same-sized straight packed ARGB8 raster inputs and an explicit per-pixel weight in
[0,1]. Zero selects the first input bit-for-bit, one selects the second. Interior weights
interpolate premultiplied working encoded RGB and alpha, then return straight packed ARGB8.
No hidden gamma conversion or artistic defaults. The catalog fixes ordered binary64 math,
quantization, degenerate transparency, validation and ownership before implementation.

Root's previously reviewed evidence is survey/out/2017/Generativos/Eyes/eyes002/notes.md,
candidate #1 imageTrail: native photographic stamps combine with changing alpha, and the
notes explicitly identify interchangeable image/draw-callback content. Source lines49–71
at69bdd8513e4482a5e6018e36887d4bc208660eb5 establish native alpha-controlled layering.
Crossfade itself is an explicit project-design dependency for the requested composition
capability, not a claim that imageTrail computes it. Motion, placement, photographic asset
and the artistic alpha ramp remain outside. Original candidate status is unchanged.

The source alpha experiment is subtle; it establishes no useful opacity recommendation.
Weights are caller data with mathematical bounds, no default or recommended gradient width.
No semantic feature extraction, original-sketch recreation, photograph redistribution or
non-Java support is claimed. Native acceptance must demonstrate a transition between two
distinct layer producers and preserve input layers for subsequent reuse.
