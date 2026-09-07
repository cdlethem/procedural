---
sketch: 2014/Generativos/Minim/arcos/arcos_pde
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: [minim]
deterministic: false
ms_first_frame: 743
animated: true
techniques: [polar]
primitives: [shape]
palette:
  colors: ["#2D2434", "#F7C350"]
  selection: fixed
composition: radial
parameters:
  - {name: bandScale, default: 8, tried: [20], change: subtle, effect: "wedge radius = band*8; x2.5 makes wedges longer but overall coverage similar at this audio moment"}
  - {name: cant, default: 64, tried: [128], change: none, effect: "wedge count = specSize/8; doubling to 128 looks identical (low-frequency bands dominate the loud end)"}
  - {name: alpha, default: 220, tried: [60], change: none, effect: "fill alpha; low value only slightly darkens the thin wedge region"}
  - {name: fillColor, default: "#F7C350", tried: ["#50C3F7"], change: none, effect: "wedge colour; blue is visible in the wedge region but wedges are a small fraction of the canvas"}
  - {name: bgColor, default: "#2D2434", tried: ["#E8E4EF"], change: large, effect: "background colour; flipping to light lavender dominates the whole image"}
reusable_candidates:
  - {name: fftWedgeBurst, signature: "fftWedgeBurst(cx, cy, bands: float[], scale, wedgeCount) -> void", note: "polar bar chart: one filled wedge per frequency band, radius proportional to band amplitude"}
---

## What it draws
On a dark aubergine background, a yellow-gold starburst of pie wedges radiates from the
exact centre of the canvas. Most wedges are short, but a few — one very long, thick wedge
pointing down-right — reach far out, giving the burst a lopsided, comet-like shape.
Because the sketch is audio-reactive, the burst changes shape every frame; by frame 60 the
audio is quiet and only a tiny speck remains at the centre.

## How the code works
`setup()` (lines 22-42) loads `jingle.mp3` with a 1024-sample buffer via Minim, loops it,
and builds an `FFT` matching that buffer. `draw()` runs every frame (lines 44-60):
1. `background(#2D2434)` (line 45) — full repaint, so nothing accumulates; each frame is a
   fresh snapshot of the audio.
2. `noStroke()` + `fill(#F7C350, 220)` (lines 46-47) — solid gold wedges at ~86% opacity.
3. `fft.forward(jingle.mix)` (line 51) — forward FFT of the mixed audio buffer.
4. `cant = fft.specSize()/8` (line 53) = 512/8 = 64 wedges; `da = TWO_PI/cant` (line 54)
   gives each wedge a 5.625° slice of the full circle.
5. Loop `i = 0..63` (line 55): `tam = fft.getBand(i)*8` (line 57) scales the band amplitude,
   then `arc(width/2, height/2, tam, tam, da*i, da*(i+1))` (line 58) draws a filled wedge of
   diameter `tam` in that band's angular slot. Low-frequency bands (small `i`) are usually the
   loudest, which is why the long dominant wedge sits near angle 0.

Randomness does not enter; the visual is driven entirely by the audio file's timing, which
is why the render is non-deterministic (seed has no effect).

## Experiments
Because the sketch is non-deterministic (audio-timing driven), each run captures a slightly
different instant of the jingle; the diff scores below mix the parameter effect with that jitter.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| scale_20 | `float tam = fft.getBand(i)*8;` -> `float tam = fft.getBand(i)*20;` | subtle | same lopsided gold starburst; the long dominant wedge is a bit longer but overall coverage is close to baseline | variants/scale_20/frame_00001.png |
| cant_4 | `int cant = fft.specSize()/8;` -> `int cant = fft.specSize()/4;` | none | no visible change; 128 wedges look the same as 64 because the low-frequency bands dominate | variants/cant_4/frame_00001.png |
| alpha_60 | `fill(#F7C350, 220);` -> `fill(#F7C350, 60);` | none | no visible change; the thin wedge region darkens only slightly | variants/alpha_60/frame_00001.png |
| color_blue | `fill(#F7C350, 220);` -> `fill(#50C3F7, 220);` | none | subtle: wedges render blue instead of gold, but the wedges cover only a small fraction of the canvas so the overall diff is negligible | variants/color_blue/frame_00001.png |
| bg_light | `background(#2D2434);` -> `background(#E8E4EF);` | large | background flips to light lavender; the gold burst is clearly visible on the light ground | variants/bg_light/frame_00001.png |

## Modularisation notes
The generic core is `fft.forward(mix)` + the wedge loop: take an array of band amplitudes
and draw `wedgeCount` filled arcs, radius `band*scale`, evenly spaced around a centre.
That is a self-contained `fftWedgeBurst(cx, cy, bands, scale, wedgeCount)` — reusable for
any audio visualizer. Art-specific decisions: the fixed gold fill `#F7C350` @ 220 alpha,
the aubergine background `#2D2434`, the `/8` band decimation, and the `*8` amplitude scale.
A clean parameter object would be `{wedgeCount, scale, alpha, fillColor, bgColor,
startAngle}`. The Minim/FFT wiring (loading the file, buffer size, `fft.forward`) is
boilerplate that a library would hide behind an "audio source" interface.
