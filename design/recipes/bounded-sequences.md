# Bounded recipe sequences

Status: root implementation direction for a Java prototype host API. This is not a new
persisted recipe format, playback scheduler, simulation API or exporter acceptance.

## Contract and ownership

`RecipeSequence.evaluate(recipe, contexts, perFrame, total, maxFrames)` evaluates one
explicit finite list of frame contexts in list order. The recipe must already declare
frameContext; the supplied contexts replace that snapshot for each evaluation. Empty input
is valid after complete recipe/context/limit admission and returns zero frames. Contexts
follow the existing catalog frameContext schema. Repeated indices, repeated times and
backward time preserve list order; output identity is sequence position, not the supplied
index. Do not infer time steps, rate, intervening frames or integrate simulation state.

Detach and validate all inputs before the first frame. Use one private existing Session
for the sequence and clear it on exit. No caller cache or callback is exposed. Return an
immutable complete Result containing ordered immutable frame results, detached contexts
and aggregate evaluator counters. Publish no Result on failure; do not return a successful
prefix. Underlying RecipeFailure metadata remains available through SequenceFailure.cause
and the zero-based position is separately recorded (-1 for sequence preflight).
This is eager bounded command evaluation, not rendering or file publication.

## Limits

The caller supplies positive perFrame and total RecipeEvaluator.Limits and positive int
maxFrames; freeze both limit objects before work. Validate context count against maxFrames
and both arrayLength limits before copying. Reuse static JSON depth/value limits and the
catalog frameContext schema for all contexts, including late invalid entries. The base
recipe is statically admitted even for an empty sequence. FrameContext is required.

Reserve8*frameCount+16 value units for sequence containers, detached contexts and result
bookkeeping before execution. This is deliberately conservative, not a byte estimate.
For each frame pass the minimum of its per-frame limit and remaining aggregate limit for
visits, calls, work, iterations, valueUnits and commands. Subtract actual successful frame
counters with checked arithmetic. Array limits remain the minimum of both host limits.
A depleted aggregate counter fails before entering another frame, even if that frame might
consume none of that counter; this conservative rule is explicit. Warm retained capacity
is charged according to the existing Session policy, including repeat reservations.

Apply an overall elapsed limit from method entry, checking admission and each frame
boundary, and cap each frame's elapsed budget to the remaining duration. Elapsed time is
an operational safeguard, never artistic time. Outer process supervision remains required
for hard termination. Failure on a frame has its position; preflight or post-completion
budget failure uses the appropriate current position. No wall-clock-based skip/retry.

## Bounded delivery

Terra may implement RecipeSequence.java against this frozen host contract. Root owns static
context admission, independent sequence probes, counter/error review and integration.
Reuse the existing Java runner and timed-triangle oracle: zero/later/repeated/backward time
must match fresh evaluation exactly and retain geometry after the first frame. Probe empty
input, excessive count, late invalid clock, aggregate exhaustion after a valid first frame,
input detachment, explicit index identity, and preserved underlying failure metadata.
No native render is required for this command-only layer: exported sequence rendering,
per-frame artifact identities and incomplete-output handling are the next integration slice.
