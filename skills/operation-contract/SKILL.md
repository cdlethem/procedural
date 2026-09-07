---
name: operation-contract
description: Define or change one approved portable operation before implementation. Use after a Phase 2 keep/merge decision and before changing code, fixtures, adapters, recipes, or public documentation.
---

# Operation contract

## Gate

Use this skill only after the completed-corpus Phase 2 process has recorded a keep or merge
decision for the candidate cluster. This skill does not authorize clustering candidates,
choosing the public API early, or turning one sketch's helper into an operation.

An operation contract is the behavioral specification. Java is the reference
implementation, not the specification. If a behavior cannot be stated in language-neutral,
JSON-compatible terms, resolve the design before implementation.

## Inputs

Read, in order:

1. the Phase 2 cluster decision and every candidate it merges or rejects;
2. motivating survey notes and relevant source lines;
3. parameter sensitivity records and any `evidence/parameter-experiments/` decisions;
4. related operation contracts, to reuse their data shapes, environment, errors, and naming;
5. `docs/portability.md` and the current catalog schema.

Run `skills/parameter-evidence/SKILL.md` when a public parameter, default, encouraged
range, or hard bound remains unsupported. Never fill an evidence gap with an intuitive
value.

## Contract contents

Create or update exactly one operation entry in the shared catalog. Do not create a second
hand-written schema beside it. The entry must define:

### Identity and provenance

- stable operation identifier and semantic version;
- Phase 2 keep/merge decision identifier;
- generator, transform, or sink role;
- concise description of what it computes, not how one host implements it;
- motivating sketch and notes paths;
- accepted and rejected candidate names subsumed by the operation.

### Portable data

- JSON-compatible input and output schemas;
- required versus optional fields;
- default resolution order;
- units for every numeric value;
- coordinate system, origin, axes, handedness, and angle unit;
- interval inclusivity and null/empty representation;
- stable representation for geometry, colours, commands, assets, and parameter objects;
- ownership and mutation: inputs immutable by default; output aliasing must be explicit.

Host types such as `PApplet`, `PGraphics`, `PVector`, `PShape`, `PShader`, p5 objects,
py5 wrappers, Android views, DOM objects, and AWT classes are forbidden in the contract.

### Behavior and numerics

Specify:

- operation order and observable iteration/command order;
- rounding, clamping, interpolation, modulo, overflow, and conversion behavior;
- floating-point comparison tolerance per output field;
- behavior for zero, empty, negative, non-finite, duplicate, collinear, and otherwise
  degenerate inputs that can reach the operation;
- stable error codes and which invalid inputs produce them;
- whether partial output is ever permitted;
- computational scaling and any evidence-backed resource bound.

Do not use a global epsilon. Exact integers, identifiers, topology, lengths, indices, and
bit patterns compare exactly.

### Explicit environment

Declare every external input the operation consumes:

- RNG algorithm/state or explicit compatibility RNG;
- noise algorithm/version and coordinates;
- time or frame value;
- assets and asset identity;
- pixel density and colour space;
- renderer and capabilities;
- fonts, text metrics, shader dialect, or third-party geometry support.

Core behavior must not read host globals. If the operation consumes randomness, noise,
time, iteration order, or portable floating-point calculations, apply
`skills/deterministic-generative-semantics/SKILL.md` before implementation.

### Parameters

For every public parameter record separately:

- semantics and unit;
- default, with provenance;
- encouraged range, only where visual evidence establishes one;
- hard validation bound, only where values are invalid, degenerate, or violate a measured
  resource constraint;
- values observed in motivating sketches;
- sensitivity and follow-up experiment provenance;
- behavior outside the encouraged range but inside hard bounds.

A source-code default is not automatically a recommended default. A `moderate` or `large`
pixel difference proves impact, not usefulness. A hard bound and an encouraged range are
not interchangeable.

### Portability and capability policy

List every supported target and required capability. Apply
`skills/capability-and-adapter-boundaries/SKILL.md` for P2D/P3D, shaders, fonts, images,
pixels, target storage, or third-party libraries. Unsupported targets/capabilities must
produce an explicit, stable result. A semantic fallback must have a distinct name or mode
and its own fixtures and benchmark evidence.

### Verification plan

Reference fixture identifiers for:

- schema and metadata validation;
- pure golden vectors;
- canonical geometry or command streams;
- target adapter integration;
- motivating corpus reproductions;
- relevant parameter boundaries, degenerate cases, fixed seeds, consecutive RNG states,
  invalid inputs, and explicit errors.

The plan states which comparisons are exact and every permitted field tolerance. Missing
required fixtures are failures, not exclusions.

## Review checklist

Before marking the contract ready:

1. Trace every public field to corpus evidence or a recorded design divergence.
2. Compare adjacent operation contracts; reuse established shapes and terminology.
3. Confirm the operation has one computation-level responsibility and composes through
   portable data rather than host callbacks.
4. Confirm no Java behavior is left for other ports to infer.
5. Confirm errors and degenerate cases are observable and testable.
6. Confirm target support and unsupported capability outcomes are explicit.
7. Confirm the fixture plan can distinguish a plausible wrong implementation.
8. Reject aliases, compatibility shims, and duplicated legacy paths; this project uses a
   clean cutover.

Only then proceed to `skills/portable-operation-implementation/SKILL.md`.
