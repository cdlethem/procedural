# Seeded pixel grain

Root capability decision, 2026-09-17. Target: p5.js; Java, py5 and Android deferred.
Step 0 is recorded in [the reconciliation](../../evidence/coverage/reconciliation-2026-09-17.json).
This admits a reusable raster dependency, not a generic shader or whole-helper equivalence.

## Artist task and computation removed

Give a clean composition a repeatable paper texture, or make a transparent shape's
coverage granular. Change grain strength without redrawing or reseeding the geometry.
The operation owns row-major random consumption, correlated RGB brightness perturbation,
alpha modulation, saturation, byte quantization and detached output. Geometry, palettes,
layer order and capture/display remain editable drawing decisions.

## Evidence

- `2014/Generativos/cuadraditos#1`, `pixelGrain(amount)`: [notes](../../survey/out/2014/Generativos/cuadraditos/notes.md),
  SHA-256 `93f6baf98a57d128b62bd7f1e0be2254a242d752f824e8758ed4d58fb710baa5`.
  Source `noisee()` traverses y then x and adds one `random(10)` value to all three
  channels. The dot-block grid is a separate candidate and ordinary drawing composition.
- `2014/Generativos/minimalCirculines#1`, `pixelGrain(amount)`: [notes](../../survey/out/2014/Generativos/minimalCirculines/notes.md),
  SHA-256 `a11a36af89f724292eba862a15fc9740548e0d7ba3efb93307f79f5213d5f087`.
  Signed brightness perturbation precedes blur and three dashed rings. Grain 5 to20
  was scored `none`; blur and a near-white ground weaken inference about useful strength.
- `2018/Generativos/quadShadow#1`, `grainShader(glsl)`: [notes](../../survey/out/2018/Generativos/quadShadow/notes.md),
  SHA-256 `033d71537b0fb4165ece4a266757350f75a4932afffcafd2ad837338b401ac8f`.
  Its fragment alpha multiplier is `0.001 + pow(rand(pixel),0.4)`. Extract only the
  random alpha treatment: hash replay, per-fragment overlaps, shadows and shader execution
  are excluded. Processing the flattened final scene would not reproduce grain applied
  to each translucent primitive. A layer must be processed before composition. Even an isolated layer does not retain
  fragment overlaps within that layer. quadShadow is an excluded whole-sketch motivation
  and alpha-distribution observation, never a structural reproduction or family credit.

These are computation observations, not preferred library defaults or ranges. No
mathematical or representation bound is an artistic recommendation. Native experiments
must distinguish visible changes from RNG/layout confounds.

## Boundary and alternative

Public operation `raster.seeded-pixel-grain`, named p5 export `seededPixelGrain(input)`.
Input is a straight encoded-sRGB ARGB8 raster, explicit uint32 RNG state, mode,
sample interval, positive distribution exponent and work budget. Output is an owned
same-sized raster plus next RNG state. Existing masked source-over, crossfade and blur
consume their masks/weights/kernels and cannot generate random pixel perturbations.
This operation composes with those raster results. It never captures a p5 object.

Two modes share one sampled scalar per pixel: `RGB_ADD` adds it to R/G/B while preserving
alpha; `ALPHA_MULTIPLY` multiplies alpha while preserving straight RGB. Range endpoints
have byte units in the first mode and dimensionless factors in the second. The exponent
changes the random distribution; it is motivated by source alpha grain, not a preset.
No saturation/hue jitter, random-grey crossfade, spatial masks, correlated film texture,
coordinate hashing, shader, temporal state or independent color-channel noise is implied.

## Control, transfer and cost

Brightness interval changes contrast/bias, alpha interval changes coverage, and the
exponent changes the balance of weak and strong samples. Retain the unprocessed raster
to make these edits independent of geometry. The explicit next state permits a sequence
of passes; restoring the starting state provides exact replay.

Reserve `2014/Generativos/pelotitas` as the withheld transfer sketch. Its detailed source
and mechanism must be checked only after the contract is frozen. No transfer is accepted yet.
The separate alpha-layer study tests a different composition, not another demonstrated original.

Cost: one raster record, one explicit random stream and three effect controls (mode,
interval, exponent), plus a budget. Work/storage O(width*height); no new dependency is
needed because the package already contains its reviewed fdlibm power helper. One draw
and at most one power evaluation per pixel; skip the power call for exponent1 without
changing values or random consumption. Native capture/display is a linear pass as well.
Benchmark tiny, 600x800 motivating and 1920x1080 stress rasters, recording setup, repeats,
checksums and runtime without claiming mobile throughput.

## Acceptance and marginal coverage

Before: the reconciled baseline is459/800 plausible (459/826 snapshot,459/901 target).
Pixel grain affects57 sketches and is the sole remaining family for29. The maximum
family-level gain is+29, but this is an upper bound, not this API's promised coverage.
Saturation-only, random-grey mixing, per-fragment overlap and biased/spatial modulation
cases need explicit assessment. No whole-sketch credit from an extracted component.

Fixtures must distinguish shared RGB noise from independent channels, ADD from MULTIPLY,
straight from premultiplied channels, rounding/clipping, transparent-pixel consumption,
zero-width interval consumption, seed0/1/high-bit/42, ten transitions, continuation,
input/output ownership, full static validation before budget, and arithmetic overflow.

The editable `pixel-grain` study recreates cuadraditos at structural fidelity: same
600x800 canvas, seven by24 blocks, eight bytwo cells, positions/pitch and alpha; independent
LCG streams and round-to-nearest byte quantization deliberately replace Processing RNG
and float/color conversion. A strength edit preserves all block geometry. Also show
alpha grain on an isolated transparent layer before source-over composition.
Pre-register a selected corpus benchmark against all stored baseline frames (static
frame1 here), retain raw metrics and inspect baseline/candidate images. A failed benchmark
does not become a demonstrated recreation by renaming its scope after rendering.

After validation: p5 core and native accepted in [the root review](../../evidence/coverage/batch1/seeded-pixel-grain/root-review.json).
The selected original failed SSIM0.673759<0.7 and earns no demonstrated credit. The withheld
transfer is a supported source walkthrough, not a rendering. The
[affected-case review](../../evidence/coverage/batch1/coverage-review.json) closes seven
grain components, leaving50 residual cases. Five sketches become newly plausible at this
stage; the broad +29 projection was an upper bound.

## Root boundary review

Approved capability dependency for contract preparation. Candidate records remain in their
original clusters: a generic raster pass is independently specified from these motivating
helpers, with their geometry, native fragment scheduling and source RNG left outside.
The contract must make finite intermediate arithmetic and alpha ownership explicit.
Contract review and fixtures precede implementation; current target acceptance remains
the responsibility of catalog validation attestations.
