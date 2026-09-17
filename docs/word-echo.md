# Word Echo

Word Echo makes an outlined word vibrate with scalar controls derived from a
project-authored synthesized signal. The same sampler also drives a spiral of
path marks and a non-audio tide/gust series. Davis's tennis work motivates the broader recorded-control task.
Open the local [editable example](../packages/javascript/examples/word-echo/index.html)
through `node tools/serve_external_expansion_studies.mjs` with pinned p5 2.3.2.

| Control | Canvas effect |
| --- | --- |
| Step / Back | Query the next or previous explicit 0.125-second feature time; endpoints hold. |
| Word | Re-extract `ECHO` or `OPEN` contours from the bundled DejaVu Sans glyph data. |
| Input series | Swap synthesized PCM-derived RMS/accent for an authored non-audio tide/gust series, retaining mappings. |
| Contour / path | Use the same sampled radius/accent/opacity values for letter marks or an independent spiral path. |
| Spacing / Mark size | Change mark density and geometric scale independently of the series. |
| Palette | Change colors without rebuilding the signal or contours. |
| Reset / Save | Restore the complete starting control record / download the displayed frame. |

`sampleRecordedControls` accepts exact passive records with `times`, `channels`,
`samples`, `time`, `maxGap`, `mappings`, and `maxWork`. Its one detached `values`
array follows mapping order. Each mapping declares a channel, `STEP` or `LINEAR`
interpolation, numeric domain/range, and clamp policy. There are no implicit
defaults. A strict interior time in a bracket wider than `maxGap` raises
`TIME_GAP`; exact knots and outside holds do not. The operation validates all
data before its exact `T*C+M` work preflight and performs checked ordered
binary64 arithmetic. See the [frozen contract](../catalog/operations/sample-recorded-controls.json)
for all carrier and failure rules. This operation does not read a clock, audio
device, FFT, font, or renderer.

The study synthesizes 5,120 mono PCM samples in forty 128-sample windows at an
effective sample rate of 1,024 samples per second. Two
deterministic sinusoidal partials share a two-attack envelope. For each window,
`level = sqrt(sum(sample²)/128)`; `accent` is the positive difference from the
previous level multiplied by eight and clamped to `[0,1]`. Sample times are
`windowIndex * 0.125` seconds. The derived `{times,channels,samples}` JSON has
SHA-256 `916eddedb86fe9c6c933cbdef5ac0791d94e1c1f3913311e8bfaa445d8b363cb`
under the pinned Chromium browser's JavaScript `Math` implementation; the
transcendental synthesis is not a cross-runtime byte-identity claim.
The PCM is synthesized by [study.js](../packages/javascript/examples/word-echo/study.js),
not captured from a real performance. The non-audio series is another authored
deterministic array with the same `level` and `accent` channel names. Neither
series establishes an artistic parameter range.

The host asks p5's `Font.textToContours` for known glyphs from the existing
licensed [GlyphMarks.ttf](../packages/javascript/examples/glyph-marks/assets/GlyphMarks.ttf),
after checking its SHA-256 against the pinned asset. p5 loads the verified
bytes through a temporary Blob URL, so contour extraction cannot read a
second mutable font response. This example keeps glyph
sampling and rendering as editable p5 code; it does not supply shaping, hole
classification, arbitrary-font support, or a new contour API. The font license
is [bundled beside the asset](../packages/javascript/examples/glyph-marks/assets/FONT-LICENSE.txt).
The example does not acquire a microphone or request media permissions.

Run the pure operation check with
`node tests/native/sample-recorded-controls-javascript.mjs --output .work/word-echo-core.json`.
Run the browser study under the shared native lease with
`python3 tools/with_native_render_lock.py -- node tests/native/word-echo-javascript.mjs .work/word-echo-native`.
The browser report and captures are local evidence; root review determines
target acceptance. The checked visual scope is the original synthesized-signal
study plus the non-audio and path-mark transfers, not an entire corpus family.
