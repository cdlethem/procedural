# Procedurals gallery and studio

A Next.js gallery of **24 interactive p5.js studies**, with a separate canvas studio for
layering Field Marks, Path Marks, Placement Marks and Lattice Marks. A Go service saves
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

Search or filter the gallery and open a study to use its original browser controls and
read its technique guide. The **Open in studio** action starts one of the four compatible
techniques as an editable layer. Other studies remain independently interactive in the gallery.

In the studio, add and select layers, change their settings, hide or reorder them, and
adjust opacity. Each layer uses its own seed. Undo/redo preserves document edits. Local
recovery keeps the latest document in this browser; explicit server saves keep named projects.
JSON export/import moves an editable document between browsers. PNG export saves the
currently rendered canvas. The inspector shows controls and keyboard hints. Choose a **Keyboard control**, focus the
canvas, and use `[` / `]` to adjust it. `1`–`8` selects a layer, `R` changes its seed,
`D` duplicates it, and Delete removes it. `Z` / Shift-Z undo and redo; Ctrl/Cmd-Z also
works. Shortcuts pause while typing or adjusting a form control.

These controls select bounded example configurations. They are not new package operation
defaults or recommended artistic ranges. Studio documents are versioned app documents,
separate from the portable recipe grammar. Unknown or stale bindings and invalid imports
are rejected. Only the four listed studio techniques can be layered in this version.

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

Rebuild previews after changing native examples:

```sh
npm --prefix apps/web run capture:previews
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
