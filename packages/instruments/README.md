# @procedurals/instruments

Version 0.2.2 provides 117 editable p5.js study IDs: 99 canonical instruments, including 14 shared discovery families. It uses `@procedurals/javascript` 0.2.2 operations; this package supplies current drawing constructions and guides, **not** new operation certification or a portable recipe executor. The package does not bundle p5.js or own a canvas, user documents, storage, or compositing.

## Install and draw

Install this package together with its exact `@procedurals/javascript` peer dependency. For the repository's GitHub release workflow, once `web-toolkit-v0.2.2` has been published, install the release assets:

```sh
npm install --save-exact \
  https://github.com/cdlethem/procedural/releases/download/web-toolkit-v0.2.2/procedurals-javascript-0.2.2.tgz \
  https://github.com/cdlethem/procedural/releases/download/web-toolkit-v0.2.2/procedurals-instruments-0.2.2.tgz
```

The caller provides p5.js. The library draws transparent marks in a 640-unit reference coordinate system; the caller creates and clears a canvas/graphics buffer, chooses background and transforms, composites layers and schedules drawing:

```js
import {
  createInstrument, definition, validateInstrument,
  drawInstrument, prepareInstrument, canPrepareInstrument,
} from "@procedurals/instruments";

const input = createInstrument("perceptual-bands");
input.params.bandCoverage = 0.58;

// Call from your p5 lifecycle after creating the host canvas.
async function paintInstrument(p, input, cancelled = () => false) {
  const checked = validateInstrument(input);
  if (canPrepareInstrument(checked.technique) &&
      !await prepareInstrument(checked, cancelled)) return false;
  if (cancelled()) return false;
  const webgl = definition(checked.technique).renderer === "webgl";
  const graphics = p.createGraphics(640, 640, webgl ? p.WEBGL : p.P2D);
  try {
    // p5.Graphics does not install every instance drawing constant.
    for (const key of ["CLOSE", "CORNER", "CENTER", "ROUND", "TRIANGLES"])
      graphics[key] = p[key];
    graphics.pixelDensity(1);
    graphics.clear();
    if (webgl) graphics.noLights();
    drawInstrument(graphics, checked);
    p.push();
    try {
      p.imageMode(p.CORNER);
      p.noTint();
      p.image(graphics, 0, 0, 640, 640);
    } finally { p.pop(); }
    return true;
  } finally {
    if (webgl)
      graphics.drawingContext.getExtension("WEBGL_lose_context")?.loseContext();
    graphics.remove();
  }
}
```

Use a fresh buffer in p5's default RGB/radians/shape modes for each layer. The host
owns its background and layer transforms; the package suppresses standalone-example
background calls and restores the context method even if drawing fails.

`createInstrument(id)` creates independent current defaults (seed 42), and `definition(id)` supplies controls. `validateParameters(id, value)` rejects unknown/missing parameter keys, invalid values and cross-control conflicts. `validateInstrument(value)` validates a complete plain input with exactly `technique`, `seed`, `palette`, `params`, `cutEdits`, returning a fresh value. Use `usesSeed(input)` before offering reseeding; deterministic constructions do not use a cosmetic seed. Preparation is cooperative and owned by the caller, not an automatic background task. `cutEdits` is the retained-rectangle operation input; use `[]` elsewhere. Caller-owned transforms/opacity/layer IDs never enter `InstrumentInput`. Painting is synchronous after any necessary preparation.

## Discover and adapt studies

`@procedurals/instruments/metadata.json` lists the 117 IDs, titles, descriptions, categories, related operation IDs, logical guide/source locations, and 14 named families with their presets. `@procedurals/instruments/guides/<id>.md` provides controls, examples and artist-facing material. `@procedurals/instruments/sources.json` contains the AST-extracted **actual library source**, including local dependencies and imports; each entry is `{ source, path }`, with a logical public repository path such as `packages/instruments/src/adapters/perceptual-color-instruments.ts`. The packaged `src/` includes that editable TypeScript; operation examples may instead refer to actual `packages/javascript/` modules supplied by the SDK package. `@procedurals/instruments/manifest.json` inventories packaged bytes and records the release's actual source commit. JSON package subpaths can be loaded with Node's `with { type: "json" }` import attribute or read as files in a build tool.

Operation IDs identify the computational contracts used by a study, **not** a fresh target-support attestation. Instruments are reusable drawing constructions; studies supply named starting configurations. Related presets are grouped into 14 families rather than counted as separate mechanisms. Creative-review scope is separate from runtime packaging: existing scoped evidence does not certify every possible composition. The `@procedurals/catalog` release remains the source for operation support, versions and attestations.

The package exports `./internal/*` for tightly coupled adapter behavior tests and source inspection. This is **not a stable consumer API**; applications should use the root exports and declarative metadata instead. License and source-specific attribution are included in `LICENSE`, `THIRD_PARTY_NOTICES.md` and retained source notices.

## Build from this repository

From a committed, clean checkout, have Node.js 22.12+ and npm available. Install the package's declared build tools locally before building (this creates only ignored `node_modules`):

```sh
npm install --prefix packages/instruments --ignore-scripts --no-package-lock --legacy-peer-deps
node tools/build_web_toolkit.mjs --output .work/dist/web-toolkit-v0.2.2
```

The release builder checks clean committed inputs, compiles NodeNext ESM/declarations, generates extracted sources from the current public modules, builds catalog/JavaScript/instruments tarballs, offline-installs all three into an isolated consumer, checks bytes and imports, and writes `report.json` plus `SHA256SUMS`. It does not publish or substitute a guessed commit hash. Run it only after the 0.2.2 inputs have been committed; choose a fresh output path. The builder uses the locally installed Babel parser and TypeScript build tools; isolated-stage and final-consumer installation use explicit local inputs with `--offline`. The source-package behavior tests use the declared `tsx` runner.
