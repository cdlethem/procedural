# Retained feedback surface for p5.js

A feedback print carries earlier pixels into each new frame. `createP5FeedbackSurface` keeps two transparent RGBA8 framebuffers, reads the current one through an editable affine map, fades it, and composites a fresh p5 image or Canvas2D graphics source. The [Feedback Print example](../packages/javascript/examples/feedback-print/index.html) draws a separate motif on every explicit logical step. The example explores retained-image questions in external corpus family 25 (Davis audiovisual work and Levin video systems), with adjacent family 24 (Davis *Run Run Blood* and Reas *Atomism*). The [source-backed family map](external-art-p5-expansion-plan.md) and [corpus manifest](../evidence/external-art/2026-09/corpus.json) explain that provenance.

```js
import { createP5FeedbackSurface } from './p5-feedback-surface.js';

const surface = createP5FeedbackSurface(p, { width: 600, height: 600, density: 1 });
const motif = p.createGraphics(600, 600, p.P2D);
motif.clear();
// Draw editable source art into motif.
surface.step({
  decay: 0.94,
  transform: [1, 0, 0, 1, 0.01, 0],
  source: motif,
  sourceOpacity: 0.5,
});
p.push();
p.translate(-p.width / 2, -p.height / 2); // WEBGL canvas center to top-left placement
surface.draw(0, 0, 600, 600);
p.pop();
```

All four `step` fields are required. The controls have these canvas effects:

| Control | Canvas effect | Required bounds |
|---|---|---|
| `decay` | Scales the retained premultiplied color and alpha before the new source is placed over it. Zero discards history. | Finite number in `[0,1]` |
| `transform` | Maps destination positions to history sampling positions. `[a,b,c,d,e,f]` maps `(x,y)` to `(a*x+c*y+e, b*x+d*y+f)` in normalized top-left coordinates. Positive `e` moves retained content left. | Array of six finite float32-representable numbers; each row absolute sum must fit float32 |
| `source` | New unwarped motif, stretched to the surface. `null` adds no fresh pixels. | Loaded `p5.Image`, Canvas2D `p5.Graphics`, or `null` |
| `sourceOpacity` | Scales fresh premultiplied color and alpha. Zero leaves only faded history. | Finite number in `[0,1]` |

These hard bounds are adapter design choices. The example's values are artistic settings, not corpus-derived recommended ranges. Destination/history coordinates use normalized top-left pixel centers. History centers outside `[0,1]` are transparent; centers on the boundary sample the edge texel. Sampling is LINEAR and clamped to half-texel centers, including when the caller has selected REPEAT or MIRROR texture wrapping. Composition uses premultiplied source-over in p5 texture color encoding, not linear-light blending.

The factory requires a live p5 **2.3.2 WEBGL** instance with fragment `highp`, and positive safe-integer `width`, `height`, and `density`. Physical dimensions are `width*density` by `height*density`, checked against `MAX_TEXTURE_SIZE` before allocation. The surface is fixed-size: resizing the main canvas does not resize it. `resize(width,height)` keeps the original density, creates and clears a replacement pair, then commits it and resets `tick` to zero. Peak color attachment storage during replacement is four surfaces, approximately `4 × physicalWidth × physicalHeight × 4` bytes, before host overhead. `reset()` clears both buffers and sets `tick` to zero. Neither advances time implicitly.

`frame` is a borrowed live p5 framebuffer. Read or draw it before the next mutating adapter call and reacquire it afterward. Do not begin, clear, resize, or remove it. `draw(x,y,width,height)` calls p5 `image` at the supplied placement, so the caller's image mode, tint, blend and transform apply. `dispose()` is idempotent and removes exactly the two owned framebuffers; borrowed source art remains usable. The shader is cached privately per p5 WebGL renderer and lives with that context.

Errors use `P5FeedbackSurfaceError.code`: `INVALID_INPUT` for malformed values or unsupported source types, `UNSUPPORTED` for unavailable required capability or physical size, `INVALID_STATE` for reentrancy, an active owned framebuffer, or active clipping, `CONTEXT_LOST` for a lost WebGL context, and `DISPOSED` after disposal. Shader and allocation host exceptions retain their original cause. A lost context requires reconstruction after host restoration. Arbitrary raw GL mutations by the caller are outside state preservation; ordinary p5 transform, camera, shader, color, blend, erase, and active external framebuffer state are preserved across adapter passes. WEBGL graphics, video, DOM media, and framebuffer source objects are outside this source slice.

The [native browser check](../tests/native/p5-feedback-surface-javascript.mjs) runs under the shared render lease. It checks raw framebuffer bytes, asymmetric source orientation, density, interpolation, lifecycle, state and exception handling, an original editable print and a withheld open-glyph transfer. Its software WebGL profile is bounded evidence for this p5 version, not a cross-driver guarantee or shared target acceptance.
