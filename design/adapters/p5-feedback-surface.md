# p5 retained feedback surface — reviewed adapter contract

Root decision, 17 September 2026. Status: reviewed for implementation, not target acceptance.
This document is the normative host-adapter contract for `createP5FeedbackSurface` version
0.1.0. It adopts the independent runtime investigation below with these resolved choices.
The original proposal in `.work/expansion-full/framebuffer-design.md` is superseded.

Artist task: build a layered print that retains, warps and fades its previous pixels while
adding a separately editable source motif. The adapter removes ping-pong allocation,
premultiplied texture composition, pass isolation, reset and replacement lifecycle work.
The alternative is explicit native p5 framebuffers and shader wiring. Ordinary source art,
affine parameters and logical scheduling stay in the example. Reusable output is a borrowed
p5 framebuffer plus explicit logical tick, not portable geometry or a snapshot.

Motivating corpus: the external plan's family25 (Davis audiovisual work and Levin video
systems), adjacent family24 (Davis Run Run Blood and Reas Atomism). See
[the source-backed family map](../../docs/external-art-p5-expansion-plan.md) and
[corpus manifest](../../evidence/external-art/2026-09/corpus.json). These establish a useful
retained-image task, not the artists' exact internal algorithms. An original print study
and withheld asymmetric glyph source/anisotropic transform test transfer. Neither is an
artist recreation. This is separate from the pure periodic fluid-field operations.

## Resolved decisions

- One private shader cached per p5 WebGL context; context owns its lifetime. Surface owns
  exactly two framebuffers. No fabricated public shader disposal or promise to reclaim
  inaccessible p5 allocation failures.
- Source supports loaded `p5.Image` and `p5.Graphics` with Canvas2D renderer only in this
  slice. WEBGL graphics, framebuffer sources, video and DOM media are unsupported source
  types and give INVALID_INPUT. Images/graphics are borrowed, never removed.
- Required capability: p5 2.3.2 WEBGL programmable highp fragment shader, two complete
  RGBA8 LINEAR fixed-size attachments. No fallback. Factory preflight rejects other p5
  versions as UNSUPPORTED until separately reviewed.
- Active p5 clipping or currently constructing a clip is an unsupported entry state:
  INVALID_STATE before framebuffer mutation. Arbitrary raw GL mutations outside p5 are
  outside this adapter's state-preservation contract. Ordinary p5 transform, camera,
  tint, shader, blend, erase, stroke/fill and external active framebuffer must be preserved.
- Use the clip-space quad orientation described below, not source-dependent flips.
- Expose exactly the factory, stable-code error class and methods/getters below. Native
  source objects stay out of the portable operation catalog. No generic render graph.
- All implementation and eight listed native validation groups remain required before
  acceptance. Native software WebGL evidence is a bounded profile, not cross-driver proof.

## Reviewed runtime investigation and normative behavior

### Independent review record

Review date: 2026-09-17. No adapter implementation, native render or support acceptance was performed. This is a small host adapter for image feedback, not a portable numerical operation or render graph. Apply `skills/capability-and-adapter-boundaries/SKILL.md` and the existing leased native harness. The original proposal needs the corrections below before implementation.

## Bound authority

Installed package `.work/environments/p5js/node_modules/p5/package.json` reports p5 **2.3.2**. Inspected unminified runtime `.work/environments/p5js/node_modules/p5/lib/p5.js`, SHA-256 `354b31a0d81ce0ddb24afe1a5b035f938417248c64f0c81112092b224d1bbdbb`.

Relevant source locations in that exact artifact:

| Lines | Finding |
|---|---|
| 69100–69176 | Framebuffer options, density, dimension adjustment, explicit dimensions disable autosizing; constructor clears through `draw`. |
| 69200–69209, 69295–69304, 69547–69552 | `resize(width,height)`, `pixelDensity(density)`, texture destruction/recreation; native resize is not transactional. |
| 69736–69743, 126270–126298 | Public framebuffer `remove()` deletes textures/framebuffer resources and removes renderer registrations. |
| 69788–69812, 69915–69935 | `begin` pushes active framebuffer and renderer state and sets framebuffer camera; `end` pops/restores framebuffer, camera, viewport and clipping. |
| 69987–69991 | Framebuffer `draw(callback)` lacks `try/finally`; adapter must not use it for an exception-sensitive pass. |
| 61962–61987 | Shader silently substitutes empty texture when a non-antialiased framebuffer sampler equals the active write framebuffer. This is not a hazard error. |
| 68130–68143, 65442–65456 | Texture defaults LINEAR; wrap inherits renderer state. `textureWrap` mutates all cached textures, including borrowed sources. |
| 124624, 124628, 125036–125039 | Images upload with premultiplied alpha; p5 native shaders also output premultiplied alpha. |
| 124730–124769 | BLEND uses ONE / ONE_MINUS_SRC_ALPHA; REPLACE uses ONE / ZERO. |
| 125053–125073 | Oversized textures are silently dimension-clamped. |
| 125712–125749 | Compilation/link failures throw. Successful shader exposes private `_glProgram`, `_vertShader`, `_fragShader`; no public shader remove/dispose. Failed compilation can leave inaccessible locally allocated handles. |
| 126351–126356 | Framebuffer camera yScale=-1 intentionally makes framebuffer samples match image/graphics texture orientation. |
| 126360–126448 | Framebuffer pixel reads expose stored bytes; region conversion does not explicitly unpremultiply. Do not treat framebuffer `get()` as a reliable straight-RGBA oracle. |

Official public [createFramebuffer reference](https://p5js.org/reference/p5/createFramebuffer/) was read on this date. It documents the options and manual sizing behavior, but does not establish shader alpha or disposal semantics. Runtime source above is the version-bound authority for those details.

## Blocking changes to the proposal

1. **Premultiplied composition:** remove the division by output alpha. Let `H=historySample*decay`, `S=sourceSample*sourceOpacity`, scaling all four channels. Output `S + H*(1-S.a)`. Both inputs and output are premultiplied RGBA in the p5 texture color encoding; this is not linear-light color blending. Require `p.REPLACE` while writing the completed result. This avoids accidental dependence on destination contents and inherited caller blend mode.
2. **Borrow duration:** `frame` is the current borrowed live framebuffer, not a snapshot. It can be overwritten by a later step. Its view is valid only until the next mutating adapter call; callers must acquire the getter again and must never begin, clear, resize or remove either owned buffer.
3. **No invented shader disposal:** p5.Shader has no public `remove`. Recommended small contract: one private cached shader per live p5 context, shared by this adapter's instances; surfaces own their two buffers, while p5/context lifetime owns the cached shader. Dispose deletes both buffers and drops source references. Do not claim per-surface shader GPU deletion or complete cleanup of allocations internal to a failed p5 constructor/compiler. An alternative pinned private-handle deletion implementation needs an explicit root decision and extra lifecycle tests.
4. **Dimension preflight:** safe positive integers for width/height/density; checked physical dimensions `width*density`, `height*density` must be safe integers and no larger than `MAX_TEXTURE_SIZE`. Reject excess as `UNSUPPORTED` before allocating rather than permit p5's silent clamp. Verify returned dimensions/format. WebGL allocation limits below this maximum remain host failures.
5. **Resize schedule:** use `resize(width,height)` with density fixed for surface lifetime. Validate first, create/clear a replacement pair, then commit replacements and tick=0 and remove old pair. This makes ordinary setup failures leave the old pair usable, unlike sequential in-place p5 `resize`. During successful resize peak attachment storage is four RGBA8 surfaces; state this cost. If root prefers in-place resizing, failures must explicitly invalidate the surface instead of promising unchanged state.
6. **No feedback-loop reliance:** preflight that neither owned framebuffer is the caller's active target. Always sample current and write the other. Sources are loaded p5.Image, live p5.Graphics or null, never p5.Framebuffer/FramebufferTexture. Reject own-context active write aliases; ordinary supported graphics canvases have separate backing surfaces. Reentrancy is invalid.
7. **Narrow error claim:** shader compile/link errors throw in this version; many GL driver errors do not. Check context loss and framebuffer completeness during creation/replacement. Do not promise arbitrary driver-error detection or rollback after context loss. Native context loss makes the surface unusable; reconstruct after the host restores/recreates its context.

## Resolved narrow behavior recommended for freeze

`createP5FeedbackSurface(p,{width,height,density})` requires a live p5 WEBGL renderer, programmable fragment highp floats, and two complete RGBA8 attachments. Explicit fixed framebuffer options: `format:p.UNSIGNED_BYTE`, `channels:p.RGBA`, `textureFiltering:p.LINEAR`, `depth:false`, `stencil:false`, `antialias:false`, explicit width/height/density. No global p5, animation loop, time, implicit source generation or fluid integration.

Return `{step,draw,reset,resize,dispose,get frame,get tick}`. `step({decay,transform,source,sourceOpacity})` requires all four fields; source may be null. No undocumented defaults. Decay/opacity are finite numbers in [0,1]. Matrix is an ordinary array of six finite numbers. GPU arithmetic is approximate: do not call this an exact affine map. Reject values that cannot be represented as finite float32, and reject row absolute sums beyond max finite float32 so the shader's affine intermediate arithmetic cannot overflow. These validation restrictions are host-adapter design choices, not corpus observations.

Coordinates are normalized **top-left**, x right, y down. Destination pixel centers are `((i+.5)/(width*density),(j+.5)/(height*density))`. History maps through `[a,b,c,d,e,f]`: `(a*x+c*y+e,b*x+d*y+f)`. Identity is `[1,0,0,1,0,0]`; translation e>0 reads farther right, visibly moving retained content left. Out-of-domain test uses the mapped center: x<0 or x>1 or y<0 or y>1 yields all-zero history. Inside, LINEAR interpolation clamps to edge texel centers. The boundary is a hard center-domain mask, not interpolation against an infinite transparent border. Source is untransformed, stretched to destination bounds with LINEAR sampling; null is zero.

Use the same top-left sample convention for images/graphics and history. With a clip-space full-screen quad that bypasses p5's framebuffer camera, emit destination y=0 at GL's bottom (`gl_Position.y=2*y-1`) so the stored texture remains in p5's normal convention. With p5 matrix-based geometry instead, use its framebuffer camera and do not add a second y flip. Pick one implementation and verify with an asymmetric native source; never compensate for a failed test with undocumented source-specific flips.

Clamp actual sample UVs to source/history half-texel limits after computing the history domain mask; this removes dependence on inherited wrap modes at the edge. Do not call global `p.textureWrap`, which mutates borrowed cached textures. Source physical size comes from its actual backing image/graphics surface, including density. Null source can bind the current history to both sampler slots with a disabled source flag, keeping both samplers valid without an adapter-owned dummy image. p5 may still allocate its own context-level empty texture; the adapter must not promise zero runtime allocations.

Each step validates completely, checks tick+1 remains a safe integer, begins the other framebuffer, clears it transparent, binds the cached shader, assigns all uniforms (including source flag and both samplers every pass), draws a full-screen pass under REPLACE, and ends in `finally` after a successful begin. Swap and increment only after the pass and end complete. A thrown pass leaves current/tick unchanged; scratch may be dirty and is cleared on retry. Prevent inherited erase/stroke/tint/model/camera/clip/depth state from changing the pass. Preserve the caller's p5 state and active framebuffer; raw external GL mutations and active clipping need either explicit preservation tests or a documented unsupported entry condition. Do not assert that push/pop alone restores arbitrary raw GL state.

`draw(x,y,width,height)` invokes p.image on the current buffer at caller placement. Finite x/y and positive finite draw sizes; current p5 matrices, imageMode, tint and blend style intentionally apply, just as for p.image. It does not advance state. This makes it an ordinary compositing convenience rather than a second renderer-state policy.

`reset()` clears both attachments and sets tick=0 after success. Successful reset/resize makes later output depend only on subsequent explicit steps. Reset is not a device-failure transaction; a context error can invalidate the surface. Canvas resize does not resize the explicitly sized surface. `dispose()` is idempotent, removes the two owned framebuffers, never removes borrowed source images/graphics, and releases adapter references. After disposal all getters/methods except dispose throw `DISPOSED`.

Errors: malformed values/source type `INVALID_INPUT`; required capability/size unsupported `UNSUPPORTED`; use after dispose `DISPOSED`; context loss `CONTEXT_LOST`; active-owned-target/reentrancy `INVALID_STATE`. Host shader/allocation exceptions preserve their original cause. Do not add a general renderer compatibility promise from one software WebGL test.

## Necessary native fixtures, before root acceptance

Run existing browser harness through the shared machine lease. Record p5 hash, browser/GL renderer/version, context attributes, shader-source hash, adapter hash, physical resolution and source size/density. Separate analytical byte checks from visual study review. No broad webapp or port tests.

1. **Asymmetric orientation:** 8x6 source, four distinct quadrants plus one unequal corner mark, first from p5.Image and then p5.Graphics Canvas2D. Identity first/second/third steps retain orientation; translation e=1/8 shifts one logical pixel left at density1. Repeat at density2 and non-square destination/source stretch. If WEBGL graphics sources are claimed, include one explicitly.
2. **Premultiplied analytical alpha:** solid straight red alpha128/255, first step opacity1 gives stored bytes near [128,0,0,128]. A null-source step decay=.5 gives [64,0,0,64]. Next, source straight blue alpha128/255 over that decayed red, decay1, gives approximately [32,0,128,160]. Separately reset/reseed the original alpha128 red, then blue alpha128 over it gives [64,0,128,192]. Inspect raw framebuffer bytes and composite onto black and white; do not use screenshots alone or framebuffer.get() alone. Interior tolerance at most2 per channel for these short sequences. Transparent colored source must not inject visible RGB.
3. **Domain/filter:** translated mapped centers outside each side are transparent; exact boundary maps clamp to edge, not opposite edge. Nontrivial affine half-pixel translation checks LINEAR interpolation on premultiplied values. Caller REPEAT/MIRROR wrap must not leak through. SourceOpacity0 matches null source; decay0 discards history but preserves source.
4. **Ping-pong/source updates:** verify buffer identities alternate and no read/write equality occurs; mutate the same borrowed graphics object between steps and prove new pixels upload. Replace source, then null source, checking no stale sampler cache. Test two surfaces interleaved to reveal cached-shader uniform contamination. Own frame supplied as source rejects before write.
5. **Reset/resize:** retained full-frame byte array after reset is transparent, tick0; subsequent fixed step sequence equals fresh sequence on same context. Replacement resize changes both physical dimensions, clears, invalidates borrowed references and retains fixed density; invalid/oversized resize leaves current pixels/tick unchanged. Main-canvas resize leaves surface dimensions fixed.
6. **State isolation and exceptions:** hostile caller translate/rotate/imageMode/tint/ADD/noFill/stroke/shader/erase plus external framebuffer active; compare an ordinary sentinel draw before/after adapter call. Test clipping entry policy explicitly. Inject a pass exception using a narrow harness hook or temporary method wrapper, verify balanced begin/end, unchanged current/tick, restored target, and successful retry. This exception-injection check is not renderer support evidence by itself.
7. **Lifetime/errors:** invalid input leaves complete retained pixels/tick unchanged; double disposal harmless; getter/method after disposal gives DISPOSED; borrowed image/graphics remains usable; framebuffer registry loses exactly two entries. Test factory/replacement allocation failure cleanup for returned owned objects, without asserting inaccessible p5 internals were reclaimed. Context-loss behavior must be tested if advertised as supported recovery; this contract offers reconstruction only.
8. **Artist study + transfer:** original layered print feedback with explicit logical steps; independently edit affine warp, decay and source motif, show startup/intermediate/later/reset/reload/save. Withhold a second asymmetric open glyph motif and anisotropic transform for transfer on the same adapter. Report full-source/history equality for replay within the accepted renderer; no corpus recreation or fluid-simulation claim. Include tiny, study and larger physical framebuffer timing with measured memory dimensions, not an unbounded performance guarantee.

The resolved choices above freeze shader ownership and source/state scope. Native numerical/render behavior remains unverified until implementation and leased tests exist.
