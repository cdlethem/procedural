---
name: deterministic-generative-semantics
description: Specify and verify portable randomness, noise, time, iteration order, and numeric behavior before implementing a stochastic or stateful generative operation.
---

# Deterministic generative semantics

## Trigger

Use this skill when an operation or recipe depends on any of:

- random values or shuffling;
- coherent noise;
- time, frame number, or animation state;
- iteration order that affects random consumption or command order;
- floating-point behavior likely to differ across Java, JavaScript, and Python;
- compatibility with an existing Processing render.

Determinism means the same declared environment and input produce the same specified
portable outputs. Pixel identity across renderers is a separate question.

## Choose the stochastic source explicitly

Every stochastic operation chooses one of two modes in its catalog contract:

1. **Portable:** use the library-owned algorithm and state format in every target.
2. **Compatibility:** use a named, versioned Processing-compatible algorithm when exact
   reproduction requires it.

Never silently use `java.util.Random`, Processing `random()`/`noise()`, JavaScript
`Math.random()`, Python `random`, or a target-global generator. Never seed a host generator
and assume its sequence is portable.

Specify:

- algorithm name and version;
- state as fixed-width integers or another exact JSON encoding;
- seed input domain and normalization;
- state transition;
- mapping from state bits to integer, unit interval, signed interval, and bounded samples;
- interval inclusivity;
- rejection sampling and retry behavior;
- shuffle order;
- state returned/consumed by an operation;
- whether zero or all-zero state is allowed.

Unsigned values crossing JSON or languages without matching integer types need a canonical
string or bounded-number representation. Do not rely on implementation-defined overflow.

## Preserve consumption order

Random output can match only if every port consumes the same sequence. Define:

- loop traversal order;
- branch-dependent consumption;
- whether rejected/culled elements consume values;
- random draws per element and their order;
- behavior for empty inputs;
- whether helper operations share, split, or copy state;
- returned next state.

Prefer explicit state threading. If stream splitting is required, define it and publish
vectors; do not derive ad-hoc child seeds from host hashes.

Do not optimize by reordering random draws, parallelizing stateful loops, or skipping draws
for invisible elements unless the contract explicitly permits changed output.

## Noise

Noise is a versioned algorithm, not a generic host facility. Specify:

- algorithm and permutation/gradient construction;
- seed application;
- dimensions supported;
- input coordinate and scale convention;
- interpolation/fade function;
- output range;
- octaves, falloff/persistence, lacunarity, and normalization;
- negative-coordinate behavior;
- periodicity where applicable;
- exact versus tolerated outputs.

Processing-compatible noise and the portable library noise are distinct sources even if
their APIs look similar. Reproduction cases must name which source they require.

## Time and animation

Time must be input data. Core operations must not read wall clocks, frame-rate estimates,
Processing globals, browser animation timestamps, or Android lifecycle clocks.

Specify:

- integer frame or time unit;
- origin and step;
- conversion to phase/seconds;
- looping and wrap behavior;
- pause/resume semantics where relevant;
- state carried between frames;
- reset behavior after context loss or re-execution.

Fixtures include consecutive frames and a nonzero starting frame. For accumulating work,
verify the state transition, not only frame 1.

## Numeric semantics

For every portable calculation whose result is observable, define:

- integer width and signedness where relevant;
- float precision expectation;
- promotion and conversion rules;
- floor, ceil, round, truncation, and tie handling;
- modulo/remainder for negative operands;
- interpolation and clamping order;
- angle unit and normalization;
- treatment of negative zero, non-finite values, and overflow;
- stable sort and tie-breaking;
- per-field comparison tolerance.

Do not demand bit-identical transcendentals across runtimes unless an implementation is
specified to make that possible. Where approximation is allowed, fixtures store the
expected value and a field-specific absolute and/or relative tolerance justified by how
the result is used. Topology, command count, indices, state bits, and identifiers remain
exact.

## Required golden vectors

Store language-neutral fixture data consumed unchanged by every port. At minimum include:

- canonical seeds including zero, one, a high-bit value, and the project example seed 42;
- initial state and at least ten consecutive state transitions;
- bounded integer and floating mappings at interval boundaries;
- several consecutive operation calls, not only the first;
- empty input and branch cases that consume different numbers of values;
- negative and large coordinates for noise;
- representative 1D/2D/3D noise samples when those dimensions are supported;
- consecutive animation frames and reset behavior;
- exact next-state assertions;
- explicit tolerances only for outputs permitted to vary numerically.

Run vectors in each native target. A wrapper around the Java result is not evidence that a
JavaScript or Python port has matching semantics.

## Diagnosis

When a fixture diverges, compare in this order:

1. normalized seed and initial state;
2. first state transition;
3. integer width, unsigned shift, and overflow;
4. mapping to float/range;
5. draw/consumption count;
6. traversal or branch order;
7. noise table/interpolation;
8. target transcendental precision.

Fix the earliest divergence. Do not compensate later output with a target-specific offset
or tolerance.

## Completion

Update the operation contract with the selected source, version, state representation,
consumption rules, numeric rules, and fixture identifiers. Then continue through
`skills/portable-operation-implementation/SKILL.md`. Reproduction acceptance remains a
separate visual check through `skills/corpus-reproduction/SKILL.md`.
