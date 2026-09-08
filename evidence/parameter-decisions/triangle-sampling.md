# Triangle sampling and stipple parameters

Status: authored D2 evidence decision, 2026-09-07. This file records evidence and
design divergences for the first-composition scope. It does not freeze an operation
contract, a public catalog entry, or a renderer support claim.

## Decision

The single-triangle sampler has enough computational evidence to proceed to a
language-neutral schema and pure fixtures. It takes exactly three supplied vertices and
one explicit stochastic state, and returns one point uniformly distributed over the
triangle using the square-root barycentric mapping described in `puntis2` and `puntis4`.
There is no corpus-supported numeric default or artistic range for the vertices: they
are caller inputs. A triangle with non-finite or degenerate vertices has no observed
behavior. The design decision for the eventual contract is to reject it with an explicit
error before consuming stochastic state; that is a recorded design divergence, not a
claim about Processing behavior.

The area-proportional stipple wrapper can proceed as a composition design: for each
triangle, calculate its area, derive an integer dot count from an explicit density, call
the sampler, and emit a dot command carrying explicit position, color, alpha, and mark
style. The corpus does not justify a wrapper default, encouraged density range, dot-size
default/range, or alpha recommendation. The wrapper must keep density, alpha, palette
selection, and mark size as separate questions. For a positive fractional `area * density`,
the Processing-style `int j = 0; j < limit; j++` loop executes `ceil(limit)` iterations
(at ordinary finite magnitudes), not `floor(limit)`; preserving that behavior is a
source-compatibility choice to record in the eventual contract, not yet an approved
portable semantic.

Mathematical schema bounds can be recorded now as design constraints: exactly three
finite coordinate pairs per triangle; density finite and non-negative; alpha in the
color representation's valid channel interval; and a count of zero emits no dots.
These are input-validity/resource decisions, not observed visual ranges. A hard upper
bound for density, dot count, or total work is not supported by this corpus and remains
an implementation/resource decision. Negative, non-finite, collinear, and coincident
inputs need explicit contract fixtures before implementation.

## Evidence identity and provenance

All four motivating notes are deterministic P2D reports at 960x960 with seed 42 and
successful frame-1 variants. SQLite confirms `sketches.deterministic = 1`, renderer
`P2D`, and the candidate/parameter/variant rows below. The note/source SHA-256 values
are:

| sketch | note/source SHA-256 | candidate provenance |
|---|---|---|
| `2018/Generativos/puntis` | `98ad640b63e2ec0872af61406743bd2b5852dd7744301ec74a337ebe0d75430b` | `reusable_candidates.ordinal=0`, `stippleTriangle` |
| `2018/Generativos/puntis2` | `a4b45e254cc656cb3aee8eb6bd6b7f1dfca0a23c56a182d71380ba8a73c09dfe` | `ordinal=0`, `stippleTriangulation`; `ordinal=1`, `randInTri` |
| `2018/Generativos/puntis3` | `9699082e346a3e7f22798f6a932e4c42df28c9435e922365ad2c3c7de59c7e9c` | `ordinal=1`, `stippleTriangle` |
| `2018/Generativos/puntis4` | `26cfb58cf0eb0ee9f544d5c410376f5cf3cb52d889f998f17d73326cbcf99ed2` | `ordinal=1`, `randInTri` |

The corresponding baseline `result.json` SHA-256 values are, in the same order,
`ed61d0c64c5230b317bdf0e25224770622e0f06ca242b8da1e65ff43c5fac5c8`,
`10528b39e793106fd62be15b4206ce2f1d836753b9e87e84299b4ae9a179a471`,
`d42dcfaab6d588134d19ceb7eaf10ddaef940503f893096c8739ad3a493b35f4`, and
`c5321b9e919a8d6cb40c0976716154c51c6a70ed3010c83c703d3894fc8b2874`.

The sampler evidence is explicit in the parent notes: `puntis2` lines 132–136 and
161–168 and `puntis4` lines 81–83 use `s1 = sqrt(r1)` and barycentric interpolation;
both modularisation sections identify this as uniform-in-triangle sampling. `puntis`
lines 131–138 and `puntis3` lines 74–85 use the same sampler while multiplying the
triangle area by a density. The sampler is therefore independent of Delaunay point
generation, palette choice, alpha, and drawing.

Palette order and mark style are not uniform across the four compositions. In `puntis`,
`stroke(rcol(), 90)` is called once per triangle (note lines 130 and 173–175), and the
triangle's dots inherit that one selected color and alpha. `puntis2` uses the same
per-triangle `rcol()` order (lines 115 and 171) while its `getColor()` helper is unused.
In `puntis3`, the Delaunay base fill chooses one palette color per triangle (lines 181–182),
but the stipple grain itself uses per-dot white/black selection at alpha 40 (lines
184–186). `puntis4` likewise selects a base color per triangle (lines 264–265), then
uses per-dot grayscale stipple and later noise-indexed palette overlays. Consequently,
the sampler has no palette order, and a wrapper must state whether color/alpha are
per-triangle attributes or per-dot mark attributes instead of silently copying one
composition's random consumption.

## Parameter-to-variant record

Every row below is a stored source substitution from `result.json`, run with seed 42,
frame 1, renderer P2D, status `ok`, and no result warnings. `result SHA` is the
SHA-256 of that variant's `result.json`; `frame MD5` identifies its stored frame. The
stderr warning `pixelDensity(2) is not available for this display` is present in these
headless runs; it is common to the baseline and variants and weakens claims about exact
pixel density, while the notes' visual observations and objective diffs remain the
available evidence.

| sketch / variant | exact substitution | result SHA-256 | frame MD5 | diff vs baseline |
|---|---|---|---|---|
| `puntis/alpha_220` | `stroke(rcol(), 90);` → `stroke(rcol(), 220);` | `343af48db89dd454f1591452caf1467518bd8e44f9985b91bc3a4f5f0d112473` | `61d2564cfe29beb7540fa06034b691d4` | moderate, mean .0965, changed .506 |
| `puntis/bb_0` | `float bb = 200;` → `float bb = 0;` | `c4ea37f438c184e24edf35c1db4f4a2c8891faa8490b076969d73cd11f77ac70` | `5e2efcbce1fa7a44a6cde71bed14c1d2` | moderate, mean .1312, changed .536 |
| `puntis/count_400` | `int cc = int(random(80, 1200*random(1))*random(1));` → `int cc = int(random(80, 400*random(1))*random(1));` | `9cade44b14d7c8a222be59097bf1be4be7d31d90491c61c0660e5ee617b2b9a9` | `7645727b65a4799988a651481e199d0e` | none, mean 0, changed 0 |
| `puntis/palette_gray` | `int colors[] = {#FF3E6D, #2C50FE, #F9FF60, #D036E9, #23778A};` → `int colors[] = {#111111, #666666};` | `492fc8f80b9c08c59c3af8ea6a4f9dd58ab604e5dd538af76f2053744707021f` | `577ab6b1690c67da772fc6723593da4d` | moderate, mean .0712, changed .265 |
| `puntis/stipple_4.0` | `for (int j = 0; j < area*1.1; j++) {` → `for (int j = 0; j < area*4.0; j++) {` | `8f7b8e4923971bfe008219d08b29075bb60162b8c0e242ad26f3f1c41070bfb1` | `024c413171c267578f07072c120384af` | large, mean .2045, changed .746 |
| `puntis2/alpha_255` | `stroke(rcol(), 90);` → `stroke(rcol(), 255);` | `22a3f2d9d1fd6d4a52b56c7c20c86f126f98bc3e38ea8f126531f0e83f57cee9` | `5176aac6fa8e90ad7f1a95cef5db6652` | moderate, mean .1145, changed .565 |
| `puntis2/bb_0` | `float bb = 200;` → `float bb = 0;` | `e9eb612637be146e56760cd4f45157ffa4bcb01860db9db809f34c671301f506` | `5e2efcbce1fa7a44a6cde71bed14c1d2` | moderate, mean .1312, changed .536 |
| `puntis2/bg_20` | `background(250);` → `background(20);` | `c9ee624b0f5ef5c4afc9d1c60fca961e4a4f4f81c82882f2330a5178ee7905b3` | `8c4e03cdb891e76da47226626f368ef4` | large, mean .6891, changed .999 |
| `puntis2/cc_400` | `int cc = int(random(80, 1200*random(1))*random(1));` → `int cc = int(random(80, 400*random(1))*random(1));` | `127cfdb2fd49306938f367a1ec94eb19d1e1e73bde13a8776077c0441b445e9f` | `7645727b65a4799988a651481e199d0e` | none, mean 0, changed 0 |
| `puntis2/density_0.4` | `for (int j = 0; j < area*1.1; j++) {` → `for (int j = 0; j < area*0.4; j++) {` | `1872de0226356c8bed47da1a9fd2bf2481cd5f3cf0ea0ab26c1084f881b9846d` | `ff367e458770c31e1ece7a3c049df82d` | moderate, mean .0962, changed .404 |
| `puntis3/cc_700` | `int cc = int(random(280, 2200*random(1))*random(1));` → `int cc = int(random(280, 700)*random(1));` | `a8ee78752ea9e44b9b629c13a37ff8b830224245a14996cec560b2068c4982a3` | `a56621a4335d87d6ae26500932d1ef56` | large, mean .193, changed .660 |
| `puntis3/ss_30` | `ss = random(20)*sca*12;` → `ss = random(20)*sca*30;` | `91b54f5be28c2796b33a6e2d6303fcbfb4cd83e9a4bdc0242fffe7a4c1db30b1` | `e3250cc6a01590829a82a2dbc02c9420` | none, mean .0077, changed .027 |
| `puntis3/stipple_6` | `for (int j = 0; j < area*2.1; j++) {` → `for (int j = 0; j < area*6; j++) {` | `1e9c68a98431715631e8d0e734f9f91404f5e12fc010c7c59d10e90d21792ba9` | `bbbc9e4608443b4fb6306003e5518532` | large, mean .1813, changed .765 |
| `puntis3/tint_255` | `tint(0);` → `tint(255);` | `cb700dc6144d7a8ab7ae222c9120432e3c9593f91cbf91401f51050ede6a16b0` | `e2d3c2ec008db22eb28c9cf3cb0640bc` | none, mean .0007, changed .003 |
| `puntis3/tris_300` | `for (int i = 0; i < 1000; i++) {` → `for (int i = 0; i < 300; i++) {` | `c499081dfb1fac33c20e991b697ec98e86cd34987c575c67628fdb49ee8691e2` | `091ff78c7bbad1260cdd6cde481917d3` | subtle, mean .0133, changed .042 |
| `puntis4/cc_1500` | `int cc = int(random(280, 2200*random(1))*random(1));` → `int cc = 1500;` | `1f46eed2cfd1c199c6cd730d266ab6a08790d21743f8b3271b60c519d92b840e` | `c35ed0e7b2c2ae7799223b685e2578d1` | large, mean .1867, changed .694 |
| `puntis4/figures_40` | `for (int i = 0; i < 18; i++) {` → `for (int i = 0; i < 40; i++) {` | `73e0967e4db289cf25b36755f64180519e579459cb9de7473ca0b9eecddfc9cb` | `771b4c94ad7ceee453acee8701628fed` | moderate, mean .117, changed .421 |
| `puntis4/haze_1.0` | `float alp = 255*constrain(noise(des3+cen.x*des3, des3+cen.y*des3)-0.1, 0, 0.6);` → `float alp = 255*constrain(noise(des3+cen.x*des3, des3+cen.y*des3)-0.1, 0, 1.0);` | `c96d7c034ef1cbe2aad21f425ea0fcd3a6dfc11e7d9139c3f22561ef86f1eb42` | `a38eda1b68488854507e6f2ff629efb9` | none, mean .0005, changed 0 |
| `puntis4/palette_cool` | `int colors[] = {#EC629E, #E85237, #ED7F26, #C28A17, #114635, #000000};` → `int colors[] = {#3A6EA5, #4C86A8, #62B6CB, #2E86AB, #114635, #000000};` | `032e42785e355aefae32c8341908fbd47045548fda8eb53490a282597e4745b3` | `fb9198a41aa6b32f5d055580707d17e9` | moderate, mean .1062, changed .520 |
| `puntis4/stipple_6` | `for (int j = 0; j < area*2.1; j++) {` → `for (int j = 0; j < area*6; j++) {` | `719b6a21ee9eb62df375d3fe43e1a6b39503bc3e56090eb9bdd935cb7f228a19` | `d7e450bee3a1b43d69084c7c3248f818` | large, mean .165, changed .654 |
| `puntis4/trees_20000` | `for (int i = 0; i < 80000; i++) {` → `for (int i = 0; i < 20000; i++) {` | `43f8b44003ba039d47aa9f9249f5620e54ab12232ed3e535399d371ce0520df1` | `ed25196773aced1153e0a0251269a353` | moderate, mean .1066, changed .459 |

Variant paths are the checked-in relative paths
`survey/out/2018/Generativos/<sketch>/variants/<variant>/result.json`; each row above
was cross-checked against the normalized SQLite `variants` table. The SQLite parameter
rows preserve the same defaults, tried values, labels, and observations. `puntis2` has
no normalized parameter rows because its frontmatter declares `parameters: []`, but its
five stored variants still provide direct substitution evidence.

## What the evidence supports

### Single-triangle sampler

`puntis2` and `puntis4` independently describe the same square-root barycentric mapping
and classify it as uniform inside a triangle. The input is three caller-supplied vertices;
the operation does not need a point-count, density, alpha, palette, triangulation, or
renderer parameter. The exact sampler transformation and stochastic-state threading can
therefore proceed to pure mathematical fixtures. The fixtures must test area uniformity,
reversed winding, collinear/coincident vertices, finite-coordinate validation, and exact
next-state behavior. The latter cases are not answered by the corpus.

### Density and count

Four density comparisons across four related notes establish effect but not a useful interval:

* `puntis` changes `1.1` to `4.0` and reports large change: triangles become near-solid,
  colors saturate, and the white ground nearly disappears (`mean .2045`, changed `.746`).
* `puntis2` changes `1.1` to `0.4` and reports moderate change: the stored note describes
  sparser stipple (`mean .0962`, changed `.404`).
* `puntis3` changes `2.1` to `6` and reports large change (`mean .1813`, changed `.765`);
  `puntis4` repeats `2.1` to `6` with large change (`mean .165`, changed `.654`). In both
  cases the stipple loop consumes the shared random stream, so downstream layers also
  move. The density effect itself is reliable, but the whole-image diff is confounded.

The observed defaults are `1.1` in `puntis`/`puntis2` and `2.1` in `puntis3`/`puntis4`.
They are sketch-specific literals, not a shared recommendation. The tested values show a
transition from sparse at `0.4` to visibly denser at `1.1`/`2.1` and near-solid at `4`/`6`,
but there is no controlled series on one composition that locates a readable interval.
Do not publish a default or encouraged range. A follow-up should isolate the wrapper's
random stream from site generation and compare at least two intermediate densities on a
fixed triangle set; it should inspect the dot field rather than only whole-composition
diffs.

The point-count substitutions do not answer stipple count: `puntis/count_400` and
`puntis2/cc_400` are pixel-identical because seed 42 already produced an effective count
below 400. `puntis3/cc_700` and `puntis4/cc_1500` are large changes to the Delaunay mesh,
with downstream random-stream movement. Point count and point margin belong to site
generation and are excluded from the single-triangle sampler.

### Alpha, palette, and mark size

Alpha is a visible wrapper/sink control: `puntis` 90→220 and `puntis2` 90→255 both report
moderate changes, with denser/saturated marks. That is enough to retain alpha as an
explicit input to a future mark command, but not enough to select 90, 220, 255, or any
encouraged interval. The mathematical color-channel interval can be a schema bound;
the visual recommendation remains unmeasured.

Palette substitutions (`puntis` five colors→two grayscale and `puntis4` warm→cool six
colors) change hue while preserving geometry. Palette selection is therefore a separate
operation/input and must not be folded into sampler semantics. The `puntis4` note confirms
that palette edits do not consume the random stream; density and count edits do, which is
why those confounds must be represented in future experiments.

All four notes use one-pixel `point()` marks. The `puntis3` `ss` experiment changes the
size of a separate dark-triangle scatter layer, not the stipple points, and is effectively
none (`mean .0077`, changed `.027`). The `tint` experiment similarly targets image
figures and is none. There is no evidence for a public stipple dot-size default or range;
keep mark size internal to the sink until a dedicated experiment isolates it.

## Proceed versus remain open

Proceed with the sampler's JSON-compatible mathematical shape, explicit stochastic-state
input/output, and documented design validation for three finite, non-degenerate vertices.
Proceed with a composition sketch that passes an explicit triangle and density, while
labeling density/alpha/mark values as experiment configuration rather than approved public
defaults. Record the source's area-times-density integer iteration as a design divergence
candidate and test the eventual rounding/zero behavior in pure fixtures.

Remain open on the canonical RNG, exact state normalization, degenerate-triangle error
code, density rounding and resource limits, alpha/color representation, dot size, and
whether the wrapper should be a public operation or a recipe/helper around sampler and
sink. No renderer pixels have been newly produced here; P2D evidence is corpus evidence
only and does not establish Processing, p5.js, py5, or Android adapter conformance.
