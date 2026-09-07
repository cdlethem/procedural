---
name: portable-operation-implementation
description: Implement an approved operation consistently across the portable core and supported target adapters. Use only after its catalog contract and fixture plan are complete.
---

# Portable operation implementation

## Preconditions

Do not implement from survey helpers, prose notes, or the Java version alone. Require:

- an approved Phase 2 keep/merge decision;
- a complete shared-catalog entry produced through `skills/operation-contract/SKILL.md`;
- resolved deterministic semantics where applicable;
- named pure and command-stream fixtures;
- explicit target capabilities and unsupported cases.

If any prerequisite is missing, finish it rather than creating a scaffold, placeholder,
compatibility shim, or host-specific temporary API.

## Ownership and delegation

One integration owner controls the catalog contract, shared fixtures, and acceptance
result. Once those are frozen, implementations for Processing Java, p5.js, py5, and
Processing for Android are independent slices and may be delegated to available local,
external, or remote agents.

Every port assignment receives the exact same:

- catalog entry and semantic version;
- fixture inputs and expected outputs;
- numeric tolerances;
- error codes;
- capability matrix;
- motivating reproduction cases.

Port agents may report a contract ambiguity but must not resolve it independently. Return
ambiguities to the integration owner, amend the contract and fixtures once, then resume all
ports. Do not let target agents silently choose different defaults, ordering, degenerate
behavior, or random streams.

## Implementation order

### 1. Schema and fixtures first

Add catalog/schema validation and pure golden vectors before algorithm code. Include:

- ordinary corpus-observed values;
- measured useful boundaries;
- empty and degenerate inputs;
- fixed seeds and consecutive RNG states where relevant;
- ordering and non-mutation checks;
- each stable error code;
- exact values where exactness is part of the contract;
- per-field absolute/relative tolerances for floating-point outputs.

A fixture must fail on at least one plausible semantic bug. Do not assert source text,
private class layout, incidental allocation strategy, or one host's formatting.

### 2. Portable core

Implement against plain scalars, arrays, records, geometry buffers, and canonical command
streams. The portable core must not import or retain host objects:

- no Processing or AWT/Swing;
- no p5/DOM/browser globals;
- no py5 wrapper state;
- no Android views, lifecycle state, or filesystem assumptions.

Pass environment dependencies explicitly. Preserve specified iteration and command order.
Do not use unordered containers where traversal changes output. Inputs remain unmodified
unless mutation is part of the catalog contract.

Avoid preventable work: no allocation, copying, parsing, reflection, or recomputation in
inner loops when storage can be reused without changing ownership or observable behavior.
Do not obscure the algorithm with speculative abstractions.

### 3. Canonical geometry and command streams

When the operation draws or emits geometry, verify before rasterization:

- command kind and order;
- vertex and index counts;
- topology and winding;
- transforms and coordinate space;
- colours, alpha, stroke/fill, and style state;
- push/pop or equivalent state balance;
- output-buffer ownership.

Command goldens are the primary debugging loop. Do not tune raster thresholds to conceal a
wrong command stream.

### 4. Target adapters

Build the smallest adapter that converts canonical output into native calls. Each adapter
must:

- negotiate required capabilities before execution;
- isolate and restore renderer state;
- map colour, transforms, density, text, assets, shaders, and lifecycle exactly as declared;
- return explicit unsupported-capability results;
- avoid duplicating portable algorithms;
- run integration checks in the actual target runtime, not a drawing mock.

Apply `skills/capability-and-adapter-boundaries/SKILL.md` for host-specific surfaces.

### 5. Reproduce and benchmark

Run `skills/corpus-reproduction/SKILL.md` for representative motivating sketches. Validate
static and animated frames required by the benchmark manifest. Rendering is serialized
through one pausable executor, especially while the survey is active.

A port is not complete because pure fixtures pass. It must either pass every applicable
adapter and reproduction case or record the target/capability as explicitly unsupported in
the catalog and reports.

## Failure handling

Classify failures before editing:

- **same pure fixture fails across ports:** contract or shared algorithm problem;
- **one pure port fails:** port semantic drift;
- **commands differ:** geometry/order/style-state problem;
- **commands agree but pixels differ:** adapter, renderer, asset, font, density, shader, or
  benchmark-profile issue;
- **all targets reproduce poorly:** challenge the operation abstraction or motivating
  recipe before weakening acceptance;
- **only a parameter boundary fails:** invoke `skills/parameter-evidence/SKILL.md` if the
  useful range itself is uncertain.

Fix the source of the discrepancy. Do not add target-specific constants, skip a required
case, average away a missing candidate, or loosen a global tolerance.

Every semantic bug adds the smallest language-neutral regression fixture that would have
caught it. Every port consumes that fixture unchanged.

## Completion

The operation is complete only when:

- catalog/schema validation passes;
- pure and command-stream fixtures pass in all claimed targets;
- native adapter integration passes;
- unsupported capabilities are explicit;
- motivating reproductions and complete applicable benchmark coverage pass;
- public documentation cites motivating sketches and evidence-backed parameter ranges;
- no obsolete aliases, duplicate schemas, temporary adapters, or unused code paths remain.

When recipe, MCP, web, and exporter surfaces exist, run the future
`catalog-surface-synchronization` skill before completion.
