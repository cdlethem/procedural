# Explicit frame context

Status: root-approved implementation direction for the draft recipe prototype. No general
animation, simulation, scheduler or cross-target executor acceptance is implied.

## Artist capability and boundary

Keep a sampled arrangement and change its marks as a function of explicit time. A saved
recipe snapshot may optionally contain `frameContext: {index, timeSeconds}`. `index` is a
nonnegative integer no larger than2^53-1; `timeSeconds` is a finite nonnegative binary64
number. Both fields are required when the record is present; no other keys are accepted.
These are engineering input domains, not measured artistic ranges. There is no default
clock, inferred rate, implicit delta, cumulative integration or relation enforced between
index and time. Repeated, skipped and out-of-order frames are valid snapshots.

After retained bindings finish, expose the detached record as `clock` to environment and
frame expressions. Retain expressions cannot access it. If a retained binding already uses
`clock`, adding frameContext fails as SHADOWED_NAME at /frameContext; never replace a user
binding silently. Without frameContext, the existing lexical behavior is unchanged and a
free `clock` reference is unbound. Environment and frame bindings cannot shadow it.

Frame context is excluded from retained cache keys because the retain stage cannot read it.
Static admission validates it before cache lookup, so invalid context leaves a prior valid
cache intact. Completed zero follows existing input normalization; no host clock is read.
Each evaluate call still emits exactly one atomic fresh frame with existing host limits.
The caller chooses and bounds any sequence. Mutable native instances remain unsupported.

The current exporter already seals the composition snapshot separately from parameters.
It must preserve this context in recipe.json and the compiled data resource; time changes
require a fresh export for now. Do not imply parameters.json controls the clock, that a
standalone export caches across launches, or that snapshot support is playback support.

## Bounded delivery and verification

Root owns schema/semantics, direct frame oracle and integration. Routine implementation
may be delegated against this direction. Use the established recipe harness: timed triangle
marks retain sampled points and vary length with explicit time. Compare zero, later, repeated
and backward time against direct-core commands, and verify warm retained reuse. Inspect
static rejection of missing fields, negative/nonintegral/out-of-range index, nonfinite time,
unknown keys, retain access and name collisions in Python and Java. Verify invalid-context
Session recovery. Export and inspect two explicit times under the shared native lock.
No new operation or accepted starter is added. Scheduling, stateful motion, assets and
other target executors remain later X1 deliverables.
