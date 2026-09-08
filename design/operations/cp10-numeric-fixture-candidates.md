# CP10 spring-response numeric fixture candidates

This is a private numeric-fixture investigation for the target-response recurrence under
consideration. It is neither a public contract nor a recommendation of artistic defaults,
ranges, or an operation interface. The only source motivation is the `Point.update()` loop
in the pinned `2018/Generativos/araniaaas/Point.pde`; the proposed model deliberately
uses binary64 values and explicit validation rather than claiming Processing's binary32
behavior as portable.

## Proposed calculation under test

For each axis independently, with finite `position`, `target`, and `velocity`, evaluate
in this exact order, rounding each operation to binary64 round-to-nearest-even:

```text
delta        = target - position
force        = delta * strength
advanced     = velocity + force
nextPosition = position + advanced
nextVelocity = advanced * retention
```

There is no fused multiply-add, reassociation, or hidden `dt`. Test finiteness immediately
after `delta`, `force`, `advanced`, `nextPosition`, and `nextVelocity`, in that order.
For the proposed mathematical boundaries only, `strength` is finite and nonnegative and
`retention` is finite in the closed interval `[0, 1]`. These boundaries are safety/model
choices, not artist-facing settings.

A returned zero state component is canonical `+0`. Intermediates must retain their normal
IEEE-754 signs through subsequent operations: canonicalizing an intermediate `-0` earlier
would alter an exact-evaluation test. With finite `advanced` and the proposed retention
interval, `nextVelocity` cannot overflow, but it still needs the final finite check.

## Small exact success cases

All displayed bit patterns are IEEE binary64 in big-endian hexadecimal. Each tuple is
`(position, target, velocity, strength, retention)` for one axis. A two-dimensional
fixture can pair these independently by axis; keeping one-axis fixtures first makes the
arithmetic and failure stage hand-checkable.

| id | input | expected `delta`, `force`, `advanced`, `nextPosition`, `nextVelocity` | purpose |
| --- | --- | --- | --- |
| `rest-positive-zero` | `(0, 0, 0, 0.025, 0.7)` | all `+0` (`0000000000000000`) | equilibrium must remain still; specifically rejects an invented autonomous drift. |
| `source-shaped-first-step` | `(0, 100, 0, 0.025, 0.7)` | `100` `4059000000000000`; `2.5` `4004000000000000`; `2.5` `4004000000000000`; `2.5` `4004000000000000`; `1.75` `3ffc000000000000` | simple target disturbance, using the source-shaped coefficient only as a diagnostic value. |
| `source-shaped-second-step` | `(2.5, 100, 1.75, 0.025, 0.7)` | `97.5` `4058600000000000`; `2.4375` `4003800000000000`; `4.1875` `4010c00000000000`; `6.6875` `401ac00000000000`; `2.93125` `4007733333333333` | confirms order: position uses undamped advanced velocity, then retention applies. |
| `zero-strength-carries-velocity` | `(5, -10, 3, +0, 0.5)` | `-15` `c02e000000000000`; raw force `-0` `8000000000000000`; `3` `4008000000000000`; `8` `4020000000000000`; `1.5` `3ff8000000000000` | strength zero must disable force, not velocity transport; it also retains the sign of a raw zero intermediate. |
| `zero-retention` | `(0, 1, 0, 1, +0)` | first four values `1` (`3ff0000000000000`); returned velocity `+0` (`0000000000000000`) | zero retention does not suppress the current position advance. |
| `negative-zero-output-canonical` | `(1, 0, -0, +0, 1)` | `delta=-1` `bff0000000000000`; raw force and advanced are `-0` `8000000000000000`; position `1` `3ff0000000000000`; raw next velocity `-0`, returned as `+0` | separates raw operation signs from the required canonical returned state. |
| `minimum-subnormal-preserved` | `(0, 2^-1074, 0, 1, 1)` | all five values `2^-1074` (`0000000000000001`) | finite subnormal propagation. |
| `minimum-subnormal-underflow` | `(0, 2^-1074, 0, 0.5, 1)` | delta `2^-1074` (`0000000000000001`); force, advanced, position, velocity all `+0` | nearest-even underflow of the minimum positive subnormal times one half. |

The source-point experiment includes a target return before the force update. That policy
is outside this isolated recurrence. A future combined fixture should apply that return
in its own explicit preceding step, then use the cases above for the force/integration
kernel.

## No-FMA discriminator

Use the exact binary64 tuple:

```text
position = 0
 target  = 10000000000000000
velocity = -10000000000000000
strength = 1.0000000000000002
retention = 1
```

The separate operations yield:

```text
delta    = 10000000000000000       (4341c37937e08000)
force    = 10000000000000002       (4341c37937e08001)
advanced = 2                        (4000000000000000)
nextPosition = 2                    (4000000000000000)
nextVelocity = 2                    (4000000000000000)
```

A fused evaluation of `velocity + delta * strength` rounds the exact result once to
`2.220446049250313` (`4001c37937e08000`). This candidate therefore detects replacing the
two specified operations with FMA. It is an arithmetic adversary, not a plausible artistic
strength selection.

## Finite-input dynamic failure witnesses

`MAX` below is the largest finite binary64 (`7fefffffffffffff`). Every row uses finite
inputs satisfying the proposed coefficient boundaries. The designated stage must fail
before evaluating later expressions; no partial next state should be exposed.

| id | input `(position, target, velocity, strength, retention)` | first nonfinite value | required stage |
| --- | --- | --- | --- |
| `delta-overflow` | `(-MAX, MAX, 0, 0, 0)` | `MAX - (-MAX) = +infinity` | `delta` |
| `force-overflow` | `(0, MAX, 0, 2, 0)` | finite delta `MAX`, then `MAX * 2 = +infinity` | `force` |
| `advanced-overflow` | `(0, MAX, MAX, 1, 0)` | finite delta and force `MAX`, then `MAX + MAX = +infinity` | `advanced` |
| `position-overflow` | `(MAX, MAX, MAX, 0, 0)` | finite zero delta/force and finite advanced `MAX`, then `MAX + MAX = +infinity` | `position` |

There is no comparable finite-input overflow witness for `nextVelocity`: for a finite
`advanced` and finite `0 <= retention <= 1`, the exact product magnitude cannot exceed
`abs(advanced)`. The check is still required to make the stage order explicit and to guard
against an implementation violating the coefficient validation boundary.

## Static input-boundary candidates

These are structural input candidates, not dynamic arithmetic rows: negative strength;
negative, greater-than-one, `NaN`, and either-sign infinity retention; `NaN` or infinity
strength; and nonfinite position, target, or velocity. They should reject before this
kernel starts. Accepted `-0` where a zero-valued state or strength is permitted should
normalize at the public boundary rather than create a distinct motion state.

## Limits of this investigation

These values establish only arithmetic fixtures for an independently specified binary64
kernel. They do not decide how a retained collection is owned, whether target-return or
pointer input belongs in a future operation, the drawing representation, frame-clock
semantics, or any usable visual control range. The original Processing point code is
binary32/PVector based, has mouse input and target return, and is not evidence of an
identical binary64 implementation.
