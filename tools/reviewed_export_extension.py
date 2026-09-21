"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json
import os
import re
import select
import subprocess
import time

REVIEW = 'evidence/conformance/placement-export-compatibility-review.json'
SUCCESSOR = 'evidence/conformance/quadrant-export-compatibility-review.json'
TRIANGLE = 'evidence/conformance/triangle-export-compatibility-review.json'
BRANCH = 'evidence/conformance/branch-export-compatibility-review.json'
PROFILE = 'evidence/conformance/profile-export-compatibility-review.json'
CORRECTION = 'evidence/conformance/javascript-retained-output-export-successor.json'
HELPER = 'tools/reviewed_export_extension.py'
PATHS = frozenset(('packages/javascript/src/index.js', 'packages/python/procedurals/__init__.py'))
CORRECTED_SOURCES = frozenset(('packages/javascript/src/branch-tree.js', 'packages/javascript/src/triangle-points.js'))
SOURCE_COMPARISON = 'evidence/conformance/javascript-retained-output-source-comparison.json'
ROOT_CORRECTION = 'evidence/conformance/javascript-retained-output-root-review.json'
BASELINE_COMMIT = '4905c054bf6540bdade201f3e64e78423b24d53e'
PUBLIC_WEB_ARCHIVE_COMMIT = 'ed02f698c9f97139be239a8e7b384ba1484359d1'
PUBLIC_WEB_ARCHIVE_MANIFEST = 'evidence/conformance/public-web-historical-source-archive.json'
PUBLIC_WEB_ARCHIVE_REVIEW = 'evidence/conformance/public-web-historical-source-archive-review.json'
PUBLIC_WEB_ARCHIVE_MAX_BYTES = 4 * 1024 * 1024

_HELPER = """function writableArraySlot(array, index) {
  const key = String(index), own = Object.getOwnPropertyDescriptor(array, key);
  if (own !== undefined) return \"value\" in own && own.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    const inherited = Object.getOwnPropertyDescriptor(prototype, key);
    if (inherited !== undefined) return \"value\" in inherited && inherited.writable === true;
  }
  return true;
}
"""
_OLD_BRANCH = """if (Array.isArray(out)) for (let n = 0; n < 4; n += 1) { const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n)); if (descriptor !== undefined && (!(\"value\" in descriptor) || descriptor.writable !== true) || descriptor === undefined && !Object.isExtensible(out)) fail(\"INVALID_OUTPUT\"); }"""
_NEW_BRANCH = """if (Array.isArray(out)) for (let n = 0; n < 4; n += 1) { if (!writableArraySlot(out, offset + n)) fail(\"INVALID_OUTPUT\"); }"""
_OLD_TRIANGLE = """if (Array.isArray(out)) for (let n = 0; n < 2; n += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n));
      if (descriptor !== undefined && (!(\"value\" in descriptor) || descriptor.writable !== true)) fail(\"INVALID_OUTPUT\");
      if (descriptor === undefined && !Object.isExtensible(out)) fail(\"INVALID_OUTPUT\");
    }"""
_NEW_TRIANGLE = """if (Array.isArray(out)) for (let n = 0; n < 2; n += 1) {
      if (!writableArraySlot(out, offset + n)) fail(\"INVALID_OUTPUT\");
    }"""


def _common_remainder(name, text, corrected):
    helper = _HELPER if corrected else ''
    if helper and text.count('\n' + helper) != 1:
        return ''
    value = text.replace('\n' + helper, '') if helper else text
    old, new = (_OLD_BRANCH, _NEW_BRANCH) if name.endswith('branch-tree.js') else (_OLD_TRIANGLE, _NEW_TRIANGLE)
    if text.count(new if corrected else old) != 1:
        return ''
    value = value.replace(new if corrected else old, 'PREFLIGHT')
    return value


def _digest(value):
    return hashlib.sha256(value).hexdigest()


def _read(root, name):
    original = root / name
    path = original.resolve()
    path.relative_to(root.resolve())
    try:
        return path.read_bytes()
    except FileNotFoundError:
        # A dangling symlink is an existing checkout entry, never an archival miss.
        if os.path.lexists(original):
            raise
        archived = _archived_missing_public_web_bytes(root, name)
        if archived is None:
            raise
        return archived


def _accepted(review):
    return (review.get('status'), review.get('owner'), review.get('reviewer')) == ('accepted', 'root', 'root')


def _public_web_archive_paths():
    """Only current app paths that archived successor validators consume."""
    return frozenset({
        BATCH1_GENERATOR,
        BATCH1_GUIDES,
        EXPANSION_GUIDES,
        SECOND_GUIDES,
        *(name for name in COPY_PATHS if name.startswith('apps/web/')),
        *WEB_GALLERY_FILES,
        *WEB_GALLERY_DEPENDENCIES,
        *(name for name in DYNAMICS_WEB_REQUIRED if name.startswith('apps/web/')),
    })


def _archive_marker(root, manifest_bytes):
    path = root / PUBLIC_WEB_ARCHIVE_REVIEW
    try:
        review = json.loads(path.read_bytes())
        helper_bytes = (root / HELPER).read_bytes()
    except (OSError, ValueError, TypeError):
        return None
    if not (isinstance(review, dict)
            and set(review) == {'schema_version', 'status', 'owner', 'reviewer',
                                'archive_commit', 'manifest_sha256', 'helper_sha256',
                                'helper_archive_sha256', 'helper_archive_blob'}
            and review.get('schema_version') == 1
            and _accepted(review)
            and review.get('archive_commit') == PUBLIC_WEB_ARCHIVE_COMMIT
            and review.get('manifest_sha256') == _digest(manifest_bytes)
            and review.get('helper_sha256') == _digest(helper_bytes)):
        return None
    return review


def _archive_path(name):
    return isinstance(name, str) and bool(re.fullmatch(
        r'apps/web/(?:[A-Za-z0-9][A-Za-z0-9._-]*/)*[A-Za-z0-9][A-Za-z0-9._-]*',
        name,
    ))


def _git_output(root, args, limit):
    process = None
    try:
        process = subprocess.Popen(
            ['git', *args],
            cwd=root,
            env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'},
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        output = bytearray()
        deadline = time.monotonic() + 10
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            readable, _, _ = select.select([process.stdout], [], [], remaining)
            if not readable:
                return None
            chunk = os.read(process.stdout.fileno(), min(8192, limit + 1 - len(output)))
            if not chunk:
                break
            output.extend(chunk)
            if len(output) > limit:
                return None
        remaining = deadline - time.monotonic()
        if remaining <= 0 or process.wait(timeout=remaining) != 0:
            return None
        return bytes(output)
    except (OSError, subprocess.SubprocessError):
        return None
    finally:
        if process is not None:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=1)
                except subprocess.SubprocessError:
                    pass


def _git_small_bytes(root, args, limit=128):
    return _git_output(root, args, limit)


def _git_blob_bytes(root, blob, size):
    value = _git_output(root, ['cat-file', 'blob', blob], size)
    return value if value is not None and len(value) == size else None


def _archived_helper_bytes(root, marker):
    if (not isinstance(marker.get('helper_archive_sha256'), str)
            or not re.fullmatch(r'[0-9a-f]{64}', marker['helper_archive_sha256'])
            or not isinstance(marker.get('helper_archive_blob'), str)
            or not re.fullmatch(r'[0-9a-f]{40}', marker['helper_archive_blob'])):
        return None
    resolved = _git_small_bytes(
        root, ['rev-parse', '--verify', f'{PUBLIC_WEB_ARCHIVE_COMMIT}:{HELPER}'],
    )
    if resolved is None or resolved.decode('ascii', 'ignore').strip() != marker['helper_archive_blob']:
        return None
    if _git_small_bytes(root, ['cat-file', '-e', f"{marker['helper_archive_blob']}^{{blob}}"]) is None:
        return None
    reported_size = _git_small_bytes(root, ['cat-file', '-s', marker['helper_archive_blob']])
    if (reported_size is None or not re.fullmatch(rb'[0-9]+\n?', reported_size)
            or int(reported_size) > PUBLIC_WEB_ARCHIVE_MAX_BYTES):
        return None
    bytes_ = _git_blob_bytes(root, marker['helper_archive_blob'], int(reported_size))
    if bytes_ is None or _digest(bytes_) != marker['helper_archive_sha256']:
        return None
    return bytes_


def _verified_archive_marker(root, manifest_bytes):
    marker = _archive_marker(root, manifest_bytes)
    if marker is None:
        return None
    helper_bytes = _archived_helper_bytes(root, marker)
    return None if helper_bytes is None else (marker, helper_bytes)


def _initialize_public_web_archive(root, snapshots):
    """Install only the reviewed helper preimage before legacy successor checks."""
    if not (root / PUBLIC_WEB_ARCHIVE_REVIEW).is_file():
        return True
    try:
        manifest_bytes = (root / PUBLIC_WEB_ARCHIVE_MANIFEST).read_bytes()
    except OSError:
        return False
    verified = _verified_archive_marker(root, manifest_bytes)
    if verified is None:
        return False
    snapshots[HELPER] = verified[1]
    return True


def _archived_missing_public_web_bytes(root, name):
    """Recover only root-reviewed, missing public web bytes from one local commit."""
    if not _archive_path(name):
        return None
    try:
        manifest_bytes = (root / PUBLIC_WEB_ARCHIVE_MANIFEST).read_bytes()
        manifest = json.loads(manifest_bytes)
    except (OSError, ValueError, TypeError):
        return None
    if _verified_archive_marker(root, manifest_bytes) is None:
        return None
    if (not isinstance(manifest, dict)
            or set(manifest) != {'schema_version', 'archive_commit', 'files'}
            or manifest.get('schema_version') != 1
            or manifest.get('archive_commit') != PUBLIC_WEB_ARCHIVE_COMMIT):
        return None
    files = manifest.get('files')
    if not isinstance(files, dict) or set(files) != _public_web_archive_paths():
        return None
    entry = files.get(name)
    if (not isinstance(entry, dict) or set(entry) != {'bytes', 'sha256', 'git_blob'}
            or not isinstance(entry['bytes'], int) or isinstance(entry['bytes'], bool)
            or not 0 <= entry['bytes'] <= PUBLIC_WEB_ARCHIVE_MAX_BYTES
            or not isinstance(entry['sha256'], str)
            or not re.fullmatch(r'[0-9a-f]{64}', entry['sha256'])
            or not isinstance(entry['git_blob'], str)
            or not re.fullmatch(r'[0-9a-f]{40}', entry['git_blob'])):
        return None
    object_name = f'{PUBLIC_WEB_ARCHIVE_COMMIT}:{name}'
    resolved = _git_small_bytes(root, ['rev-parse', '--verify', object_name])
    if resolved is None or resolved.decode('ascii', 'ignore').strip() != entry['git_blob']:
        return None
    if _git_small_bytes(root, ['cat-file', '-e', f"{entry['git_blob']}^{{blob}}"]) is None:
        return None
    reported_size = _git_small_bytes(root, ['cat-file', '-s', entry['git_blob']])
    if (reported_size is None or not re.fullmatch(rb'[0-9]+\n?', reported_size)
            or int(reported_size) != entry['bytes']):
        return None
    bytes_ = _git_blob_bytes(root, entry['git_blob'], entry['bytes'])
    if bytes_ is None or _digest(bytes_) != entry['sha256']:
        return None
    return bytes_


def _bindings(root, review, snapshots):
    for key in ('implementation_sha256', 'evidence_sha256'):
        values = review[key]
        if not isinstance(values, dict) or not values:
            return False
        for name, digest in values.items():
            data = snapshots[name] if name in snapshots else _read(root, name)
            if _digest(data) != digest:
                return False
    return True


def _validate_retained_output_correction(root, snapshots):
    """Validate the narrow source-isolation successor and expose its old bytes."""
    path = root / CORRECTION
    if not path.exists():
        return False
    correction = json.loads(_read(root, CORRECTION))
    root_review = json.loads(_read(root, ROOT_CORRECTION))
    comparison = json.loads(_read(root, SOURCE_COMPARISON))
    if not _accepted(correction) or not _accepted(root_review):
        return False
    if comparison.get('status') != 'passed' or comparison.get('baseline_commit') != BASELINE_COMMIT:
        return False
    if correction.get('previous_review_sha256') != _digest(_read(root, ROOT_CORRECTION)):
        return False
    if not _bindings(root, root_review, snapshots):
        return False
    if not isinstance(correction.get('implementation_sha256'), dict) or not isinstance(correction.get('evidence_sha256'), dict):
        return False
    if not (CORRECTED_SOURCES | {HELPER}).issubset(correction['implementation_sha256']):
        return False
    if not {ROOT_CORRECTION, SOURCE_COMPARISON}.issubset(correction['evidence_sha256']):
        return False
    if not _bindings(root, correction, snapshots):
        return False
    sources = comparison.get('sources')
    if not isinstance(sources, dict) or set(sources) != CORRECTED_SOURCES:
        return False
    prior = correction.get('previous_bytes')
    extensions = correction.get('extensions')
    if not isinstance(prior, dict) or not isinstance(extensions, dict):
        return False
    required = CORRECTED_SOURCES | {HELPER}
    if set(prior) != required or set(extensions) != required:
        return False
    for name in CORRECTED_SOURCES:
        entry = extensions.get(name)
        if not isinstance(entry, dict) or set(entry) != {'before', 'after'}:
            return False
        current = _read(root, name)
        if entry['after'].encode('utf-8') != current:
            return False
        if entry['before'] != prior[name] or _digest(entry['before'].encode('utf-8')) != sources[name].get('before_sha256'):
            return False
        if _digest(current) != sources[name].get('after_sha256') or not sources[name].get('unchanged_outside_helper_and_array_preflight'):
            return False
        current_remainder = _common_remainder(name, current.decode('utf-8'), True)
        prior_remainder = _common_remainder(name, entry['before'], False)
        if not current_remainder or not prior_remainder or current_remainder != prior_remainder:
            return False
    helper = extensions[HELPER]
    if not isinstance(helper, dict) or set(helper) != {'before', 'after'} or helper['before'] != prior[HELPER]:
        return False
    if helper['after'].encode('utf-8') != snapshots.get(HELPER, _read(root, HELPER)):
        return False
    # The helper's prior bytes are fixed by the pushed baseline; the correction
    # successor may only carry this exact historical snapshot forward.
    if _digest(helper['before'].encode('utf-8')) != 'bf839cf4448c5233ce4e185dfaf2136136c77e58a1349fc0c1263ebe95d5aa07':
        return False
    snapshots.update({name: text.encode('utf-8') for name, text in prior.items()})
    return True


JS_PORTS = 'evidence/conformance/javascript-core-export-compatibility-review.json'
JS_INDEX = 'packages/javascript/src/index.js'
JS_PORT_ADDITIONS = 'export { stopRamp, StopRampError } from "./stop-ramp.js";\nexport { bilinearRasterRemap2D, RasterRemapError } from "./raster-remap.js";\nexport { targetSprings2D, SpringError } from "./target-springs.js";\nexport { occupiedLatticePaths2D, LatticeError } from "./occupied-lattice-paths.js";\nexport { delaunay2D, DelaunayError } from "./delaunay.js";\nexport { closedSpline2D, SplineError } from "./closed-spline.js";\nexport { noiseBandPath2D, NoiseBandPathError } from "./noise-band-path.js";\nexport { seededLinePool2D, LinePoolError } from "./line-pool.js";\n'
JS_PORT_MODULES = ('packages/javascript/src/stop-ramp.js', 'packages/javascript/src/raster-remap.js', 'packages/javascript/src/target-springs.js', 'packages/javascript/src/occupied-lattice-paths.js', 'packages/javascript/src/delaunay.js', 'packages/javascript/src/closed-spline.js', 'packages/javascript/src/noise-band-path.js', 'packages/javascript/src/line-pool.js')
JS_PORT_REVIEWS = ('evidence/ports/stop-ramp-p5/root-review.json', 'evidence/ports/raster-remap-p5/root-review.json', 'evidence/ports/target-springs-p5/root-review.json', 'evidence/ports/occupied-lattice-p5/root-review.json', 'evidence/ports/delaunay-p5/root-review.json', 'evidence/ports/closed-spline-p5/root-review.json', 'evidence/ports/noise-band-path-p5/root-review.json', 'evidence/ports/line-pool-p5/root-review.json')



P5_BATCH = 'evidence/conformance/p5-batch-export-compatibility-review.json'
P5_BATCH_ADDITIONS = 'export { binaryCellPartition2D, PartitionError as BinaryPartitionError } from "./binary-cell-partition.js";\nexport { retainedRectangleCuts2D, RectangleCutError, RetainedRectangleCuts2D } from "./retained-rectangle-cuts.js";\nexport { rasterCrossfade2D, RasterCrossfadeError } from "./raster-crossfade.js";\nexport { maskedSourceOver2D, MaskedCompositeError } from "./masked-source-over.js";\nexport { gradientNoise3D01, GradientNoise3D01Error } from "./gradient-noise-3d-01.js";\nexport { orderedConvexPolygonFilter2D, PlacementError as ConvexPlacementError } from "./convex-polygon-placements.js";\nexport { clipSegmentsSimplePolygon2D, SegmentClipError } from "./segment-clip.js";\nexport { radialPull2D, PullError } from "./radial-pull.js";\nexport { sequentialDiscProjection2D, DiscProjectionError } from "./disc-projection.js";\nexport { annularSolid3D, MeshError as AnnularMeshError, FaceLimitError as AnnularFaceLimitError, MeshArithmeticError as AnnularMeshArithmeticError } from "./annular-mesh.js";\nexport { separableBlur2D, SeparableBlurError } from "./separable-blur.js";\nexport { nearestSegmentContact2D, ContactError } from "./nearest-segment-contact.js";\n'
P5_BATCH_MODULES = ('packages/javascript/src/binary-cell-partition.js', 'packages/javascript/src/retained-rectangle-cuts.js', 'packages/javascript/src/raster-crossfade.js', 'packages/javascript/src/masked-source-over.js', 'packages/javascript/src/gradient-noise-3d-01.js', 'packages/javascript/src/convex-polygon-placements.js', 'packages/javascript/src/segment-clip.js', 'packages/javascript/src/radial-pull.js', 'packages/javascript/src/disc-projection.js', 'packages/javascript/src/annular-mesh.js', 'packages/javascript/src/separable-blur.js', 'packages/javascript/src/nearest-segment-contact.js')


def _validate_p5_batch(root, snapshots):
    review = json.loads(_read(root, P5_BATCH))
    test = 'tests/test_reviewed_export_extension.py'
    required = {HELPER, JS_INDEX, test, *P5_BATCH_MODULES}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or JS_PORTS not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, JS_PORTS))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX, test} or set(review['extensions']) != {JS_INDEX}:
        return False
    if _digest(prior[HELPER].encode()) != 'ba6f0089cbe43fe12cfec1567238ba7c99926a5dc0e27684ddc7e56abcd10500':
        return False
    older = json.loads(_read(root, JS_PORTS))
    if _digest(prior[test].encode()) != older['implementation_sha256'][test]:
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or prior[JS_INDEX] != older['extensions'][JS_INDEX]['after']
            or entry['after'] != prior[JS_INDEX] + P5_BATCH_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


def _validate_js_ports(root, snapshots):
    review = json.loads(_read(root, JS_PORTS))
    required = {HELPER, JS_INDEX, *JS_PORT_MODULES}
    evidence = {PROFILE, *JS_PORT_REVIEWS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not evidence.issubset(review['evidence_sha256'])
            or review['previous_review_sha256'] != _digest(_read(root, PROFILE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX} or set(review['extensions']) != {JS_INDEX}:
        return False
    if _digest(prior[HELPER].encode()) != '846b93477950f373062f0116b6e25939161225b821277c79df70492bafcbf179':
        return False
    profile = json.loads(_read(root, PROFILE))
    if prior[JS_INDEX] != profile['extensions'][JS_INDEX]['after']:
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + JS_PORT_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    for name in JS_PORT_REVIEWS:
        accepted = json.loads(_read(root, name))
        if not _accepted(accepted) or not _bindings(root, accepted, {}):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


P5_GALLERY = 'evidence/conformance/p5-gallery-export-compatibility-review.json'
P5_GALLERY_STEMS = ('voronoi-cells-2d', 'resample-polyline-2d', 'marching-squares-2d')
P5_GALLERY_ADDITIONS = ''.join(
    f'export {{ {name} }} from "./{stem}.js";\n'
    for name, stem in zip(('voronoiCells2D', 'resamplePolyline2D', 'marchingSquares2D'), P5_GALLERY_STEMS))


def _validate_p5_gallery(root, snapshots):
    review = json.loads(_read(root, P5_GALLERY))
    older = json.loads(_read(root, P5_BATCH))
    test = 'tests/test_reviewed_export_extension.py'
    required = {HELPER, JS_INDEX, test, *(f'packages/javascript/src/{stem}.js' for stem in P5_GALLERY_STEMS)}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or P5_BATCH not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, P5_BATCH))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX, test} or set(review['extensions']) != {JS_INDEX}:
        return False
    if any(_digest(prior[name].encode()) != older['implementation_sha256'][name] for name in prior):
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + P5_GALLERY_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


P5_TENFOLD = 'evidence/conformance/p5-tenfold-export-compatibility-review.json'
P5_TENFOLD_BINDINGS = (('adjacency-tile-collapse-2d', 'adjacencyTileCollapse2D'), ('assemble-segment-chains-2d', 'assembleSegmentChains2D'), ('bayer-dither', 'bayerDither'), ('binary-morphology-2d', 'binaryMorphology2D'), ('chaikin-polyline-2d', 'chaikinPolyline2D'), ('convex-hull-2d', 'convexHull2D'), ('convolve-2d-signed', 'convolve2DSigned'), ('cost-grid-paths-2d', 'costGridPaths2D'), ('damped-wave-step-2d', 'dampedWaveStep2D'), ('elementary-cellular-rows', 'elementaryCellularRows'), ('euclidean-distance-transform-2d', 'euclideanDistanceTransform2D'), ('extrude-simple-polygon-3d', 'extrudeSimplePolygon3D'), ('floyd-steinberg-dither', 'floydSteinbergDither'), ('gray-scott-step-2d', 'grayScottStep2D'), ('life-like-step-2d', 'lifeLikeStep2D'), ('lloyd-relaxation-2d', 'lloydRelaxation2D'), ('loop-subdivide-triangles-3d', 'loopSubdivideTriangles3D'), ('median-cut-quantize', 'medianCutQuantize'), ('offset-polyline-2d', 'offsetPolyline2D'), ('oklab-ramp', 'oklabRamp'), ('parallel-token-rewrite', 'parallelTokenRewrite'), ('parallel-transport-ribbon-3d', 'parallelTransportRibbon3D'), ('poisson-disc-2d', 'poissonDisc2D'), ('rk4-vector-grid-trace-2d', 'rk4VectorGridTrace2D'), ('scalar-grid-curl-2d', 'scalarGridCurl2D'), ('seeded-depth-first-spanning-tree', 'seededDepthFirstSpanningTree'), ('simplify-polyline-2d', 'simplifyPolyline2D'), ('skyline-pack-2d', 'skylinePack2D'), ('token-turtle-2d', 'tokenTurtle2D'), ('triangulate-simple-polygon-2d', 'triangulateSimplePolygon2D'))
P5_TENFOLD_ADDITIONS = ''.join(f'export {{ {name} }} from "./{stem}.js";\n' for stem, name in P5_TENFOLD_BINDINGS)


def _validate_p5_tenfold(root, snapshots):
    review = json.loads(_read(root, P5_TENFOLD))
    older = json.loads(_read(root, P5_GALLERY))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = {HELPER, JS_INDEX, test}
    required = prior_names | {f'packages/javascript/src/{stem}.js' for stem, _ in P5_TENFOLD_BINDINGS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or P5_GALLERY not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, P5_GALLERY))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX}:
        return False
    if any(_digest(prior[name].encode()) != older['implementation_sha256'][name] for name in prior):
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + P5_TENFOLD_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


BATCH1_SURFACE = 'evidence/conformance/survey-batch1-surface-compatibility-review.json'
BATCH1_GENERATOR = 'apps/web/scripts/generate-api.mjs'
BATCH1_GUIDES = 'apps/web/content/survey-coverage-api.mjs'
BATCH1_PRIOR_WEB = 'evidence/web/p5-tenfold/root-review.json'
BATCH1_BINDINGS = (('seeded-pixel-grain', 'seededPixelGrain', 'SeededPixelGrainError'),
                   ('field-displace-2d', 'fieldDisplace2D', 'FieldDisplace2DError'),
                   ('octave-gradient-noise', 'octaveGradientNoise', 'OctaveGradientNoiseError'))
BATCH1_ROOT_REVIEWS = tuple(
    f'evidence/coverage/batch1/{stem}/root-review.json' for stem, _, _ in BATCH1_BINDINGS)
BATCH1_ADDITIONS = ''.join(f'export {{ {name}, {error} }} from "./{stem}.js";\n' for stem, name, error in BATCH1_BINDINGS)


def batch1_generator_successor(before):
    """Only three named bindings and an isolated authored-guide fallback are admitted."""
    changes = (
        ('import { apiGuides } from "../content/api-guides.mjs";\n',
         'import { apiGuides } from "../content/api-guides.mjs";\nimport { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\n'),
        ('const bindings = {\n', 'const bindings = {\n' + ''.join(
            f'  "{stem}": ["{stem}", "{name}"],\n' for stem, name, _ in BATCH1_BINDINGS)),
        ('const guide = apiGuides[catalog.id];',
         'const guide = surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];'),
    )
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_batch1_surface(root, snapshots):
    review = json.loads(_read(root, BATCH1_SURFACE))
    older = json.loads(_read(root, P5_TENFOLD))
    web = json.loads(_read(root, BATCH1_PRIOR_WEB))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = {HELPER, test, JS_INDEX, BATCH1_GENERATOR}
    required = prior_names | {BATCH1_GUIDES} | {f'packages/javascript/src/{stem}.js' for stem, _, _ in BATCH1_BINDINGS}
    evidence = {P5_TENFOLD, BATCH1_PRIOR_WEB, *BATCH1_ROOT_REVIEWS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not evidence.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, P5_TENFOLD))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX, BATCH1_GENERATOR}:
        return False
    for name in prior:
        source = web if name == BATCH1_GENERATOR else older
        if _digest(prior[name].encode()) != source['implementation_sha256'][name]:
            return False
    expected = {JS_INDEX: prior[JS_INDEX] + BATCH1_ADDITIONS,
                BATCH1_GENERATOR: batch1_generator_successor(prior[BATCH1_GENERATOR])}
    for name in expected:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != expected[name] or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    for name in BATCH1_ROOT_REVIEWS:
        accepted = json.loads(_read(root, name))
        if not _accepted(accepted) or not _bindings(root, accepted, {}):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


EXPANSION_SURFACE = 'evidence/conformance/external-expansion-surface-review.json'
EXPANSION_GUIDES = 'apps/web/content/external-expansion-api.mjs'
EXPANSION_ROOT = 'evidence/expansion/first-batch/root-review.json'
EXPANSION_BINDINGS = (('radius-pairs-2d', 'radiusPairs2D', 'RadiusPairs2DError'),
                      ('pair-force-step-2d', 'pairForceStep2D', 'PairForceStep2DError'))
EXPANSION_ADDITIONS = '\nexport { defaultPalettes } from "./default-palettes.js";\n' + ''.join(
    f'export {{ {name}, {error} }} from "./{stem}.js";\n' for stem, name, error in EXPANSION_BINDINGS)


def expansion_generator_successor(before):
    """Exactly two expansion guides/bindings; existing guide meanings stay unchanged."""
    changes = (
        ('import { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\n',
         'import { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\nimport { externalExpansionApiGuides } from "../content/external-expansion-api.mjs";\n'),
        ('const bindings = {\n', 'const bindings = {\n' + ''.join(
            f'  "{stem}": ["{stem}", "{name}"],\n' for stem, name, _ in EXPANSION_BINDINGS)),
        ('const guide = surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];',
         'const guide = externalExpansionApiGuides[catalog.id] ?? surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];'),
    )
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_expansion_surface(root, snapshots):
    review = json.loads(_read(root, EXPANSION_SURFACE))
    older = json.loads(_read(root, BATCH1_SURFACE))
    accepted = json.loads(_read(root, EXPANSION_ROOT))
    prior_names = {HELPER, 'tests/test_reviewed_export_extension.py', JS_INDEX, BATCH1_GENERATOR}
    required = prior_names | {EXPANSION_GUIDES, 'packages/javascript/src/default-palettes.js'} | {
        f'packages/javascript/src/{stem}.js' for stem, _, _ in EXPANSION_BINDINGS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not _accepted(accepted) or not _bindings(root, accepted, snapshots)
            or not required.issubset(accepted['implementation_sha256'])
            or not required.issubset(review['implementation_sha256'])
            or not {BATCH1_SURFACE, EXPANSION_ROOT}.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, BATCH1_SURFACE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX, BATCH1_GENERATOR}:
        return False
    for name in prior:
        if _digest(prior[name].encode()) != older['implementation_sha256'][name]:
            return False
    expected = {JS_INDEX: prior[JS_INDEX] + EXPANSION_ADDITIONS,
                BATCH1_GENERATOR: expansion_generator_successor(prior[BATCH1_GENERATOR])}
    for name in expected:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != expected[name]
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


COPY_SURFACE = 'evidence/conformance/external-expansion-copy-compatibility-review.json'
COPY_ROOT = 'evidence/web/study-copy-review.json'
# Fixed byte preimages and only the prose replacements in the reviewed cleanup manifest.
# The manifest is a drafting aid in .work; this table is the durable whitelist.
COPY_EDITS = {
    "apps/web/content/agent-trails.md": ("f4b1ffe061624aad17e9056e52addefd947f901abef2d10fc513ab661257c0ed", ((" This is an original study, not a recreation of a surveyed artwork.", ""),)),
    "apps/web/content/arrival-contours.md": ("0a074f02a563b59ea94cd1d9ff21f81f26b7471558ecf737203dcafd04d8cbec", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/aspect-tiles.md": ("a30db1385cd352bf40e4c774d904fc1d13f906d7afd1fbe5fb5d1cd12c20343b", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/blue-noise-stipple.md": ("91413e6b1511794291b5eb300fc06a880fef4833e7e26538b66f41c3eaa59d92", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/centroid-trails.md": ("ee294a9703201894f40c9b050bc45d36ab61937fd5aff44c8fb8bba9088e56e0", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/concave-grain.md": ("32a1c92884c6efe7a5484035715c8126f0fdf1316100d8ce017accc661a7abbd", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/contact-network.md": ("faacbba1ffe71be9d15db78385dc8b75da32b3e6fa80d34a6606de11d3b54da1", ((" This is an original study, not a recreation of a surveyed artwork.", ""),)),
    "apps/web/content/contour-abstraction.md": ("c8aea509ae4e082368bfb877abda1e4905350a58f92c4b17eb666e6118b5f2f3", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/faceted-silhouettes.md": ("4a514732317afa0f798937bddbfcf96f0876904031d28d4d798d03efca41ccca", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/flowing-brushes.md": ("68a9c7a2e36e293e89bb334fd8cdb38d1f7747b517ae3933ed81b0c063a5f3fc", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/fragmented-lines.md": ("28eb055ef8e440c6ff7054ab055a1edcf94aff93505ddba1fee423b94cd2dac8", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/geometric-panel.md": ("587ce13fa1cf602833a1909925a33a41a19c1e68db6ba7d3093538e899338780", ((" This is an original study, not a recreation of a surveyed artwork.", ""),)),
    "apps/web/content/gesture-skeletons.md": ("475f5ba6ea8ef468e3f859aca24a247b4f23e8c99e1d0f152b65d2395bdf35b2", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/nested-contour-strokes.md": ("5c8d0833958062790c6c8ddfbab7ce92478b77a4261cf6b62bc5161af80df32c", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/obstacle-roads.md": ("41dbde4ea4ee10dd6389837359911360c6cc737e39ee6c2d85ae5d38ca219310", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/orbital-brush.md": ("8228142c20a1eecffd5270700b3f8fb9c18a53c4bedee979dab678586ca4ad82", ((" This is an original study, not a recreation of a surveyed artwork.", ""),)),
    "apps/web/content/ornament-poster.md": ("1cefb554b08f483fb3dd5e1f0795241a8740e554614584a57894ab3670ea67ad", ((" This is an original study, not a recreation of a surveyed artwork.", ""),)),
    "apps/web/content/packed-posters.md": ("014c4b0d492b97c3909217594010a04993343ddc611fd8dcef184d38b349fd1c", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/relaxed-stones.md": ("072e1250f5f5b2ef29b0f2f4b99c1de3e771f0e3ec1404e4fe601f3fd99690fa", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/road-margins.md": ("a23a4277eefdcbaa1642f6daea318ec180af81b6f65e18c97f33afcd3bac05af", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/rounded-panels.md": ("40ed1756bcef0047f4748d665b2abca3709e46109513641f32a22dc1faadb260", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/scatter-envelopes.md": ("012d4cdd58f9e3c3b18ca6cdcf9987a1af108cf835e3956d82b509e2d488dd16", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "apps/web/content/spaced-symbols.md": ("262a13774861c923a7cf9ecdd5a639f5c629a72a2c834de1bf15fedd5b5ff6cd", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/stitched-contours.md": ("bbe6a7af29ebccdaa95246fbd8d3109f0f23aaa8e0fdf9efb7cfe487e51d0ae1", ((" This is an original design, not a corpus recreation.", ""),)),
    "apps/web/content/terraced-islands.md": ("989e5b2a4d17442e6c742d0b4454414c2c68fee586f3cafa1f7f4b5c88e3f571", ((" This is an original design study, not a recreation of a surveyed original.", ""),)),
    "docs/agent-behavior-studies.md": ("60f4c24be6954d384b3ca98db296a377110bc0cd832e3595e7b9b4c1bba7abb0", (("links the external motivations and distinguishes these original studies from source recreations.", "links the external motivations and operation boundaries."),)),
    "docs/bridge-web.md": ("1737d7b11a5caf58ede8c572b7db799469aacea32a98e1044037a03bb7a45cc4", (("The composition is motivated by [Hoff's *A Tangle of Webs*](https://inconvergent.net/2019/a-tangle-of-webs/); this is an original planar web rather than a recreation of that source.", "For related composition context, see [Hoff's *A Tangle of Webs*](https://inconvergent.net/2019/a-tangle-of-webs/)."),)),
    "docs/motif-compositions.md": ("96bd1985f61a1344d58767c750da1cc3795ea73032b133f8884c03c517423dcf", (("They are original compositions, motivated by the composition tasks documented\nin the local external-art research. They do not recreate an artist's work or use artwork,\nSVGs, code, or other assets from those sources.", "They explore composition tasks from the local external-art research through\neditable placements and mark treatments."), (" The examples use original marks and make no claim to\nreproduce those artists' algorithms or artworks.", ""))),
    "docs/p5-feedback-surface.md": ("5bd817884aee09df7763f009d6aeba77d9f5c229fd2ad7f116ed4ce54946a67e", (("It is an original study motivated by the retained-image questions", "The example explores retained-image questions"), ("; this example does not claim to reproduce those artists' algorithms.", "."))),
    "docs/periodic-fluid-fields.md": ("1e4372a1b1c62b28330e983b85bffee2fcb601f9e87d33dfd0e72f3134a0817f", (("The study's other settings are authored choices,\nnot corpus-derived recommended ranges. This CPU grid workflow is an original study, with\nno claim of a GPU fluid solver or recreation of a specific source artwork.", "The study's other settings are authored choices,\nnot corpus-derived recommended ranges. The operations use a CPU grid, with no GPU solver."),)),
    "docs/proximity-interactions.md": ("810b07d4e8dfb49206a6376f0c085418e6e9b9d7b6809c6a23b9198c49077a39", (("These original studies use independently specified point interactions. They do not\nimplement Process18's persistent relationship opacity or Tissue's sensor/motor\nbehavior. A retained path is a point's movement history, not memory of a pair's\ncontact.", "The studies use independently specified point interactions. Persistent pair-opacity\nand sensor/motor feedback are separate computations. A retained path is a point's\nmovement history, not memory of a pair's contact."),)),
    "docs/thick-regions-and-plotting.md": ("04d03f43962fca826b92db49360e54d966bbbcdb2f1b05c8a5570814e2f7c300", (("Both are original studies, motivated by the tasks described in the [capability decision](../design/capabilities/thick-regions-and-plotting.md). They do not recreate a named artist work.", "The [capability decision](../design/capabilities/thick-regions-and-plotting.md) explains the reusable geometry behind both studies."),)),
    "docs/weighted-image-marks.md": ("57b48933b1c533d3b8012edd536923de6b36a2915e18c50c21d38c6e0aba3912", ((" Neither source is a borrowed artwork or a recreation of a reference piece.", ""), ("The [capability decision](../design/capabilities/weighted-image-marks.md) separates this task from Sighack's brightness-to-circle-radius packing and Secord's continuous weighted Voronoi precedent.", "The [capability decision](../design/capabilities/weighted-image-marks.md) discusses Sighack's brightness-to-circle-radius packing and Secord's continuous weighted Voronoi method as related context."))),
    "docs/word-echo.md": ("2c752581ff201c5e9b87774176bc54a9511de1fb8e5202c8a824134b1da85241", (("These are original transfer\nstudies, not recreations of the Davis tennis work that motivates the broader\nrecorded-control task. Open the local", "Davis's tennis work motivates the broader recorded-control task.\nOpen the local"),)),
    "apps/web/content/external-expansion-api.mjs": ("8e580287669f841e33b4d564f9cd5872c6be3de18393e996e17080d924dd984c", ((', "This authored force law does not recreate Reas Process 18 or Tissue."', ''),)),
    "apps/web/content/survey-coverage-api.mjs": ("af5001ad2fccb27d7b5c608bee85daf1b35f2d0e1ee1cc16fe31e26c11ae0771", (('      "This is a pixel transform component; it does not reproduce a source shader hash or an entire sketch.",\n', ''),)),
    'packages/javascript/examples/contact-network/index.html': ('b9b3f9c815045fed7dc873cc794bdee0a275dd6b6b52b820de37b9bb75e082bc', (('; this is an independent study, not a recreation of their rules.', '.'),)),
    'packages/javascript/examples/agent-trails/index.html': ('3b6af1df317dc25549493b0c98ddad2bd2017a485c65e257615c622a331a9410', (('; this is an independent study, not a recreation of their rules.', '.'),)),
    'packages/javascript/examples/feedback-print/index.html': ('6d313a57e7cf073c4aecab5910f4d84cf5445bb362bbca2f95657554ef451edf', (("; this is not a recreation of either artist's method.", '.'),)),
}
COPY_PATHS = frozenset(COPY_EDITS)


WEB_GALLERY = 'evidence/conformance/external-expansion-gallery-compatibility-review.json'
WEB_GALLERY_ROOT = 'evidence/web/external-expansion-gallery-review.json'
WEB_GALLERY_PREVIOUS = 'evidence/web/p5-tenfold/root-review.json'
WEB_GALLERY_FILES = frozenset((
    'apps/web/lib/studio.ts', 'apps/web/lib/render-studio.ts', 'apps/web/lib/harness-render.ts',
    'apps/web/scripts/generate-gallery.mjs', 'apps/web/scripts/sketch-source.mjs', 'apps/web/tests/studio.test.ts',
))
WEB_GALLERY_DEPENDENCIES = frozenset((
    'apps/web/lib/adapters/external-expansion.ts',
    'apps/web/content/external-expansion-studies.mjs',
    'apps/web/content/agent-trails.md',
    'apps/web/content/contact-network.md',
    'apps/web/content/geometric-panel.md',
    'apps/web/content/orbital-brush.md',
    'apps/web/content/ornament-poster.md',
))

SECOND_SURFACE = 'evidence/conformance/external-dynamics-surface-review.json'
SECOND_ROOT = 'evidence/expansion/second-batch/root-review.json'
SECOND_GUIDES = 'apps/web/content/external-dynamics-api.mjs'
SECOND_BINDINGS = (
    ('contact-history-2d', 'contactHistory2D', 'ContactHistory2DError'),
    ('sensor-motor-step-2d', 'sensorMotorStep2D', 'SensorMotorStep2DError'),
    ('flock-steer-2d', 'flockSteer2D', 'FlockSteer2DError'),
    ('region-clearance-2d', 'regionClearance2D', 'RegionClearance2DError'),
    ('tapered-stroke-strip-2d', 'taperedStrokeStrip2D', 'TaperedStrokeStrip2DError'),
    ('select-tapered-stroke-strips-2d', 'selectTaperedStrokeStrips2D', 'SelectTaperedStrokeStrips2DError'),
    ('hatch-region-lines-2d', 'hatchRegionLines2D', 'HatchRegionLines2DError'),
    ('svg-plot-plan-01', 'svgPlotPlan01', 'SvgPlotPlan01Error'),
    ('insert-segment-bridge-2d', 'insertSegmentBridge2D', 'InsertSegmentBridge2DError'),
    ('relative-neighborhood-pairs-2d', 'relativeNeighborhoodPairs2D', 'RelativeNeighborhoodPairs2DError'),
    ('threshold-edge-relaxation-2d', 'thresholdEdgeRelaxation2D', 'ThresholdEdgeRelaxation2DError'),
    ('elastic-curve-grow-step-2d', 'elasticCurveGrowStep2D', 'ElasticCurveGrowStep2DError'),
    ('project-periodic-velocity-2d', 'projectPeriodicVelocity2D', None),
    ('advect-periodic-scalar-2d', 'advectPeriodicScalar2D', None),
    ('diffuse-periodic-scalar-2d', 'diffusePeriodicScalar2D', None),
)
SECOND_HOST = 'packages/javascript/src/p5-feedback-surface.js'
SECOND_MODULES = frozenset(f'packages/javascript/src/{stem}.js' for stem, _, _ in SECOND_BINDINGS) | {SECOND_HOST}
SECOND_TRANSITIVE = frozenset(f'packages/javascript/src/internal/{stem}.js' for stem in (
    'agent-behavior-utils', 'region-utils', 'graph-growth-utils', 'elastic-growth-utils',
    'periodic-grid', 'systems-a-utils', 'exact-rational', 'fdlibm-hypot')) | {
        'packages/javascript/src/fdlibm-trig.js'}
SECOND_REQUIRED = frozenset({HELPER, 'tests/test_reviewed_export_extension.py', JS_INDEX,
                              BATCH1_GENERATOR, SECOND_GUIDES}) | SECOND_MODULES | SECOND_TRANSITIVE
SECOND_ADDITIONS = '\n' + ''.join(
    f'export {{ {name}{", " + error if error else ""} }} from "./{stem}.js";\n'
    for stem, name, error in SECOND_BINDINGS
) + 'export { createP5FeedbackSurface, P5FeedbackSurfaceError } from "./p5-feedback-surface.js";\n'


def second_generator_successor(before):
    """Add exactly the approved 15 guide bindings, preserving all prior entries."""
    changes = (
        ('import { externalExpansionApiGuides } from "../content/external-expansion-api.mjs";\n',
         'import { externalExpansionApiGuides } from "../content/external-expansion-api.mjs";\n'
         'import { externalDynamicsApiGuides } from "../content/external-dynamics-api.mjs";\n'),
        ('const bindings = {\n', 'const bindings = {\n' + ''.join(
            f'  "{stem}": ["{stem}", "{name}"],\n' for stem, name, _ in SECOND_BINDINGS)),
        ('const guide = externalExpansionApiGuides[catalog.id] ?? surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];',
         'const guide = externalDynamicsApiGuides[catalog.id] ?? externalExpansionApiGuides[catalog.id] ?? surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];'),
    )
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_second_surface(root, snapshots):
    review = json.loads(_read(root, SECOND_SURFACE))
    accepted = json.loads(_read(root, SECOND_ROOT))
    expansion = json.loads(_read(root, EXPANSION_SURFACE))
    gallery = json.loads(_read(root, WEB_GALLERY))
    prior_names = {HELPER, 'tests/test_reviewed_export_extension.py', JS_INDEX, BATCH1_GENERATOR}
    if (not _accepted(review) or not _accepted(accepted)
            or not SECOND_REQUIRED.issubset(review['implementation_sha256'])
            or not SECOND_REQUIRED.issubset(accepted['implementation_sha256'])
            or not {WEB_GALLERY, EXPANSION_SURFACE, SECOND_ROOT}.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, WEB_GALLERY))
            or not _bindings(root, review, snapshots) or not _bindings(root, accepted, snapshots)):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX, BATCH1_GENERATOR}:
        return False
    for name in prior:
        source = expansion if name in {JS_INDEX, BATCH1_GENERATOR} else gallery
        if _digest(prior[name].encode()) != source['implementation_sha256'][name]:
            return False
    expected = {JS_INDEX: prior[JS_INDEX] + SECOND_ADDITIONS,
                BATCH1_GENERATOR: second_generator_successor(prior[BATCH1_GENERATOR])}
    if expected[BATCH1_GENERATOR] is None:
        return False
    for name in expected:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != expected[name]
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


def copy_cleanup_successor(name, before):
    """Apply only the reviewed prose replacements to an exact preimage."""
    specification = COPY_EDITS.get(name)
    if specification is None or _digest(before.encode()) != specification[0]:
        return None
    result = before
    for old, new in specification[1]:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_copy_surface(root, snapshots):
    review = json.loads(_read(root, COPY_SURFACE))
    accepted = json.loads(_read(root, COPY_ROOT))
    second = json.loads(_read(root, SECOND_SURFACE))
    second_root = json.loads(_read(root, SECOND_ROOT))
    verifier = {HELPER, 'tests/test_reviewed_export_extension.py'}
    required = COPY_PATHS | verifier
    if (not _accepted(review) or not _accepted(accepted)
            or not required.issubset(review['implementation_sha256'])
            or not required.issubset(accepted['implementation_sha256'])
            or not {SECOND_SURFACE, COPY_ROOT}.issubset(review['evidence_sha256'])
            or not {SECOND_SURFACE, SECOND_ROOT}.issubset(accepted['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, SECOND_SURFACE))
            or not _bindings(root, review, snapshots) or not _bindings(root, accepted, snapshots)):
        return False
    prior = review['previous_bytes']
    if set(prior) != required or set(review['extensions']) != COPY_PATHS:
        return False
    for name in verifier:
        if (_digest(prior[name].encode()) != second['implementation_sha256'][name]
                or _digest(prior[name].encode()) != second_root['implementation_sha256'][name]):
            return False
    for name in COPY_PATHS:
        before = prior[name]
        after = copy_cleanup_successor(name, before)
        entry = review['extensions'][name]
        if (after is None or set(entry) != {'before', 'after'}
                or entry['before'] != before or entry['after'] != after
                or after.encode() != snapshots.get(name, _read(root, name))):
            return False
        for predecessor in (second, second_root):
            if name in predecessor['implementation_sha256']:
                if _digest(before.encode()) != predecessor['implementation_sha256'][name]:
                    return False
    snapshots.update({name: text.encode() for name, text in prior.items()})
    return True


def web_gallery_successor(name, before):
    """Apply only the reviewed five-study registration and source extraction edits."""
    if name == 'apps/web/lib/studio.ts':
        changes = (
            ('import { expansionDefinitions } from "./adapters/expansion";\n',
             'import { expansionDefinitions } from "./adapters/expansion";\n'
             'import {\n  externalExpansionDefinitions,\n  externalExpansionPalette,\n'
             '} from "./adapters/external-expansion";\n'),
            ('  ...expansionDefinitions,\n',
             '  ...expansionDefinitions,\n  ...externalExpansionDefinitions,\n'),
            ('function paletteFor(id: string): number[] {\n',
             'function paletteFor(id: string): number[] {\n'
             '  const external = externalExpansionPalette(id);\n'
             '  if (external) return external;\n'),
        )
    elif name == 'apps/web/lib/render-studio.ts':
        changes = (
            ('import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n',
             'import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n'
             'import {\n  drawExternalExpansion,\n  externalExpansionDefinitions,\n'
             '} from "./adapters/external-expansion";\n'),
            ('const expansionIds = new Set(expansionDefinitions.map((definition) => definition.id));\n',
             'const expansionIds = new Set(expansionDefinitions.map((definition) => definition.id));\n'
             'const externalExpansionIds = new Set(\n'
             '  externalExpansionDefinitions.map((definition) => definition.id),\n);\n'),
            ('  if (expansionIds.has(layer.technique)) return drawExpansion(p, layer);\n',
             '  if (expansionIds.has(layer.technique)) return drawExpansion(p, layer);\n'
             '  if (externalExpansionIds.has(layer.technique)) return drawExternalExpansion(p, layer);\n'),
        )
    elif name == 'apps/web/lib/harness-render.ts':
        changes = (('import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n', 'import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\nimport {\n  drawExternalExpansion,\n  externalExpansionDefinitions,\n} from "./adapters/external-expansion";\n'), ('const expansionIds = new Set(expansionDefinitions.map((item) => item.id));\n', 'const expansionIds = new Set(expansionDefinitions.map((item) => item.id));\nconst externalExpansionIds = new Set(externalExpansionDefinitions.map((item) => item.id));\n'), ('  if (expansionIds.has(workflow.technique)) return drawExpansion(p, workflow);\n', '  if (expansionIds.has(workflow.technique)) return drawExpansion(p, workflow);\n  if (externalExpansionIds.has(workflow.technique)) return drawExternalExpansion(p, workflow);\n'))
    elif name == 'apps/web/tests/studio.test.ts':
        changes = (('all 90 studio definitions', 'all 95 studio definitions'),
                   ('assert.equal(techniques.length, 90);', 'assert.equal(techniques.length, 95);'))
    elif name == 'apps/web/scripts/generate-gallery.mjs':
        changes = (
            ('import { tenfoldStudies } from "../content/tenfold-studies.mjs";\n',
             'import { tenfoldStudies } from "../content/tenfold-studies.mjs";\n'
             'import { externalExpansionStudies } from "../content/external-expansion-studies.mjs";\n'),
            ('definitions.push(...tenfoldStudies.map(study => [study.slug, study.category, study.operations]));\n',
             'definitions.push(...tenfoldStudies.map(study => [study.slug, study.category, study.operations]));\n'
             'definitions.push(...externalExpansionStudies.map(study => [study.slug, study.category, study.operations]));\n'),
            ('  "masked-partition-marks", "placement-image-marks", "pointer-marks", "relief-marks",\n]);\n',
             '  "masked-partition-marks", "placement-image-marks", "pointer-marks", "relief-marks",\n]);\n'
             '// Present package examples that are either private layout helpers or pending separate\n'
             '// review. Listing them here prevents a directory from becoming a gallery workflow merely\n'
             '// because it exists; accepted registrations above remain the source of gallery membership.\n'
             'const pendingExampleSlugs = new Set([\n'
             '  "motif-compositions",\n  "dye-currents",\n  "field-displacement",\n'
             '  "flocking-marks",\n  "lingering-links",\n  "octave-noise",\n'
             '  "pixel-grain",\n  "sensing-trails",\n  "guarded-bands",\n'
             '  "hatched-islands",\n  "bridge-web",\n  "neighborhood-growth",\n]);\n'),
            ('if (\n  dirs.length !== slugs.size + nativeOnlySlugs.size ||\n'
             '  dirs.some((d) => !slugs.has(d) && !nativeOnlySlugs.has(d)) ||\n'
             '  [...slugs, ...nativeOnlySlugs].some((slug) => !dirs.includes(slug))\n)',
             'const declaredExampleSlugs = new Set([\n'
             '  ...slugs,\n  ...nativeOnlySlugs,\n  ...pendingExampleSlugs,\n]);\n'
             'if (\n  dirs.some((directory) => !declaredExampleSlugs.has(directory)) ||\n'
             '  [...slugs, ...nativeOnlySlugs].some(\n'
             '    (slug) => !dirs.includes(slug),\n  )\n)'),
        )
    elif name == 'apps/web/scripts/sketch-source.mjs':
        changes = (
            ('  for (const group of ["basic", "geometry", "effects", "expansion", "paths", "systems", "materials"]) {',
             '  for (const [group, dispatchName] of [\n'
             '    ["basic", "basic"],\n    ["geometry", "geometry"],\n'
             '    ["effects", "effects"],\n    ["expansion", "expansion"],\n'
             '    ["external-expansion", "externalExpansion"],\n'
             '    ["paths", "paths"],\n    ["systems", "systems"],\n'
             '    ["materials", "materials"],\n  ]) {'),
            ('`draw${group[0].toUpperCase()}${group.slice(1)}`',
             '`draw${dispatchName[0].toUpperCase()}${dispatchName.slice(1)}`'),
        )
    else:
        return None
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_web_gallery(root, snapshots):
    review = json.loads(_read(root, WEB_GALLERY))
    older = json.loads(_read(root, EXPANSION_SURFACE))
    previous_web = json.loads(_read(root, WEB_GALLERY_PREVIOUS))
    web = json.loads(_read(root, WEB_GALLERY_ROOT))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = WEB_GALLERY_FILES | {HELPER, test}
    required = prior_names | WEB_GALLERY_DEPENDENCIES
    if (not _accepted(review) or not _accepted(web)
            or not _bindings(root, review, snapshots)
            or not _bindings(root, web, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not (WEB_GALLERY_FILES | WEB_GALLERY_DEPENDENCIES).issubset(web['implementation_sha256'])
            or not {EXPANSION_SURFACE, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS}.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, EXPANSION_SURFACE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != WEB_GALLERY_FILES:
        return False
    for name in prior:
        source = previous_web if name in WEB_GALLERY_FILES else older
        if _digest(prior[name].encode()) != source['implementation_sha256'][name]:
            return False
    for name in WEB_GALLERY_FILES:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != web_gallery_successor(name, prior[name])
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True



DYNAMICS_WEB = 'evidence/conformance/external-dynamics-gallery-compatibility-review.json'
DYNAMICS_WEB_ROOT = 'evidence/web/external-dynamics-gallery-review.json'
DYNAMICS_WEB_PAIRS = {'apps/web/lib/studio.ts': ('3234718fc1ce5c2a2bf5cd0c0f956fe2b05e79e0fd6e3c78c9c5c617136eb833', 'e8f77dc25bc5b254f115f6181ece0b24287bbaac9d8351ca2ffcfe61838b6f7a'), 'apps/web/lib/render-studio.ts': ('c74d2646223ab80dab81f4beb33b6ada76d15db2fa90af450676271260b3b0c8', 'df2bbd69e2c8f7d65d326890cf21aea92c3a2bef3a57809e0110bdaee87d7e68'), 'apps/web/lib/harness-render.ts': ('0ecce43266b068779397563db321e94cfb41db32314ebd755366cda7751f0533', 'cb0d8654c82032c3dab3e8fc6be1d89bf5c948433f22c5c27d02cf7cfcef58bc'), 'apps/web/scripts/generate-gallery.mjs': ('efcd284c1fbb41ef31083d8588dcde1149ea11c348cdf33213715fc760996bf5', '85f282dd557424bdcc5ba9a3805c856ae8565c111ab2874b32acb167289bf363'), 'apps/web/tests/studio.test.ts': ('0fe5ebc54ac8d9c4529e8fd155d00f2ae10e0c00a8c47d85a0c31b4a9eac03d4', '79acf30947255223e05c72a8a4e271c1e20702411ae8273a0d178eea4e22cd1b')}
DYNAMICS_WEB_FILES = frozenset(DYNAMICS_WEB_PAIRS)
DYNAMICS_WEB_REQUIRED = DYNAMICS_WEB_FILES | frozenset(['apps/web/lib/adapters/external-dynamics.ts', 'apps/web/content/external-dynamics-studies.mjs', 'apps/web/tests/external-dynamics-adapters.test.ts', 'apps/web/content/lingering-links.md', 'apps/web/content/sensing-trails.md', 'apps/web/content/flocking-marks.md', 'apps/web/content/guarded-bands.md', 'apps/web/content/hatched-islands.md', 'apps/web/content/bridge-web.md', 'apps/web/content/neighborhood-growth.md', 'apps/web/content/elastic-loops.md', 'apps/web/content/dye-currents.md', 'tools/reviewed_export_extension.py', 'tests/test_reviewed_export_extension.py'])

def _validate_dynamics_web(root, snapshots):
    review = json.loads(_read(root, DYNAMICS_WEB))
    accepted = json.loads(_read(root, DYNAMICS_WEB_ROOT))
    previous = json.loads(_read(root, COPY_SURFACE))
    gallery = json.loads(_read(root, WEB_GALLERY))
    verifier = {HELPER, 'tests/test_reviewed_export_extension.py'}
    if (not _accepted(review) or not _accepted(accepted)
            or not DYNAMICS_WEB_REQUIRED.issubset(review['implementation_sha256'])
            or not DYNAMICS_WEB_REQUIRED.issubset(accepted['implementation_sha256'])
            or not {COPY_SURFACE, DYNAMICS_WEB_ROOT}.issubset(review['evidence_sha256'])
            or not {COPY_SURFACE, SECOND_ROOT}.issubset(accepted['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, COPY_SURFACE))
            or not _bindings(root, review, snapshots) or not _bindings(root, accepted, snapshots)):
        return False
    prior = review['previous_bytes']
    if set(prior) != DYNAMICS_WEB_FILES | verifier or set(review['extensions']) != DYNAMICS_WEB_FILES:
        return False
    for name in verifier:
        if _digest(prior[name].encode()) != previous['implementation_sha256'][name]:
            return False
    for name, (old_hash, new_hash) in DYNAMICS_WEB_PAIRS.items():
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or _digest(prior[name].encode()) != old_hash
                or old_hash != gallery['implementation_sha256'][name]
                or _digest(entry['after'].encode()) != new_hash
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: text.encode() for name, text in prior.items()})
    return True

def historical_export_bytes(root, relative, expected):
    """Return only exact reviewed historical entrypoint bytes.

    A successor may retain the previous entrypoint and verifier bytes for validating
    the immutable placement review. The fixed retained-output correction additionally
    supplies two old source snapshots only to archival binding checks. Returned bytes
    are always entrypoints; runtime operation validation never uses these snapshots.
    """
    batch1_archival_paths = {JS_INDEX, BATCH1_GENERATOR, HELPER, 'tests/test_reviewed_export_extension.py'}
    archival_paths = batch1_archival_paths | WEB_GALLERY_FILES | COPY_PATHS
    if relative not in PATHS and relative not in archival_paths:
        return None
    try:
        snapshots = {}
        if not _initialize_public_web_archive(root, snapshots):
            return None
        successor_match = None
        if (root / DYNAMICS_WEB).exists():
            if not _validate_dynamics_web(root, snapshots):
                return None
            if relative in snapshots and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / COPY_SURFACE).exists():
            if not _validate_copy_surface(root, snapshots):
                return None
            if relative in snapshots and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / SECOND_SURFACE).exists():
            if not _validate_second_surface(root, snapshots):
                return None
            if relative in snapshots and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / WEB_GALLERY).exists():
            if not _validate_web_gallery(root, snapshots):
                return None
            if relative in snapshots and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / EXPANSION_SURFACE).exists():
            if not _validate_expansion_surface(root, snapshots):
                return None
            if relative in batch1_archival_paths and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / BATCH1_SURFACE).exists():
            if not _validate_batch1_surface(root, snapshots):
                return None
            if relative in batch1_archival_paths and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / P5_TENFOLD).exists():
            if not _validate_p5_tenfold(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / P5_GALLERY).exists():
            if not _validate_p5_gallery(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / P5_BATCH).exists():
            if not _validate_p5_batch(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / JS_PORTS).exists():
            if not _validate_js_ports(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / PROFILE).exists():
            profile = json.loads(_read(root, PROFILE))
            required = {HELPER, *PATHS, 'packages/javascript/src/radial-profile.js',
                        'packages/python/procedurals/radial_profile.py'}
            evidence = {CORRECTION, 'evidence/conformance/radial-profile-javascript-root-review.json',
                        'evidence/conformance/radial-profile-python-root-review.json',
                        'evidence/conformance/profile-p5js-native-root-review.json',
                        'evidence/conformance/profile-py5-native-root-review.json'}
            if (not _accepted(profile) or not _bindings(root, profile, snapshots)
                    or not required.issubset(profile['implementation_sha256'])
                    or not evidence.issubset(profile['evidence_sha256'])
                    or profile['previous_review_sha256'] != _digest(_read(root, CORRECTION))):
                return None
            prior = profile['previous_bytes']
            if set(prior) != {HELPER, *PATHS} or set(profile['extensions']) != PATHS:
                return None
            if _digest(prior[HELPER].encode()) != '6e80c1e797186611cfecbffab6f8e5f0e29e69d46ae76f336d76f1f28b2bfb16':
                return None
            additions = {
                'packages/javascript/src/index.js': 'export { RadialProfile3D, RadialProfileError } from "./radial-profile.js";\n',
                'packages/python/procedurals/__init__.py': '\nfrom .radial_profile import RadialProfile3D, RadialProfileError\n__all__ += ["RadialProfile3D", "RadialProfileError"]\n',
            }
            for name in PATHS:
                entry = profile['extensions'][name]
                if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                        or entry['after'] != entry['before'] + additions[name]
                        or entry['after'].encode() != snapshots.get(name, _read(root, name))):
                    return None
                if name == relative and _digest(entry['before'].encode()) == expected:
                    successor_match = entry['before'].encode()
            snapshots.update({name: value.encode() for name, value in prior.items()})
        if (root / CORRECTION).exists() and not _validate_retained_output_correction(root, snapshots):
            return None
        # Only these frozen export transitions are authorized. Walking newest to
        # oldest keeps earlier reviews immutable without allowing arbitrary overlays.
        stages = (
            (BRANCH, TRIANGLE, PATHS,
             {HELPER, *PATHS, 'packages/javascript/src/branch-tree.js',
              'packages/python/procedurals/branch_tree.py'}),
            (TRIANGLE, SUCCESSOR, PATHS,
             {HELPER, *PATHS, 'packages/javascript/src/triangle-points.js',
              'packages/python/procedurals/triangle_points.py',
              'packages/python/procedurals/quadrant_partition.py'}),
            (SUCCESSOR, REVIEW, {'packages/javascript/src/index.js'},
             {HELPER, 'packages/javascript/src/index.js',
              'packages/javascript/src/quadrant-partition.js'}),
        )
        for record, previous, changed, required in stages:
            if not (root / record).exists():
                continue
            successor = json.loads(_read(root, record))
            if not _accepted(successor) or not _bindings(root, successor, snapshots):
                return None
            if not required.issubset(successor['implementation_sha256']):
                return None
            if successor['previous_review_sha256'] != _digest(_read(root, previous)):
                return None
            prior = successor['previous_bytes']
            if set(prior) != {HELPER, *changed} or set(successor['extensions']) != changed:
                return None
            for name, entry in successor['extensions'].items():
                current = snapshots[name] if name in snapshots else _read(root, name)
                if entry['after'].encode('utf-8') != current:
                    return None
                before = entry['before'].encode('utf-8')
                if before != prior[name].encode('utf-8'):
                    return None
                if name == relative and _digest(before) == expected:
                    successor_match = before
            snapshots.update({name: text.encode('utf-8') for name, text in prior.items()})

        review = json.loads(_read(root, REVIEW))
        if not _accepted(review) or not _bindings(root, review, snapshots):
            return None
        entries = review['extensions']
        if set(entries) != PATHS:
            return None
        # Validate both retained entrypoint snapshots, even when only one is requested.
        for name, entry in entries.items():
            current = snapshots[name] if name in snapshots else _read(root, name)
            if entry['after'].encode('utf-8') != current:
                return None
        if successor_match is not None:
            return successor_match
        before = entries[relative]['before'].encode('utf-8')
        return before if _digest(before) == expected else None
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None
