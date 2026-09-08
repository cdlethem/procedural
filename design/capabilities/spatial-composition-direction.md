# Spatial composition: place, reveal, and constrain

## Expanded requirement: images and interacting effects

The maintainer broadened this requirement to arbitrary generated content, pre-existing
images and image snippets, including soft transitions between effects. Flow paths are one
acceptance input, not the organizing abstraction. This section is root's proposed design,
not an accepted API or a claim of implemented functionality.

Use a small set of interoperable values: raster sources/layers, scalar masks, coordinate
placements, and the existing generated geometry/fields. Loading a photo and drawing marks
onto a transparent surface should both supply usable raster inputs. Keep retained geometry
available for editing and simulation; rasterizing it is an explicit rendering step.

The artist-facing capability sequence is:

1. Select and place: take an explicit image rectangle or supplied silhouette mask, crop,
   fit and place it. Preserve the distinction between source-image and canvas coordinates.
2. Reveal and mix: use a hard region or a scalar mask to control visibility and transition
   between two layers. A gradient, image luminance, noise or a feathered shape may supply
   mask values; arbitrary masks need not acquire a separate bespoke effect implementation.
3. Derive: sample image color or a defined scalar channel to drive existing mark color,
   size or placement density. Each mapping must remain explicit and replaceable. Sampling
   brightness is not equivalent to extracting an outline or recognizing an eye.
4. Process and recombine: apply an image transform to a photo, a crop or a generated layer,
   then mix that result with another input through the same mask/placement machinery.

Distinguish crossfading two completed images from interpolating compatible field values
before generating geometry. The former makes a visible transition; the latter can alter
trajectories. Neither should silently substitute for the other. Also distinguish masked
source-over painting from a two-input crossfade: alpha behavior differs on transparent inputs.

Existing raster.bilinear-remap-2d provides explicit source-coordinate remapping with clamped
bilinear sampling (catalog/operations/bilinear-raster-remap.json). It is a foundation, not
already a crop/mask/compositor. Before reuse, review its alpha/interpolation contract;
do not silently change accepted behavior to implement new compositing semantics.

Corpus grounding: survey/out/2017/Generativos/terrainCollage/notes.md describes nine photo
inputs, noise-based tile selection and rotated placement. Count, tile size, noise detail
and classification-band experiments show large changes; shadow-distance change shows none.
This supports image/generated-layout interplay, not automatic segmentation or useful
feather widths. The maintainer's eye example remains to identify: explicit crops and supplied
masks are in scope for this design; automatic semantic feature detection requires a separate
evidence and dependency decision. Asset licensing must be checked independently of code MIT.

Next bounded batch: finish reviewing the private hard-clip study, then freeze one common
raster/mask composition contract and demonstrate (a) an image crop placed in a generated
composition and (b) a soft transition between two different layer producers. Include a
small image-driven mark example to check the sampling boundary before freezing conveniences.
Use original project-generated diagnostic image inputs when photographic asset rights are
unresolved. Do not invent a generic effect graph or large filter inventory for this batch.

Root must decide alpha representation, color/interpolation space, mask extent and outside
behavior, transform order, pixel-center conventions, source ownership and bounded allocation
before delegation of public implementation. Focused validation must cover transparent edges,
zero/one/intermediate masks, source immutability, placement and untouched outside pixels.
Native examples must show substitution of a photo-like raster input and generated marks
without rewriting composition logic. These are planned acceptance criteria, not passed checks.

Root architectural direction from the maintainer's explicit composition request,2026-09-08.
This is a new artist requirement and design investigation, not a frozen API, operation
admission, native acceptance, or a claim that an arbitrary wrapper already exists.

## Artist task

The maintainer additionally requests partition generators composed with a function deciding
what each partition contains. Make this a primary usability case. Portable partition output
supplies stable identity, boundary geometry and bounds; it does not carry a host callback.
A Processing adapter convenience may iterate these regions and invoke artist content code
with an explicit target and coordinate frame. It owns placement, visibility and restoration.
The callback must support both a window onto one larger drawing and an independent local
drawing/image crop. It must not require modifying every generator to know about partitions.

Before freezing that convenience, specify callback invocation order and count, failure/state
restoration, target lifetime, overlap order and deterministic per-region seed derivation.
Repeated drawing must not implicitly advance a simulation or regenerate random content.
Raster layer inputs should also work without callbacks, permitting retained content reuse.
Soft crossfades between neighbors need explicit weight normalization/coverage semantics;
ordinary overlapping source-over layers are a separate compositing choice.

Private study review: evidence/parameter-experiments/spatial-composition/root-review.json.
All four modes retain identical geometry. Root visually reviewed placement and mark transfer.
Modes 1 and 2 each change one pixel outside an analytic pixel-center ellipse test. This
does not pass the preregistered strict outside-region criterion; resolve and document native
raster edge semantics before claiming acceptance. Native hard clipping is not a soft mask.

Apply a field/path/mark technique inside one part of a composition, retain content elsewhere,
and reuse the same generated values in differently positioned regions. The current core
already separates generated values from rendering, but the public Java package lacks a
unified spatial placement/clipping layer. Whole-frame starters and their internal adapters
must not be mistaken for reusable regional drawing targets. The internal fresh-raster adapter
explicitly initializes identity transform/full clip and owns a completed surface.

## Keep three decisions distinct

1. Placement changes coordinate interpretation: translate, rotate, scale or fit local geometry
   into a canvas frame. Coordinate transforms should act on explicit values, with deliberate
   rules for directions, widths, distances and nonuniform scaling.
2. Visibility limits what is painted: clip or mask a drawing layer to a region, then composite
   it without touching other canvas areas. This preserves the underlying paths and simulation.
   A clipped centerline alone cannot guarantee its stroke/motif stays inside the region.
3. Generation constraints change the process itself: seed inside a region, stop at a boundary,
   reflect or wrap. These are different semantics; placing seed points inside alone does not
   keep a traced path inside. A step may cross a hole even if both endpoints are inside.

For a global flow field, sampling the same field coordinates in two clipped windows should
preserve continuity. Independent local panels should instead use explicit local coordinates
and place their generated content. Do not silently normalize all field inputs to each panel:
that changes the scale and relationships the artist might want to retain.

## Architectural preference and immediate experiment

Prefer a small family operating on reusable geometry/placement values and explicit drawing
targets over one opaque higher-order wrapper accepting every operation. Keep coordinate
frames, region geometry and composited layers separate but easy to combine. A source field
is queried; a path is transformed or geometrically clipped; a layer is visually masked.
There is no universal transformation of arbitrary output records (colors, motion state,
meshes and paths have different meanings). No recipe executor or new planning framework is
needed to demonstrate this composition boundary.

Prioritize a private Java demonstration before more isolated motif operations: the same
retained field paths in two rectangular windows, then a shaped mask, alongside existing
canvas content that must remain unchanged outside each region. Compare global-field windows
with independently placed local coordinates. Verify state/clip restoration, marked stroke
extents at boundaries, deterministic retained geometry, and transfers to another mark style.
Use established rendering infrastructure and the shared native lease. First establish a
useful placement/visibility layer; only then decide whether boundary-aware integration adds
an independently useful operation. Do not imply stop/bounce/wrap from a visual mask.

Any public names, common geometry representation, region variants, transform order, mask
alpha rules and performance bounds remain to freeze from that experiment. This priority is
root's response to the maintainer's workflow need, not a corpus-derived artistic parameter
range. Reuse motivating path/region evidence for implementation provenance; do not fabricate
new survey candidates or defaults.
