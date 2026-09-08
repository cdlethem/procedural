# CP6 arbolito4 source audit

This is a source-and-record audit for a possible branching capability. It makes no API,
catalog, range, implementation, or rendering decision. It extends the endpoint-recursion
versus mutable-line-pool comparison in [branching-evidence-audit.md](branching-evidence-audit.md)
without repeating its `Arboles` or `brotes` inspection.

## Evidence identity

| item | identity |
| --- | --- |
| survey record | `2018/Generativos/arbolito4` |
| reusable candidate | `2018/Generativos/arbolito4#0`: `recursiveBranch(x, y, angle, spread, size, color, depth, branchProbs) -> void` |
| note | [notes.md](../../survey/out/2018/Generativos/arbolito4/notes.md), SHA-256 `d9fed9e20763c254e5ae4954995ab721684fdd98222f392dbe895479d1f6c899` |
| pinned upstream input | `69bdd8513e4482a5e6018e36887d4bc208660eb5:2018/Generativos/arbolito4/arbolito4.pde`, blob SHA-256 `cda8512f87103aaf75d4114fcfb1e33bf8e3c47fe77641df9aef77f42c492cc0` |
| renderer evidence | P2D, 960×960, seed field `seed=42`; baseline reports `deterministic: true` and three rerun frames. Every recorded run warns that `pixelDensity(2)` is unavailable on display `:2`. |

Line references below are to that exact pinned source, numbered by `git show` output.
The source is provenance and is not project code.

## Actual recursive computation

`generate()` reseeds the **global Processing** random and noise streams once, clears the
background, consumes four setup random values, then loops 120 roots (lines 24–42). It is
therefore not a self-contained tree stream: all earlier roots and the generator prelude
determine where each later root begins in the same random stream.

For root index `i`, the code computes `val=i/cc`, draws `cx=random(width)`, places `cy`
through `lerp(-0.1*height, 1.3*height, pow(val,1.2))`, and gives it
`(200-60*(1-val))*random(0.6,1)` before calling `arbol` (lines 35–41). `arbol` fixes
the root angle to `1.5*PI`, halves that length, overwrites the global `totalIte` with 8,
gets a noise-based size multiplier and colour coordinate, samples `ea` in `[0.4,0.6)`,
and calls `rama(x,y,a,ea,s*ms,c,8)` (lines 56–67). Noise supplies `ms` and `c`; it does
not make a branch-choice draw. `stroke(getColor(c),240)` is immediately overwritten by
`stroke(0)` (lines 82–85), so the active segments are black despite the colour argument.

Each entered `rama` call copies the start, advances one endpoint by its current angle and
length, and emits exactly one line before changing depth (lines 76–86). Its emitted width
is `8*(s*0.01)`, or `0.08*s`. It then consumes two random values for
`random(random(0.6,0.8),0.95)` and multiplies the length by that value (line 87). The
same shortened value is passed to every successful child; siblings do not get independently
sampled lengths.

The decrement follows the segment emission (line 88). In the normal supplied invocation,
entered depths are 8 down to 1: depth 1 emits, decrements to 0, and draws an orange tip
ellipse; it does not recurse (lines 90–100). There is no entry guard for zero or negative
depth: an externally supplied zero would still emit a segment, decrement to -1, and return
without a tip. This is source behavior, not a requested public edge-case policy.

For every parent whose decremented depth remains positive, child slots execute in fixed
order: left, right, middle (lines 96–100). Each slot first consumes one `random(1)` gate:

| slot | gate | child angle | extra random draws only if gate passes |
| --- | --- | --- | --- |
| left | `< 0.7` | `a-random(errAng*0.5,errAng)` | angle, then `c+random(0.2)` |
| right | `< 0.7` | `a+random(errAng*0.5,errAng)` | angle, then `c+random(0.2)` |
| middle | `< 0.4` | `a+random(-0.2*errAng,0.2*errAng)` | angle, then `c+random(0.2)` |

Thus a parent has 0–3 children, not necessarily 2–3. A failed slot consumes only its gate;
a successful slot consumes its gate, angle, and colour-offset draws before the recursive
call. The descendant then continues from that same global stream before control returns to
the next sibling slot. This order makes branch topology, angles, child colour coordinates,
and every later root dependent on all earlier gate outcomes.

`errAng=lerp(ea*0.3,ea,v)` uses `v=map(ite,0,totalIte,0,1)` **before** decrement
(lines 82, 89). With initial `ite=8`, the trunk has `errAng=ea`; the last branching level
has a lower multiplier. The code therefore narrows its angular error toward the tips for
this depth schedule. It does not support a claim that the active formula fans out more as
branches get thinner.

## Recorded substitutions and what they establish

All five variants ran successfully with the same stated seed, P2D profile, one retained
frame, and static duplicate drops at frames 10 and 60. The fractions below are recorded
pixel-difference metadata, not an independent visual inspection. The unavailable-density
warning is shared by baseline and variants, so it is a reproducibility qualification rather
than evidence of an effect.

| variant | exact one-occurrence substitution | mean / changed fraction | source-supported interpretation | important confounds |
| --- | --- | --- | --- | --- |
| `totalIte_12` | `totalIte = 8;//19  //int(random(8, 20));` → `totalIte = 12;//19  //int(random(8, 20));` | 0.2619 / 0.616, large | The active root depth assignment changed from 8 to 12. | Extra entered levels consume gates and conditional child draws. That shifts the global random stream for later siblings and later roots, so this is not an isolated depth comparison or a portable termination/range measurement. |
| `s_400` | `(200-60*(1-val))*random(0.6, 1)` → `(400-60*(1-val))*random(0.6, 1)` | 0.3292 / 0.655, large | It changes root scale before the `/2`, noise multiplier, branch shrink, line width, and tip diameter. | It leaves random-call count unchanged, but changes the index-dependent size gradient from `140..200` to `340..400` before the same random multiplier. It is not a direct per-branch length-factor experiment. |
| `ea_0.8_1.0` | `random(0.4, 0.6)` → `random(0.8, 1.0)` | 0.1410 / 0.374, moderate | It widens the per-root spread input used by all descendant angle offsets. | Each root still consumes one `ea` draw and branch gates do not depend on angle, so stream call count remains aligned; however, all 120 roots change and the depth-varying `errAng` rule remains coupled to the result. |
| `weight_20` | `strokeWeight(8*str)` → `strokeWeight(20*str)` | 0.1096 / 0.329, moderate | It changes emitted line style after geometry is computed. | It does not establish a topology, length, spread, or probability control. |
| `cc_40` | `int cc = 120;` → `int cc = 40;` | 0.1331 / 0.315, moderate | It reduces roots from 120 to 40. | It also changes `val=i/cc`, and therefore every retained root's vertical position and base length; it is not a count-only substitution. |

The notes' prose labels depth 8→12 “denser, busier”, the size substitution “larger”, and
the wider `ea` substitution “bushier”; those descriptions agree with the modified source
roles. The metadata establishes only the listed single seeded render differences. It does
not measure branch probability, per-node shrink distribution, child-slot ordering, RNG
consumption, a useful continuous range, or a portable default.

## Corrections and boundary relevance

The note's candidate shorthand says “2-3 recursive children”, but the active three
independent gates permit zero, one, two, or three. Its How-code prose says branches fan
out more as they get thinner; the evaluated `errAng` formula has the opposite depth trend
for this invocation. The frontmatter's `totalIte` default of 8 is operationally correct
only because `arbol()` overwrites the file-global initial value 20 on every root.

The source is an endpoint-attached recursive emitter: a child begins at the parent’s
already-emitted endpoint and nothing rewrites a prior segment. That supports treating it
as evidence adjacent to the audited recursive endpoint family, while keeping it distinct
from the audited `brotes` mutable line-pool model, which truncates and revises parents.
It does not by itself decide whether a future capability should return endpoints, segments,
or rendered marks, nor whether source-specific style, roots, stream prelude, noise sizing,
tips, and palette arguments belong in it.
