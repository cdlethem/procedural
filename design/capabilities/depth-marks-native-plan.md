# CP18 DepthMarks workflow and native plan

Candidate artist workflow; root design, not native or package acceptance.
Use Processing4.5.6 P3D density1,640x640 with existing pinned JOGL/native dependencies and
shared machine lease. Reuse the current source-built core/JAR path and established
source/compiled-class/image bindings. Do not reuse an old CP7 installed JAR accidentally.

Artist starts with an evenly placed field of strokes. One retained GradientNoise3D01 seed42
samples fixed x/y positions with depth0.25; scalar sets heading/length. Z edits the explicit
third coordinate to1.25 and back; do not change seed, point origins or rotate headings as
part of that edit. C switches palette while retaining field and cached scalar values.

M transfers the same field to face-center samples of a retained RadialProfile3D rounded
surface. Use17 authored increasing[z,radius] pairs along a semicircle, radius190,32 slices,
zero-radius endpoints and no extra caps. The profile curve is ordinary supplied shape data,
not a new sphere operation. Generate indexed geometry once; retain it through every field
or style edit. Sample actual x/y/z face centers with explicit scale/offset. Use existing
CyclicPalette or StopRamp for sample-to-color; shader, multi-octave or derivative support
is not part of this workflow. Match each triangle's chosen scalar across its vertices.
Lighting may be used if retained and explicit; rotate the form for depth legibility.

Expose ordinary editable constants for spacing, scale and palette. They are authored
configuration, not evidence-backed defaults. Precompute scalar arrays for planar positions
and mesh face centers when depth changes, so palette/mode edits visibly reuse values.
Public example must contain no independent noise implementation or mesh topology algorithm.

Native sequence zcm0s, five states: baseline, depth-changed, recolored, mesh-transfer, reset.
Check actual field/mesh code source JARs, PGraphics3D environment, dimensions and density;
point positions and mesh identity/geometry remain stable, field identity remains stable;
depth changes scalar arrays/output, C/M retain arrays; reset reconstructs the exact baseline
samples and pixels. S reads the cached image and saves the actual PNG; verify no draw during
quiet interval and compare decoded pixels. Root inspects all distinct states. Mesh-face
sampling must actually include z; a projected2D lookup is insufficient.

The private hemisphere study had concentric mark overlap; this workflow uses existing mesh
faces to avoid inheriting that presentation artifact. Native GL results and extracted
consumer checks remain necessary. Do not broaden shared JAVA2D-only helper claims merely to
run this probe; reuse or narrowly extend the existing P3D infrastructure with explicit scope.
