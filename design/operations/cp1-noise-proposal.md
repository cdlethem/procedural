# CP1 portable noise proposal

Owner: root. Historical design proposal, now admitted after Sol review and the visual
experiment. The authoritative frozen contract is
[`field.gradient-noise-2d-01`](../../catalog/operations/gradient-noise-2d-01.json);
three portable language cores are implemented.

## Choice and alternatives

Provide one explicitly named portable 2D gradient-noise field for independent CP1 marks.
Its scalar output is in [0,1], evaluation is pure, and coordinate scaling remains visible
in the example. This is a technique-level replacement for Processing noise, not a
Processing-compatible source. Do not promise identical fields for the same seed.

Use a single octave initially. Four-octave accumulation, rectified octaves and signed
simplex remain separate computations under investigation; silently baking in four octaves
would obscure which capability is being supplied. This narrows the first field's algorithm,
not the project's required technique coverage. Before CP1 acceptance, compare the complete
piece against its declared technique and edit tasks; insufficient field richness is grounds
to change this choice. The field must not be accepted solely because scalar tests pass.

Host noise delegation would undermine cross-target identity. A Processing compatibility
implementation is useful for exact reproduction but is not required by CP1's declared
technique-level acceptance. An algorithm-switching constructor would hide differing
ranges and seed semantics. A generic expression DSL adds no necessary artistic capability.

## Data and artist use

Tentative operation `field.gradient-noise-2d-01`, native constructor `gradientNoise2D01({seed})`.
Immutable field; native `sample(x,y)` returns a scalar without point-array allocation.
The language-neutral query shape remains a two-number coordinate. Seed is required unsigned 32-bit
integer, including zero; no default or encouraged seed range. Serialize only `{seed}`.
Coordinates must have both floor(q) and floor(q)+1 in the exact safe-integer domain:
q in [-(2^53-1),2^53-1). This is a representability bound, not a visual recommendation. Scale and offset remain caller
arithmetic: `field.sample(offsetX+x*frequency, offsetY+y*frequency)`. They are explicit native
example controls and can later be a proven convenience, not hidden units in the algorithm.

For CP1, reuse one field with distinct offsets or construct independently seeded fields.
Changing query order, constructing another field, recolouring, or reusing a field must
never advance state. No external RNG, table, renderer, clock or mutable host noise settings.

## Independently specified algorithm proposal

This uses gradient interpolation and quintic fade as described by Ken Perlin's
[Improved Noise reference](https://mrl.cs.nyu.edu/~perlin/noise/) (consulted 2026-09-07).
The proposed 2D gradient set and seed/lattice hash below are project design choices;
this is not that reference's permutation table, 3D implementation or output sequence.
No reference implementation code or permutation table is copied into the library.

The scalar mixer is `lowbias32` from [Hash Function Prospector](https://github.com/skeeto/hash-prospector), published under the Unlicense; retain attribution when implementing. The lattice-combination rule is a project proposal, not a quality claim inherited from that mixer.

All integer hash arithmetic is unsigned 32-bit with modular multiplication and logical
right shift. Define `mix(v)` by these successive assignments:

1. `v = v XOR (v >>> 16)`
2. `v = v * 0x7feb352d mod 2^32`
3. `v = v XOR (v >>> 15)`
4. `v = v * 0x846ca68b mod 2^32`
5. return `v XOR (v >>> 16)`

For integer lattice `(i,j)`, define `a = mix(seed XOR (i mod 2^32) XOR 0x9e3779b9)`
and `h = mix(a XOR (j mod 2^32) XOR 0x85ebca6b)`. Select `h mod 8` from the ordered gradients
`(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)`.
This bounded finite gradient set deliberately avoids cross-runtime square roots.
Hash construction has no stream, shuffle or permutation-state consumption. Root rejected
an earlier symmetric XOR/rotate combiner: equal coordinates restricted its intermediate
value to 16 bits. Ordered mixing avoids that structural cancellation; empirical checks
still must test directional behavior and no statistical-quality guarantee is implied.

Let `i=floor(x)`, `j=floor(y)`, `u=x-i`, `v=y-j`. Compute the four gradient dot
products with offsets `(u,v)`, `(u-1,v)`, `(u,v-1)`, `(u-1,v-1)`.
Use the quintic polynomial `6t^5-15t^4+10t^3` as fade, with a frozen evaluation order
in the eventual contract. Interpolate the bottom pair in x, top pair in x, then in y.
The theoretical raw range is [-1,1]; return `0.5 + 0.5*raw`, clamped to
[0,1] only as a final floating-point guard. Both endpoints are possible for appropriate corner gradients at a cell centre.
Lattice points return exactly 0.5. Negative coordinates use floor, never abs or truncation.
Hash periodicity is 2^32 per coordinate, exposed within the input domain when shifted
coordinates are exactly representable. This is not a configurable tileability feature. Adjacent representable positions can converge at
large magnitudes; no epsilon correction.

Binary64 separate operations, ties-to-even, no fused multiply/add. All arithmetic order,
including dot products/fade/lerp, must be frozen before fixtures. Exact native output
comparison is intended; no transcendental functions occur. Per query: four corner hashes (eight scalar mix evaluations) and
four dot products; O(1) state and work, no coordinate/point-list materialization.

## Evidence and admission

`2018/Generativos/pelines#0` justifies the scalar-field dependency of independent strokes.
It is not a whole noise-generator computation. Extract only that dependency; account for
grid placement, attribute mappings, segment/clipping, colour and opacity separately.
Related `field.angle` members must not be relabelled equivalent to pure noise.
`2019/generativos/ciserp#0` remains an integrated-path counterexample using a different
source, not an accepted merge. Existing `field.fbm` records remain visible and unresolved.

The report's detail experiment is RNG-confounded and does not approve a frequency range.
No seed or frequency recommendation is inferred. Root must inspect the complete example
and its parameter edits before calling the capability useful.

## Required challenge and verification

Sol: challenge seed/lattice hash symmetry and directional bias, range/rounding, operation
name, single-octave sufficiency and the distinction from host reproduction. Root will
resolve those questions before ledger admission and catalog creation.

Fixtures must include seeds 0,1,42,2^31,2^32-1; signed and fractional positions; lattice
and near-lattice positions; both coordinate-domain boundaries; repeat/reordered queries;
independent fields; serialization/ownership; invalid shape/seed/coordinate; intermediate
hash values and final exact scalars. Distinguish floor/abs/truncation, wrong gradient order,
host RNG, seed ignored, axis interchange, cubic fade, octave accumulation and wrong mapping.
No renderer or cross-target capability is claimed before actual native validation.

## Root resolution of Sol review

Accepted the ordered mixer, tighter raw/unit range, safe-lattice-corner domain, explicit
periodicity, descriptive gradient-noise name, seed-only serialization and scalar native
hot path. The range proof bounds each weighted absolute coordinate contribution by 1/2
using monotonic quintic fade with midpoint 1/2; their sum bounds raw magnitude by one.
Sol's bounded hash/derivative probes were smoke checks, not a statistical quality proof.

Retain unequal axial/diagonal gradient lengths as an explicit choice to test visually.
The registered four-render experiment is `evidence/parameter-experiments/cp1-noise-choice/`.
No public operation admission follows merely from this semantic review. Root will record
its direct visual decision. Processing's documented default is multi-octave; the pelines
note alone does not prove the absence of a source override, so exact source configuration
remains unverified. In either case this source is a declared independent algorithm.
