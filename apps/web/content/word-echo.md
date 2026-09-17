# Word echo

An outlined word vibrates as recorded scalar values change over explicit time. The same values can drive marks on a separate spiral path, and a non-audio series can replace the synthesized signal.

| Control | Canvas effect |
| --- | --- |
| Time | Query a precise 0.125-second step in the authored feature series. |
| Word outline | Switch between supplied `ECHO` and `OPEN` contours. |
| Input series | Exchange synthesized PCM-derived RMS/accent for an authored non-audio tide/gust series. |
| Mark path | Place marks along the supplied letter contours or an independent spiral. |
| Mark spacing | Change how densely the existing contours or path receive marks. |
| Mark scale | Scale mark radius independently of the sampled series. |
| Palette | Recolor marks and page without changing outlines or sampled controls. |

The source signal is project-authored synthesized PCM, analyzed into forty RMS/accent samples. It is not microphone input. `sampleRecordedControls` queries those samples with explicit time, interpolation, mapping, and gap policy; the alternate non-audio series uses the same mapping.

The two word outlines are supplied geometry extracted with pinned p5 2.3.2 from the licensed GlyphMarks font. The browser composition draws those verified points directly and does not load or shape arbitrary text at runtime. To use another word or font, regenerate and review the contour asset with `apps/web/scripts/extract-word-echo-contours.mjs` after changing the extraction scope and font provenance. The editable [native study](../../../packages/javascript/examples/word-echo/) retains live font loading and contour extraction.
