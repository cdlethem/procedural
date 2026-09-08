# Triangle grain recipe binding

Status: implementation draft using accepted `sampling.seeded-triangle-points-2d`.
No new operation, starter acceptance or original-sketch recreation is implied.

The artist supplies three ordered vertices and a point count. The accepted sampler owns
uniform-area sampling for nondegenerate triangles; the recipe paints short round-capped
segments at the resulting points. Count is explicit, with no hidden area-to-density rule.
Changing mark length, stroke width or palette leaves sampling independent. Seed, count and
triangle changes invalidate retained geometry. Example count2400 and mark length1.5 are
composition choices, not measured recommended ranges. Motivation and design divergence
remain in the accepted triangle sampler contract (including the unused source helper).

## Accounting and validation plan

Construction calls `TrianglePoints2D.seeded(input)` after catalog input validation. For n
points, reserve2n+16 units: packed output2n, temporary triangle6, array containers and fixed
instance/stream state. Check max(6,2n) array length before the call, including zero count's
triangle temporary. Work reservation32+128n is a conservative binding work quantum for
seed expansion, two stream draws, square root and four bounded interpolations per point;
it is not an elapsed-time or exact instruction measurement. Catalog count<=1073741823
keeps every calculation within signed long. No output-sized temporary grows incrementally.

`toValues()` materializes one record, one list and n pairs:3n+2 value units. Reserve4n+3
work units and check n and pair length2 before calling it. Native validation has only
static INVALID_INPUT; preserve its code if raised. Finite degenerate or extreme triangles
are accepted by the core's clamped interpolation; do not add area rejection.

Compare every emitted command against a direct-core oracle for baseline, mark length,
palette, seed, count, triangle replacement and zero count. Verify Session reuse for style
and invalidation for all sampling inputs. Focused probes cover packed-array, value and work
limits, the representational count ceiling, and a malformed nested vertex at zero count.
Then export/render default and longer-mark/alternate-palette previews under the shared
machine lock. Root must inspect them before recording native preview success.
