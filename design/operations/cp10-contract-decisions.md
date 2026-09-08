# CP10 contract decisions for drafting

Root records the following decisions after operation admission and the completed
parameter investigation. They guide the single forthcoming catalog entry; this
prose is not a second schema or an implementation approval.

## One transition, with native retained execution

The portable operation transforms a complete state and a target list into a new
complete state after exactly one logical step. The state is an ordered list of
bodies; each body supplies a position pair, velocity pair, spring strength and
velocity retention. All values are explicit. Targets are a separate same-length
ordered list of pairs. Output preserves body order and coefficients, replacing
positions and velocities only. It is usable as the next input without a conversion.

The native batch factory imports this state once and owns its arrays. Repeated
steps mutate that batch only after complete success. A snapshot returns detached
complete state; importing a snapshot supports mid-sequence replay. The operation
specifies the transition independently of this storage choice. No implicit tick
counter, elapsed time, reset cache or persisted recipe executor is added.

Per-body retention preserves the source's differing per-instance response. Allowing
per-body strength is a design generalization of the same independent recurrence:
a batch is a collection of independent systems, not a hidden shared force. This
adds no new force law. Uniform examples explicitly repeat their chosen values;
there are no scalar/array union schemas, broadcast sentinels or automatic defaults.
A separate public uniform-construction convenience must earn its place through
actual example use; it is not needed to specify these semantics.

Coefficients remain fixed within a native batch. To change them while preserving
motion, export state, edit coefficients and create the replacement batch. This
makes the edit explicit without adding an atomic reconfiguration subsystem before
there is a measured need. Target changes remain the normal allocation-free frame
path. No position/velocity teleport setters are included in the first interface.

## Selected numeric model

Positions, velocities and targets are finite binary64 pairs in the caller's shared
coordinate system. Strength is finite and nonnegative; retention is finite in
[0,1]. These are model boundaries: nonnegative strength accelerates toward a
target, while the selected retention keeps or discards updated velocity without
inverting or amplifying it. Negative attraction and velocity amplification are
outside this operation. The parameter experiment supplies no artistic recommended
range or default, and these mathematical domains must not be labelled as one.

There is no stability or convergence guarantee across all admitted coefficients
and target sequences. In particular, retention1 can preserve oscillation. Do not
silently clamp, subdivide a step, infer elapsed seconds or impose an unproved
stability interval. Document illustrative tested values separately.

For each body in order, compute the entire x-axis transition, then y, with each
primitive operation rounded separately to binary64 nearest-even:

- delta = target minus current position;
- force = delta times strength;
- advanced velocity = current velocity plus force;
- next position = current position plus advanced velocity;
- next velocity = advanced velocity times retention.

Check each intermediate for finiteness immediately. Do not reassociate or fuse
multiply/add; do not skip delta/force when strength0 or next-position calculation
when retention0. Normalize input and completed-output zeros to positive zero;
intermediate signed zero and gradual underflow follow binary64. No transcendental
function or tolerance is needed for this recurrence.

## Validation and atomicity

Validate the complete passive input before performing any recurrence. For the
portable transition: outer exact keys, complete state, complete target list and
matching size, then arithmetic. State validation visits bodies in order, position
x/y, velocity x/y, strength, retention. Boolean/string/nonfinite carriers are not
numbers. An invalid late target beats an earlier body's would-be overflow.

Arithmetic visits body index first, x before y, then the five stages above. An
arithmetic error identifies body index, axis and stage. Native current state and
coefficients remain unchanged on every failed step, even if earlier bodies have
already produced prospective values in scratch. Invalid output/access buffers
similarly perform no partial writes.

Native fast stepping accepts a flat binary64 target buffer of exactly2N values,
matching target pairs in body order. Capture and validate all values into owned
reusable target storage before recurrence; never retain the caller's buffer.
A canonical-list stepping entry must obey the same semantics. Both paths compute
into reusable next-state scratch and commit only after all bodies succeed. No
per-body map parsing, allocation or result object is permitted inside the numeric
loop. Passive input ownership excludes simultaneous mutation during a call and
promises no thread safety.

## Size and interface scope

N may be zero; an empty state still requires empty targets and performs no numeric
step. The shared representational ceiling is floor(2147483647/6)=357913941 bodies,
so a packed six-scalar state representation remains signed32-indexable. This is
not a feasible-allocation promise, performance result or artistic count range.
Host allocation failure stays a host resource failure. One explicit step authorizes
O(N) work; no retry or open-ended convergence loop needs a separate work budget.

The first Java interface should follow existing create/size/At/Into/toValues
conventions: import state, step using canonical or flat targets, observe position,
velocity and coefficients, and export detached state. Safe integer index errors
and atomic Into writes follow existing operations. Exact signatures, field names,
error codes, carrier dispatch and source links belong in the catalog before code.

## Required distinguishing evidence

Shared fixtures must include at least ten consecutive transitions with nonzero
initial state and changing targets, exact mid-sequence state restoration, empty
and duplicate/coincident independent bodies, heterogeneous coefficients, strength0,
retention0/1, negative-zero normalization and subnormal results. Include finite
input overflow at delta/force/advanced-velocity/position stages, body/axis precedence,
static-invalid-late-target precedence, and a multiply/add fusion counterexample.
Finite advanced velocity times retention in[0,1] cannot overflow, but its output
still undergoes the specified finite check. Do not invent a purported reachable
retention-product overflow fixture.

Native checks must separately establish deep construction/export detachment,
late-failure atomicity across a continuing batch, reusable target-buffer capture,
all canonical/flat stepping paths, safe-index boundaries and Into sentinels. A
fixture runner that constructs a fresh batch for every expected state cannot alone
prove continuing-state behavior. No implementation is authorized until the exact
catalog and shared fixtures have passed root review.
