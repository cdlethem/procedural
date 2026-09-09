# Procedurals web application

Root architecture, 2026-09-09. This app demonstrates existing JavaScript package
workflows; it does not change operation contracts or target acceptance.

## Artist experience

The gallery leads with rendered artwork, search, and technique families. Each detail
page combines an interactive existing p5.js example, its controls, explanatory Markdown,
and operation provenance. Existing native examples remain editable source. Every available
browser workflow belongs in the gallery; studio compatibility is a separate dimension.

The studio is an ordered stack of independently generated artwork layers. Begin with
FieldMarks, PathMarks, PlacementMarks, and LatticeMarks: fields, trajectories, separated
forms, and occupied lattice paths. Add, select, duplicate, reorder, hide, remove, and
change opacity; each selected technique supplies parameter controls and visible shortcut
hints. Keyboard commands only run outside text/slider/select editing. Undo/redo, local
autosave, JSON import/export, PNG download, and explicit server save/load make edits useful.
Mobile layouts stack panels without hiding controls. Canvas renders at 640 square and
scales for display. Layer order is array order, back to front, source-over compositing.
Each layer is drawn into a transparent buffer; group opacity is rounded to the nearest
8-bit alpha before compositing the completed layer.

## Boundaries frozen for implementation

Next.js App Router owns navigation, Markdown presentation, and React controls. p5 runs
client-side, has an explicit mount/unmount lifecycle, and never uses wall time for static
studio output. Real existing composition helpers import the package algorithms. A failed
render reports its error and does not publish a partially successful frame. Full
recomputation is allowed; any retained geometry optimization needs an invalidation test.
Gallery examples may animate according to their own documented controls.

Go standard-library HTTP serves project CRUD through a same-origin Next rewrite. Disk
writes are atomic, IDs are server-generated, requests and project counts are bounded.
It stores opaque versioned studio documents; the browser validates technique identities,
parameters and execution budgets before use. It does not interpret host code or claim
portable recipe validation. This initial service is for a trusted local installation;
multi-user hosting requires authentication, ownership, and deployment configuration.
Gallery and local editing continue when the storage service is unavailable.

`apps/web/lib/studio-types.ts` specifies the app document envelope. Version 1 fixes the
canvas at 640x640, requires the studio binding version and catalog digest, limits layers to 8, uses explicit per-layer uint32 seeds, opaque RGB
background, visible flags and opacity in [0,1]. Technique definitions own app-specific
controls and bounded example configurations, distinct from operation defaults or artistic
recommendations. Import rejects unknown keys, techniques, parameters, invalid values,
non-finite numbers and unsupported versions before state replacement. App binding metadata
records operation IDs, versions and content hashes from catalog authority; stale generation
fails a check. No cache or p5 object is serialized. Change the binding version when the studio adapter
or example mapping semantics change; changing an operation contract changes the generated digest.

The studio is deliberately a workflow compositor, with named substitution points in
existing compositions. It is not the general portable recipe executor specified in
`design/recipes/`. Those contracts and Java work remain independent. Exposing all low-level
operations as arbitrary nodes requires typed ports, explicit construction/query bindings,
and error/budget rules; opaque layers must never be described as that completed system.

## Prompt direction

A future prompt interface should propose a validated editable document or a visible set of
changes to the current document. The same controls, undo history, seed and renderer then
remain available. MCP would be a transport into that model, not an arbitrary-code runtime.
Prompt execution is outside this first app implementation. Before implementing it, create
the required prompt-to-recipe-evaluation skill and evaluate semantic and visual outcomes.

## Verification

Build/type-check Next, test Go CRUD and persistence, test document admission and command
output, and exercise real browser gallery, parameter edits, keyboard focus isolation,
layer ordering, undo, round trips, PNG and server save/load. All browser rendering uses
`tools/with_native_render_lock.py`; root inspects representative screenshots and records
navigation in the visual-review gallery. This is app integration evidence, not expanded
shared target support or source reproduction acceptance.
