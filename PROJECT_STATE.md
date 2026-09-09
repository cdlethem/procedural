# Current project state

Updated 2026-09-08. Read with [AGENTS.md](AGENTS.md); open other docs only for the task.
This is a snapshot, not a chronological log. Earlier decisions and runs remain in Git and
linked evidence. Do not treat old pending statements as new assignments.

## Accepted baseline

- Main integration baseline: `3f56c0c3f88de0700a7b7e6682a34b9b48e356e0`.
- Java implementation objective is accepted: **31 operations, 37 editable workflows**.
  Java 0.35 runtime baseline: `d7f95a06f55fd0937ebb2c12bb2192c7644922c4`.
  [Completion review](evidence/distribution/java-completion-review.json) evaluates the
  [five requirements](docs/java-completion-plan.md); the installed start-page successor
  changes documentation/navigation without changing runtime classes.
- The p5 feature branch at `47ec5b2b73d7ac4466e7192e0695c64ee5664158` is integrated:
  **eight additional JavaScript operations and five workflows**, with public package
  exports and offline local tarball installation checked. These are batch additions,
  not the total package inventory. See [port integration](docs/port-integration-status.md)
  and [package review](evidence/ports/javascript-package/root-review.json).
- Packages are local reviewed artifacts, not registry publications. Java completion
  does not imply equivalent ports, a general recipe executor, web/MCP or full-corpus coverage.

## Target support

Current catalog attestations have the following operation counts. These are distinct
support dimensions, not sums or counts of all example workflows. Recompute from
`catalog/validation/` when support changes; check its bound evidence before making claims.

| Target | Conformant core | Scoped native | Scoped technique |
|---|---:|---:|---:|
| Processing Java | 31 | 31 | 26 |
| p5.js | 18 | 15 | 4 |
| py5 | 10 | 10 | 4 |
| Processing Android | 10 | 10 | 4 |

Separate radial-profile JavaScript/Python reviews exist, but their shared catalog target
attestations remain unvalidated. Do not discard that accepted work or silently promote it.
The [port handoff](docs/porting-resume.md) distinguishes these integration obligations.
Four selected original structural recreations are demonstrated; no extrapolation to the
full corpus is accepted. See [recreation coverage](docs/recreation-coverage.md).

## Current work and remaining decisions

The Java buildout and requested p5 branch integration are complete within their recorded
scope. This documentation cleanup introduces no new implementation priority. Follow the
next user assignment; the [roadmap](docs/roadmap.md) lists downstream work and dependencies.

- Other target ports remain separate work, including Python changes on the port branch,
  Android ProfileMarks lifecycle validation and remaining Java capabilities/adapters.
- Preserve the unrelated working-tree edit in
  `packages/java-android/examples/ProfileMarks/ProfileMarksActivity.java`.
  Gradle directories may be created by another worker; do not stage or delete them as cleanup.
  Recheck Git/process state before assuming an agent or native task is running or stopped.
- SpringMarks p5 animation and full source reproductions are not established by the recent
  core-only spring acceptance. Core, native workflow and technique claims remain separate.
- General Voronoi cells, grammar rewriting, text shaping and arbitrary solid modeling are
  explicit extensions outside the accepted Java surface, not missing promised implementations.
- A Java recipe prototype exists, documented in [recipe preview](docs/java-recipe-preview.md).
  It is not a general portable executor. Web/MCP remain downstream design work.
  Browser composition is the desired direction; its implementation scope is not yet frozen.

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
