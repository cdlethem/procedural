# CutMarks native draft plan

Status: prepared for root review; no native execution or acceptance is authorized by this
file. This plan names the bounded JAVA2D callback scenario for the draft
`packages/java-processing/examples/CutMarks/CutMarks.pde`.

The probe must build the current Java source into a candidate JAR, officially preprocess
the PDE, and compile against that JAR. It must confirm that
`RetainedRectangles2D` loads from the supplied candidate JAR, rather than from a runtime or
ambient class path.

The prepared sequence is baseline, a selected local X cut, decoration, deletion, reset, and
cached save. Immediately inside the posted X callback, the probe sets `mouseX`/`mouseY` to
the centre of a known live leaf and calls the PDE's real `mousePressed()` callback before its
actual X handler. Selection is therefore simulated through the callback; all five key events
are posted to Processing. It then posts D, Delete, 0, and S.
It records five frames and requires JAVA2D at 512 by 512 with density 1. Leaf counts are
37, 38, 38, 37, and 37. The selected low X child must preserve the parent's left, top, and
bottom bounds and end at the exact midpoint. An unrelated retained `Leaf` instance must
survive the selected cut, decoration, and deletion by identity; decoration must not replace
the model or leaves.

Reset must restore the baseline detached snapshot and pixels, and the cached displayed image
must equal the saved PNG.
The save callback must not cause an extra draw. This checks the draft's artist workflow only;
it is not a source-distribution, target-support, recreation, or release claim.
