# Current project state

Updated 2026-09-17. Read with [AGENTS.md](AGENTS.md); open other documents only for the task.
This is a current snapshot. Historical plans and reviews are not an active assignment queue.

## Accepted capabilities

- Java implementation objective: **31 operations, 37 editable workflows**. Java 0.35 runtime
  baseline remains `d7f95a06f55fd0937ebb2c12bb2192c7644922c4`; see the
  [completion review](evidence/distribution/java-completion-review.json).
- p5.js: **69 conformant cores, 69 operations with scoped native coverage, 111 editable
  package workflows**, and five scoped technique attestations. These dimensions are separate.
  [Port status](docs/port-integration-status.md) links the historical integrations.
- [Survey coverage batch 1](evidence/coverage/batch1/integration-review.json) adds exactly
  seeded pixel grain, sampled-field displacement and octave gradient noise. Each has a
  reviewed contract, independent fixtures, an editable p5 study, native controls/reset/reload/save,
  performance evidence and a withheld source transfer. Other targets remain deferred.
- The first grain candidate failed SSIM0.674. Its [replay successor](evidence/reproductions/survey-coverage-batch1/grain-replay/root-review.json)
  restores the recorded source-layout RNG and passes the unchanged gate at **SSIM0.995**,
  adding one demonstrated structural recreation. Both field studies remain independent
  components. All three withheld transfers remain source walkthroughs.
- [External expansion batch A/B](evidence/expansion/first-batch/root-review.json) adds radius-pair
  queries, synchronous pair-force steps and five original editable studies. Source and installed
  package lifecycle checks pass; no artist recreation or new technique attestation is claimed.
- Packages are reviewed local artifacts, not registry publications. This work does not imply
  a portable recipe executor, full-corpus certification or equivalent target ports.

## Target support

Counts derive from `catalog/validation/` and its bound reviews. Frozen contract prose and
old example headers are not current support authority.

| Target | Conformant core | Scoped native | Scoped technique |
|---|---:|---:|---:|
| Processing Java | 31 | 31 | 26 |
| p5.js | 69 | 69 | 5 |
| py5 | 10 | 10 | 4 |
| Processing Android | 10 | 10 | 4 |

The [coverage report](docs/survey-operation-coverage-report.md) now records **474/800 plausible**
recreations, including **381/800 operation-led**. Step0 reconciliation added20 to each original
439/346 total; the three new capabilities add another15. Demonstrated originals are now **5**, including the accepted grain replay.
The report includes all69 family dispositions and all three denominators:800 assessed,
826 snapshot notes and901 targets. Missing/unassessed cases never count as supported.

## Web application

- The [web app](apps/README.md) has95 gallery/Studio studies and generated API pages for69
  operations. The three coverage studies are packaged native examples; the web study count
  is95 after the five external expansion studies. The app compositor remains separate from portable recipes/MCP.
- Layer editing, custom palettes, source inspection, undo/redo, local recovery, JSON/PNG export
  and Go storage are reviewed. [Workspace review](evidence/web/studio-workspace-review.json),
  [v3 review](evidence/web/app-v3-review.json) and [architecture](docs/web-app-architecture.md)
  describe layout, persistence and boundaries.
- The [UI integration review](evidence/web/ui-main-integration.json) binds the redesign,
  procedural identity, About page and final **Art with knobs** hero copy for main.
  Clean-checkout production, workspace and palette/prompt browser checks passed.
  Historical [design](evidence/web/ui-design-audit-2026-09-17.json) and
  [brand](evidence/web/procedural-brand-review.json) reviews retain their original bindings.
  Preview: https://eunoia.tailf03dad.ts.net:8444/ (persistent `ui-design-preview`, Next3016).
  This working-checkout preview is separate from the unchanged8443 release below.
- Prompt drafts and applied source/layer revisions are covered by the
  [prompt integration](evidence/web/prompt-web-integration-review.json) and
  [saved-layer successor](evidence/web/generated-layer-review.json). See the
  [artist guide](docs/prompt-studio-guide.md). Generated artifact JSON needs the harness service.
- Named manual/generated palettes retain their [review](evidence/web/palette-library-review.json).
  The [50 default palettes](docs/default-palettes.md) now have a separate
  [local data/UI review](evidence/external-art/2026-09/default-palette-review.json), including
  the JavaScript export, offline defaults, editable copies and scoped browser checks.
- Live8443 serves the completed merged redesign plus five new studies and 50 default palettes
  from clean main revision `6d4759b8`, immutable release `.work/external-gallery-review`
  (Next3002, Go8088). The [release review](evidence/web/external-expansion-live-release.json)
  records actual HTTPS verification; the [restoration review](evidence/web/completed-redesign-restoration.json)
  retains the source reconciliation and recovery checks.
  The in-progress landing page remains separate. Future releases must preserve this completed UI
  baseline; see [live release procedure](docs/live-web-release.md).
- Named projects live in `.work/web-projects`. The current release links shared prompt
  artifacts, saved layers and palettes under `.work/web-palettes-release/.work/harness`.

## External reference research

The [corpus](docs/external-art-corpus.md) contains 6,497 distinct local images across 24 artist/studio
groups, representing 1,988 of 2,023 selected records; 383 source URLs remain unavailable. The
[58-family p5 expansion plan](docs/external-art-p5-expansion-plan.md) compares current capabilities
and prioritizes future work. [Root review](evidence/external-art/2026-09/root-review.json) records
visual scope and access gaps; no external artwork recreation is accepted by this research.

## Remaining work and ownership

The survey batch and first [external expansion batch](docs/external-expansion-first-batch.md)
are complete at their declared scope. The maintainer now requires the **entire external expansion
plan implemented**. [Execution scope](docs/external-expansion-execution.md) tracks active B–I
and deeper-audit work; batch completion is an integration checkpoint, not the task endpoint.
Contact/sensor/flock, width-aware regions, connected growth and periodic fluid contracts are
in design. These pending slices do not change the accepted counts above.

- Other-target ports remain separate. The [port handoff](docs/porting-resume.md) tracks Python
  attestation reconciliation, Android ProfileMarks lifecycle validation and Java backlog.
  Three Python cores remain pending source; older Python/Android work at `2f9418e3` requires
  explicit transplant and review. SpringMarks p5 has scoped animation acceptance.
- Preserve concurrent Android ProfileMarks edits, `.gradle/` directories and unrelated work.
  The [export successor](evidence/conformance/external-expansion-surface-review.json) binds the
  two new operations and default palette data while preserving historical acceptance bytes.
- The [Java recipe preview](docs/java-recipe-preview.md) is a prototype. Before natural-language
  recipe planning/its first prompt benchmark, create the missing prompt-to-recipe evaluation
  skill after catalog/executor work, as required by AGENTS.md.

## Evidence and focused commands

Use [survey/snapshot.json](survey/snapshot.json), exact note hashes and linked raw evidence.
The authorized incomplete snapshot has826 reports including26 unassessed blank baselines;
75 target sketches are outside it. Native rendering always uses the shared machine lease.

```sh
uv run python tools/check_catalog.py
uv run python tools/check_phase2_design.py --contract-cluster <id>
python3 tools/update_survey_coverage.py --check
python3 tools/with_native_render_lock.py -- <native command>
python3 tools/build_visual_review.py
node tools/build_ported_javascript_package.mjs .work/dist/<fresh-directory>
```

The local [visual gallery](.work/visual-review/index.html) links reviewed images; inclusion
is navigation, not acceptance. The [artist architecture](docs/artist-capabilities.md),
[agent briefs](docs/agent-briefs.md) and [generated reference](docs/reference/operations.md)
cover admission, bounded delegation and current operation semantics.
