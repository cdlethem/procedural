# Current project state

Updated 2026-09-09. Read with [AGENTS.md](AGENTS.md); open other docs only for the task.
This is a snapshot, not a chronological log. Earlier decisions and runs remain in Git and
linked evidence. Do not treat old pending statements as new assignments.

## Accepted baseline

- Latest integration: p5 backlog `2f9418e3`, reconciled with main `aed135cc`;
  [root review](evidence/ports/p5-backlog/integration-root-review.json).
- Java implementation objective is accepted: **31 operations, 37 editable workflows**.
  Java 0.35 runtime baseline: `d7f95a06f55fd0937ebb2c12bb2192c7644922c4`.
  [Completion review](evidence/distribution/java-completion-review.json) evaluates the
  [five requirements](docs/java-completion-plan.md); the installed start-page successor
  changes documentation/navigation without changing runtime classes.
- The p5 batch adds **12 JavaScript cores and 12 browser workflows**. Root corrected
  numerical-helper provenance, public exports and a SpringMarks focused-button shortcut
  bug. Core fixtures, native controls/reset/save, representative images and installed
  package exports are reviewed. See [port integration](docs/port-integration-status.md).
- The [web app](apps/README.md) provides 24 techniques in both its gallery and layered
  studio, plus formatted API pages for all 31 operations. Shared numeric controls,
  custom per-layer palettes, inline highlighted source, undo/redo, local recovery,
  JSON/PNG export and Go storage are implemented. Studio v3 adds per-layer movement,
  scale and rotation, a thumbnail picker, a compact tabbed inspector, focused reseed/cut
  actions and human-readable constructor/output guides. Sketch source opens by default.
  [Version 3 root review](evidence/web/app-v3-review.json) records production browser
  checks and visual inspection; earlier web reviews remain historical.
  Tailnet deployment: https://eunoia.tailf03dad.ts.net:8443/ (Next 3002, Go 8088),
  served from the reviewed `.work/web-ui-release` checkout to isolate concurrent work.
  This remains an app-specific compositor, separate from portable recipes and MCP.
- Packages are local reviewed artifacts, not registry publications. Java completion
  does not imply equivalent ports, a general recipe executor or full-corpus coverage.

## Target support

Current catalog attestations have the following operation counts. These are distinct
support dimensions, not sums or counts of all example workflows. Recompute from
`catalog/validation/` when support changes; check its bound evidence before making claims.

| Target | Conformant core | Scoped native | Scoped technique |
|---|---:|---:|---:|
| Processing Java | 31 | 31 | 26 |
| p5.js | 30 | 29 | 4 |
| py5 | 10 | 10 | 4 |
| Processing Android | 10 | 10 | 4 |

Separate radial-profile JavaScript/Python reviews exist, but their shared catalog target
attestations remain unvalidated. Do not discard that accepted work or silently promote it.
The [port handoff](docs/porting-resume.md) distinguishes these integration obligations.
Four selected original structural recreations are demonstrated; no extrapolation to the
full corpus is accepted. See [recreation coverage](docs/recreation-coverage.md).

## Current work and remaining decisions

The Java buildout, requested p5 batch integration and initial web gallery/studio are complete
within their recorded scope. Follow the next user assignment; the [roadmap](docs/roadmap.md) lists downstream work and dependencies.

- Other target ports remain separate work, including Python changes on the port branch,
  Android ProfileMarks lifecycle validation and remaining Java capabilities/adapters.
- Preserve the unrelated working-tree edit in
  `packages/java-android/examples/ProfileMarks/ProfileMarksActivity.java`.
  Gradle directories may be created by another worker; do not stage or delete them as cleanup.
  Recheck Git/process state before assuming an agent or native task is running or stopped.
- SpringMarks p5 animation now has scoped native acceptance; source reproductions remain
  separate. Three new Python cores are pending source only; older Python/Android backlog
  files were excluded from the merge and must be transplanted explicitly from `2f9418e3`.
- General Voronoi cells, grammar rewriting, text shaping and arbitrary solid modeling are
  explicit extensions outside the accepted Java surface, not missing promised implementations.
- A Java recipe prototype exists, documented in [recipe preview](docs/java-recipe-preview.md).
  It is not a general portable executor. The [web architecture](docs/web-app-architecture.md)
  freezes the separate app boundary: all 24 browser techniques, at most eight layers,
  transparent Canvas2D/WebGL composition, per-layer affine placement, versioned JSON
  with exact v1/v2 migration,
  and a trusted local Go store. Arbitrary operation graphs, portable target export,
  multi-user hosting remain future work. Concurrent additive prompt/MCP harness work is
  separate and excluded from the reviewed app release.

## Evidence and navigation

The publishable [snapshot](survey/snapshot.json) contains 826 reports of the 901-sketch
survey target, including stubs. Work on this incomplete snapshot is authorized. Use the
snapshot, normalized corpus and exact source-note hashes for decisions; never infer live
survey progress from these checked-in counts.

| Need | Read |
|---|---|
| Install and edit Java artwork | [Getting started](README.md#get-started), `tools/install.py`, [workflow chooser](docs/choosing-java-workflow.md) |
| Compose regions, images and effects | [Composition guide](docs/composing-java-effects.md) |
| Current operation semantics/support | [Generated reference](docs/reference/operations.md), relevant catalog entry and attestation |
| Capability admission | [Artist architecture](docs/artist-capabilities.md) |
| Delegate a bounded task | [Agent briefs](docs/agent-briefs.md) |
| Review or continue ports | [Port handoff](docs/porting-resume.md) |
| Inspect actual images | [Gallery guide](docs/visual-review.md), `.work/visual-review/index.html` |

## Focused commands

Run only those relevant to changed inputs; a routine resume does not require rebuilding.

```sh
uv run python tools/check_catalog.py
uv run python tools/check_phase2_design.py --contract-cluster <id>
python3 tools/with_native_render_lock.py -- <native command>
python3 tools/build_visual_review.py
node tools/build_ported_javascript_package.mjs .work/dist/<fresh-directory>
```

Full corpus adjudication/certification and exhaustive test runs are not routine checkpoint
gates. Use the existing operation, adapter or packaging runner for the assigned change.
Keep this file near 100 lines by replacing resolved work with links to its acceptance record.
