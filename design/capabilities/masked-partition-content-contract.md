# JAVA2D masked partition content — frozen implementation contract

Root decision, 2026-09-08. Candidate implementation contract; not native or distribution
acceptance. Motivation and exclusions: masked-partition-content-brief.md. This extends a
host adapter, not the portable operation catalog. Existing rectangular render behavior
must remain unchanged. No new target-support claim is authorized by this document.

## Public surface and ownership

Extend org.procedurals.processing.Java2DRegions with:

- `public static final class MaskedRegion`
- Its `public final Region region`, `public final int width, height` are immutable metadata.
- Constructor `MaskedRegion(Region region, int width, int height, double[] coverage)`.
  Reject null region/coverage, dimensions <1, product >Integer.MAX_VALUE, mismatched array
  length, nonfinite values or values outside [0,1] with IllegalArgumentException. Capture a
  private clone of coverage once during construction; no getter exposes the array. Caller
  mutation after construction cannot change it. Concurrent mutation during construction is
  outside the contract. Validate the captured values. Signed zero has zero coverage.
- `public static PImage renderMasked(PApplet parent, PImage destination,
  List<MaskedRegion> regions, Space space, Content content)`.
  No feather argument: the supplied mask already defines fractional coverage.

Region retains its accepted positive finite rectangle and safe integer ID constraints.
For this route, its bounds are a coordinate frame, not an extra clipping boundary. Mask
pixels outside that frame may be visible; holes and disconnected areas are allowed. LOCAL
only translates to region.left/top; CANVAS preserves the destination origin. No scaling.
Mask coordinates always remain destination coordinates, including in LOCAL mode. No inferred
polygon, automatic fit or conversion of grayscale to alpha.

## Preflight and execution

Match existing render's parent/destination/space/content validation, RGB normalization,
density-one requirement, completed image semantics and finite-float LOCAL translation check.
Snapshot the supplied list and validate every nonnull descriptor, matching width AND height,
unique region IDs and LOCAL origin before any callback. Constructor validation ensures masks
are immutable and valid; do not rescan or clone each mask at every render. Empty input returns
a detached canonical ARGB destination. Zero-coverage/offcanvas frames still invoke content.

Invoke Content exactly once per descriptor in supplied order on a fresh transparent active
JAVA2D target of destination size, with the same state/lifecycle as rectangular rendering.
Pass descriptor.region unchanged. Composite with existing MaskedComposite2D arithmetic and
that descriptor's private captured coverage. Overlap is ordered source-over, not normalized
neighbor mixing. No random consumption, mask generation or simulation advancement is hidden.
A callback may mutate the caller's list: this must not affect this render's snapshot.

Keep destination values unchanged and return only after all callbacks succeed. Preserve
callback exception identity, all scratch cleanup attempts and suppressed cleanup exceptions.
External effects performed by callbacks cannot be rolled back. No fallback renderer.
No changes to portable raster kernels or existing rectangle pixel-center/feather arithmetic.
Prefer minimal shared private helper reuse, with existing rectangular entry checks unchanged.

## Cost and evidence

Constructor O(pixels) time and 8*pixels bytes of retained coverage per descriptor, excluding
headers. Four 720x480 masks retain 11,059,200 payload bytes. This is an explicit retained
input cost, not an incidental copy on every edit. Rendering remains O(regions*pixels) work
plus callback work, O(pixels) live scratch/composition storage and O(regions) snapshot storage;
existing kernel temporary allocations still apply. No per-pixel object allocation or
per-render mask cloning. Limits guarantee index representation, not host allocation success.
Retain completed images for display/export. No frame-rate claim.

Root acceptance requires focused actual JAVA2D cases for disconnected/hole coverage, pixels
outside the coordinate frame, exact quarter coverage, CANVAS/LOCAL, ordered overlap, zero
mask callback, same-product wrong dimensions, duplicate/null late descriptors before callback,
constructor rejection and caller-array mutation, list mutation during callback, original
callback exception and successful recovery, destination immutability, RGB empty result.
Run existing rectangle native cases unchanged to detect regressions. Measure tiny,
representative and stress native cases with warmups/repetitions/checksums and mask payload
cost; report timing as observations. Use the shared machine render lock.

One artist workflow must reuse an irregular layout across retained global paths, local marks
and explicit image content; demonstrate layout-only and content-only edits. Root reviews
native images before acceptance. Source-built bundle and extracted consumer proof follow;
implementation/compilation alone does not update accepted counts or support records.
