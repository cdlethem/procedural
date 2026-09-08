# Parapara: root source-to-package assessment

Status: plausibly supported at declared structural/technique fidelity; not demonstrated.
Root read the complete upstream PDE at revision69bdd8513e4482a5e6018e36887d4bc208660eb5
and survey/out/2019/generativos/parapara/notes.md. Identity hashes are in the cohort evidence
map. No candidate ledger decisions or new public operations follow from this assessment.

## Defining computations and boundaries

- Horizon: three active noisy strips precede the sky/ground. Processing noise(x*det) is
  active; imported toxiclibs SimplexNoise is unused. Existing GradientNoise2D01 can provide
  a declared independent field sampled along (x*det,0), with the source clamp(4*n-2,0,1)
  and power1.4 amplitude mapping. This changes the noise basis and range distribution;
  visual validation must show meaningful undulation, not assume a named noise operation
  recreates the source. Do not silently drop this layer or claim Processing-noise replay.
- Ground/sky: two1000-quad loops use power4.2 coordinate spacing, independently random left
  and right palette starts/drifts, and per-vertex alpha180. This is drawing/layout glue.
  P2D colour interpolation and alpha blending are required native behavior, not core logic.
- Palette: preserve all NINE source entries including repeated1D6C9E; the note's unique
  colour list loses multiplicity. Map source positive index v to q=abs(v)%9,
  phase=(floor(q)+pow(q-floor(q),10.8))/9, then call CyclicPalette.sample(phase). This
  composes caller phase easing with the accepted interpolator. No eased-palette operation
  is needed. Apply opacity in host drawing. Package quantization differs from lerpColor.
- Placement: generate exactly50 proposals, never retry until50 accepted. Each proposal
  takes fresh nested random val=.98*u*v, fresh x=960*w, y=960*(hor+val*(1-hor)),
  diameter=(.06+pow(val,1.4))*120. Caller coordinate/size distributions are composition
  policies. Ordered-circle-filter performs the actual rejection algorithm.
  CRITICAL: ss in source is ellipse DIAMETER, not radius. Supply radius=ss/2 and
  separationScale=1.2 to reproduce distance < .6*(ss+other.ss). Thus accepted circles
  have clearance, not the 'loose packing' suggested by the note. Preserve survey text,
  record correction here. Original float/hypot and package robust distance may disagree
  at boundaries; structural fidelity, not exact accepted-index replay, is claimed.
- Triangulate accepted centres with Delaunay2D. Draw triangle outlines at alpha10, including
  shared edge overdraw as source triangle traversal does. Do not silently deduplicate to
  unique edges and change opacity. Canonical face order remains an explicit divergence.
- Each circle has two flattened shadow fans below it, its filled disk, a coloured outer
  halo, faint white outer halo, and inward coloured band, in that exact order. These are
  explicit alpha-ramped native quad fans, with source segment-count formulas retained.
  Do not substitute a blurred sprite or ordinary ellipse and call the glow reproduced.
  The elliptical arc helper's second inner vertex reuses cos(ang1); both active elliptical
  calls have zero inner dimensions, so that apparent bug has no effect here. Circular
  annulus helper is the active nonzero-inner-radius case. No general ring API is admitted
  from this source-specific renderer pattern alone.
- Each triangle centroid gets a stretched coloured triangle and tiny white disk. Source
  calls ellipse while a shape is open; use explicit balanced triangle then disk drawing,
  retaining intended overlay order and declaring lifecycle correction. The white disk
  diameter is the random ss<3, not a universally fixed3 as the note informally suggests.

## Admission and editing direction

Existing noise, palette, ordered filtering and triangulation plausibly cover every reusable
algorithm. Native P2D supplies interpolated vertex colour, alpha, ellipses and explicit fan
geometry. Root considers remaining formulas drawing/artistic glue; that design judgment
is separate from the report's proposed gradientStripes and ringGlow library candidates.

Before implementation freeze a retained scene with independent random samples for every
policy; avoid R2's accidental cross-policy correlations. Keep horizon noise seed explicit.
A useful edit is stripe power4.2 versus1, supported by the note's moderate measured change;
retain proposals and topology. Palette shift also retains geometry. Seed/reset/save follow
existing examples. Do not elevate line opacity (measured none) into the main editing flow.
Point count and size have subtle measured effects, so they are not priority exposed knobs.

The complete source has no shader call and needs P2D, not P3D. Default960,density1 is a
recorded portability choice versus source density2. First native acceptance must inspect
horizon undulation, depth-dependent sizes, shadow/glow layering and band placement; a
successful triangulation or nonblank image alone cannot establish recreation coverage.
No count is added to the two demonstrated cohort originals until these checks pass.
