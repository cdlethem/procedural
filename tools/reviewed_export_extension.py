"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json

REVIEW = 'evidence/conformance/placement-export-compatibility-review.json'
SUCCESSOR = 'evidence/conformance/quadrant-export-compatibility-review.json'
TRIANGLE = 'evidence/conformance/triangle-export-compatibility-review.json'
BRANCH = 'evidence/conformance/branch-export-compatibility-review.json'
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
    if not _bindings(root, root_review, {}):
        return False
    if not isinstance(correction.get('implementation_sha256'), dict) or not isinstance(correction.get('evidence_sha256'), dict):
        return False
    if not (CORRECTED_SOURCES | {HELPER}).issubset(correction['implementation_sha256']):
        return False
    if not {ROOT_CORRECTION, SOURCE_COMPARISON}.issubset(correction['evidence_sha256']):
        return False
    if not _bindings(root, correction, {}):
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
    if helper['after'].encode('utf-8') != _read(root, HELPER):
        return False
    # The helper's prior bytes are fixed by the pushed baseline; the correction
    # successor may only carry this exact historical snapshot forward.
    if _digest(helper['before'].encode('utf-8')) != 'bf839cf4448c5233ce4e185dfaf2136136c77e58a1349fc0c1263ebe95d5aa07':
        return False
    snapshots.update({name: text.encode('utf-8') for name, text in prior.items()})
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
