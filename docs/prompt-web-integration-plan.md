# Prompt web integration

User-directed integration, 2026-09-09. Root owns architecture and acceptance; three
Terra execution assignments implement the bounded slices below. The existing p5 harness
is the implementation foundation. This work adds app experiences, not portable operations.

## Frozen product and state boundaries

- `/studio` is the composition workspace for workflow and generated p5.js layers. Adopt
  the existing strict `harness-v1` envelope and migrate earlier app documents through
  `validateStudioDocument`. Preserve workflow parameters, palettes, placement and cut edits.
  Keep the picker, manual editing, project storage, import/export and local recovery.
- One document history owns manual edits, candidate application and source-control updates.
  Generation produces a separate, clearly marked preview. Explicit application creates one
  undoable edit. Newer manual edits invalidate a candidate; explicit rebase uses the latest
  document. Asynchronous renders must never overwrite intervening changes.
- `/explorations` is a separate navigation tab. Each prompt starts with an empty composition
  and displays a completed image with its exact source files and replay inputs. It does not
  mutate the studio, require studio application, or share studio recovery/history. Keep the
  last successful image/source pair together during failures and subsequent generation.
- Reuse the typed harness tools, model coordinator, artifact store and isolated p5 runner.
  Generated code is displayed as text; only runner-produced rasters enter the app compositor.
  No new model planner, code execution origin, recipe grammar or Processing target is added.
- Source controls rerender before committing. Source opacity and visibility use the existing
  envelope; workflow affine placement remains supported. Do not silently extend source
  placement semantics beyond the existing source schema.
- Named project storage accepts and preserves the strict mixed envelope. JSON contains
  artifact references, not a portable source/image bundle; explain service-local ownership
  and missing-artifact errors in the artist guide.

## Execution assignments

| Owner | Deliverable | Acceptance scenarios | Stop boundary |
|---|---|---|---|
| Terra studio integration | Unified Studio, prompt lifecycle, mixed rendering and controls | Workflow editing survives migration; add/preview/discard/apply; undo/redo; stale candidate and control-render races; recovery/import | No backend tool/schema changes or shared support admission |
| Terra explorations | Independent prompt/image/code page, navigation and reusable source viewer | Blank starting context; exact source shown; pending/failure retains paired result; cancellation; studio remains unchanged | No studio apply or alternative runner |
| Terra persistence/docs | Go mixed-document persistence and accessible artist guide | Strict validation; save/load roundtrip; malformed inputs rejected; setup and both workflows documented | No portable export claims |
| Root | Integration review, focused browser evidence, running app update | Real model generation in both experiences; mixed composition and controls; code/image pairing; project reload; responsive navigation and guide | Publish only the scope actually verified |

Files are divided by ownership in the agent briefs. Workers return implementation and
checks, not root acceptance records. Existing unrelated working-tree changes are preserved.

## Integration verification and release

Run TypeScript checks, web tests, Go tests and the production build on the combined result.
Use the existing browser harness where compatible and a focused prompt integration scenario
for the new UI. Browser/native renders acquire the shared machine lease; model-triggered
jobs acquire it through the existing render supervisor. Avoid holding the outer lease while
waiting for a server job that needs that same lease.

Root inspects representative images and exact generating artifacts, registers meaningful
screenshots in the existing visual gallery, and records evidence limits. Inspect the current
production service and preserve project/artifact storage before updating its reviewed
checkout. Verify the running routes after restart. Update PROJECT_STATE to the actual result.

## Integrated result

All three Terra assignments are integrated and the running site is updated. The
[root review](../evidence/web/prompt-web-integration-review.json) records real model and
renderer results separately from the leased browser transport-replay checks. Studio source
remains collapsed by default; Explorations is an independent top-level page. Production
artifacts live in the release-owned real directory, with the original store preserved.
