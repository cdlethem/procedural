"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json

REVIEW = 'evidence/conformance/placement-export-compatibility-review.json'
SUCCESSOR = 'evidence/conformance/quadrant-export-compatibility-review.json'
HELPER = 'tools/reviewed_export_extension.py'
PATHS = frozenset(('packages/javascript/src/index.js', 'packages/python/procedurals/__init__.py'))


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


def historical_export_bytes(root, relative, expected):
    """Return only exact reviewed historical entrypoint bytes.

    A successor may retain the previous entrypoint and verifier bytes for validating
    the immutable placement review. These snapshots never substitute operation code,
    fixtures, evidence or arbitrary caller-requested files.
    """
    if relative not in PATHS:
        return None
    try:
        snapshots = {}
        successor_match = None
        successor_path = root / SUCCESSOR
        if successor_path.exists():
            successor = json.loads(successor_path.read_text())
            if not _accepted(successor) or not _bindings(root, successor, {}):
                return None
            required = {HELPER, 'packages/javascript/src/index.js',
                        'packages/javascript/src/quadrant-partition.js'}
            if not required.issubset(successor['implementation_sha256']):
                return None
            if successor['previous_review_sha256'] != _digest(_read(root, REVIEW)):
                return None
            prior = successor['previous_bytes']
            # This exact scope is an audited export addition, not a general source overlay.
            if set(prior) != {HELPER, 'packages/javascript/src/index.js'}:
                return None
            snapshots = {name: text.encode('utf-8') for name, text in prior.items()}
            if set(successor['extensions']) != {'packages/javascript/src/index.js'}:
                return None
            entry = successor['extensions']['packages/javascript/src/index.js']
            if entry['before'].encode('utf-8') != snapshots['packages/javascript/src/index.js']:
                return None
            if entry['after'].encode('utf-8') != _read(root, 'packages/javascript/src/index.js'):
                return None
            if relative in successor['extensions'] and _digest(entry['before'].encode('utf-8')) == expected:
                successor_match = entry['before'].encode('utf-8')

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
