"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json

REVIEW = 'evidence/conformance/placement-export-compatibility-review.json'
PATHS = frozenset(('packages/javascript/src/index.js', 'packages/python/procedurals/__init__.py'))


def historical_export_bytes(root, relative, expected):
    """Return reviewed prior bytes only for the exact current exports and dependencies."""
    if relative not in PATHS:
        return None
    try:
        review = json.loads((root / REVIEW).read_text())
        if (review.get('status'), review.get('owner'), review.get('reviewer')) != ('accepted', 'root', 'root'):
            return None
        entries = review['extensions']
        if set(entries) != PATHS:
            return None
        for key in ('implementation_sha256', 'evidence_sha256'):
            values = review[key]
            if not isinstance(values, dict) or not values:
                return None
            for name, digest in values.items():
                path = (root / name).resolve()
                path.relative_to(root.resolve())
                if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                    return None
        entry = entries[relative]
        before = entry['before'].encode('utf-8')
        after = entry['after'].encode('utf-8')
        if hashlib.sha256(before).hexdigest() != expected or (root / relative).read_bytes() != after:
            return None
        return before
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None
