# Delivery roadmap

Current Java feature-completion execution is tracked in [java-completion-plan.md](java-completion-plan.md).
Port integration is paused; the historical packet sequence below does not override that priority.

## Policy and intended outcome

The maintainer authorized Phase 2 on the 826/901-report snapshot, superseding the former
full-corpus start gate. Decisions carry evidence revisions and are reconciled as reports
arrive. An evidence gap blocks its dependent decision, not every work packet. Report
completion is not a substitute for evidence quality.

Delivery remains library-first, organized by artist capabilities rather than candidate count.
Develop working native examples alongside each capability. The maintainer now prioritizes
Processing Java breadth after CP3 contract/fixture closure; CP1/CP2 already established the
four-target route. New capabilities may ship on Java alone, with p5.js, py5 and Android
explicitly deferred to a later porting batch. Validate every support claim on its actual target. Persisted recipes, MCP and web remain downstream.
A scoped package may ship without exhaustive corpus reproduction. Define its capability and
reproduction acceptance before execution; preserve full-corpus certification as a separate
strict mode. The current benchmark tool's release mode still means full-corpus certification;
it must not be relabelled as scoped certification without a separately reviewed implementation.

During this buildout sprint, Sol reviews are paused at the maintainer's request. Root
reviews contracts, code and complete workflows directly, retaining shared fixtures and
meaningful Java/native validation. No external review handoff is a sprint gate.

This is a work specification, not a claim that downstream systems exist. `PROJECT_STATE.md`
records actual completion. `docs/agent-briefs.md` defines ownership and handoffs.

## Current architectural priority

Follow [artist-capabilities.md](artist-capabilities.md). Root owns CP1: a complete editable
field of independent marks, and reviews CP2: an integrated path with separate mark treatment
as its architectural counterexample. A gpt-5.6-sol reviewer challenges consequential choices;
Luna/Terra supply bounded evidence and frozen-contract work. The triangle sampler is optional
engineering work. Start from what a capability lets an artist do, not the easiest primitive.

Before D3, root records the capability's task, burden removed, alternatives, reusable result,
meaningful edits, transfer case, provenance and acceptance. Complete a conceptual example
walkthrough before freezing interfaces; validate actual usability with a runnable reference
example and later human feedback. Never call a paper walkthrough a successful user test.

## Work packets and acceptance gates

### E1 — Evidence identity, dossiers, and reconciliation

Inputs: public snapshot/index, all note paths, normalized SQLite, baseline/variant metadata.
Output: reproducible target inventory and one dossier per candidate record, with original
text, source hashes, parameters, variant references, and reliability warnings.

- Derive the target set from `generative: true` and `status: ok` index records; distinguish
  missing, unexpected, duplicate, stub, malformed, and stale evidence. Do not count attempts.
- Keep snapshot/sketch/ordinal identity and original records. Ordinals are not stable across
  edits: changed notes require renewed review of their candidate memberships.
- Distinguish sketch-level parameter/variant association from an established causal link.
  Flag malformed candidate-like parameters and missing or contradictory fields.
- Reconcile new snapshots by content hashes: added, changed, and removed records; affected
  decisions and fixtures; and explicit review outcomes. Never silently retain stale approval.

Acceptance: all current targets and candidate rows are accounted for, evidence ambiguity
is visible, and a normal clone can regenerate the inventory without images or private services.

### E2 — Benchmark completeness

Inputs: public evidence, database, external reference images, existing manifest and runner.
Output: strict manifest publication and distinct development/release evaluation.

- Reject missing/corrupt reference frames when building a manifest; compare discovered frames
  with recorded frame identities, preserving explicitly dropped-frame metadata semantics.
- Bind manifests to their evidence revision and content. Reject stale release evidence.
- Reject empty evaluations and filtered release runs. Report selected and full-manifest
  denominators separately; a selected pass never certifies the full corpus.
- Keep required unsupported cases visible as failures. Stub and suspect-shader exclusions
  remain explicit; missing references do not become exclusions.

Acceptance: incomplete reference inputs cannot replace a complete manifest, empty selections
cannot pass, and release certification cannot be obtained by selecting the easiest cases.

### D1 — Computation-level clustering and family review

Starts now; requires the E1 record identities, but unrelated data cleanup may run alongside it.
Output: an authored decision ledger, candidate memberships, and evidence review.

- Inspect candidate signatures/descriptions and motivating modularisation prose. Name matches
  are search aids, not proof of equivalence.
- Record keep/merge/reject, computation and output, rationale, motivating sketches, observed
  parameter union, reliability, and unresolved questions. Draft proposals remain distinct
  from reviewed dispositions. Every record must have exactly one final disposition before
  claiming exhaustive adjudication complete; that is not a scoped delivery gate. Family membership is provisional; resolve each final
  computation into an operation, recipe or explicit exclusion, accounting for extracted
  components separately. A family does not automatically become one public function.
- Review all families explicitly, especially flow-field, voronoi-delaunay, physics, l-system,
  and typography. Sparse evidence is not absence; one-off aesthetic choices remain outside
  the reusable core. Surface major family exclusions.
- The former 30–80 estimate is not a quota. Select the smallest understandable surface that
  enables the chosen capabilities, including useful conveniences. Review relevant neighbours
  deeply before broadening candidate coverage.

Acceptance: no orphaned or duplicate memberships; no final decisions inferred solely from
names; all rare-family dispositions and uncertainties are reviewable.

### D2 — Parameter adjudication and written API design

Requires reviewed D1 decisions for the affected operations. Output: written module layout,
naming, generator/transform/sink composition, parameter-object convention, minimal signatures,
target boundaries, deliberate exclusions, and an evidence-linked parameter decision queue.

Defaults, encouraged ranges, hard bounds, and whether to expose a parameter are separate
decisions. Apply the parameter-evidence skill when reliable observations are insufficient.
Moderate/large differences prove change, not usefulness; none/subtle may reflect masking,
time, or randomness. Do not invent a continuous range from isolated tested values.

Acceptance for CP1: a coherent whole-sketch design and meaningful edit tasks, with no unresolved
choices in the contracts being implemented. Review CP2's boundary before freezing shared
field/value abstractions. Other cases in `docs/api-design.md` guide expansion and are required
when their capability is claimed, not an all-family gate on the first useful package.

### D3 — Portable contracts and fixture conventions

Requires D2. Output: the authoritative catalog, canonical values/geometry/commands, explicit
environment, capability/error conventions, semantic versioning, fixture format, and recipe
composition/schema. Decide target packaging/toolchain compatibility and py5 bridging with
the actual operation requirements available.

Pass `tools/check_phase2_design.py --contract-cluster <id>` for recorded architecture and
member-audit prerequisites, then use the operation-contract and deterministic-semantics skills.
The check is structural eligibility, not semantic approval. Specify RNG/noise/time,
ordering, mutation, units, degeneracy, and per-field tolerances where relevant. Java and
other host types belong in adapters. A proposed signature is not a runnable contract.

Acceptance: each assigned operation has a reviewed catalog entry and expected pure/command
fixtures. Port agents do not need to invent behavior. Catalog-derived consumers have one
authority rather than parallel handwritten metadata.

### I1 — Build infrastructure and first four-target slice

Requires frozen D3 contracts for the smallest dependency-complete composition justified by
D1/D2, including value joins and explicit state order. Output: installable Processing JAR, p5.js package, py5
delivery, Android-compatible core/adapter, and reproducible native test entrypoints.

Implement fixtures, portable calculations, canonical commands, and native adapters in that
order. Select reproductions and acceptance profiles before tuning rendered output. Cover
ordinary/boundary inputs, deterministic state, target capabilities, and all required frames.

Acceptance: all four targets pass the slice's schema, pure, command, native, and visual checks.
Missing native runtimes/images are recorded as unvalidated dependencies, never passing mocks.

### I2 — Library and reproduction expansion

Current local delivery is fifteen workflows and fifteen operations in Java0.15.0,
accepted in `evidence/distribution/line-pool-review.json`. ReliefMarks adds a demonstrated structural
recreation of `momito`; CityMarks adds `ciscis002`, and LandscapeMarks adds `parapara`, all using existing operations. CP1 FieldMarks and CP2 PathMarks
retain their four recorded target scopes. CP3–CP11 expand Java with placement/filtering,
region subdivision, grain sampling, branching, radial-profile meshes, glyph placement,
Delaunay facets, spring motion and occupied lattice paths. GlyphMarks composes existing
operations; the other additions have their own scoped core and native evidence.
CutBranchMarks adds a separate mutable interior-cut line pool, validated in an editable
P2D workflow and a30-pool workload. This is scoped technique support, not a fourth whole-sketch
recreation claim. CP3–CP11 and line-pool ports remain deferred. Current implementation status comes from catalog validation
attestations; local archive acceptance does not imply registry publication or full-corpus
certification. CP12 remains deferred after the Java0.15 reconsideration; its missing traversal is not
counted as supported. The deferred port batch has begun with JavaScript circle placement
and ordered filtering; see [port batch 01](../design/port-batch-01.md).

Requires I1; implement operations in dependency order and schedule retained rare families
explicitly. Each operation carries docstrings, parameter evidence, capability support, shared
fixtures, and motivating reproductions. Treat failed reproduction as potential abstraction
failure, not automatically a threshold problem.

Sequence I2 as follows:

1. Close the CP3 placement contracts and fixtures, then deliver its Java implementation
   and editable Processing workflow.
2. Expand reusable operations and complete Java workflows by the new artistic tasks they
   enable. Root selects the next capability from decisive evidence; do not make exhaustive
   candidate adjudication or additional ports prerequisites for this breadth work.
3. Batch the deferred p5.js, py5 and Android implementations against the same frozen
   contracts and fixtures, followed by actual native workflow validation and packaging.
   Record contract changes once and apply them to all affected targets.

Maintain a separate full-corpus reproduction backlog. One-off artwork may remain in example
code; benchmark coverage must not inflate the public API. Preserve MIT notices and explicit
provenance for any upstream implementation used.

Acceptance: the selected capabilities meet their contracts, native example/edit tests and
predeclared reproduction suite on every claimed target. Scope and unvalidated capabilities
are explicit. Full-corpus certification retains its complete-suite rules; threshold overrides
still require repeated reference evidence.

### X1 — Recipes, execution, and project exports

The [root execution direction](../design/recipes/execution-direction.md) records the
current D3 gaps and first two composition walkthroughs. It is an architectural draft,
not an accepted schema, executor or exporter.

Requires D3 recipe schema and validated library behavior. Implement one validator/execution
contract followed by four target exporters. Recipes contain catalog operations, explicit
seed/canvas/time/assets/capabilities, and no arbitrary host-language code.

Acceptance: type/capability errors are precise; recipes round-trip; exported projects include
the recipe, required assets/runtime dependencies, and conformance metadata; installed exports
replay correctly in native targets.

### X2 — Templates, helper tools, and documentation

Begin native example/template and getting-started work with CP1, not after the entire library.
Publish visual claims only with evidence. Expand into seeded rendering, parameter sweeps, contact sheets, palette extraction/application,
catalog-backed references, getting started, and a techniques guide.

Acceptance: every template runs; a Processing user can install and modify a piece after the
twenty-minute introduction; useful ranges cite evidence; visual claims cite notes or inspected
renders supplied through the external evidence workflow.

### X3 — MCP, companion web, and prompt evaluation

Requires the catalog and X1 executor; follow the existing MCP/web requirements. Implement
evidence/catalog discovery, recipe planning/validation/mutation, bounded rendering, comparison,
and export. The browser uses isolated p5.js preview, schema-derived controls, provenance,
compatibility reporting, and four-target export.

Acceptance: protocol errors, cancellation/progress, and resource limits are tested. Prompt
evaluation covers semantic predicates, provenance, execution, cross-target behavior, visual
results, and every retained family; equivalent recipes are accepted. Recorded planner outputs
provide deterministic protocol tests; live-model quality is a separately reported distribution.

## Skill creation and work ownership

- Create generative-performance at I1 kickoff before the first performance-sensitive operation.
- Create catalog-surface-synchronization before D3's catalog first gains a generated/mirrored
  consumer; do not wait for MCP or web.
- Create recipe-execution-and-validation after D3 and before X1 accepts persisted recipes.
- Create prompt-to-recipe-evaluation after catalog/executor work, before X3 planning or its
  first prompt benchmark. Record each addition in the checkpoint.

One integration owner controls shared decisions, catalog, and fixture formats. Delegate
independent evidence work now; delegate target implementations only against frozen contracts.
Use one pausable Processing executor. Keep new temporary work under ignored `.work/` inside
this repository; use external survey images as read-only references and never add them to Git.

## Resume and change protocol

At each handoff record packet status, evidence/contract revision, owned files, verified tests,
unresolved questions, next assignment, and blockers. A new snapshot triggers E1 reconciliation
and targeted D1/D2/D3 review. Re-estimate effort after the reviewed operation inventory and
first four-target slice; do not invent a calendar forecast before their costs are known.
