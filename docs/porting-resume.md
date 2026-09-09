# Porting handoff

## Baseline and authority

Use the pushed integration baseline in [PROJECT_STATE](../PROJECT_STATE.md) for a new
separate checkout/branch. Recheck remote state before starting; do not overwrite the port
author's existing checkout. [Port integration status](port-integration-status.md) identifies
the accepted JavaScript batch. The former Java-only/ports-paused scheduling is no longer
an instruction. Choose the next bounded batch from the current user assignment.

Operation semantics come from `catalog/operations/` and shared `fixtures/operations/`.
Current support comes from `catalog/validation/` and bound root reviews, not historical
implementation-status fields. Inspect both before deciding something needs reimplementation.
Java's accepted surface is the reference, not proof that another target works.

Root owns important semantic decisions, native review and final main integration. Workers
return patches and evidence; they must not write root acceptance records or accept shared
attestations. Use the machine-wide render lease and publishing rules in [AGENTS](../AGENTS.md).

## Remaining target work

- **p5.js:** the recent eight-core/five-workflow branch is integrated, including exports
  and local package checks. Remaining Java capabilities include binary panels, retained
  rectangle cuts, 3D noise, radial pull, convex-polygon placement, image blending/filtering,
  disc projection, annular meshes, polygon clipping and nearest contact, plus their adapters.
  Use current catalog differences to select exact operation IDs and dependency order.
- **Radial profile:** JavaScript/Python core and ProfileMarks native reviews already exist;
  shared target attestations remain unvalidated. Reconcile existing evidence and package
  successors rather than redoing accepted cores. Android P3D remains a separate obligation.
- **py5/Python:** branch implementations beyond the accepted baseline still require review.
  The branch's OpenJDK-derived spline hypot translation has unresolved notice/provenance
  integration; JavaScript uses a separately reviewed netlib replacement. Do not import the
  old Python translation under an implicit project MIT claim or change numeric tolerances.
- **Android:** finish the ProfileMarks draft and independently port/review other capabilities.
  Existing six-starter restoration acceptance is scoped to its recorded runtime; it does
  not establish P3D, physical-device or additional-workflow support.
- **Native and technique coverage:** spring, occupied-lattice and Delaunay p5 cores have
  no newly accepted native workflows from this batch. Source recreations and animations
  require their own evidence; core fixture success cannot fill those gaps.

## Android ProfileMarks retained investigation

Preserve the working-tree Activity edit and related draft files. Recheck source and any
live worker before changing them. The last recorded incomplete native attempt is
`.work/native/profile-marks-android2`: it reached nine states and saved a MediaStore PNG,
then timed out after HOME/resume. This is diagnostic evidence, not acceptance or live status.

The retained investigation points to restoration waiting for a surface-changed event when
EGL is preserved. A proposed `g.surfaceChanged()` call during resume was not accepted.
Inspect current code before treating it as unimplemented. Relevant pinned runtime paths:
PApplet onResume/handleSpecialDraw, PGraphics restoreState, PGraphicsOpenGL restoreSurface,
and PSurfaceGLES. Do not weaken viewport equality or skip resume to accept the port.

Completion requires a fresh bounded native sequence under the shared lease, resumed viewport
equality before the next edit, saved-pixel validation after it, radial core fixtures on the
claimed runtime, and extracted-package build/use. Root reviews representative images and
source/evidence bindings before adding target attestations. A compiled APK is insufficient.

## Handoff checklist

Name the pinned commit, owned files, operation versions, shared fixtures and native scenarios.
Preserve branch-sensitive elementary arithmetic, RNG consumption, ordering and error precedence;
use existing exact-math infrastructure and notices. No per-target semantic workaround.
Return actual commands/results, evidence paths and unresolved work. Keep images, builds,
logs, toolchains and Gradle state out of Git. See [agent briefs](agent-briefs.md) for the
assignment template. Recipes/web/MCP are separate roadmap work, not part of port acceptance.
