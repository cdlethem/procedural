# p5.js Canvas2D adapter prerequisites

Owner: JavaScript target investigation. Date: 2026-09-07. Status: prerequisite finding, not an adapter implementation or a support claim.

This records the route to test the reviewed [`drawing.fresh-raster-2d`](../catalog/drawing/fresh-raster-2d.json) profile in an actual p5.js browser runtime. It does not change the catalog, add a package export, or grant the target any validated status.

## Local findings

The JavaScript package is currently a small ESM-only pure package:

```json
{
  "name": "@procedurals/javascript",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.js"
}
```

At investigation time it has no dependency declaration, package lock, `node_modules`, p5 bundle, browser page, browser-test runner, or browser harness. The workspace has no root lock file either. Node is `v22.22.1` and npm is `9.2.0`. `chromium`, `chromium-browser`, `google-chrome`, and `playwright` are absent from `PATH`; the standard Linux Playwright browser cache is absent as well. These facts mean that the existing JavaScript drawing results are pure-validator and simulated-state results only. They are not p5.js, Canvas2D, or browser evidence.

The frozen profile requires an exclusively owned, fresh density-1 surface from `1 × 1` through `2048 × 2048`, opaque RGB24 background, source-over ordering, round segments, and one-fill strict-convex quads. It rounds each accepted command coordinate and width once to binary32 before native drawing; it never delegates validation, conversion, topology, batch atomicity, or lifecycle state to p5. The existing internal `drawing.js` and `drawing-state.js` therefore remain the portable validation and state boundary. A browser adapter only leases a fresh surface and issues already-normalized slots in order.

The portability design already names p5.js as the Canvas2D/WebGL target, requires actual native adapter integration rather than mocks, and says that the first browser preview adapter will be p5.js. Those documents do not provide a browser runtime or a p5 dependency. This investigation does not broaden the reviewed profile to WebGL.

## Recommended adapter boundary

Implement the first native route as an **internal p5 P2D/Canvas2D adapter**, alongside the existing internal drawing files. It should accept a p5 instance supplied by the integration and create `p.createGraphics(width, height, p.P2D)`. p5 documents that `createGraphics()` returns a separate graphics buffer and that P2D is its default; passing `P2D` makes the required backend explicit. Do not draw through the parent sketch canvas and do not expose this adapter from `src/index.js`.

Before background initialization, the adapter must set the graphics buffer density to one and verify all of these facts:

1. `graphics.pixelDensity()` returns `1`.
2. Logical dimensions are the validated environment dimensions.
3. The backing canvas dimensions are exactly the logical dimensions, rather than device-pixel-ratio scaled.
4. `graphics.drawingContext` is a real `CanvasRenderingContext2D`, not WebGL or an emulated test double.

Static absence of a p5 P2D graphics factory is `UNSUPPORTED_CAPABILITY` at begin preflight. The checks above occur only after a graphics buffer was acquired: allocation failure and a returned buffer with wrong density, dimensions, backing storage, or Canvas2D context are `RESOURCE_FAILURE`, before initialization. Canvas state/background initialization or context failure after readiness is `RENDER_FAILURE`. p5's documented default density follows the display; explicitly setting density one is thus required rather than an optimization. The native harness must exercise a device scale factor above one to prove this assertion is meaningful.

Draw against the verified `CanvasRenderingContext2D`, not the p5 shape convenience API. This avoids p5 colour mode, style persistence, and shape construction rules becoming unwritten profile semantics. For a new owned buffer, initialize identity transform, full-surface clip, `globalCompositeOperation = "source-over"`, opaque RGB background, and the relevant stroke/fill state. For every normalized record, establish the complete state it consumes, draw one path, and restore state before the next record:

- A `segment2` uses `beginPath`, `moveTo`, `lineTo`, `lineWidth`, `lineCap = "round"`, sRGB `strokeStyle`, and `globalAlpha = opacity8 / 255`, followed by one `stroke`.
- A `quad2` uses one closed path and one `fill`, with its sRGB `fillStyle` and the same alpha conversion. It must not split the quad into two triangles, which could make an alpha seam.

Use the `FrameState` plans directly: normalize a full batch before its first canvas call, visit slots in source order, skip no-op slots, commit only after every native call succeeds, and resolve every token/lease in `finally` paths. A Canvas exception or lost context aborts the frame and releases the buffer; it cannot return a completed surface. After successful transfer, integration owns the `p5.Graphics`; the adapter must not later remove it. The integrating caller releases it with `graphics.remove()` when done, which p5 documents as removing the graphics buffer element.

This is deliberately a main-thread browser prerequisite. Worker/OffscreenCanvas, WebGL, fonts, assets, resize reuse, borrowed parent canvases, and browser-preview sandboxing require separate capability contracts and tests. The fresh P2D buffer makes the parent-isolation test concrete: modify parent context transform, clipping, style, and pixels, render a frame, then prove those parent observations are unchanged.

## Pinned native harness route

Use a small Node ESM program, for example `tests/native/p5js-frame-native.mjs`, rather than a test framework. It should launch a real browser with Playwright, serve a local harness page over loopback HTTP, and emit one JSON result to stdout. A local server avoids `file:` module and origin behaviour. The page loads the pinned local p5 bundle, creates an instance-mode sketch, and invokes the internal adapter. It must not use Node canvas, jsdom, a fake p5 object, or screenshots as the primary oracle: those do not establish browser Canvas2D behaviour. Read pixels by `getImageData` from the actual graphics context; screenshots and PNGs may be optional diagnostics under ignored `.work/` paths.

Pin these test-only dependencies exactly when the adapter work is authorized:

| dependency | exact version selected on 2026-09-07 | purpose |
| --- | --- | --- |
| `p5` | `2.3.2` | real P2D graphics buffer and browser API |
| `playwright` | `1.63.0` | Node library launch of its matching Chromium binary |

Record the resulting `package-lock.json` integrity entries and Playwright's installed browser revision in every native report. Do not substitute a system Chrome: none is available locally and it would decouple browser behaviour from the pinned harness. The Playwright package owns a matching browser version, so a version bump must update both the lock and installed browser and re-run the registered suite. This route needs only the `playwright` library, not `@playwright/test`, because the repository's native harnesses already own their JSON protocol and assertion reporting.

The following commands are the proposed provisioning commands; they were **not run** for this investigation and should be used only in the future authorized adapter change:

```sh
cd packages/javascript
npm install --save-dev --save-exact p5@2.3.2 playwright@1.63.0
PLAYWRIGHT_BROWSERS_PATH=.work/p5js-playwright-browsers \
  npx playwright install chromium
npm ci
PLAYWRIGHT_BROWSERS_PATH=.work/p5js-playwright-browsers \
  node tests/native/p5js-frame-native.mjs
```

Use a project-local ignored browser directory so an inspection can bind the exact installed revision. In CI, install dependencies first and cache that directory by the lock-file/Playwright version; do not silently reuse a browser for another Playwright version. If Chromium needs OS libraries, first inspect with `npx playwright install-deps chromium --dry-run`; installing OS dependencies is a separate host mutation, not part of the harness command above.

The relevant upstream references are p5's [`createGraphics` API](https://p5js.org/reference/p5/createGraphics/), [`pixelDensity` API](https://p5js.org/reference/p5/pixelDensity/), and [`p5.Graphics` cleanup API](https://p5js.org/reference/p5/p5.Graphics/); Playwright documents that each release requires matching browser binaries and provides [`install chromium`](https://playwright.dev/docs/browsers). p5 `2.3.2` and Playwright `1.63.0` were the current stable npm releases checked for this record; the future lock, not a floating `latest` tag, is the evidence binding.

## Native harness acceptance scope

Register the browser suite before running it, following the Java2D registration shape. It should report only this profile's actual Canvas2D observations and include source, fixture, catalog, harness, Node, package-lock, p5, Playwright, browser, and platform identities. The initial matrix should mirror the registered Java2D groups:

1. Background-only dimensions/density/opaque RGB at `1×1`, representative, wide, tall, and maximum surfaces.
2. Boundary and clipping records including binary32 ULP-in/out coordinates, x and y overscan, width `1/256`, `1`, and `M`, invalid values, fully offscreen records, and one central crossing. Record minimum-width coverage without inventing a coverage guarantee.
3. Source-over alpha/order panel, opacity zero, opaque fill, both quad windings, and no diagonal seam in a translucent quad's interior.
4. Alternating segment/quad style reset, round-cap extension, identity/full clip of the owned graphics buffer, and parent transform/style/pixel isolation.

The browser context must set an explicit viewport and `deviceScaleFactor: 2` for at least the density proof. A single run should keep page/browser lifecycle bounded and release every graphics buffer. All output must identify itself as native p5.js Canvas2D evidence if it actually launches the pinned browser; before that, the JavaScript target remains pure-core only. Lifecycle fault injection, CP1 routing, and visual corpus reproduction are separately registered work and must not be reported as covered by groups 1--4.

The adapter harness also needs focused ownership regressions before native support is claimed. Use its internal factory/context seam to throw a `FrameError` from acquisition, initialization, a drawing call, and end finalization; each unfinished case must leave the portable state aborted and remove the one owned graphics buffer. A completed frame must stay completed when a later method is misused, and `P5Frame.releaseCompleted(graphics)` must clear the backing dimensions and call `remove()` once across two calls. Fully normalize both an empty batch and a converted-noop-only batch while a supported `isContextLost()` probe reports loss; neither may commit its input count and both must report `RENDER_FAILURE` with a null index. A seam whose `remove` accessor throws must leave the original lifecycle error code/index intact while cleanup bookkeeping continues.

## Read-only checks used for this finding

These commands reproduce the local availability facts without changing dependencies or rendering:

```sh
cat packages/javascript/package.json
node --version
npm --version
test -d packages/javascript/node_modules
test -f package-lock.json
test -f packages/javascript/package-lock.json
command -v chromium
command -v chromium-browser
command -v google-chrome
command -v playwright
test -d "$HOME/.cache/ms-playwright"
rg -n -i 'p5\\.js|playwright|puppeteer|canvas2d' packages/javascript docs design
```

The last command and the package inventory show no existing browser adapter/harness to extend. The current `tests/native/drawing-javascript.mjs` remains useful for the pure contract but cannot substitute for this route.
