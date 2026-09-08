# Grain / point-texture evidence audit

This is a factual input to a possible next capability decision. It does not admit an
operation, select a public signature, preserve a source RNG, or claim a renderer result.
No new image was rendered for this audit.

## Evidence identity

The three surveyed sources are deterministic P2D reports at 960×960. Their candidate
and note identities are:

| source record | candidate / current triage | note SHA-256 | candidate evidence SHA-256 |
| --- | --- | --- | --- |
| `2018/Generativos/puntis#0` | `stippleTriangle`; `mark.stipple`, proposed keep | `98ad640b63e2ec0872af61406743bd2b5852dd7744301ec74a337ebe0d75430b` | `d06ada2d7b1ba40958706d8aa596a00afe61242c8d36af7f1f52dd785b9014f9` |
| `2018/Generativos/puntis2#0` | `stippleTriangulation`; unresolved whole composition | `a4b45e254cc656cb3aee8eb6bd6b7f1dfca0a23c56a182d71380ba8a73c09dfe` | `61df2a3b1d8c3ee3f3abc0ffaa2cceaf273b5cb7227786434ab92cdd9acd21a1` |
| `2018/Generativos/puntis2#1` | `randInTri`; reviewed uniform-triangle sampler | same | same |
| `2018/Generativos/puntis3#1` | `stippleTriangle`; `mark.stipple`, proposed keep | `9699082e346a3e7f22798f6a932e4c42df28c9435e922365ad2c3c7de59c7e9c` | `ae90e11c37f949b9d5ff1f820c14fbd2a9d0650227a0b2c5bc43433c8cd06931` |

I read the exact upstream PDE files from the existing local checkout at
`69bdd8513e4482a5e6018e36887d4bc208660eb5`:

| PDE | SHA-256 |
| --- | --- |
| `2018/Generativos/puntis/puntis.pde` | `e58a65c8f7794bb85f4fdd3747d9a17f95711354d4314e3862bdb6f72f804335` |
| `2018/Generativos/puntis2/puntis2.pde` | `e58a65c8f7794bb85f4fdd3747d9a17f95711354d4314e3862bdb6f72f804335` |
| `2018/Generativos/puntis3/puntis3.pde` | `abe82f16a6b1a4f28aa442fad0340ba8c325f994127babebcdc0df6fd43868c3` |

`puntis` and `puntis2` are byte-identical at that revision. The checkout's upstream MIT
LICENSE hashes to `98abe149fa5183cb8edbcaac0a4bc3a7d01218f63e4fee5d779c05ecbb119dc4`.
The upstream source remains provenance only.

## What executes in the two source families

### `puntis` and `puntis2`

At lines 54–68, each `generate()` call first rerolls `seed`, samples `cc`, and samples
the Delaunay site positions. Only after triangulation does line 73 call
`randomSeed(seed)`. The reset therefore governs the later triangle styling/stipple stream,
not the `cc` or site-position draws that formed the mesh. This is direct source evidence;
the `puntis2` note's statement that all point positions are under the reset is not true of
the pinned PDE.

After the reset, lines 78–79 consume three setup draws (`amp1` uses two and `amp2` one).
For every triangle, line 130 consumes one palette draw through `rcol()`. The loop at
lines 131–138 then consumes **three draws per emitted dot**, in this exact order:

1. `random(1) * random(1)` for the value later square-rooted;
2. `random(1)` for the second barycentric-like coordinate.

The actual loop condition is `int j = 0; j < area * 1.1; j++`. For finite positive
non-integral `area * 1.1`, it emits `ceil(area * 1.1)` dots, not floor. A zero or negative
limit emits none; `NaN` also makes the comparison false. The source contains no validation
for degenerate vertices, non-finite coordinates, a non-finite Heron area, or an excessive
count. An extremely large positive limit also has the ordinary Java `int` loop-overflow
hazard rather than a resource policy.

The executed loop is not the standard uniform square-root barycentric sampler despite its
surface form: its first value is a product of two uniform draws before `sqrt`. The unused
`randInTri()` helper at lines 161–168 does use one uniform `r1` and one uniform `r2`; it
cannot establish the distribution of the executed stipple loop. Thus “uniform” is source
supported for the helper, while the active `puntis`/`puntis2` grain loop needs an explicit
distribution decision before it can be reused as a generic sampler.

### `puntis3`

`puntis3` has the same reset boundary: lines 29–43 reroll the seed and construct sites,
then line 48 resets randomness after Delaunay triangulation. Its site-y expression on line
40 additionally contains two nested random bounds, so it is not a simple rectangular
site sampler.

For every triangle, line 62 takes one base-fill palette draw. The grain loop at lines
75–85 uses `area * 2.1`, hence the same finite-positive ceil rule. It consumes **seven
draws per dot** before the point:

1. three draws for the pre-stroke brightness product;
2. one draw for `dd`;
3. two draws for the product that forms `r2`;
4. one fresh draw for the square-rooted `r1` used in the coordinates.

The coordinate `r2` is not uniform: it is a product whose first factor's lower bound is
chosen by `dd`. The point distribution therefore differs from both the standard helper and
the active `puntis`/`puntis2` loop. Changing its density changes all later random work:
the 1,000 dark triangles (lines 109–119), 100 squares (122–132), and 100 image picks
(135–142) move in the same stream. The grain loop also has the same unguarded Heron area,
degenerate/non-finite, and count-overflow issues.

## Measured controls and their limits

The checked-in reports give direct composition evidence, not portable grain semantics:

| source / edit | measured result | what it establishes | material confound |
| --- | --- | --- | --- |
| `puntis`, density `1.1 → 4.0` | large; changed `.746` | more emitted dots visibly make facets near-solid | alpha compositing and complete mesh composition remain present |
| `puntis2`, density `1.1 → 0.4` | moderate; changed `.404` | lower density visibly reduces the field | no parameter frontmatter; full triangulation composition |
| `puntis3`, density `2.1 → 6` | large; changed `.765` | the loop count is artistically consequential | consumes extra draws and reshuffles all later overlays |
| `puntis`, alpha `90 → 220` | moderate; changed `.506` | alpha changes texture appearance | alpha is mark/raster style, not point placement |
| `puntis`, margin `200 → 0` | moderate; changed `.536` | site overhang changes mesh coverage | belongs to site generation, not grain in a supplied triangle |
| `puntis3`, `cc` edit to 700 | large; changed `.660` | site count changes mesh scale | source samples sites before reset; not a grain parameter |
| `puntis3`, dark triangles `1000 → 300` | subtle; changed `.042` | dark overlay count is separately visible | it runs after grain and is unrelated to a supplied-region sampler |

`puntis`/`puntis2` count-400 variants are pixel-identical at the recorded seed because the
effective count was already below 400. They establish no useful count range. The observed
`1.1`, `2.1`, `4`, and `6` are discrete sketch/experiment values only; they do not justify
a default, encouraged range, count cap, dot size, alpha, or palette policy. The existing
[triangle sampling parameter decision](../../evidence/parameter-decisions/triangle-sampling.md)
reaches the same no-range conclusion and already records the source-style ceil behavior as
a future contract choice.

## Transfer boundaries and unresolved points

Direct evidence supports separating these responsibilities:

- a supplied-region point generator from Delaunay site construction and triangle ordering;
- a deliberate stochastic stream from palette/overlay/image streams;
- emitted point coordinates from colour, alpha, mark size, and raster behavior;
- bounded count/resource behavior from the source's open-ended float-condition loop.

The three active grain loops are not interchangeable evidence for one exact stochastic
primitive: they differ in first-coordinate distribution, second-coordinate distribution,
draw count, colour timing, and downstream stream coupling. A future capability decision
must choose whether it wants the reviewed standard two-draw helper, a separately specified
biased texture sampler, or only a deterministic count-to-points mechanism. It must also
state degenerate/non-finite handling, rounding/count behavior, work bounds, stream state,
and whether per-dot mark attributes belong outside the operation. Those choices are not
made by this audit.
