---
sketch: 2018/Generativos/gaming
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1464
animated: true
techniques: [particles, polar]
primitives: [ellipse, shape]
palette:
  colors: ["#FFFCF7", "#FDDA02", "#EE78AC", "#3155A3", "#028B88", "#01AFD8", "#009A91", "#E46952", "#784391", "#1B2D53"]
  selection: lerp-between
composition: centered
parameters:
  - {name: trailAlpha, default: 20, tried: [60], change: moderate, effect: "heavier per-frame black overlay -> background clearly darker at frame 1; shortens the fading trail (only over later frames)"}
  - {name: gravity, default: 0.7, tried: [0.15], change: none, effect: "no visible change at frame 1; slower downward descent only diverges over later frames"}
  - {name: dotSize, default: "50+cos(vy*0.2)*20", tried: ["110+cos(vy*0.2)*50"], change: none, effect: "center dot visibly larger (~160 vs 50 px diameter) but a small fraction of the canvas"}
  - {name: colorSpeed, default: 0.05, tried: [0.3], change: none, effect: "no visible change at frame 1 (frameCount=1 keeps both at the first palette colour); faster palette cycling only later"}
  - {name: palette, default: "{#FFFCF7,#FDDA02,#EE78AC,#3155A3,#028B88}", tried: "{#01AFD8,#009A91,#E46952,#784391,#1B2D53}", change: none, effect: "dot recolored to cyan/teal (first colour of the commented alt set) instead of cream at frame 1"}
reusable_candidates:
  - {name: aro, signature: "aro(x, y, radius, thickness) -> void", note: "closed filled ring drawn as two polar vertex loops (outer then inner radius); the sketch's ring primitive"}
  - {name: getColor, signature: "getColor(v) -> int (color)", note: "maps a float to a palette colour by lerping between the two nearest palette entries (v%len, v%1)"}
  - {name: fadeTrail, signature: "fadeTrail(alpha) -> void", note: "full-canvas translucent black rect each frame that turns an accumulating sketch into a fading trail"}
  - {name: ringBurst, signature: "ringBurst(cx, cy, count, spread, age) -> void", note: "count concentric aro() rings spread along an axis, radius growing with age and coloured by size (the Aro class)"}
---

## What it draws
Frame 1 (seed 42) is a flat light-gray canvas with a single small cream/ivory dot in the centre. By frame 60 the canvas has faded to near-black and a comet-like form sits in the centre: a pulsing blue ellipse (the live dot, colour cycled to blue at frame 60) with a tapering tail streaming upward above it, grading from blue at the dot through magenta/pink to a faint olive-yellow head. A soft gray-to-white band lingers along the bottom edge. The live dot stays pinned near screen centre while its own fading trail scrolls upward past it. (The sketch's richer feature — vertical columns of stacked colorful rings — only appears when Aro objects are spawned, which normally needs the spacebar; see Experiments.)

## How the code works
Single tab `gaming.pde`, P2D, 960x960. No libraries.

- `setup()` (L4-10): sizes the window, `smooth(8)`, empty `aros` list. No `randomSeed()` call, but the visible path is fully time-driven so the output is deterministic.
- `draw()` (L19-53) is an accumulating animation:
  - Camera: `cx,cy` lerp toward the dot's world `xx,yy` (L21-22); `translate(-cx,-cy)` (L23) follows the dot so it stays centred.
  - Trail: `fill(0,20); rect(0,0,w,h)` (L25-26) — a translucent black overlay each frame. Drawn in the translated world space, so as the camera moves it leaves an uncovered band behind (the bottom gray→white gradient). This is what fades old pixels into a trail.
  - Motion: `vy -= 0.7` clamped to [-100,100] (L28-29), `yy -= vy` (L30) so the dot accelerates downward in world space. `left`/`right` (key `a`/`d`) nudge `xx` but are never set headlessly, so only vertical motion occurs.
  - The dot: `translate(w*0.5, h*0.5)` (L41), `ss = 50+cos(vy*0.2)*20` (L42) — diameter 30-70 pulsing with velocity; `stroke(0,20)`, `fill(getColor(frameCount*0.05))` (L43-44) — colour cycles slowly through the palette over time; `ellipse(xx,yy,ss,ss)` (L45). At frame 60 `frameCount*0.05 = 3.0` → palette index 3 = blue, matching the blue dot.
- `Aro` (L77-102): normally spawned only by the spacebar key (L63), so rings are absent from the baseline and every numeric variant. Each ring lives `random(4,8)` s (`time += 1./60`, L88); `show()` (L94-101) draws 11 concentric `aro()` calls spread across `x+i*180` for `i=-5..5`, radius `s` growing 4→180 via `map(pow((time+cos(time))/life,1.2),0,1,4,180)`, coloured by size `getColor(s)`.
- `aro(x,y,s,b)` (L104-118): one filled ring = a polar loop of `vertex(cos/sin*r)` then a reversed loop at `r-b`; segment count `int(s*PI*0.5)`.
- Palette (L124): active 5-colour set; a commented alternative set on L125. `getColor(float)` (L132-137) lerps between adjacent palette entries.
- **Ring columns (revealed by the `aro_spawn` variant):** spawning an `Aro` every frame at the dot's position shows the intended generative core. Each Aro is fixed at its spawn world position, so as the dot descends (camera follows) the 11-ring bursts stack vertically at 180px x-spacing — by frame 60 this reads as five tall columns of overlapping, age-grown, palette-coloured ring-donuts (only the 5 columns that fit on-screen; outer rings scroll off the edges), with the live dot at the bottom centre.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| fade_60 | `fill(0, 20);` -> `fill(0, 60);` | moderate | background clearly darker gray at frame 1 (heavier per-frame fade); dot unchanged; trail-length effect develops only over later frames | variants/fade_60/frame_00001.png |
| grav_0.15 | `vy -= 0.7;` -> `vy -= 0.15;` | none | no visible change at frame 1; slower descent only diverges over later frames | variants/grav_0.15/frame_00001.png |
| size_110 | `float ss = 50+cos(vy*0.2)*20;` -> `float ss = 110+cos(vy*0.2)*50;` | none | center dot visibly larger (~160 vs 50 px diameter) but a small fraction of the canvas | variants/size_110/frame_00001.png |
| colspeed_0.3 | `getColor(frameCount*0.05)` -> `getColor(frameCount*0.3)` | none | no visible change at frame 1 (frameCount=1 keeps both at the first palette colour); faster cycling only later | variants/colspeed_0.3/frame_00001.png |
| palette_alt | active `int colors[] = {...#FFFCF7...}` -> commented alt set `{#01AFD8,...}` | none | dot recolored to cyan/teal (first colour of alt palette) instead of cream; background unchanged | variants/palette_alt/frame_00001.png |
| aro_active | `if (key == ' ') {` -> `if (true) {` | none | no visible change — substitution was inside `keyPressed` (spacebar), which the headless run never triggers, so no rings were spawned | variants/aro_active/frame_00001.png |
| aro_spawn | `stroke(0, 20);` -> `aros.add(new Aro(xx, yy));` | none | subtle at frame 1 (a small ring in the dot + 4 small ring-donuts in a 180px-spaced horizontal line); by frame 60 these accumulate into five tall columns of stacked colorful rings — the sketch's core visual | variants/aro_spawn/frame_00001.png |

## Modularisation notes
Generic / reusable: `aro()` (ring primitive from two polar loops), `getColor()` (palette lerp by float), `fadeTrail(alpha)` (the fade-overlay trail), and `ringBurst()` (the `Aro` class — timed, size-grown, size-coloured ring bursts). The `Aro` class is the most self-contained and library-worthy block: `{x, y, life, time}` plus a `show()` that emits `count` rings at `spread` spacing. One-off art decisions: the 5-colour palette (and the commented alt set), the `frameCount*0.05` colour speed, the `cos(vy*0.2)` diameter pulse, the `vy-=0.7`/clamp dynamics, the camera-lerp follow, and the 11-rings-at-180px layout. A clean parameter object for this sketch: `{palette, colorSpeed, dotSizeBase, dotSizePulse, trailAlpha, gravity, maxSpeed, aroCount, aroSpread, aroMaxRadius}`. Note the sketch is input-driven (spacebar/a/d); a library version should expose ring spawning as an API call rather than a key handler.
