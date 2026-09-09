# Procedurals web application

Root architecture, 2026-09-09. This app demonstrates existing JavaScript package
workflows; it does not change operation contracts or target acceptance.

## Artist experience

The gallery leads with rendered artwork, search, and technique families. All 24 browser
techniques open an interactive p5 canvas with shared studio controls, an adapted artist
guide, and links to formatted operation documentation. An expandable, highlighted Sketch
source component displays the actual adapter function and its local dependencies. Source
excerpts are extracted from TypeScript syntax trees, so they track the renderer. No raw
repository files are navigation targets. The API reference covers all 31 operations.

The studio is an ordered stack of independently generated artwork layers. Add, select,
duplicate, reorder, hide, remove, and change opacity. Numeric settings use sliders plus
exact numeric inputs; modes use selectors and checkboxes. Every layer owns an ordered RGB
palette of 2–12 colors, editable with pickers and hex fields. All app keyboard shortcuts
and their hints have been removed; ordinary browser/form keyboard behavior remains.
Undo/redo, local autosave, JSON import/export, PNG download, and server save/load preserve
edits. Mobile panels stack. The canvas renders at 640 square and scales for display.

Layer order is array order, back to front. Each layer draws into a transparent buffer;
source-over group opacity is rounded to nearest 8-bit alpha before composition. 3D
techniques require p5 WebGL and their output becomes a raster layer. Temporary WebGL
contexts are released after composition. Raster techniques generate/filter their own
source artwork; they are not implicit effects on other layers. Spring motion uses an
explicit bounded tick parameter for repeatable snapshots rather than wall time.

## Application boundaries

Next.js App Router owns navigation, Markdown presentation, and React controls. The same
TechniquePlayground/LayerControls and renderer are used for gallery studies and studio
layers. p5 runs client-side with explicit mount/unmount lifecycle. A failed render reports
its error and leaves the last successful canvas intact. Full recomputation is allowed;
future retained geometry optimizations require invalidation tests.

Adapters under `apps/web/lib/adapters/` declare parameters, app defaults, renderer needs,
and cross-parameter validation. Drawing functions consume validated layers through existing
package cores and example helpers. App ranges are bounded composition choices, not new
public operation defaults or evidence-backed artistic recommendations. These interactive
compositions are not pixel replicas of all the original native example modes.

Go standard-library HTTP serves project CRUD through a same-origin Next rewrite. Disk
writes are atomic; IDs are server-generated; requests and project counts are bounded.
It stores opaque versioned documents. The browser validates technique identities,
parameters and execution budgets before use. The service is for a trusted local
installation, without accounts or per-user ownership. Gallery and local editing continue
when server storage is unavailable. Multi-user hosting remains separate work.

The schemaVersion 1 envelope now carries bindingVersion `studio-v2`: 640×640 canvas,
at most eight layers, explicit uint32 seed, ordered RGB palette, opaque RGB background,
visible flag and opacity in [0,1]. Imports reject unknown keys, techniques, parameters,
non-finite values and unsupported versions before state replacement. Binding metadata
records actual app operation IDs, versions and catalog hashes. Changes to adapter
semantics require a new binding version; changed operation contracts change the digest.
No p5 object or executable code is serialized.

Only the exact original `studio-v1` binding is migrated. The frozen registry validates
old controls first, then materializes original/neon palettes and maps lattice flags to
numeric settings. Existing geometry/style choices remain represented. Unknown or stale
bindings continue to fail. Prior app acceptance records remain historical snapshots.

API metadata is generated from catalog schemas, behavior, errors, and target attestations.
JavaScript export mappings are checked against the actual package. Formatted API pages
expose nested fields, scalar/array constraints, defaults when recorded, queries, semantics,
errors, target support, and motivating sketch provenance. Displayed implementation availability
and catalog target acceptance are distinct; app rendering does not promote target support.

## Prompt direction

The studio composes named workflows. It is not the portable recipe executor in
`design/recipes/` or an arbitrary graph of low-level operations. Such graphs require typed
ports and explicit construction/query/error/budget rules. A future prompt interface should
propose a validated editable document or visible changes to it, preserving manual controls,
undo history, seed and renderer. MCP would transport those edits rather than execute
arbitrary generated code. Before implementing prompt planning, create the required
prompt-to-recipe-evaluation skill and evaluate semantic and visual outcomes.

## Verification

Typecheck and build Next; test document validation/migration and native core adapter calls;
exercise all gallery/studio renderers, numeric and palette edits, layer opacity/order,
undo, imports, PNG and server save/load in a real browser. All browser rendering uses
`tools/with_native_render_lock.py`; root inspects representative screenshots and records
navigation in the visual-review gallery. Evidence describes these app scenarios, not
expanded shared target support or source-reproduction acceptance.
