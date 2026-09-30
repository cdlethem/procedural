# Creative quality and review

The gallery should offer useful ways to make images. Correct rendering, deterministic
replay, working export, an attractive default and high operation counts do not establish
that usefulness. Previous technical acceptance remains valid evidence of its stated
scope; it does not exempt a study from creative review. This policy applies to the
existing gallery and new work. Review affected instruments within the coordinated release;
an exhaustive corrective audit is not a prerequisite for functional composition or additions.

## Review the right thing

| Deliverable | Required contribution |
|---|---|
| Core operation | Remove a reusable computation, return useful data and preserve substitution points. A focused operation does not need many parameters. |
| Technique | Expose a coherent image-making mechanism that responds to different geometry, fields, images, graphs or signals. |
| Study | Make the mechanism understandable and worth exploring through the actual available controls. Editable source alone does not excuse a restrictive interface. |
| Composition example | Demonstrate an intentional combination. A fixed poster or two canned variants must not count as a newly enabled technique. |

Combine shallow cosmetic variants when one study with meaningful choices teaches the
mechanism better. Keep useful fixed compositions as examples. Existing web-Studio artwork
is disposable; do not retain migrations or historical renderers to preserve it. Preserve
useful study identities and URLs where they still aid discovery, not as a compatibility gate.

### Generative instruments, not fixed pictures

The maintainer's 27 September 2026 direction expands the apparatus through reusable,
functionally composable techniques and a substantial range of new artist-facing studies.
Extract and improve existing studies alongside additions; see [roadmap](roadmap.md) and
[current progress](next-release-progress.md). An entry that adds no distinct, interesting
capability need not remain separate. Count useful new artistic possibilities, not renamed
algorithms, fixed presets or hardcoded drawing callbacks.

The survey is one input to this tool, alongside direct artistic exploration, other
techniques and the needs revealed by composing layers. Look for mechanisms and useful
control relationships, not obligations to reproduce individual source images. Creative
work does not need recreation-versus-borrowing labels or a corpus-coverage score.

Do not require every layer to be a finished standalone artwork. A useful fragment, texture,
contour, cluster or field of marks can earn its place through its compositional usefulness.
Conversely, an attractive standalone image does not excuse rigid construction or a layer
that overwhelms everything beneath it. Review visual interest and compositional usefulness
separately.

Seed variation should change the appropriate construction decisions, not only palette or
an imperceptible translation of a fixed scene. Expose the character and amount of disorder
where meaningful, alongside controls for organization. Keep deterministic mechanisms
deterministic when chance would add nothing. Appearance edits must preserve structural
random choices; repeated seeds must reproduce them.

Prefer interacting, intelligible construction controls over a large collection of cosmetic
sliders. Review whether different settings or seeds reveal different structures rather
than stretching one authored composition. Unexpected outcomes must arise from the
mechanism, not hidden switches between canned scenes.

## Start with the artist's decisions

Before implementation, put a short creative brief in the existing task handoff:

- What can an artist make, and which computation does the toolkit remove?
- Which choices determine its structure, and which determine its marks or material?
- What source geometry or data can be replaced independently?
- What is hardcoded, and why should it remain hardcoded?
- What substantially different outcomes should the actual controls enable?

Compare with a relevant strong existing study and useful visual references, including
survey images where helpful. Examine mechanisms and degrees of freedom, not resemblance
alone. Keep provenance and acceptance bookkeeping out of teaching copy.

Root freezes the control model before a worker polishes one default. Prefer independent
construction choices over coupled presets and switches between two hardcoded scenes.
Presets are starting points once the underlying choices are available. Do not add
controls merely to increase their count.

A geometric panel should expose included shapes and their relative frequency, repetition,
rows and columns, spacing or offsets, and orientation. A convolution study needs editable
source structure and intelligible filter behavior; scale and display gain on one hidden
field are insufficient.

The Studio document owns the canvas background. A reusable study layer paints transparent
space around its marks, so artists can place layers above or below it. A palette swatch may
color a mark or an intentional bounded shape; it must not silently become a full-canvas
paper fill. Review full-size rectangles, images and shader outputs as well as explicit
`background()` calls when checking this boundary.

Transparency alone does not establish composability. Review occupied area, density,
extent, spacing, direction and local mark scale where the mechanism supports them.
Artists should be able to make a useful accent or partial field as well as an expansive
one without relying solely on shrinking, cropping or fading the completed layer.
Dense, full-frame results remain legitimate choices, not mandatory defaults.

For each reviewed study, build a real layered composition with another study and inspect
both layer orders. Establish that its negative space and marks can play a supporting role
without losing the mechanism. Do not solve rigid source geometry by adding an opacity
control or imposing one common mask on every technique.

## Ranges support exploration

| Decision | Meaning |
|---|---|
| Default | A useful, readable starting composition. |
| Slider interval | A convenient span for direct manipulation, informed by observed behavior. |
| Numeric domain | Values the parameter actually means; continuous values need not lie on slider ticks. |
| Hard limit | A required numeric, geometric, storage or measured execution constraint. |

Exact entry should allow values outside the slider interval when supported. Do not
silently clamp or ignore edits. Keep counts integral without applying that restriction
to continuous amounts. Test zero, negative values, periodic angles, overlap and extreme
scales where meaningful. Clipping, overlap and abstraction can be intentional results.

Every hard limit needs a concrete reason. For coupled counts, bound combined work rather
than arbitrarily narrowing each artistic dimension. Preserve core contracts and bounded
execution. Use existing parameter-evidence and performance workflows for unresolved
decisions; distinguish observed behavior from authored choices. Reuse existing notes and
harnesses rather than creating a new report format for every slider.

## Explore before accepting

The implementer must use the real interface. Review a readable default, substantially
different deliberate configurations, and relevant extreme or combined settings. Choose
these by the mechanism; there is no universal image or control quota. Sparse/dense,
ordered/perturbed, alternative inputs and different growth or field regimes are useful
comparisons when they match the technique.

Use controlled comparisons to establish consequential controls, then combine them to
test creative freedom. A pixel difference alone cannot establish usefulness. A palette
swap, seed change or outer-layer transform alone does not demonstrate control over
construction. A small control set can pass when it offers a useful, understood space
of outcomes.

Reject inert controls, misleading labels, nearly equivalent presets, hidden decoration
and restrictions that make every result resemble the default. Titles, frames and marks
must teach the mechanism or be meaningful editable choices. Appearance changes should
not secretly regenerate geometry; structural controls must reach the computation.
Inspect full images as well as contact sheets. Judge legibility and unintended artifacts
without imposing one preferred aesthetic.

## Responsiveness is part of quality

Measure initial display, structural edits and appearance edits separately. Long synchronous
replays that freeze interaction are unresolved product defects. Use retained state,
cheaper previews, explicit computation or cancellable background work as appropriate.
Preserve numerical semantics and the last successful image on failure. Test expensive
combinations; a high-quality export can have a different cost from direct manipulation.
Do not disguise a static image as a live implementation.

## Delegate implementation; retain judgment

Workers own bounded proposals or implementations in disjoint files. Handoffs name creative
choices, configurations exercised, hardcoded ingredients and remaining limits. Independent
worker review helps, but cannot admit the result or replace root judgment.

Root personally reads decisive code, operates representative controls in the real app,
and inspects results. Answer four questions separately:

1. Is the computation correct and reusable at its stated scope?
2. Can an artist meaningfully direct the result through the available interface?
3. Do the outcomes support discovery and useful composition, including partial or supporting layers?
4. Do editing, persistence, replay and export work at practical costs?

Passing one cannot offset failing another. Revise, combine, move to examples or leave
unpublished when appropriate. Preserve historical evidence and record current decisions
separately; do not claim earlier technical reviews covered creative quality.

## Integrate small, reviewed batches

Use existing semantic/regression tests, focused real-browser scenarios and the visual
gallery. Avoid new generic checkers, routine render matrices and repeated full suites
without changed inputs or an unresolved failure. Root must have time to review each batch.

The local visual gallery is navigation, not an acceptance gate. Missing archived images
or review records should be visibly reported there without preventing current work from
being browsed. This does not relax provenance, hash checks or the evidence required for
an actual acceptance claim.

Control-schema changes require strict current-input validation and updated guides/metadata,
not saved-artwork migration. Preserve the visual identity and current editing behavior.
Creative iteration uses an isolated local preview and must not wait for unrelated tenant
or deployment work. When actually releasing, build fresh preview assets and service
configuration and verify the deployed URL; do not reopen disabled visitor ingress early.

Report useful capabilities and things artists can make. Separate core conformance, creative
review, gallery integration and live deployment. Counts are inventory, never release targets.

## Current corrective sequence

1. Audit all gallery definitions for limited construction choices, hidden sources,
   misleading controls, arbitrary limits, opaque layer fills and slow interaction. Group shared causes and
   compare with the strongest existing studies.
2. Prioritize demonstrated rigidity rather than an inherited list of names. The current
   first slices expose seeded curl fields/starting distributions and spatially editable
   convolution sources. Review meaningful parameter interactions, legibility and useful
   local fragments before polishing one default.
3. Reopen fixed-source path/grammar, raster and motion/growth families. Preserve their
   technical evidence while deciding whether to revise, consolidate or retain each entry.
4. Select new studies and techniques for distinct creative value. The historical full
   capability plan is a source of candidates, not a mandatory expansion quota.
