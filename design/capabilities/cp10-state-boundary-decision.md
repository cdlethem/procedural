# CP10 state ownership decision

Root selects a mutable, owned, fixed-size motion batch for the proposed native
workflow, before contract drafting. This selects architecture only; parameter
admission, public signatures, semantics and implementation remain pending.

The [options review](cp10-state-boundary-options.md) correctly identifies the
tradeoff: a sketch needs a continuing current state, while detached historical
values are useful only when explicitly requested. Preserve that distinction.
The expected allocation advantage is structural reasoning, not a benchmark result;
representative native per-tick allocation still requires measurement.

The batch owns current positions and velocities. An explicit step receives current
targets and advances once; reading values or drawing never advances it. Validation
must finish before computation can commit. Compute the complete next batch into
owned reusable scratch storage, checking arithmetic, then commit as one operation.
An invalid late input or late non-finite intermediate leaves every current value
unchanged. No accessor may leak a buffer that can later become writable scratch.

Input admission and per-tick calculation must avoid object parsing and unnecessary
allocation in inner loops. Exact target carrier/ownership rules are contract work:
they must prevent source aliasing and define when targets are captured. No claim of
thread safety or asynchronous target mutation is implied.

A snapshot/export must be detached and explicitly requested. Holding the mutable
batch is not holding a historical frame. The example may keep initial values and
construct a new batch for reset; do not add a redundant reset/history subsystem
until the contract walkthrough shows that it improves use. Recorded target events
plus explicit stepping provide replay. Pause means no step; frame rate is solely
an example playback policy, not an implicit integration timestep.

The portable behavioral specification can describe complete before/after state
values even though native execution uses mutable owned storage. Future recipes
can represent initial values and ordered inputs; this does not authorize a recipe
executor, persistence format or immutable history framework now.

The source's target-return and pointer policy remain outside the batch. Native
drawing can reuse current sites for independent marks or fixed indexed edges.
Changing colour, mark shape or wire treatment must leave the state untouched.

Contract work must now resolve numeric domains and error precedence, detached
observations, late-failure atomicity, zero-size behavior, bounded storage/work and
exact arithmetic/update order. The parameter experiment remains necessary before
exposing or recommending coefficients. No operation is admitted by this document.
