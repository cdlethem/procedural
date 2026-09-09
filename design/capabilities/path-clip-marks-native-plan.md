# PathClipMarks composition validation plan

Status: example investigation using accepted Java operations. No new public operation,
reproduction count, workflow acceptance or distribution claim.

Artist task: generate movement once, reveal it inside an editable concave outline, and
change appearance without changing the movement. This is a transfer test of the accepted
path/clipping interfaces, motivated by the maintainer's request for effects that compose
with region boundaries. It is an authored example, not an original-sketch recreation.

## Composition boundary

`GradientPath2D` supplies retained positions. Ordinary conversion of successive position
pairs supplies segment quadruples to `SegmentClip2D`; no custom intersection or field
algorithm belongs in the example. Flattened segment ordinals retain explicit path/step
metadata. A clipping result's source index selects that metadata, including when a
concave boundary splits a source into several pieces. `Java2DLayers` draws the retained
pieces once and returns the cached display/save image.

Initial artwork:640-square JAVA2D density1, seed17, six starts at x60 and y140,212,284,
356,428,500;160 advances per path, distance4, fieldScale0.004, offset[0,0], angle mapping
[-PI,+PI]. These are example settings, not recommended parameter ranges. The eight-vertex
ClipMarks notch uses floor270 or430.960 supplied segments have abstract work charge622144;
1920 output slots bound the intended example. Root may adjust authored settings after
inspection if the initial drawing does not make the intended edit visible; no acceptance
threshold or operation semantics may change to hide a failure.

## Checks before acceptance

Compile the actual PDE against the current accepted extracted JAR. Verify each flattened
segment equals its retained path's consecutive points, and every returned source ordinal
maps to the correct path and step. Independently compare clipping geometry with the exact
reference using actual inputs; comparing only counts or images is insufficient.

Render through the shared machine lock. Root inspects a baseline, changed notch, changed
palette and original-stroke overlay. The ordinary clipping view must show real path segments
inside the polygon without connecting separated output pieces across the notch. Appearance
choices must preserve geometry identity. The notch edit must retain the original paths and
source segments while recomputing clipping; at least one output geometry change must occur.

Use actual queued N,N,C,O,0,S events. The restored notch and final reset must match baseline
pixels in the pinned runtime. Save must equal the cached final image, with no extra path
tracing or clipping. Capture path-build, clip-build and display-build counts to distinguish
these stages. Record source/runtime/artifact/image hashes and expose reviewed images in the
central gallery. Accepted ClipMarks remains unchanged during this investigation.

Scope is mathematical centerline clipping. Painted widths may extend over an edge; no path
steering, polygon holes, full original recreation or non-Java support is implied. If transfer
reveals a real type/ownership gap, root decides the abstraction before modifying the core.

## First visual review adjustment

The initial270-floor native run passed geometry/control checks, but root inspection found
that the main path bundle only grazed the notch. Change the initial floor to200 so a
substantial portion of the retained movement is excluded; keep430 as the alternate floor.
This changes authored artwork only. Acceptance criteria and operation semantics stay fixed.
