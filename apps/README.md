# Procedurals web app

The application successor is private:
[cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
New application, authentication, persistence and deployment work belongs there.
The instructions below describe the pre-extraction shared-store application and are
historical, not a visitor-safe deployment procedure. App ingress is offline during cutover.
The public repository retains the MIT toolkit, editable examples and historical evidence.

A playable landing page, a searchable gallery of interactive p5.js studies, a layered canvas
studio, and an API reference generated from the package catalog. The Next.js frontend uses
the existing JavaScript package; a Go service saves projects as JSON.

The **About** page (`/about`) explains the procedural approach: visible rules, deliberate
edits, and seeded variation instead of black-box image generation. Optional AI tools
propose editable code; they do not replace the method. Reproduction requires keeping the
code and settings, including the seed and relevant renderer/time context.

## Run

From the repository root, with Node.js 22+ and either Go 1.22+ or Docker installed:

```sh
npm ci --prefix apps/web
cd apps/web && npx playwright install chromium
```

Then, from the repository root:

```sh
python3 tools/run_web_app.py
```

Open **http://localhost:3000**. The launcher builds the Go binary, prepares package assets,
captures real gallery previews on first use under the shared render lease, and starts both
services. Ctrl-C stops both. An existing repository p5 browser environment is reused when
available. The first Docker build may download the Go image.

If port 8080 is occupied, use `--api-port 8088`. Use `--port 3001` to change the frontend
port. `--production` builds and serves the production frontend. `--skip-previews` skips
image capture; gallery links still work but image thumbnails need the capture step.

Project files live in `.work/web-projects/`. This initial installation uses one trusted
local project store; it has no accounts or per-user ownership. Keep that scope when hosting.
The gallery, local editing, JSON and PNG export work independently of server storage.

New studies include cell mosaics, nested cell outlines, stitched paths, beaded orbits,
terrain contours and overlapping hill contours. They use three p5-only additions:
Voronoi cells, polyline resampling and marching squares.

## Explore and compose

Start at **/**, **art with knobs**, with six live studies: Agent trails, Cut branch marks, Cell mosaic,
Distance halos, Warp marks, and Contact network. Each starts with a different palette.
Continue to **Studio** or the full **Gallery** at **/gallery**.

| Landing control | What changes on the page |
|---|---|
| Cells, Disorder, Tile inset | Change the mosaic's cell count, site arrangement, and space between tiles. |
| Strength, Scale, Stripe | Change the warped bands' displacement, field scale, and stripe spacing. |
| Ticks, Radius, Avoidance | Replay the trails or contact network, change nearby relationships, and adjust short-range repulsion. |
| Cuts, Cut angle, Stroke weight | Change the branching line pool and its drawing weight. |
| Scale, Radius, Stroke weight | Change the distance-halo field and its ring treatment. |
| Palette | Recolor the current study without changing its geometry. |
| Reseed | Generate another arrangement for seed-dependent studies. Agent trails and Contact network replay fixed initial states and omit this control. |
| Reset | Restore the current study's original controls, palette, and seed. |

The carousel advances every three seconds, including a half-second sliding crossfade.
Control activity delays the next transition until five seconds after the latest interaction;
holding a pointer keeps the study still until release, which starts a fresh five-second delay.
Stationary hover or focus does not prevent resuming. **Pause rotation** remains paused until
**Resume rotation** is chosen. Reduced motion starts paused and disables transitions.
Offscreen or hidden-tab carousels do not advance.
Each study retains its edits while you browse; nothing replaces a saved Studio document.
**Open study** opens the matching full study, not a copy of the preview's edits.
Without JavaScript, palette-matched artwork previews and ordinary links remain visible;
live controls are disabled with an explanation.

Regenerate the ignored landing previews from the running app with
`WEB_BASE_URL=http://localhost:3016 npm run capture:previews -- --landing` in `apps/web`.
The command uses the shared native-render lease and captures the actual default landing
documents, including their palettes. Restart a production server after adding new public assets.

Search or filter the numbered study index, then open a study for an interactive canvas.
**Make it yours** groups the procedure's sliders and exact inputs beside the artwork;
**Color & finish** contains opacity and palette controls. The section links jump between the
playground, method, and source. The guide's control tables use open rows rather than boxed cells.
On narrow screens, use the gallery's **Category** menu; **Clear filters** returns to the full collection.
**Sketch source** starts open with a formatted, highlighted view of the actual drawing code
and a copy button. Source panes accept keyboard focus for scrolling.

The API reference is searchable by operation name, identifier, or description. Operation
pages explain constructor inputs and returned data with runnable JavaScript examples.
Expand the detailed contract for constraints, semantics, and binding information.

The shared navigation marks the current section and offers a keyboard **Skip to content**
link. Studio tabs support arrow keys; mobile drawers contain keyboard focus until closed
and return focus to their opening button.

**Studio** is a viewport-sized workspace: a layer stack on the left, a fitted canvas in the
center, and an editor on the right. The layer stack and inspector scroll independently;
adding layers, expanding source, or browsing long palettes keeps the canvas in place. Switch
the right editor between **Inspector** and **Prompt**; prompt drafts survive tab changes.
On smaller screens, the **Layers**, **Inspector**, and **Prompt** buttons open drawers.
The canvas keeps its 640 × 640 drawing resolution at every display size.

**Open in studio** starts any study as a layer. **Add layer** opens a searchable thumbnail
picker for the available techniques. Select layers, change their settings,
hide or reorder them, and adjust opacity. Move layers by dragging on the canvas or setting
Position X/Y in the inspector; Scale and Rotation let you resize and turn each layer
around its center. The inspector groups these controls into Placement, Technique and Style
tabs. Reset placement restores the original position and size. Each layer owns an ordered palette of 2–12 colors,
editable with color pickers or hex values. Seeded techniques also expose seed controls.
Click the canvas and press **R** to reseed eligible techniques. For CutMarks, select a
region in **Cut regions** mode and use **X** for a vertical cut, **Y** for a horizontal cut, or the visible buttons
to cut/remove it. Canvas hints list available actions. Changing the seed or base layout
clears manual cuts; palette and other styling edits preserve them.
Undo/redo preserves document edits. Local recovery keeps the latest document in this browser;
explicit **Save project** actions keep named projects. **Open** opens the searchable project
library and JSON import; **Export** offers PNG and editable JSON downloads. **Canvas help**
collects keyboard shortcuts and cut/move instructions. JSON export/import moves editable documents
between browsers. PNG export saves the currently rendered canvas.

3D techniques render to transparent WebGL buffers before composition. Raster techniques
create their own source artwork; they do not filter lower layers. Spring motion exposes
an explicit tick count, so changing its settings produces repeatable snapshots.

These bounded controls are example configurations, not package operation defaults or
recommended artistic ranges. Studio documents use the `studio-v3` app binding, separate
from the portable recipe grammar. Imports from the exact `studio-v1` and `studio-v2` releases migrate
their palettes and controls with empty manual-cut histories; other stale or invalid bindings are rejected.

## Prompt studio and explorations

**Studio** combines named workflows and generated p5.js layers in one undoable document
history. A labelled candidate can temporarily replace the canvas for review while the
committed document remains unchanged until it is applied. Generated-layer controls remain
visible in the inspector; the collapsed **Generated source** disclosure is a read-only exact
source viewer with copy and download actions. **Explorations** is a separate prompt
sketch playground: choose **Start new sketch** for a fresh composition, or **Follow up on
layer** to revise a generated layer. The last successful image/source stays visible while a request is pending or fails. Name and
save generated layers from either workspace to reuse them through the gallery’s **Saved
layers** category or Studio’s **Add layer** picker. Leaving Explorations discards unsaved state. It does
not change Studio state until a saved layer is explicitly added there. Read the in-app guide at `/docs/prompt-studio`.

The prompt service uses an OpenAI-compatible endpoint at `http://127.0.0.1:8080/v1` by
default. Set `PROCEDURALS_MODEL_URL`, `PROCEDURALS_MODEL_NAME`, and
`PROCEDURALS_MODEL_KEY` before starting Next. When the model occupies port 8080, start the
app with `python3 tools/run_web_app.py --api-port 8088` so the Go project store uses a
different port.

Generated p5.js runs in the isolated 640px runner; the page composites only its
content-addressed preview PNG. Applying a candidate or changing a declared control creates
one undoable revision. Document JSON contains local artifact hashes, not generated source
or preview PNG bytes; use a supported per-layer or studio-bundle export when available. A
mixed composition has no supported single portable sketch export, and a preview PNG is not
editable source. Save/load validation never executes generated source.

Saved layer snapshots live in `.work/harness/saved-layers/` alongside the content-addressed
artifact store. Keep both directories when backing up or moving this installation. Copies
inserted into Studio own their controls and ids; revising them leaves saved originals intact.
Follow-up prompts receive the current source files and replay inputs.

This scoped surface does not claim Processing Java, portable recipe execution,
blind-recreation acceptance or additional shared target support.

## Development and verification

```sh
npm --prefix apps/web run check:generated
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run build
go -C apps/server test ./...
```

Run real-browser integration checks against a running app:

```sh
python3 tools/with_native_render_lock.py -- node apps/web/scripts/test-browser.mjs
```

Rebuild previews from a running app after changing studio adapters:

```sh
WEB_BASE_URL=http://127.0.0.1:3000 npm --prefix apps/web run capture:previews
```

Gallery metadata is generated from the catalog and existing Markdown by
`apps/web/scripts/generate-gallery.mjs`; `--check` fails on drift. Preview PNGs, copied
runtime assets, dependencies, project data and build outputs stay out of Git. Existing
source authorship and numerical-helper notices are retained with the served package.

For separate processes, run the API as described in [server/README.md](server/README.md),
then `npm --prefix apps/web run dev`. `PROCEDURALS_API_URL` is the API origin (default
`http://127.0.0.1:8080`); Next proxies `/api/*`. Set it before either development startup
or production build. The production server uses the build's rewrite configuration.

See [architecture](../docs/web-app-architecture.md) for app boundaries and
[prompt harness design](../docs/prompt-studio-harness.md) for the wider staged direction.

## Reusable palettes

Open **Palettes** in the main navigation to create a named color collection. Pick colors or
enter hex values, reorder them, and add or remove colors (2–12). **Generate colors** turns a
short description into an editable draft using the configured prompt model. Review it and
choose **Save palette**. Palettes can be renamed, edited, duplicated, searched, and deleted.

In Studio, open a package layer’s **Style → Saved palettes** to apply a collection in one
undoable edit, or save that layer’s current colors. The same picker is available in gallery
study controls. Each application copies the colors: later library edits/deletion leave
existing sketches unchanged.

For generated layers, **Revise with a palette** prepares a prompt edit with the exact chosen
colors. Choose **Generate**, review the candidate, and **Apply edit**. **Choose a palette**
also adds colors to new Studio and Explorations prompts. Generated artwork uses model-driven
source revisions; its color interpretation remains subject to preview review.

The library is shared on this installation and stored in `.work/harness/palettes/` beside
prompt artifacts (under the active release checkout when deployed). Project JSON retains
applied colors/source references independently of the palette record. Prompt palette
creation uses the same model configuration as artwork generation and never executes source.
