# CP21 direction: editable unequal rectangle subdivision

Root source review, 2026-09-08. Investigation priority, not a frozen public API or
implementation acceptance. Java0.23 remains the accepted 23-operation distribution.
Source and report identities are in cp21-gap-source-bindings.json. No source code copied.

## Artist entry point and selection

Divide a surface into uneven regions, choose which region to subdivide, and reuse the
result for different content. Existing seeded equal quadrants and integer binary panels
own their selection and split policies. Neither exposes retained, caller-directed unequal
subdivision. The useful extension should separate region selection from cut geometry;
it should not add one seeded monolith for every source's random-expression variation.

Root prioritizes a private editable-region prototype. Test whether supplied cuts and explicit
leaf selection can express both aligned unequal quadrants and staggered two-stage cuts
without forcing an artist to maintain rectangle replacement/order themselves. Retained
region identity and atomic edits are potential capabilities, not approved signatures.
Before admission compare this approach against a smaller extension of existing partition
behavior; adding state is justified only if the editing workflow benefits materially.

## Source corrections that change design

`2019/generativos/griton#0` is a real candidate, but the report is unreliable:

- Selection is nested random: floor(random(liveCount * random(0.6,1))). It does
  not exclude the early list entries or simply favor recently appended rectangles.
- A split has three ratios: a primary cut, then independently positioned perpendicular
  cuts in the two halves. It is not the aligned two-ratio cross in pliegues.
- Only the vertical-primary branch probabilistically omits two particular children.
  Horizontal-primary always retains four. A step appends two, three or four children,
  never five; the parent is removed afterward. Geometry need not cover the root.
- Rendering independently skips rectangles and extends translucent bands beyond bounds.
  Full-bleed appearance is not proof of a space-covering subdivision invariant.

`2018/Generativos/pliegues` provides prose evidence for aligned unequal quadrants:
uniform live-leaf selection, independent width/height ratios in source0.35..0.65,
children appended top-left/top-right/bottom-right/bottom-left before parent removal.
Its checked-in frontmatter has NO reusable_candidates array: do not invent pliegues#0.
The note's experiments at8 and37 subdivisions report large composition changes. These
support a count edit, not recommended ratio bounds; ratios were not isolated experimentally.
An agent called its Git blob identity SHA256 and assigned a nonexistent candidate ID;
root computed actual SHA256 bindings and read the source directly instead.

These two computations are related, not equivalent candidates to merge wholesale.
Existing poop/barab binary algorithms stay accepted and unchanged. Selection bias,
omission policy, palette and drawing belong to source compositions unless separate
reusable value is demonstrated. Do not use griton measurements as generic cut defaults.

## Other shortlist findings

`2018/Generativos/araniaaas#1`: target returns toward the initial position, then receives
mouse-conditioned interpolation; existing TargetSprings2D can supply the spring advance.
A missing bundled target policy does not yet justify a second spring operation. Prefer a
future interactive composition demonstrating supplied targets before admitting policy API.

`2018/Generativos/peces#1`: each update clears and reconstructs spine points by walking
backward through the current field. It is NOT persistent head-position history. Head motion,
lifetime, palette phases, width profile and blur accumulation are distinct components.
The report's early-frame parameter experiments all measured none, so no useful public
ranges follow. A future tapered field-path workflow may be valuable; do not implement a
history buffer or agent engine on the mistaken premise that it reproduces this algorithm.

## Bounded next batch and stop condition

Root: choose retained region representation, ordering/identity and failure behavior through
a private specification; compare aligned and staggered cuts and coverage/omission boundaries.
Terra: only after that brief, implement private geometry and an editable native example
using established runners. No catalog entry, source copying, shared acceptance or ports.
Root: inspect an edit and a different decoration of the same cells, then decide whether a
public operation is justified. Use one shared native lease and add meaningful images to
the central gallery. Only then freeze a contract and delegate production implementation.
No new renderer harness, broad evidence audit or large test matrix is needed.
