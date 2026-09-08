#!/usr/bin/env python3
"""Assemble the accepted Java source surface without historical local build artifacts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.operation_attestations import load_attestations


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_zip(path, entries):
    with zipfile.ZipFile(path, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, payload in sorted(entries.items()):
            if Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name:
                raise ValueError('Unsafe archive member: ' + name)
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payload)


def require_hash(path, expected):
    if not path.is_file() or sha(path) != expected:
        raise ValueError('Accepted input missing or changed: ' + str(path))


def fresh_output(root, output):
    output = output.resolve()
    if (root / '.work').resolve() not in output.parents or output.exists():
        raise ValueError('Output must be a fresh directory below repository .work')
    return output


def java_home(value):
    supplied = value or os.environ.get('JAVA_HOME')
    found = shutil.which('javac') if not supplied else None
    if not supplied and not found:
        raise ValueError('Supply --java-home, JAVA_HOME or javac on PATH')
    home = Path(supplied).expanduser().resolve() if supplied else Path(found).resolve().parents[1]
    for name in ('bin/javac', 'bin/java', 'release', 'lib/modules'):
        if not (home / name).is_file():
            raise ValueError('Missing JDK input: ' + str(home / name))
    return home


def source_inputs(root):
    manifest_path = root / 'packages/java/source-bundle.json'
    manifest = json.loads(manifest_path.read_text())
    review = manifest['accepted_distribution_review']
    require_hash(root / review['path'], review['sha256'])
    approval = json.loads((root / review['path']).read_text())
    if approval.get('status') != 'accepted' or approval.get('reviewer') != 'root':
        raise ValueError('Root distribution acceptance required')
    actual = {str(p.relative_to(root)) for p in (root / 'packages/java/src/main/java').rglob('*.java')}
    if actual != set(manifest['core_sources']):
        raise ValueError('Java source inventory differs from accepted source release')
    for name, expected in manifest['core_sources'].items():
        require_hash(root / name, expected)
    adapter_root = root / 'packages/java-processing/src/main/java'
    actual_adapter = {str(p.relative_to(root)) for p in adapter_root.rglob('*.java')}
    if actual_adapter != set(manifest['adapter_sources']):
        raise ValueError('Processing adapter inventory differs from accepted source release')
    for name, expected in manifest['adapter_sources'].items():
        require_hash(root / name, expected)
    for record in manifest['examples'].values():
        require_hash(root / record['source'], record['sha256'])
    catalogs = sorted((root / 'catalog/operations').glob('*.json'))
    if [p.name for p in catalogs] != manifest['operation_files']:
        raise ValueError('Operation inventory differs from accepted source release')
    operations = [dict(json.loads(p.read_text()), _file=p.name) for p in catalogs]
    errors, attestations = load_attestations(root, operations)
    if errors:
        raise ValueError('Invalid support evidence: ' + '; '.join(errors[:3]))
    for p in catalogs:
        if attestations.get(p.name, {}).get('targets', {}).get('processing-java', {}).get('core', {}).get('status') != 'conformant':
            raise ValueError('Java operation is not accepted: ' + p.name)
    # Bind all text evidence used by the attestation validator; never read its .work images.
    evidence = list((root / 'evidence').rglob('*.json')) + list((root / 'fixtures').rglob('*.json'))
    inputs = [manifest_path, root / review['path'], *catalogs,
              *[root / name for name in manifest['core_sources']],
              *[root / name for name in manifest['adapter_sources']],
              *[root / v['source'] for v in manifest['examples'].values()],
              *list((root / 'catalog/validation').glob('*.json')), *evidence]
    return manifest, inputs


def build(root, output, jdk, font, notice, processing_core):
    output = fresh_output(root, output)
    manifest, inputs = source_inputs(root)
    require_hash(font, manifest['font_sha256'])
    require_hash(notice, manifest['font_license_sha256'])
    require_hash(processing_core, manifest['processing_core_sha256'])
    files = {'procedurals/' + name: root / name for name in ('LICENSE', 'THIRD_PARTY_NOTICES.md')}
    files.update({name: root / v['source'] for name, v in manifest['examples'].items()})
    for directory in ('docs', 'catalog/operations', 'catalog/validation'):
        suffix = '*.md' if directory == 'docs' else '*.json'
        files.update({'procedurals/' + str(p.relative_to(root)): p for p in (root / directory).rglob(suffix)})
    files.update({'procedurals/src/' + name.removeprefix('packages/java/src/'): root / name
                  for name in manifest['core_sources']})
    files.update({'procedurals/adapter-src/main/java/' + name.removeprefix('packages/java-processing/src/main/java/'): root / name
                  for name in manifest['adapter_sources']})
    files['procedurals/examples/GlyphMarks/data/GlyphMarks.ttf'] = font
    files['procedurals/examples/GlyphMarks/data/FONT-LICENSE.txt'] = notice
    files['procedurals/GlyphMarks-FONT-LICENSE.txt'] = notice
    inputs += [Path(__file__).resolve(), root / 'tools/operation_attestations.py', processing_core, *files.values(),
               *[jdk / n for n in ('bin/java', 'bin/javac', 'release', 'lib/modules')]]
    inputs = sorted(set(p.resolve() for p in inputs))
    label = lambda p: str(p.relative_to(root)) if p.is_relative_to(root) else str(p)
    before = {label(p): sha(p) for p in inputs}
    payloads = {name: p.read_bytes() for name, p in files.items()}
    output.mkdir(parents=True)
    classes = output / 'classes'
    classes.mkdir()
    command = [str(jdk / 'bin/javac'), '--release', '8', '-encoding', 'UTF-8', '-d', str(classes),
               *[str(root / n) for n in manifest['core_sources']]]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    (output / 'compile.json').write_text(json.dumps({'command': command, 'exit_code': result.returncode,
                                                  'stdout': result.stdout, 'stderr': result.stderr}, indent=2) + '\n')
    if result.returncode:
        raise RuntimeError('javac failed; preserve compile.json')
    class_payloads = {p.relative_to(classes).as_posix(): p.read_bytes() for p in classes.rglob('*.class')}
    if not class_payloads:
        raise RuntimeError('No compiled Java classes')
    jar = output / 'procedurals.jar'
    write_zip(jar, class_payloads)
    payloads['procedurals/library/procedurals.jar'] = jar.read_bytes()
    adapter_classes = output / 'adapter-classes'
    adapter_classes.mkdir()
    adapter_command = [str(jdk / 'bin/javac'), '--release', '8', '-encoding', 'UTF-8',
                       '-classpath', str(classes) + os.pathsep + str(processing_core),
                       '-d', str(adapter_classes),
                       *[str(root / n) for n in manifest['adapter_sources']]]
    adapter_result = subprocess.run(adapter_command, capture_output=True, text=True, timeout=120)
    (output / 'adapter-compile.json').write_text(json.dumps({
        'command': adapter_command, 'exit_code': adapter_result.returncode,
        'stdout': adapter_result.stdout, 'stderr': adapter_result.stderr,
    }, indent=2) + '\n')
    if adapter_result.returncode:
        raise RuntimeError('adapter javac failed; preserve adapter-compile.json')
    adapter_payloads = {p.relative_to(adapter_classes).as_posix(): p.read_bytes()
                        for p in adapter_classes.rglob('*.class')}
    if not adapter_payloads:
        raise RuntimeError('No compiled Processing adapter classes')
    adapter_jar = output / 'procedurals-processing-adapter.jar'
    write_zip(adapter_jar, adapter_payloads)
    payloads['procedurals/library/procedurals-processing-adapter.jar'] = adapter_jar.read_bytes()
    payloads['procedurals/library.properties'] = (
        'name=Procedurals\ncategory=Utilities\nsentence=Composable generative-art operations.\n'
        'paragraph=Fields, paths, placement, topology and motion with editable examples.\n'
        'url=https://github.com/cdlethem/procedural\nauthors=Colin Lethem\nmaintainer=Colin Lethem\n'
        f'version={manifest["processing_version"]}\nprettyVersion={manifest["version"]}\n'
        'minRevision=0\nmaxRevision=\n').encode()
    after = {label(p): sha(p) for p in inputs}
    if before != after:
        raise RuntimeError('Input changed during source build')
    archive = output / 'procedurals-java-source-dev.zip'
    write_zip(archive, payloads)
    report = {'status': 'built-development-source-bundle',
              'scope': 'Source assembly only; artifact requires root distribution acceptance.',
              'input_sha256_before': before, 'input_sha256_after': after,
              'archive': {'path': str(archive.relative_to(root)), 'sha256': sha(archive), 'members': len(payloads)},
              'class_sha256': {n: hashlib.sha256(b).hexdigest() for n, b in sorted(class_payloads.items())},
              'adapter_class_sha256': {n: hashlib.sha256(b).hexdigest() for n, b in sorted(adapter_payloads.items())},
              'example_tabs': len(manifest['examples']), 'operations': len(manifest['operation_files'])}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home')
    parser.add_argument('--font', type=Path, required=True)
    parser.add_argument('--font-license', type=Path, required=True)
    parser.add_argument('--processing-core', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = build(ROOT, args.output, java_home(args.java_home), args.font.resolve(),
                   args.font_license.resolve(), args.processing_core.resolve())
    print(json.dumps(report['archive']))


if __name__ == '__main__':
    main()
