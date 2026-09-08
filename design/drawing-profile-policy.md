# Initial fresh-raster profile policy

Root decision, reviewed with Sol, 2026-09-07. This resolves the engineering domain
in [drawing-boundary.md](drawing-boundary.md). It fixes the intended v0 admission policy;
the [reviewed catalog contract](../catalog/drawing/fresh-raster-2d.json) now encodes the policy;
portable implementation follows the completed fixture/model review. All adapter targets remain
unvalidated for this profile. This is package policy, not a universal renderer safety
theorem or an artistic parameter recommendation.

## Selected envelope

- Density is 1. Integer width and height each range from 1 through 2048 inclusive.
  This includes the validated 640×640 example and 1920×1080 work. The largest surface
  has a 16 MiB raw RGBA8 payload; that is not a total heap/resource guarantee.
- Let M=max(width,height). After binary32 conversion, x lies in [-M,width+M] and y
  in [-M,height+M], inclusively. A full-canvas overscan margin accommodates marks
  centred near edges and crossing the surface. Geometry is not endpoint-clamped.
- Converted segment width lies in [1/256,M], inclusively. The positive lower limit
  preserves subpixel strokes while excluding subnormal/zero-width host behavior;
  the upper limit permits surface-scale strokes. These particular limits are chosen
  engineering policy, not inferred from measured corpus ranges.
- Validate canonical finite values and exact topology first, then convert, then check
  profile bounds, then converted topology. A binary64 value just outside a boundary
  that rounds onto it is accepted. Bounds concern actual renderer inputs. A segment
  with coincident converted endpoints becomes an indexed no-op only after style/domain
  validation; invisibility does not excuse malformed input.

Root accepts Sol's proposed numbers because they cover the first editable capability
and useful larger compositions while making host investigation finite and reviewable.
They do not redefine the final package as a 2048px-only toolkit. Larger surfaces, density
and other renderers require explicitly versioned profile expansion and evidence.

## Admission versus validated support

Freeze schema, exact geometry/conversion, error precedence, ordered batches and fresh
surface lifecycle against this policy before assigning ports. Policy can be specified
before host tests pass; target support cannot be claimed then. Existing JAVA2D example
evidence does not certify this profile.

Register the native suite before runs, covering:

- 1×1, 640×640, 1920×1080, 2048×1, 1×2048 and 2048×2048 surfaces;
- coordinate bounds, one binary32 ULP inside/outside, crossing and fully clipped
  segments, and convex quads touching boundaries;
- minimum, one-pixel and maximum widths; both windings; alternating translucent
  commands; order-sensitive overlap and a quad without an alpha seam;
- backing dimensions/density, profile preflight, allocation and context failure;
- complete CP1 base, length, palette and bar edits using the shared command route.

Pure fixtures establish exact rejection/no-op behavior before host drawing. Native
evidence records actual runtime/version/renderer identities and structural pixel
predicates: fully offscreen marks leave background, central crossings are visible,
and overlapping colours respect order. A minimum-width stroke is not promised visible
at every pixel alignment; define visibility cases separately from subpixel observations.
Cross-renderer pixel identity is not the acceptance criterion.

Each claimed host must complete its profile probes and CP1 edits. A failure within the
envelope triggers repair or an explicit profile revision and renewed review; it does
not justify labelling that host compliant with a smaller hidden range.

## Next concrete contract work

The reviewed catalog is the behavioral authority. Catalog checks cover schemas, policy
consistency, evidence hashes and fixture metadata; exact normalization and lifecycle
model suites provide separate contract evidence. Implement portable validation and
adapters against those shared fixtures. The Fraction investigation is an independent
oracle source, not an alternate schema or a claimed production implementation.
