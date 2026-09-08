#!/usr/bin/env python3
"""Fetch a pinned Processing core and smoke-test actual JAVA2D (not adapter conformance)."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_grid_conformance import java_home, run

VERSION = '4.5.6'
CORE_SHA256 = '88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4'
CORE_URL = f'https://repo.maven.apache.org/maven2/org/processing/core/{VERSION}/core-{VERSION}.jar'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home')
    args = parser.parse_args()
    home = java_home(args.java_home)
    jar = ROOT / f'.work/toolchains/processing-{VERSION}/core-{VERSION}.jar'
    if not jar.exists():
        with urlopen(CORE_URL, timeout=30) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != CORE_SHA256:
            raise RuntimeError('Downloaded Processing core checksum mismatch')
        jar.parent.mkdir(parents=True, exist_ok=True)
        jar.write_bytes(data)
    if hashlib.sha256(jar.read_bytes()).hexdigest() != CORE_SHA256:
        raise RuntimeError('Local Processing core checksum mismatch')
    build = ROOT / '.work/build/processing-runtime'
    build.mkdir(parents=True, exist_ok=True)
    source = ROOT / 'tests/native/ProcessingRuntimeSmoke.java'
    run([home/'bin/javac', '-cp', jar, '-d', build, source])
    png = build / 'smoke.png'
    result = run(['xvfb-run', '-a', home/'bin/java', '-cp', f'{build}:{jar}',
                  'ProcessingRuntimeSmoke', png])
    report = {'scope':'Processing JAVA2D runtime prerequisite only; no package adapter or P2D/Android claim',
              'processing_version':VERSION,'core_url':CORE_URL,'core_sha256':CORE_SHA256,
              'java':run([home/'bin/java','-version']).stderr.strip(),
              'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
              'tool_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'png_sha256':hashlib.sha256(png.read_bytes()).hexdigest(),
              'result':result.stdout.strip()}
    (build/'result.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
