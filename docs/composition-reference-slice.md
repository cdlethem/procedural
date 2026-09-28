# Functional composition reference slice

Status: **root-reviewed reference slice, 2026-09-28; unreleased**.
Motif Ecologies, Contour Scores and Region Quilts implement the first vertical slice in
the [release roadmap](next-release-roadmap.md), not the whole editor or all 56 briefs.

## Artist-facing brief

- **Motif Ecologies:** a positioned Poisson population whose individual marks can be dots,
  open rings or radial rosettes. Separation, footprint, support and opening control the
  population; retention and stable size variation create accents and negative space.
  Replacing a mark or recolouring must not move the population.
- **Contour Scores:** editable noise/hill/wave/saddle contours, consumed by continuous ink,
  tangent-oriented stitches or interchangeable beads. Thresholds change topological
  structure; spacing, phase and mark vocabulary change its material without rebuilding it.
- **Region Quilts:** binary rectangular partitions with hatching, motif populations or
  contour scores inside their leaves. The latter two reuse the first two constructions.
  Retention, inset, cut policy and subdivision bias expose both fragments and larger
  compositions. Mixed fillers are an explicit option, not compulsory decoration.

Visual references inform hierarchy, omissions, coherent direction and useful negative
space, not an imitation claim: see the Davis, Hobbs, Molnar and LIA sections of the
[visual synthesis](next-release-visual-review.md). Root must review new actual interface
outcomes; neither those references nor package tests establish quality.

## Frozen boundary

`packages/instruments/src/composition/types.ts` defines this slice's typed values.
This is a p5-compatible, 2D instrument composition boundary, not a new cross-target
operation certification. Reuse the existing Poisson, sampled contour, chain assembly,
arc-length resampling, binary partition and region hatching computations.

- `componentSeed(parentSeed, stableId, purpose)` derives uint32 child streams using
  deterministic string hashing; identities are source element IDs, not draw order.
- `createCompositionRun({maxWork?, maxDepth?, cancelled?})` supplies a shared invocation
  budget, depth limit and cancellation predicate. Defaults: 100,000 callback units and
  depth 8. Consumers charge each callback before drawing and restore depth on failure.
  Source operations retain their own explicit computational work limits. Arbitrary custom
  callbacks are trusted code; this is not a JavaScript sandbox.
- `atEach(surface, sites, mark, run?)` isolates each callback with push/pop and applies
  the site's translation, radians rotation and uniform scale. A mark draws at local zero.
- `strokeWith(surface, paths, material, run?)` isolates each path callback without changing
  its coordinates. A material receives complete path geometry, not disconnected segments.
- `inside(surface, regions, filler, run?)` isolates callbacks and translates each rectangle
  to local `[0,width] × [0,height]`. It does not silently stretch marks or promise general
  polygon clipping. Built-in fillers keep their geometry inside this domain.
- `poissonSites(options)`, `contourPaths(options)` and `partitionRegions(options)` return
  cached, deeply frozen source values. Cache identity contains construction only, never
  palette, marks, material or retention. Source changes may change IDs; appearance edits,
  omission and traversal order may not. Coordinates use canvas units; option rotations
  are degrees, frame rotations radians.
  Singular contour junctions are split into maximal non-branching edge components before
  the existing chain assembler runs. Every marching-square edge is retained exactly once;
  no threshold perturbation or exception suppression is allowed. This makes an exact
  saddle level a set of paths ending at the junction, rather than an invalid simple loop.
- `motif(spec,palette)`, `pathMaterial(spec,palette)` and `regionFill(spec,palette)` return
  ordinary callbacks backed by these same functions. Region fillers nest the point/path
  consumers, sharing the run budget and deriving child seeds from region IDs.
  `RegionFillSpec.contour` carries the nested field construction explicitly; source choice
  and frequency are editable in Studio. Local source frames are fitted to their leaf.
  Hatch scanlines are centered at half-spacing offsets, not forced through leaf corners.
- `ReferenceComposition` is a JSON-compatible discriminated value for these three source
  and consumer pairs. `referenceComposition(input)` resolves the current named instrument
  and scalar bindings to it. `drawReferenceComposition` and cooperative
  `prepareReferenceComposition` consume that same value. No evaluated source strings.

Existing producer functions are already separated in adapters. Reuse them rather than
copy algorithms; migrate existing point, path and panel drawing through the corresponding
callback consumers where their current semantics can be retained. Do not change their
historical default artwork merely to exercise a new spelling.

## Studio scope

The named layer `technique` and strictly validated scalar `params` remain the persisted
binding for these three parameterized compositions. They resolve deterministically to the
public typed descriptor above. No opaque JSON-in-a-text-box parameter, compatibility
renderer, saved closure or second interpretation of composition semantics is introduced.
The host shows library-owned parameter groups and conditional child controls, allowing
mark/material/filler substitution and nested motif/material editing. Controls hidden by a
choice retain their values; all stored values remain validated.

This is not arbitrary graph authoring, cross-layer geometry linking or a replacement
Studio document format. Those remain roadmap work. Host layer identities, transforms,
visibility, opacity, paper, storage and lifecycle stay private-host responsibilities.
The reference studies render transparent layers and allocate no graphics buffer per item.

## Integration and evidence

Library core ownership: composition consumers/sources and existing producer caller migration.
Library example ownership: callback factories, descriptors, three instrument definitions,
controls and guides. Host ownership: grouped conditional controls and existing rendering,
export/reload paths. Root owns public exports, metadata, integration and acceptance.

Run focused semantic regressions for immutable sources, stable child identity under
reorder/omission, nested frame/state restoration, bounded work, closed-path phase,
material-only source reuse and cancellation. Then build/install the actual package and
operate the actual private-host controls. Review defaults, strongly different structural
settings, sparse supporting fragments and layered compositions; record initial,
structural and appearance costs separately. Native runs use the shared render lease.
Authentication/persistence acceptance requires the real private backend; an isolated
preview may prove controls/rendering without pretending it proves tenant persistence.

## Reference implementation and root review

Use these examples as implementation patterns, not as three scenes to copy:

| Boundary | Reference |
|---|---|
| Element/frame ownership, callback budget and child seeds | [`types.ts`](../packages/instruments/src/composition/types.ts), [`core.ts`](../packages/instruments/src/composition/core.ts) |
| Frozen reusable geometry from existing computations | [`sources.ts`](../packages/instruments/src/composition/sources.ts) |
| Replaceable marks/materials and genuine nested fillers | [`materials.ts`](../packages/instruments/src/composition/materials.ts) |
| Named scalar bindings, typed recipes and cooperative preparation | [`reference.ts`](../packages/instruments/src/composition/reference.ts) |
| Consequential controls, visibility and authored starting points | [`reference-composition-instruments.ts`](../packages/instruments/src/adapters/reference-composition-instruments.ts) |
| Artist-facing control tables and ordinary-function examples | [Motif Ecologies](../packages/instruments/guides/motif-ecologies.md), [Contour Scores](../packages/instruments/guides/contour-scores.md), [Region Quilts](../packages/instruments/guides/region-quilts.md) |

The [root evidence record](../evidence/web/composition-reference-slice.json) binds exact
inputs, current host documents, package hashes, images and verification scope.
The local visual-review gallery registers the actual-interface outcomes and layered pairs.

Root operated the real `/techniques/<id>` controls in an isolated copy of the private app
consuming built packages. Thirteen configurations cover the three defaults, material-only
substitutions, structural alternatives, sparse fragments, a dense off-slider population,
and regions containing contour paths containing point marks. All thirteen interface images
replayed pixel-for-pixel through the actual host renderer. Three authored pairs were reviewed
in both orders and replayed identically through both `renderStudio` and `renderHarness`.
The filled-disc/hatch pair makes foreground order particularly legible; the other pairs
use subtler crossings. A separate custom callback painted the same immutable sites as a
stock mark, without adding a mark enum or instrument.

The implementation was corrected during review: open-path station coverage and corner
tangents, singular contour junctions, centered hatch construction, filled-dot containment,
and slider increments that could not represent the authored defaults. Permanent semantic
regressions accompany these changes. Hidden child settings, seed undo, palette undo,
source identity, work rejection with the last image preserved, and superseded asynchronous
preparation were exercised. See the evidence record for the five legacy drawing comparisons;
four were pixel-identical and Blue-noise Stipple had a small recorded raster difference.

The final artifact source is `d7bb73551d23d71a6e00f3c201411d2ab67a99fd`.
Its local package report is `.work/dist/composition-reference-accepted/report.json`.
It is an **unpublished development artifact**, not a replacement for the existing 0.2.2
release. The isolated app has 120 workflow IDs / 102 canonical instruments; the primary
private app's released package pins were intentionally not changed. Consume the matching
three-package bundle and run the existing gallery/API generators when integrating it.
The host change is limited to grouped conditional controls and its browser scenario;
its document schema, renderer, authentication and persistence were not replaced.

Measured first preparation was 1.8–35 ms and drawing 7.1–14.3 ms for these defaults on
the review machine. The selected structural edits prepared in 1.2–56.4 ms. Palette-only
preparation was 0 ms for points/paths and 20.6 ms for the quilt's retained-leaf traversal.
Fifty-nine completed interface edits took at most 83.6 ms including automation overhead.
These are observations, not universal performance guarantees or certified parameter ranges.

Admission is scoped to these three p5 studies and the reviewed compositions. It does not
admit arbitrary graphs, cross-layer geometry links, polygon-hole masks, other targets,
every parameter combination, the rest of the gallery, tenant persistence or deployment.
