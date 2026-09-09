# Compose drawings, regions and image effects

Start by deciding what you want to reuse: positions, a contour, a region layout, a completed
drawing, or attributes sampled from an image. Keep that result, then change how you draw or
combine it. The Java0.29 examples demonstrate these choices without a recipe executor.

## Put content inside partitions

The composition boundary is **layout → content → boundary treatment**. A partition
operation produces regions; a content callback chooses what to draw for each region;
the rendering adapter places and masks that drawing. This is an architectural design
choice: it lets a layout work with photographs, typography, paths or generated textures
without adding a specialized version of every partition operation.

For example, the existing Java callback can switch between two retained drawings by ID:

```java
Java2DRegions.Content content = (target, region) -> {
    target.image(region.id % 2 == 0 ? firstDrawing : secondDrawing, 0, 0);
};
PImage composed = Java2DRegions.render(this, backgroundImage, regions,
    Java2DRegions.Space.CANVAS, 0, content);
```

Here `regions` is a supplied rectangle list, and the three images are already prepared
at the destination size. Each rectangle reveals a snip of its selected larger drawing.
Replace only the callback to generate a different composition inside each rectangle.
Retain expensive geometry and images outside the callback so layout or style edits do
not accidentally rerun simulation or change random choices.

[LayerMarks](layer-marks.md) separates region layout from a drawing callback. The layout
supplies rectangular regions; `Java2DRegions.render` invokes your callback for each region
and constrains its visible output afterward. A mark or path can extend beyond the region
without appearing outside its mask. The callback receives the region's bounds and stable ID,
so different regions can choose different content while using the same layout.

Choose `Space.CANVAS` for windows onto a larger composition. Draw a retained full-canvas
image at `(0,0)` for each region; each mask reveals the corresponding part, preserving
continuity between neighboring windows. Render expensive content once with
`Java2DLayers.render`, then reuse that image in the callbacks.

Choose `Space.LOCAL` to draw from each region's upper-left corner. This translates the
origin; it does not scale your drawing or change the target's width/height to the region
size. Compute local dimensions from `region.right-region.left` and
`region.bottom-region.top`. Use `region.id` to select retained content. The adapter owns
the temporary drawing target; the callback draws into it without beginning or ending it.

For a picture or a selected snip, [PlacementImageMarks](placement-image-marks.md) supplies
explicit crop, frame, contain/cover/stretch and alignment. A generated drawing is also a
`PImage`, so the same placement call works for both. This is a reusable content layer;
partition generation need not know whether it contains a photograph or generated marks.

Java0.34 adds [MaskedPartitionMarks](masked-partition-marks.md): the same content callback
can receive immutable raster-mask descriptors through `Java2DRegions.renderMasked`. Its
frame supplies identity and a local origin; mask coverage alone determines visibility.

The original region callback route supports rectangles in JAVA2D. For a curved or
irregular visible region, draw that shape into a transparent layer and extract its alpha
with `Java2DLayers.alphaMask`, as in [MaskMarks](mask-marks.md). This masks image content;
it does not produce clipped vector paths or make geometry follow the boundary.

[ContactMarks](contact-marks.md) instead stops each directed stroke at its first supplied
obstacle, preserving hit identity. Origin touches count; choose the obstacle list explicitly.

For retained line geometry, [ClipMarks](clip-marks.md) uses `SegmentClip2D` to trim
supplied segments to one simple polygon, including a concave outline. It returns each
interior piece with its original source index. This trims centerlines; use an image mask
when the complete painted stroke footprint must stay inside.
[PathClipMarks](path-clip-marks.md) demonstrates this connection with actual field-generated
paths: reclip the same movement after a boundary edit, then color pieces by original path.

Extend this pattern through region adapters when a new shape family needs it. A callback
belongs on the drawing adapter, while the underlying partition result remains available
as data for sampling, geometry and later edits. Introduce a specialized effect only when
the region changes its algorithm—for example, steering paths around a boundary rather
than hiding their exterior portions. Arbitrary effects cannot all be interchanged:
geometry consumers need geometry, image filters need pixels, and drawing callbacks need
an active rendering target. These explicit connections keep composition understandable.

## Blend two effects across a boundary

A mask answers how much of each result appears at each pixel. It need not be a binary
inside/outside decision. `Java2DLayers.crossfade` mixes two equal-sized images using an
explicit scalar array: zero selects the first, one selects the second, and intermediate
values blend their premultiplied encoded colors and alpha.

`Java2DLayers.composite` instead puts a source over a destination with mask coverage.
Use it when transparent parts of the source should reveal the destination. The region
adapter's feather uses this source-over interpretation. Feathering adjacent regions is
not automatically a normalized two-image transition; choose crossfade when that is what
you mean. An alpha mask reads transparency, so opaque black and opaque white both select
fully. Draw the desired transparency when creating it.

[BlurMarks](blur-marks.md) retains a sharp drawing and filtered variants, then applies a
left-to-right crossfade. Replace either input with a different effect's image without
changing the mask. Keep the filtered images when changing only the transition.

## Choose the order deliberately

| Sequence | Resulting behavior |
| --- | --- |
| Draw a complete field, then reveal it through regions | Regions show parts of one continuous field. |
| Generate a field separately using each region's local coordinates | Each region has its own field composition. |
| Filter a full drawing, then mask it | Content outside the visible region can contribute to pixels inside it before masking. |
| Mask a transparent drawing, then blur it | The filtered alpha can spread beyond the original mask; mask again if the final visible boundary must remain fixed. |
| Crop an image, then filter the crop | Filtering uses the crop's own clamped edges. |
| Deform geometry, then draw it | Strokes follow the changed coordinates; retained paths remain available. |
| Draw geometry, then remap its image | All captured pixels move together; the result is a raster, not updated paths. |

These are explicit call sequences, not interchangeable arrangements. A visibility mask
cannot make a path bend around an obstacle, and smoothing a contour does not establish
polygon containment. Use an operation that computes the needed geometry when the boundary
must affect movement or shape rather than only visibility.

## Let an image guide a new drawing

[ImageFieldMarks](image-field-marks.md) snapshots a completed image and samples it at retained
positions. Its ARGB, alpha and maximum-RGB values can choose mark color, size or visibility.
The example changes the input image while preserving the layout, then changes the mark
interpretation while preserving the samples. Maximum RGB ignores alpha and is not luminance.

This gives two distinct uses for images: visible content you place/mask/filter, and data
that guides another drawing. They can share the same source. Start with the
[workflow chooser](choosing-java-workflow.md), then substitute one retained result at a time.

For cache boundaries, reusable access buffers and work allowances, see
[keeping Java compositions responsive](java-performance.md).
