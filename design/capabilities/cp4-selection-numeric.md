# CP4 `mosaic02` scheduler numeric check

This is a bounded numerical check of one source fact from the CP4 partition audit. It
does not render `mosaic02`, propose an operation, or decide a public parameter.

## Source and model

The checked source is
`2018/Generativos/mosaic02/mosaic02.pde` at upstream revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`, SHA-256
`d02a09f0179627ae7f358d26db41a5321555b11025959763da19162a40b7a2ff`.
Its relevant sequence is:

1. `randomSeed(seed);` then `background(rcol());`, which consumes one
   `random(4)` draw before any leaf choice.
2. Start with one rectangle, repeat 100 times, and choose
   `int(random(rects.size()*0.5))`.
3. Append equal children in top-left, top-right, bottom-right, bottom-left order,
   then remove the selected parent.

The independent tool confirms the pinned Processing 4.5.6 `PApplet` bytecode uses
`java.util.Random.setSeed(long)` for `randomSeed`, and `Random.nextFloat()` with a
binary32 multiplication for `random(float)`. It therefore models the source prelude,
the 48-bit Java RNG, float selection bound/product, integer truncation, append order,
and parent removal. It models neither filling, shading, ellipses, mesh construction,
nor pixels.

Run the check from the repository root:

```sh
python3 tools/diagnostics/cp4/run_selection_numeric.py
```

The generated machine-readable result is
[cp4-selection-numeric.json](../../evidence/investigations/cp4-selection-numeric.json).
It binds the tool, source PDE, source audit, source note, Processing core JAR, and
`javap` binary hashes.

## Results

For five fixed diagnostic seeds (`0`, `1`, `42`, `123456`, `999998`), both policies
performed 100 successful four-child replacements and retained 301 leaves. Their RNG
states remain identical after the loop: both consume the same prelude draw and one
selection draw per split. Their index choices and resulting live lists differ.

For every sampled seed, full-list selection (`fraction = 1`) produced a deeper tail
and a larger area-concentration score than first-half selection (`fraction = 0.5`).
For the baseline-pinned seed 42:

| fraction | retained depths | min / max normalized leaf area | HHI | ten largest leaves' area share |
| --- | --- | --- | ---: | ---: |
| 0.5 | 2–6 | `0.000244140625` / `0.0625` | `0.02723073959350586` | `0.4375` |
| 1.0 | 1–11 | `0.0000002384185791015625` / `0.25` | `0.09562546989263865` | `0.765625` |

The most extreme sampled full-list result was seed 999998: depths 1–15, a minimum
area of `9.313225746154785e-10`, HHI `0.18944855376830977`, and the ten largest leaves
holding `0.84765625` of normalized area. These are arithmetic properties of the
specified mutable-list schedule, not visual claims.

## Relation to the surveyed note

The surveyed note prose (SHA-256
`94598aad3ded856d78414ab21fd454aba3802612bb2a1abe0fa0f466ac0165c5`)
reports that replacing `0.5` with `1.0` made tile sizes look roughly uniform and removed
the huge-block/tiny-cluster mix. The bare leaf statistics above point in the other
direction for all five sampled source-seeded runs. That prose is not independently
verified visual evidence here: no original image was inspected. The discrepancy is not
resolved by this numeric experiment, and the complete P3D composition also includes
per-tile treatment and a later mesh that this check does not model.

The useful conclusion for architecture is narrow: append/remove list order and eligible
index fraction are independently observable scheduler semantics. Neither a visual
direction nor a public parameter choice follows from these depth and area metrics.

See [the CP4 source audit](cp4-partition-source-audit.md) for the source and note
provenance, including the composition confounds.
