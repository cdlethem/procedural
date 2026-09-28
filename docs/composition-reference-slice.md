# Functional composition reference slice

Status: implementation in progress; no creative acceptance or release claim yet.
This implements the first reference examples in the [release roadmap](next-release-roadmap.md),
not the entire composition editor or all 56 capability briefs.

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
