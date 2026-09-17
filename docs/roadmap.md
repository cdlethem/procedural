# Delivery roadmap

[PROJECT_STATE](../PROJECT_STATE.md) records what is accepted and the active assignment.
[AGENTS](../AGENTS.md) defines standing rules. This roadmap records remaining product work;
it does not automatically launch a new batch or reopen completed Java milestones.

## Delivered foundation

Evidence ingestion, the language-neutral catalog, shared fixtures, Java operations and
artist workflows are implemented. The scoped Java implementation objective is
[accepted](../evidence/distribution/java-completion-review.json). The requested p5 feature
branch is [integrated](port-integration-status.md). Target support remains operation-specific.
Native workflows, seeded rendering, sweeps, gallery tooling and composition guides already
exist; do not recreate their infrastructure as a prerequisite for downstream work.
The [web gallery/studio](../apps/README.md) provides 95 gallery and Studio techniques with Go project storage; its [architecture](web-app-architecture.md) keeps
app documents separate from the portable recipe grammar.

The [collection report](external-art-corpus.md) records the expanded source corpus, and the
[default palette library](default-palettes.md) supplies 50 reusable color choices. The research
plan prioritizes new artist capabilities in p5.js; target parity remains a separate workstream.
The [first implementation batch](external-expansion-first-batch.md) delivers three motif
compositions, radius queries and synchronous pair responses with two native interaction studies.

## Remaining work and dependencies

| Workstream | Next bounded outcome | Acceptance boundary |
|---|---|---|
| New p5.js capabilities | Following accepted A and narrow B, freeze width-aware strip regions/occupancy and connected elastic growth from the [external-art plan](external-art-p5-expansion-plan.md); persistent contact history and remaining stages stay distinct | Independent p5 implementation, explicit state/geometry contracts, meaningful edits and contrasting transfer examples; no port requirement or inherited artist-recreation claim |
| Target parity | Review/port accepted capabilities using the [port handoff](porting-resume.md) | Frozen semantics/fixtures, actual target-native evidence and root integration; no inherited support claims |
| Recipe execution/export | Reconcile the [Java prototype](java-recipe-preview.md) and [execution direction](../design/recipes/execution-direction.md), then freeze a bounded catalog-backed composition slice | Explicit seed/canvas/time/assets/capabilities, type validation, round-trip serialization and installed exported replay for claimed targets |
| Browser composition | Extend the current Studio with new supported bindings and explicit asset/renderer adapters | Preserve working edits, catalog identities, keyboard controls, bounded rendering and honest export scope |
| MCP and prompt planning | Follow the [harness proposal](prompt-studio-harness.md): workflow candidates, isolated p5 source, Processing Java profile and blind pilot | Shared catalog, bounded execution, editable layers, isolated benchmark and per-target evidence; MCP wraps the same handlers |
| Evidence and recreation coverage | Reconcile new snapshot records and investigate concrete missing artist capabilities | Root-reviewed evidence changes; demonstrated recreation kept separate from projected coverage |

Browser work need not wait for every p5 port: choose a dependency-complete supported slice.
The initial web app and Go backend have their own scoped review. Target-specific portable
exports and general operation graphs still require separate execution contracts and evidence.
The [MCP/web requirements](mcp-web.md) remain the broader target; the prototype does not
satisfy the general portable recipe or four-target export objective.

## Gates for future implementation

- Start from the artist task and evaluate existing composition before adding operations.
  Use [artist-capabilities](artist-capabilities.md) and [recreation coverage](recreation-coverage.md).
- Freeze the affected portable contract and fixtures before independent target work.
  New snapshots require hash-based reconciliation of affected decisions, not a blanket reset.
- Use existing recipe-execution and catalog-synchronization skills before accepting persisted
  recipes, executors, exporters or generated product surfaces. Use the now-created
  [prompt-evaluation skill](../skills/prompt-to-recipe-evaluation/SKILL.md) before
  natural-language planning or its first benchmark.
- Prompt evaluation must accept semantically equivalent recipes and separately score intent,
  provenance, execution, cross-target behavior, visual results and coverage. Recorded planner
  outputs test protocol behavior; live-model quality is a separate observation.
- Keep full-corpus benchmark certification separate from scoped releases. Missing required
  references or outputs, empty evaluations and filtered runs cannot establish certification.

## Batch planning

For each selected workstream, root records the bounded deliverable, frozen dependencies,
file ownership, distinguishing checks and stopping condition. Delegate independent work
using [agent briefs](agent-briefs.md); integrate at useful checkpoints. Reuse established
render/package infrastructure and update current state by replacement, not accumulated history.
