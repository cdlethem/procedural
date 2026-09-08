# Root error-order and reachability review

The frozen private oracle is evidence for the specified transition, not a production
implementation. Root independently ran three additional precedence cases in
.work/diagnostics/line-pool/precedence/results.json:

- seed20,maximum finite angle,cap1: spread_negative overflow occurs before capacity check.
- invalid cap536870912 with zero work and extreme finite endpoints: INVALID_INPUT occurs
  before zero-work return, not distance overflow or successful output.
- short root,maximum finite angle,cap1,two attempts: success with two skips and four words;
  no angular arithmetic or capacity failure on skipped selections.

Eight manual cases separately establish zero/short-root behavior and difference/square/sum
overflow and tiny squared-length underflow. First-choice vectors and capacity outcomes are
independently reviewed in line-pool-oracle-review.json.

## Reachability rather than synthetic impossible errors

Difference and square/squared-sum overflows are reachable from finite endpoint inputs.
First-cut spread multiplication can overflow when the unbounded finite scale multiplies
an independently sampled factor greater than one; seed20 proves negative-spread failure.
After finite squared sum, length<=sqrt(MAX_FINITE), so multiplying remainder by at most1.2
cannot overflow. length_positive/negative/straight/repeat checks are defensive invariants,
not grounds for inventing fixtures that cannot arise from valid inputs.

Heading is atan2 in[-pi,pi]. Adding/subtracting this small heading to a finite sampled
spread cannot overflow at the top of binary64: the small addend is far below half an ulp
there. Repeat and straight turns are bounded. Trig outputs have magnitude<=1, so child
coordinate deltas cannot exceed their finite length. Cut deltas are at most .8 of already
finite differences. These stage checks still localize implementation errors and protect
future reviewed changes, but need not each have an artificial reachable-failure vector.

Cut positions interpolate finite endpoints. Child positions add length-scale deltas whose
magnitude is limited by the earlier finite squared-length check. Near MAX_FINITE, such
deltas are many orders below one ulp, so addition rounds back to the original finite value;
away from that magnitude the finite headroom dwarfs the possible delta. Endpoint overflow
is therefore not established as reachable under this version's length policy. Do not
weaken earlier length checks merely to make endpoint-error coverage attainable.

The current numeric rule deliberately differs from robust hypot: tiny squared lengths can
underflow and skip; extreme squared lengths can fail. This is documented and fixture-bound,
not silently repaired in a port. Source-scale artistic validation remains a separate step.

Next catalog review should preserve exact typed errors, static validation and access/write
ownership tests. JSON schemas alone do not validate nonfinite host values, boolean coercion,
or atomic writes; those remain native implementation acceptance requirements.
