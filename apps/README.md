# Procedurals gallery and studio

A Next.js gallery of **24 interactive p5.js studies**, with a separate canvas studio for
layering all 24 techniques and an API reference for all 31 package operations. A Go service saves
projects as JSON. Rendering runs locally in the browser and uses the existing package.

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

## Explore and compose

Search or filter the gallery and open a study for an interactive canvas, sliders, exact
numeric inputs, color controls, and a technique guide. **Sketch source** starts open with a formatted,
highlighted view of the actual drawing code with a copy button. Operation links open API
pages explaining the operation, constructor inputs and returned data with runnable JavaScript
examples. Expand the detailed contract for constraints, semantics and binding information.

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
explicit server saves keep named projects. JSON export/import moves editable documents
between browsers. PNG export saves the currently rendered canvas.

3D techniques render to transparent WebGL buffers before composition. Raster techniques
create their own source artwork; they do not filter lower layers. Spring motion exposes
an explicit tick count, so changing its settings produces repeatable snapshots.

These bounded controls are example configurations, not package operation defaults or
recommended artistic ranges. Studio documents use the `studio-v3` app binding, separate
from the portable recipe grammar. Imports from the exact `studio-v1` and `studio-v2` releases migrate
their palettes and controls with empty manual-cut histories; other stale or invalid bindings are rejected.

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

See [architecture](../docs/web-app-architecture.md) for boundaries and the future prompt
integration direction. Prompts/MCP and arbitrary operation graphs are not implemented.
