#!/usr/bin/env python3
"""Stage an editable CP8 sketch with explicit font bytes; no build or render."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FONT_SHA = 'b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c'
LICENSE_SHA = '63d3ba759d12804c5b31a9d5940d855c1820d1f5999e6b0872eb1c7ff045fbc9'
ARCHIVE_SHA = '0a0c6e76f30f0ae8b9eb5b074ca26af117038230993452c9566b7bcc2b17f499'
CORE_SHA = '2cd36310135e4d74f748e33cf062666d4abb6a8d9844620f921d7c0e7936440a'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--font', type=Path, required=True)
    parser.add_argument('--license', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / '.work')
    if output.name != 'GlyphMarks' or output.exists():
        raise RuntimeError('Use a new .work directory ending in GlyphMarks; edited sketches are preserved')
    source_map = {
        'GlyphMarks.pde': ROOT / 'packages/java-processing/examples/GlyphMarks/GlyphMarks.pde',
        'GlyphComposition.java': ROOT / 'packages/java/examples/GlyphMarks/GlyphComposition.java',
        'GlyphFont.java': ROOT / 'packages/java/examples/GlyphMarks/GlyphFont.java',
        'data/GlyphMarks.ttf': args.font.resolve(),
        'data/FONT-LICENSE.txt': args.license.resolve(),
    }
    payloads = {name: path.read_bytes() for name, path in source_map.items()}
    if digest(payloads['data/GlyphMarks.ttf']) != FONT_SHA:
        raise RuntimeError('Expected audited DejaVu Sans font bytes')
    if digest(payloads['data/FONT-LICENSE.txt']) != LICENSE_SHA:
        raise RuntimeError('Expected complete audited font license notice')
    archive = ROOT / '.work/dist/cp7/final/procedurals-processing-0.7.0.zip'
    if digest(archive.read_bytes()) != ARCHIVE_SHA:
        raise RuntimeError('Expected accepted CP7 final archive')
    with zipfile.ZipFile(archive) as bundle:
        payloads['code/procedurals.jar'] = bundle.read('procedurals/library/procedurals.jar')
    if digest(payloads['code/procedurals.jar']) != CORE_SHA:
        raise RuntimeError('Core JAR differs from accepted CP7')
    for name, path in source_map.items():
        if path.read_bytes() != payloads[name]:
            raise RuntimeError('Source changed during staging: ' + str(path))
    output.mkdir(parents=True)
    for name, data in payloads.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    report = {
        'status': 'staged-unvalidated',
        'scope': 'Editable checkout example only; no native execution or package release claim.',
        'source_sha256': {str(path): digest(payloads[name]) for name, path in source_map.items()},
        'archive': {'path': str(archive), 'sha256': ARCHIVE_SHA},
        'staged_sha256': {name: digest(data) for name, data in payloads.items()},
        'tool_sha256': digest(Path(__file__).read_bytes()),
    }
    (output / 'staging.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'sketch': str(output / 'GlyphMarks.pde')}))


if __name__ == '__main__':
    main()
