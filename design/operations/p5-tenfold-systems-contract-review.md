# Generative systems contract review

Root approves ten p5 implementation contracts after reviewing the complete systems
draft, typed schemas and analytical success/error scenarios. The reviewed catalog
entries supersede the proposals. Root checked reaction and wave consecutive states,
narrow-grid wrap multiplicity, rule-bit order, token/stack transitions, predecessor
discovery and branch-dependent LCG consumption and work budgets.

RK4 consumes an explicit bilinear vector grid. CLAMP clamps field samples while
allowing retained path coordinates outside the grid; STOP returns the completed
prefix when any stage or final point leaves it. Represented extent collapse has
an explicit error. Root resolved endpoint evaluation to skip unused row/column
interpolation arithmetic while still statically validating every supplied value.
The added large-finite endpoint fixtures distinguish that decision from accidental
overflow in unused interpolation branches. Nonconstant-field convergence remains
a separate numerical implementation check; constant fields alone cannot prove RK4.

Gray–Scott and damped-wave calls each advance one synchronous state. Their shared
four-neighbor Laplacian uses physical spacing and explicit boundary multiplicity.
Chemical values and wave amplitudes remain signed and unclamped; no stability
range is inferred. Wave pins require zero supplied displacement/velocity. Life-like
rules and elementary cellular rules remain separate totalistic versus ordered
neighborhood computations. Curl defines a rotated finite-difference gradient,
without claiming sampler-independent exact incompressibility.

Parallel token rewriting and geometric interpretation remain substitutable stages.
UTF-16 tokens are not characters to split implicitly. Turtle movement, heading,
stack capacity, final balance, source indices and zero-length draws are explicit.
Exact fixtures separate stack/heading behavior from trigonometric approximation.

Tile collapse uses minimum domain cardinality, weighted choice and deterministic
arc propagation. It performs no backtracking; CONTRADICTION is a failed greedy
assignment and does not prove unsatisfiability. DFS samples a reproducible depth-first
tree, not a uniform spanning tree; even forced moves consume the declared draw.
Both use explicit returned uint32 LCG state without global randomness or retries.

Every operation specifies passive inputs, detached output, complete static validation,
finite arithmetic, exact ordering and bounded work or output capacity. Other ports,
general solver guarantees, hidden obstacle solvers and automatic simulation tuning
are excluded. Two original studies per operation must demonstrate editable controls,
retained-output reuse, bounded replay, native reset/reload/save and reviewed images
before scoped support acceptance. No corpus recreation credit is added by this review.
