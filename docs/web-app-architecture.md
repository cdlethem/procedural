# Procedurals web application

Root architecture, 2026-09-09. This app demonstrates existing JavaScript package
workflows; it does not change operation contracts or target acceptance.

## Artist experience

The gallery leads with rendered artwork, search, and technique families. All 24 browser
techniques open an interactive p5 canvas with shared studio controls, an adapted artist
guide, and links to formatted operation documentation. An initially open, collapsible, highlighted Sketch
source component displays the actual adapter function and its local dependencies. Source
excerpts are extracted from TypeScript syntax trees, so they track the renderer. No raw
repository files are navigation targets. The API reference covers all 31 operations.

The studio is an ordered stack of independently generated artwork layers. A searchable
thumbnail picker presents the available techniques when adding a layer. Add, select,
duplicate, reorder, hide, remove, and change opacity. Each layer has its own position,
uniform scale and rotation. The studio supports dragging the selected layer plus exact
inspector controls, with each drag recorded as one undoable edit. Numeric settings use sliders plus
exact numeric inputs; modes use selectors and checkboxes. Every layer owns an ordered RGB
palette of 2–12 colors, editable with pickers and hex fields. Focused-canvas shortcuts support actions: R reseeds eligible techniques, and Ctrl/Cmd-Z
undoes (Shift redoes). CutMarks supports selecting a region, X/Y midpoint cuts, removal
and clearing selection. Hints explain these actions beside the canvas. Numeric parameters
use their controls, without redundant preset-toggle shortcuts. Inputs retain normal typing.
Undo/redo, local autosave, JSON import/export, PNG download, and server save/load preserve
edits. The studio inspector separates Placement, Technique and Style into tabs. Its compact
three-column workspace is centered and capped in width, keeping the inspector next to
the canvas. Controls stay in normal page flow without nested scroll areas. Mobile panels stack;
only tall desktop viewports keep the canvas sticky. The canvas renders at 640 square and scales for display.

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

The schemaVersion 1 envelope now carries bindingVersion `studio-v3`: 640×640 canvas,
at most eight layers, explicit uint32 seed, ordered RGB palette, opaque RGB background,
visible flag and opacity in [0,1]. Each layer also carries `cutEdits`: empty for other
techniques, or at most 64 ordered CutMarks cut/remove commands. The browser rebuilds the
seeded layout and validates replay before accepting a document. Region selection is transient
and excluded from image export. Each layer has `transform: {x, y, scale, rotation}`: x/y
place its local (320,320) center in canvas pixels, scale is uniform, and rotation is in
degrees. Identity is (320,320,1,0). Position is bounded to [-640,1280], scale to [0.05,4],
and rotation to [-180,180]. These are app bounds, not package semantics. Transform the
completed 640px layer buffer before composition, including WebGL/raster layers. Cut editing
uses the inverse transform to select local regions. Transforms preserve cut history. Changing the seed or base layout clears manual cuts in one
undoable edit; styling changes preserve them. Imports reject unknown keys, techniques, parameters,
non-finite values and unsupported versions before state replacement. Binding metadata
records actual app operation IDs, versions and catalog hashes. Changes to adapter
semantics require a new binding version; changed operation contracts change the digest.
No p5 object or executable code is serialized.

Exact `studio-v1` and `studio-v2` bindings migrate through frozen registries. Version 1
validates old controls, materializes original/neon palettes and maps lattice flags to
numeric settings. Both versions gain empty manual-cut histories and identity transforms without changing geometry
or styling. Unknown or stale
bindings continue to fail. Prior app acceptance records remain historical snapshots.

API metadata is generated from catalog schemas, behavior, errors, and target attestations.
JavaScript export mappings are checked against the actual package. Authored guides lead with the visible task, explain each constructor input and returned
model, and show JavaScript examples executed against real package exports during generation.
The complete nested fields, constraints, recorded defaults, queries, semantics, errors,
target support and provenance remain available in a collapsed detailed contract. Displayed implementation availability
and catalog target acceptance are distinct; app rendering does not promote target support.

## Prompt studio integration

`/studio` is the unified canvas: editable named workflows and generated p5.js source layers
share one ordered, eight-layer `harness-v1` document and one undo history. A service-side,
OpenAI-compatible model uses typed catalog/context/candidate/render tools. Generated source
runs in a disposable browser on an isolated origin; Studio composites only its
content-addressed preview raster. Candidate application and declared-control edits are
atomic document revisions. The selected source layer exposes its source in a collapsed
inspector disclosure.

`/explorations` is a separate one-shot prompt sketch surface. It shows an image with the
exact p5.js source that produced it and owns independent state. It does not alter Studio
unless an explicit add-to-Studio action creates a source layer.

The Go project store structurally validates `harness-v1` documents on save and never
executes source while saving or loading. It retains older exact `studio-v1`, `studio-v2`,
and `studio-v3` workflow documents. Artifact hashes are service-local references: document
JSON does not contain source or preview bytes. The integration does not admit recipe
execution, expand shared target support, or make generated source part of a portable
operation contract. Processing Java, blind recreation evaluation, and wider transport work
remain separate.

## Verification

Typecheck and build Next; test document validation/migration and native core adapter calls;
exercise all gallery/studio renderers, numeric and palette edits, layer opacity/order,
undo, imports, PNG and server save/load in a real browser. Check manual region editing,
focused action keys, empty documents, source expansion and control overflow as app behavior. All browser rendering uses
`tools/with_native_render_lock.py`; root inspects representative screenshots and records
navigation in the visual-review gallery. Evidence describes these app scenarios, not
expanded shared target support or source-reproduction acceptance.
