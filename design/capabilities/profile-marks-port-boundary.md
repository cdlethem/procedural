# ProfileMarks port boundary and native acceptance intent

Draft workflow plan; no native port acceptance. Root reviewed the accepted Java PDE,
ProfileComposition and CP7 selection before defining this boundary. The operation remains
mesh.radial-profile-surface-3d at its frozen version. This document adds no core behavior.

## Artist entry point

Supply increasing [axial position, radius] pairs and an angular subdivision count, choose
independent endpoint caps, then retain the mesh. A drawing loop reads indexed triangles,
flat normals and band/cell/kind metadata. No port may replace package geometry with a host
cylinder/cone primitive, recompute normals, or hide a topology repair in the sketch.
Example cylinder/waist/pointed formulas remain editable example code, not library presets.

The Java reference retains all three meshes. Profile selection, palette changes and the
three-object arrangement reuse those objects. Subdivision and closure edits regenerate
the composition; reset restores the baseline settings and same-runtime geometry. A cap
flag at the pointed end does not change that mesh, because a pole is already closed.
Do not falsely require every member mesh to change on every closure edit.

## Bounded native scenarios

Before each target render, translate this intent into exact settings and expected counts
using the accepted composition model, and bind the executable sources. Start with the
closed cylinder, then select the waist and pointed forms without regeneration. Change
32 angular slices to8 to expose facets. Toggle start and end caps independently on a
positive-radius endpoint example so each choice has an observable effect. Verify the
pointed-end flag is ignored by core geometry. Change palette and switch to the three-form
arrangement while retaining the relevant meshes. Reset and save the acknowledged image.

Observe real input delivery, completed drawing and retained object identity alongside
geometry/metadata values. A populated screenshot alone is insufficient. Root inspects a
representative baseline, open/faceted form and trio; save pixels must match the retained
acknowledged display image at that target's declared resolution. This is technique/workflow
acceptance, not source-sketch recreation or cross-renderer pixel identity.

## Rendering and lifecycle

Preserve local Z-axis geometry and explicit supplied face normals. A target may translate
canvas origin, camera or lighting setup to its native 3D API; record that adapter choice
and review the image before acceptance. These are workflow choices, not core defaults.
Do not assume p5 WEBGL matches Processing P3D camera or lighting implicitly.

Capture/save must obey the actual target's graphics-thread and lifecycle rules. The Java
reference captures a CPU image after drawing and saves it on command. Android's reviewed
2D snapshot restoration helper does not establish 3D context restoration. Preregister a
bounded 3D pause/resume and next-edit/save check before claiming Android native support;
reuse existing executor and machine lock, but do not force the 2D adapter into P3D.

No new general renderer or public adapter profile is authorized by this workflow draft.
If the existing target surface cannot express supplied normals, retained drawing or safe
save, report the concrete gap to root before choosing an alternative architecture.

## Concrete baseline sequence for target preregistration

Use the Java example's17 profile points and existing controls. The following counts are
contract-derived expectations, not observed native results. They count retained mesh
vertices/faces; a renderer submits three vertices per drawn face. Each composition owns
all three meshes even when only one is drawn. C/W denotes cylinder/waist; P denotes the
pointed form. Exact target plans must also bind geometry checks and save observations.

| Step | Input | Selected/displayed | Slices | Start/end caps | C/W vertices, faces | P vertices, faces | Drawn faces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | launch | cylinder | 32 | on/on | 546,1088 | 514,1024 | 1088 |
| 1 | P | waist | 32 | on/on | 546,1088 | 514,1024 | 1088 |
| 2 | P | pointed | 32 | on/on | 546,1088 | 514,1024 | 1024 |
| 3 | D | pointed | 8 | on/on | 138,272 | 130,256 | 256 |
| 4 | P | cylinder | 8 | on/on | 138,272 | 130,256 | 272 |
| 5 | B | cylinder | 8 | off/on | 137,264 | 129,248 | 264 |
| 6 | T | cylinder | 8 | off/off | 136,256 | 129,248 | 256 |
| 7 | C | cylinder, alternate palette | 8 | off/off | 136,256 | 129,248 | 256 |
| 8 | X | all three | 8 | off/off | 136,256 | 129,248 | 760 |
| 9 | 0 | baseline cylinder | 32 | on/on | 546,1088 | 514,1024 | 1088 |

Steps1,2,4,7,8 retain the composition. Steps3,5,6,9 rebuild it. At step6 the
pointed mesh's values remain equal to step5 despite composition regeneration, because its
end pole ignores capEnd. Save at the trio and after reset without triggering a redraw.
This sequence exercises both positive-ring cap removals and the ignored pole flag with
one bounded native run. Frame and input acknowledgment expectations remain target-specific.
