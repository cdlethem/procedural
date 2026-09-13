# Prompt studio and explorations

Prompt studio lets you build a 640 × 640 layered image from the editable workflows in
Procedurals and from generated p5.js layers. Start with a workflow when you want an
existing technique with its familiar controls; use a prompt when you want the studio to
propose a new p5.js layer or a complete arrangement. A clearly labelled candidate can
temporarily appear on the canvas for review, while the committed document remains unchanged
until you apply it.

## Studio: make a layered image

1. Open **Studio** and choose a workflow from **Add layer** in the layer stack. You can
   combine up to eight layers. On smaller screens, open **Layers** from the bottom bar first.
2. Select a layer, then edit its visible controls. Workflow layers keep their palettes,
   seeds, cut edits, and placement controls. Move layers up or down to change draw order;
   hide a layer to compare it with the composition beneath it.
3. Switch the right editor to **Prompt** (or open **Prompt** from the bottom bar). Describe
   a layer, an edit to the selected layer, or a full composition, then choose **Generate**. The canvas can show the labelled candidate preview;
   apply it only when it is the direction you want. Generating again, editing, or undoing
   discards that preview without changing the committed document.
4. Use **Undo** to return to the preceding committed document revision. Applying a
   candidate and changing one of its declared generated controls each make one undoable
   revision.

The canvas fits the available space while keeping its 640px resolution. Layers, controls,
and prompt details scroll inside their own panels. **Generate** and candidate actions remain
accessible in the prompt editor. Switch back to **Inspector** to adjust a selected layer;
switching panels preserves your prompt draft.

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

## Revise a generated layer

In **Studio**, select the generated layer and choose **Revise with a prompt** in the
Inspector. This opens Prompt with **Edit selected layer** selected. Describe your change. For example: “Keep the branching pattern, make the lines
thinner, and add more space between branches.” The prompt receives the layer’s exact current
source files, declared controls, and current replay inputs. Review the candidate and choose
**Apply edit**; **Undo** restores the previous version. Edits stay within the selected layer.

In **Explorations**, generate an initial sketch, then enter a follow-up and choose
**Revise layer**. If the result contains several generated layers, choose which layer to
revise. A successful revision replaces that layer in the preview. **Generate new sketch**
starts over from a blank composition. While either request is pending or fails, the last
successful image and source remain visible. Explorations does not change Studio’s document
or undo history. Leaving the page discards unsaved exploration state.

## Keep layers for other sketches

Below a generated layer in Explorations, or under **Save to your layer collection** in
its Studio inspector, enter a **Layer name** and choose **Save layer to gallery**. This saves a snapshot of that layer with its source,
controls, seeds, and rendered preview on this installation. In Studio, apply a candidate
before saving its revision. Give a revised version a new name to keep both versions.

Open the gallery’s **Saved layers** category to search saved work, inspect its image and
source, and choose **Add to studio**. Studio’s **Add layer** picker also includes saved
layers, so you can reuse them in an existing sketch. Each insertion creates an independent,
editable copy and counts toward the eight-layer limit. Revising a copy leaves the saved
original intact. The destination sketch keeps its own background.

Saved layers remain available after leaving the page or restarting the app. They belong to
this installation’s shared local collection; they are separate from package studies.
Backing up the collection requires the harness store, including its artifact files.

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

In Studio, **Open** opens saved projects and **Import JSON**. The **Export** menu provides
**Export PNG** and **Export JSON**.

**Export PNG** saves the currently composited raster. **Export JSON** saves the document,
including content-addressed hashes for generated source and preview artifacts. Those hashes
refer to the local harness artifact service; JSON by itself does not bundle the source files
or PNGs, and it cannot restore them on another machine or after that service’s artifacts
are removed. Use a supported harness source or studio-bundle export when you need the
available per-layer source files and replay inputs. A mixed composition has no supported
single portable sketch export; a preview PNG is not editable source.

Prompt generation is currently scoped to p5.js. It does not add Processing Java support,
portable recipe execution, or any new catalog target support.
