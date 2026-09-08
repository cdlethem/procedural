# R3 LandscapeMarks frozen composition and acceptance

Root owns public boundaries, PDE drawing, native image review and final integration. Terra
owns LandscapeComposition.java and focused pure diagnostic only. No new core or catalog
operation. Follow parapara-recreation-walkthrough.md; this is structural fidelity, not source
RNG/Processing-noise replay. Stop batch after accepted editable local Java package.

## Retained helper contract

Package org.procedurals.examples.landscapemarks, final LandscapeComposition, create(long seed).
Use private java.util.Random(seed), fresh independent draws for EVERY policy occurrence.
Store immutable private primitive arrays with scalar getters, no exposed mutable storage.
Methods below are example-only, not public catalog additions.

- horizon(): .15+.15*u. noise(): GradientNoise2D01.create(seed map).
- horizonFrequency(layer): .01*u, horizonColor(layer): nextInt(9), for3 layers.
- stripeStart(sky,side), stripeDrift(sky,side): four independent start/drift pairs,
  start=9*u, drift=.1*u*(.4+.6*v)*horizon*(sky?.1:1). Fresh u/v each time.
- placements(): CirclePlacements2D.filter;50 proposals with depth=.98*u*v,
  x=960*w,y=960*(horizon+depth*(1-horizon)),diameter=(.06+pow(depth,1.4))*120.
  Pass radius=diameter/2,separationScale1.2. Use package filter, no local rejection loop.
- mesh(): Delaunay2D of accepted centres, maxWork50000000. No source triangulator.
- diskColor(index), haloColor(index), innerColor(index): independent nextInt(9) per accepted
  circle. White halo and black shadows fixed native colours.
- speckSize(face)=3*u, speckAngle(face)=PI*u, speckStretch(face)=200*u,
  speckColor(face)=nextInt(9). Centroid computed by caller from accepted mesh.

Use the exact9-entry palette in PDE including duplicate1D6C9E. Seed42 replay and43 change,
50attempts, positive sizes, accepted distances and correct source-index mapping need a small
pure diagnostic against accepted JAR (.work/examples/r2-candidate1/CityMarks/code/procedurals.jar).
Compile with existing JDK17; preserve all diagnostic attempts. No renderer tasks for Terra.

## Drawing and scoped acceptance

P2D960,density1, black-blue background. Three retained-frequency noise horizon strips,
source clamp/power amplitude;1000 ground and1000 sky vertex-colour alpha180 quads.
Eased palette phase maps into existing CyclicPalette. Triangle edge overlay preserves
per-face shared-edge overdraw. Two elliptical black shadow fans, coloured disk, coloured
outer halo, white outer halo, coloured inner band per circle. Source segment-count rules
and alpha values; no blurred sprite substitutions. Triangle-centre coloured speck and white
small disk as explicit balanced native shapes. Include source MIT notice for drawing.

C shifts palette index (retain geometry), P toggles stripe power4.2/1 (retain geometry),
R changes seed,0 resets,S saves completed cached canvas. No rendering RNG or per-frame
reconstruction. Use reusable coordinate storage in loops. Unknown keys do nothing.

Stage actual PDE against unchanged JAR. One scoped P2D run:baseline,C/reset,P/reset,R/reset,
then cached save.180s timeout under existing render lock; source-bound fresh attempts.
Check retained identities, visible edit differences, reset/save decoded pixel equality,
actual native renderer, and complete required drawing layers. Root inspects distinct images
for wavy horizon, bands, size/depth relation, glows/shadows and fine mesh/specks. If horizon
noise transfer fails, correct explicitly before acceptance. No source-pixel equivalence claim.
