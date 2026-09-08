#!/usr/bin/env python3
"""Run prepared stop-ramp vectors on a live API33 ART runtime; no drawing or APK install.

Use the shared native-render wrapper when this command is part of an emulator session.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_prepared(directory):
    manifest = json.loads((directory / 'result.json').read_text())
    if manifest.get('status') != 'passed':
        raise RuntimeError('preparation not passed')
    for name, expected in manifest['inputs_sha256'].items():
        if digest(ROOT / name) != expected:
            raise RuntimeError('preparation input changed: ' + name)
    for name, expected in manifest['toolchain_sha256'].items():
        if digest(Path(manifest['toolchain_paths'][name])) != expected:
            raise RuntimeError('preparation toolchain changed: ' + name)
    for name, expected in manifest['generated_classes_sha256'].items():
        if digest(directory / 'classes' / name) != expected:
            raise RuntimeError('prepared class changed: ' + name)
    if set(manifest['generated_sources_sha256']) != {'StopRampVectors.java', 'StopRampAndroidAccess.java'}:
        raise RuntimeError('unexpected generated sources')
    for name, expected in manifest['generated_sources_sha256'].items():
        if digest(directory / name) != expected:
            raise RuntimeError('generated source changed: ' + name)
    if digest(directory / 'classes.dex') != manifest['dex_sha256']:
        raise RuntimeError('prepared dex changed')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepared', type=Path, required=True)
    parser.add_argument('--android-sdk', type=Path, required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--adb-port', default='5038')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    prepared = verify_prepared(args.prepared.resolve())
    output = args.output.resolve()
    output.relative_to(ROOT)
    output.mkdir(parents=True, exist_ok=False)
    adb = args.android_sdk.resolve() / 'platform-tools/adb'
    dex = args.prepared.resolve() / 'classes.dex'
    started = time.monotonic()
    remote = '/data/local/tmp/procedurals-stop-ramp-' + digest(dex)[:16] + '-' + str(time.monotonic_ns()) + '.dex'
    report = {'status': 'failed', 'scope': 'API33 ART pure stop-ramp vectors and ownership/access only; no renderer or performance claim.',
              'dex_sha256': digest(dex), 'runner_sha256': digest(Path(__file__)),
              'adb_sha256': digest(adb), 'serial': args.serial, 'preparation': prepared}
    def run(*command, cleanup=False):
        remaining = (240 if cleanup else 210) - (time.monotonic() - started)
        if remaining <= 0:
            raise TimeoutError('Android core execution deadline')
        return subprocess.run([str(adb), '-P', args.adb_port, '-s', args.serial, *command],
                              text=True, capture_output=True, check=True, timeout=min(remaining, 60))
    try:
        report['api'] = run('shell', 'getprop', 'ro.build.version.sdk').stdout.strip()
        if report['api'] != '33':
            raise RuntimeError('expected API33 runtime')
        report['fingerprint'] = run('shell', 'getprop', 'ro.build.fingerprint').stdout.strip()
        report['vm'] = run('shell', 'getprop', 'persist.sys.dalvik.vm.lib.2').stdout.strip()
        run('push', str(dex), remote)
        remote_digest = run('shell', 'sha256sum', remote).stdout.split()[0]
        if remote_digest != report['dex_sha256']:
            raise RuntimeError('device dex hash differs')
        report['results'] = {}
        for name in ('StopRampVectors', 'StopRampAndroidAccess'):
            result = run('shell', 'env', 'CLASSPATH=' + remote, 'app_process', '/system/bin',
                         'org.procedurals.color.' + name)
            (output / (name + '.stdout')).write_text(result.stdout)
            (output / (name + '.stderr')).write_text(result.stderr)
            value = json.loads(result.stdout)
            if value.get('status') != 'passed':
                raise RuntimeError(name + ' did not pass')
            report['results'][name] = value
        if report['results']['StopRampVectors'].get('fixture_cases') != 12:
            raise RuntimeError('incomplete shared fixture execution')
        if report['results']['StopRampAndroidAccess'].get('assertions') != 28:
            raise RuntimeError('ownership/access checks missing')
        if report['results']['StopRampAndroidAccess'].get('native_ownership_access') is not True:
            raise RuntimeError('ownership/access completion missing')
        if digest(dex) != report['dex_sha256']:
            raise RuntimeError('local dex changed during execution')
        if verify_prepared(args.prepared.resolve()) != prepared:
            raise RuntimeError('preparation changed during device run')
        report['status'] = 'passed'
    except Exception as error:
        report['error'] = str(error)
    finally:
        try:
            run('shell', 'rm', '-f', remote, cleanup=True)
            report['cleanup'] = 'removed exact temporary dex'
        except Exception as error:
            report['cleanup_error'] = str(error)
            report['status'] = 'failed'
        report['elapsed_seconds'] = time.monotonic() - started
        (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
