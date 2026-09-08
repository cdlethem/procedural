# CP18 direction: a field with depth

Status: root-selected private investigation, not public API or implementation acceptance.

Artist entry: keep a pattern's positions and seed, but move through a smooth field in
its third coordinate. Reuse that field on a three-dimensional form, where z denotes
spatial depth instead. Existing GradientNoise2D01 cannot supply independent x/y/z
variation. Re-seeding a 2D field gives unrelated patterns; translating its x/y plane
moves the same slice. Those are useful edits but not the same capability.

Root read notes and pinned source at69bdd8513e4482a5e6018e36887d4bc208660eb5 for:
- 2016/Generativos/pelosNoise2: jittered fixed grid, noise(x*detail,y*detail,z), shared
  scalar driving stroke angle and length; z follows cos(frame-angle/4). Its measured
  zScale1-to4 edit reports a moderate pattern shift, not a recommended depth interval.
  Frame angle also rotates headings; separate those edits in the new example.
- 2018/Generativos/conitos: noise sampled at supplied x/y/z gates placement and sizes
  cones; three offset samples drive rotations. Source generate() does not call randomSeed
  or noiseSeed despite the seed field/harness determinism report. Do not infer a source
  seed contract. Threshold/power, placement, cone construction and rotation mapping are
  composite consumers, not a standalone noise operation.

sphhhh also describes per-cell3D noise on a sphere, but its candidate-looking rows occur
under parameters in frontmatter. It is supporting prose, not an invented candidate ID.
Spiral2's polar cells remain a separate layout investigation; no polar API is admitted.

## Proposed boundary and alternatives

A seed-only immutable3D scalar field, independently specified as the existing2D field is.
Query3coordinates, return0..1, no RNG consumption on query. No octave stack, derivative,
vector/curl field, frame reader, host noise delegation or drawing callback. Coordinates
carry scale/offset/depth through ordinary caller arithmetic; no speculative detail control.
Do not promise the z=0 slice equals GradientNoise2D01. Keep existing2D behavior unchanged.

Private experiment: twelve edge gradients, existing lowbias32 mixer (existing notice),
three-coordinate corner hashing and separable quintic interpolation. This is a design
choice, not the Processing Perlin algorithm. Resolve the exact arithmetic before public
contract work. Assess slice coherence and depth edits, then volumetric reuse with existing
mesh/drawing machinery. Porting and Sol remain paused; root owns decisions and final review.

Bounded delivery: root specifies/reviews private field and native study, freezes dependency
admission/contract only if useful; Terra can implement a frozen public core/example slice;
Luna handles evidence bindings and established runners. Stop this investigation at a
reviewed choice, not a broad audit. No operation count or recreation credit until acceptance.
