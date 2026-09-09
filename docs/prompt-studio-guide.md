# Prompt studio and explorations

Prompt studio lets you build a 640 × 640 layered image from the editable workflows in
Procedurals and from generated p5.js layers. Start with a workflow when you want an
existing technique with its familiar controls; use a prompt when you want the studio to
propose a new p5.js layer or a complete arrangement. A clearly labelled candidate can
temporarily appear on the canvas for review, while the committed document remains unchanged
until you apply it.

## Studio: make a layered image

1. Open **Studio** and choose a workflow from **Add layer**. You can combine up to eight
   layers.
2. Select a layer, then edit its visible controls. Workflow layers keep their palettes,
   seeds, cut edits, and placement controls. Move layers up or down to change draw order;
   hide a layer to compare it with the composition beneath it.
3. Describe a layer, an edit to the selected layer, or a full composition in the prompt
   panel, then choose **Generate**. The canvas can show the labelled candidate preview;
   apply it only when it is the direction you want. Generating again, editing, or undoing
   discards that preview without changing the committed document.
4. Use **Undo** to return to the preceding committed document revision. Applying a
   candidate and changing one of its declared generated controls each make one undoable
   revision.

Generated source layers keep their source artifact and replay inputs in the same history as
workflow layers. Their declared controls remain visible in the inspector. Open the collapsed
**Generated source** disclosure to read the exact source files and use **Copy** or
**Download**; the viewer does not provide direct source editing. Changing a declared control
rerenders the artifact with its recorded random seed, noise seed, and tick. The layer preview
is a rendered image, while the source artifact remains available for reuse.

| Control or scope | Canvas effect | Document effect |
| --- | --- | --- |
| Add layer | Previews a proposed extra layer | **Add layer** commits it as one undoable revision. |
| Edit selected layer | Previews a proposed replacement for that layer | **Apply edit** commits it as one undoable revision. |
| Whole composition | Previews the proposed complete stack | **Use composition** commits the stack as one undoable revision. |
| Generated source control | Rerenders that source layer | Commits the updated control and preview as one undoable revision. |
| Undo / redo | Restores the corresponding rendered document | Moves through committed revisions; it also clears a candidate preview. |

For CutMarks workflow layers, select a region in cut mode and add a horizontal or vertical
cut, or remove the selected region. Changing a seed or base layout clears its manual cuts;
palette and styling changes retain them. Placement, opacity, ordering, visibility, cut
history, and the eight-layer maximum are checked when a document is loaded. Clear errors
leave the current artwork in place.

## Explorations: try one prompt sketch

**Explorations** is a separate, one-shot p5.js playground. Enter a prompt and select
**Generate** to make one static 640px sketch. A successful result shows its image, exact
source files, and **Copy**/**Download** actions, including **Download PNG**. The next prompt
starts a fresh sketch. While a request is pending or fails, the last successful image and
source remain visible. Leaving the page discards exploration state. Explorations does not
alter Studio documents or their undo history.

## Start the local services

From the repository root, install the web dependencies and start the app:

```sh
npm ci --prefix apps/web
python3 tools/run_web_app.py --api-port 8088
```

The Go project store normally listens on port 8080. Use `--api-port 8088` when a local
OpenAI-compatible model already occupies port 8080. Configure that model before starting
Next with `PROCEDURALS_MODEL_URL`, `PROCEDURALS_MODEL_NAME`, and
`PROCEDURALS_MODEL_KEY`; optional temperature and token environment variables are also
supported. The default model URL is `http://127.0.0.1:8080/v1`.

## Saving and exporting

Browser recovery stores the current Studio document locally. Named server projects use the
trusted local Go store. Both accept the current strict `harness-v1` document envelope and
the older exact `studio-v1`, `studio-v2`, and `studio-v3` workflow documents. Loading and
saving validate JSON structure only: they never execute generated source.

**Export PNG** saves the currently composited raster. **Export JSON** saves the document,
including content-addressed hashes for generated source and preview artifacts. Those hashes
refer to the local harness artifact service; JSON by itself does not bundle the source files
or PNGs, and it cannot restore them on another machine or after that service’s artifacts
are removed. Use a supported harness source or studio-bundle export when you need the
available per-layer source files and replay inputs. A mixed composition has no supported
single portable sketch export; a preview PNG is not editable source.

Prompt generation is currently scoped to p5.js. It does not add Processing Java support,
portable recipe execution, or any new catalog target support.
