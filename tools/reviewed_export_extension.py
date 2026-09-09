"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json

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
    path = (root / name).resolve()
    path.relative_to(root.resolve())
    return path.read_bytes()


def _accepted(review):
    return (review.get('status'), review.get('owner'), review.get('reviewer')) == ('accepted', 'root', 'root')


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
    if (not _accepted(review) or not _bindings(root, review, {})
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
            or entry['after'].encode() != _read(root, JS_INDEX)):
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


def historical_export_bytes(root, relative, expected):
    """Return only exact reviewed historical entrypoint bytes.

    A successor may retain the previous entrypoint and verifier bytes for validating
    the immutable placement review. The fixed retained-output correction additionally
    supplies two old source snapshots only to archival binding checks. Returned bytes
    are always entrypoints; runtime operation validation never uses these snapshots.
    """
    if relative not in PATHS:
        return None
    try:
        snapshots = {}
        successor_match = None
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
