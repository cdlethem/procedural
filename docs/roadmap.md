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
The [web gallery/studio](../apps/README.md) adds 24 interactive studies and four layerable
techniques with Go project storage; its [architecture](web-app-architecture.md) keeps
app documents separate from the portable recipe grammar.

## Remaining work and dependencies

| Workstream | Next bounded outcome | Acceptance boundary |
|---|---|---|
| Target parity | Review/port accepted capabilities using the [port handoff](porting-resume.md) | Frozen semantics/fixtures, actual target-native evidence and root integration; no inherited support claims |
| Recipe execution/export | Reconcile the [Java prototype](java-recipe-preview.md) and [execution direction](../design/recipes/execution-direction.md), then freeze a bounded catalog-backed composition slice | Explicit seed/canvas/time/assets/capabilities, type validation, round-trip serialization and installed exported replay for claimed targets |
| Browser composition | Extend the four-technique studio with further supported bindings or explicit typed composition ports | Preserve working edits, catalog identities, keyboard controls, bounded rendering and honest export scope |
| MCP and prompt planning | Implement discovery and validated composition tools over that same catalog/executor | No duplicate operation schema; protocol errors, cancellation/progress and bounded execution verified |
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
  recipes, executors, exporters or generated product surfaces. Create the prompt-evaluation
  skill before natural-language planning or its first benchmark, as specified in AGENTS.
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
