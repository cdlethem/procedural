#!/usr/bin/env python3
"""Build and install the complete Processing library with verified build inputs."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.work' / 'installer'
JDK_VERSION = '17.0.20.1_1'
JDK_HASHES = {
    ('Linux', 'x64'): '3808d1d15e3ec6bd5b84057fb5d84c33d8a1536a258146bcea2e603fc726e08e',
    ('Linux', 'aarch64'): '457b57af8f9c93ec39080bb8c764f559dc8c89a6da1a39d718a400b7890d3e41',
    ('Darwin', 'x64'): 'c01975da12ed4235250ff891fe8bba73a9e73037d444b269c9d0922b5dbc8e0a',
    ('Darwin', 'aarch64'): '196d13ba5f10414bef7f6a05a9b3f00edacb18ebacef2b99485db9e2ee18f0e8',
    ('Windows', 'x64'): 'e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0',
}
FONT_URL = ('https://archive.ubuntu.com/ubuntu/pool/main/f/fonts-dejavu/'
            'fonts-dejavu-core_2.37-8build1_all.deb')
FONT_HASH = 'f4606b12eb41ddf7932d3a1ebc2019f9bbf90d0824943a2dc0c77a00f43019f2'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(url, name, expected):
    """Reuse only verified cache entries; publish a download after its hash passes."""
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if target.is_file() and digest(target) == expected:
        return target
    print('Downloading ' + name + ' ...', flush=True)
    with tempfile.NamedTemporaryFile(dir=CACHE, delete=False) as stream:
        partial = Path(stream.name)
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Procedurals-installer/1'})
            with urllib.request.urlopen(request, timeout=60) as response:
                shutil.copyfileobj(response, stream)
            stream.close()
            if digest(partial) != expected:
                raise ValueError('Checksum mismatch for ' + name + '; nothing installed.')
            os.replace(partial, target)
        finally:
            partial.unlink(missing_ok=True)
    return target


def extract_zip(archive, destination):
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            path = Path(member.filename)
            if (path.is_absolute() or '..' in path.parts or '\\' in member.filename
                    or ':' in member.filename or (member.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError('Unsafe ZIP member: ' + member.filename)
        source.extractall(destination)


def jdk_input():
    arch = {'x86_64': 'x64', 'amd64': 'x64', 'arm64': 'aarch64', 'aarch64': 'aarch64'}.get(platform.machine().lower())
    key = (platform.system(), arch)
    if key not in JDK_HASHES:
        raise ValueError('Automatic Java setup is unavailable on this platform. Use --java-home with a JDK 17 installation.')
    target_os = {'Linux': 'linux', 'Darwin': 'mac', 'Windows': 'windows'}[key[0]]
    extension = '.zip' if key[0] == 'Windows' else '.tar.gz'
    name = f'OpenJDK17U-jdk_{arch}_{target_os}_hotspot_{JDK_VERSION}{extension}'
    archive = download('https://github.com/adoptium/temurin17-binaries/releases/download/'
                       'jdk-17.0.20.1%2B1/' + name, name, JDK_HASHES[key])
    # Fresh extraction avoids trusting modified executables in an old extracted cache.
    unpacked = Path(tempfile.mkdtemp(prefix='jdk-', dir=CACHE))
    if extension == '.zip':
        extract_zip(archive, unpacked)
    else:
        with tarfile.open(archive) as source:
            source.extractall(unpacked, filter='data')
    executable = 'javac.exe' if os.name == 'nt' else 'javac'
    homes = [p.parent.parent for p in unpacked.rglob(executable) if p.parent.name == 'bin']
    if len(homes) != 1:
        raise ValueError('Downloaded Java archive has an unexpected layout.')
    return homes[0], unpacked


def font_inputs(manifest):
    archive = download(FONT_URL, 'fonts-dejavu-core.deb', FONT_HASH)
    raw = archive.read_bytes()
    if raw[:8] != b'!<arch>\n':
        raise ValueError('Invalid font package')
    offset = 8
    data = None
    while offset + 60 <= len(raw):
        header = raw[offset:offset + 60]
        size = int(header[48:58])
        if header[:16].strip().rstrip(b'/').startswith(b'data.tar'):
            data = raw[offset + 60:offset + 60 + size]
            break
        offset += 60 + size + size % 2
    if data is None:
        raise ValueError('Font package has no data archive')
    names = {
        'usr/share/fonts/truetype/dejavu/DejaVuSans.ttf': ('GlyphMarks.ttf', 'font_sha256'),
        'usr/share/doc/fonts-dejavu-core/copyright': ('FONT-LICENSE.txt', 'font_license_sha256'),
    }
    found = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as source:
        for member in source:
            name = member.name.removeprefix('./')
            if name in names and member.isfile():
                filename, hash_key = names[name]
                payload = source.extractfile(member).read()
                if hashlib.sha256(payload).hexdigest() != manifest[hash_key]:
                    raise ValueError('Font or license checksum mismatch')
                target = CACHE / filename
                target.write_bytes(payload)
                found[filename] = target
    if len(found) != 2:
        raise ValueError('Font package is missing its font or complete license')
    return found['GlyphMarks.ttf'], found['FONT-LICENSE.txt']


def install_archive(archive, sketchbook):
    """Stage before touching an existing installation; restore it if replacement fails."""
    libraries = sketchbook / 'libraries'
    libraries.mkdir(parents=True, exist_ok=True)
    target = libraries / 'procedurals'
    backup = None
    with tempfile.TemporaryDirectory(prefix='.procedurals-install-', dir=libraries) as temporary:
        stage = Path(temporary)
        extract_zip(archive, stage)
        source = stage / 'procedurals'
        for required in ('library/procedurals.jar', 'library/procedurals-processing-adapter.jar',
                         'examples/FieldMarks/FieldMarks.pde', 'library.properties'):
            if not (source / required).is_file():
                raise ValueError('Incomplete library archive: ' + required)
        if target.exists() or target.is_symlink():
            backup_root = sketchbook / 'procedurals-backups'
            backup_root.mkdir(exist_ok=True)
            backup = backup_root / ('procedurals-' + uuid.uuid4().hex[:12])
            target.rename(backup)
        try:
            source.rename(target)
        except OSError:
            if backup is not None:
                backup.rename(target)
            raise
    return target, backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sketchbook', type=Path, required=True,
                        help='Sketchbook location shown in Processing Preferences')
    parser.add_argument('--java-home', type=Path, help='Use an existing JDK instead of downloading Java 17')
    args = parser.parse_args()
    sketchbook = args.sketchbook.expanduser().resolve()
    if sketchbook == ROOT or (ROOT in sketchbook.parents and ROOT / '.work' not in sketchbook.parents):
        raise ValueError('Choose your Processing sketchbook outside the source checkout.')
    sys.path.insert(0, str(ROOT))
    from tools.build_java_source_bundle import build, java_home
    manifest = json.loads((ROOT / 'packages/java/source-bundle.json').read_text())
    core = download('https://repo.maven.apache.org/maven2/org/processing/core/4.5.6/core-4.5.6.jar',
                    'core-4.5.6.jar', manifest['processing_core_sha256'])
    font, notice = font_inputs(manifest)
    extracted_jdk = None
    try:
        if args.java_home:
            jdk = java_home(str(args.java_home))
        else:
            jdk, extracted_jdk = jdk_input()
            jdk = java_home(str(jdk))
        output = CACHE / ('build-' + uuid.uuid4().hex[:12])
        print('Building the library and reference pages ...', flush=True)
        build(ROOT, output, jdk, font, notice, core)
        target, backup = install_archive(output / 'procedurals-java-source-dev.zip', sketchbook)
        count = len(list((target / 'examples').glob('*/*.pde')))
        print(f'\nInstalled {count} examples in {target}')
        if backup:
            print('Previous installation saved in ' + str(backup))
        print('Restart Processing, then open File > Examples > Contributed Libraries > Procedurals > FieldMarks.')
        print('Click Run. Save a copy before editing the example.')
    finally:
        if extracted_jdk:
            shutil.rmtree(extracted_jdk)


if __name__ == '__main__':
    if sys.version_info < (3, 12):
        sys.exit('Install Python 3.12 or newer, then run this command again.')
    try:
        main()
    except (OSError, ValueError, RuntimeError, tarfile.TarError, zipfile.BadZipFile) as error:
        sys.exit('Installation failed: ' + str(error))
