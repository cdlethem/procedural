#!/usr/bin/env python3
"""Run the Next.js gallery/studio and local Go project service from a checkout."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]

def run(command, **kwargs):
    subprocess.run(command, cwd=ROOT, check=True, **kwargs)

def wait_for_http(url, child, timeout=60):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        if child.poll() is not None:
            raise SystemExit(f'Web server exited before becoming ready ({child.returncode}).')
        try:
            with urlopen(url, timeout=2) as response:
                if 200 <= response.status < 500:
                    return
        except (URLError, TimeoutError, OSError) as error:
            last_error = error
        time.sleep(0.25)
    raise SystemExit(f'Web server did not become ready at {url} within {timeout}s: {last_error}')

def previews_current(gallery):
    report_path = ROOT/'apps/web/public/previews/manifest.json'
    try:
        report = json.loads(report_path.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    binding = report.get('sourceBinding')
    current = gallery.get('studioBinding', {})
    if binding != {'version': current.get('version'), 'catalogSha256': current.get('catalogSha256')}:
        return False
    results = report.get('results')
    if not isinstance(results, list) or any(not isinstance(item, dict) or item.get('status') != 'passed' for item in results):
        return False
    return len(results) == len(gallery['techniques']) and all((ROOT/'apps/web/public/previews'/f"{item['slug']}.png").exists() for item in gallery['techniques'])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--api-port', type=int, default=8080)
    parser.add_argument('--production', action='store_true', help='build and serve production Next.js')
    parser.add_argument('--skip-previews', action='store_true', help='skip first-run image capture')
    args = parser.parse_args()
    if not (1 <= args.port <= 65535 and 1 <= args.api_port <= 65535) or args.port == args.api_port:
        parser.error('ports must be distinct and between 1 and 65535')
    if not (ROOT/'apps/web/node_modules/next').exists():
        run(['npm', 'ci', '--prefix', 'apps/web'])
    run(['node', 'apps/web/scripts/generate-gallery.mjs'])
    run(['node', 'apps/web/scripts/generate-api.mjs'])
    gallery = json.loads((ROOT/'apps/web/lib/generated-gallery.json').read_text())
    capture_previews = not args.skip_previews and not previews_current(gallery)
    (ROOT/'.work').mkdir(exist_ok=True)
    binary = ROOT/'.work/procedural-studio-api'
    if shutil.which('go'):
        run(['go', '-C', 'apps/server', 'build', '-o', str(binary), '.'])
    elif shutil.which('docker'):
        run(['docker', 'run', '--rm', '-v', f'{ROOT}:/repo', '-w', '/repo/apps/server',
             'golang:1.22', 'go', 'build', '-buildvcs=false', '-o', '/repo/.work/procedural-studio-api', '.'])
    else:
        raise SystemExit('Install Go 1.22+ or Docker to build the project service.')
    base_url = f'http://127.0.0.1:{args.port}'
    env = dict(os.environ, PROCEDURALS_API_URL=f'http://127.0.0.1:{args.api_port}', WEB_BASE_URL=base_url)
    if args.production:
        run(['npm', '--prefix', 'apps/web', 'run', 'build'], env=env)
    web_command = ['npm', '--prefix', 'apps/web', 'run', 'start' if args.production else 'dev', '--', '--hostname', '127.0.0.1', '--port', str(args.port)]
    children = []
    def stop(*_):
        for child in children:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        children.append(subprocess.Popen([str(binary), '-addr', f'127.0.0.1:{args.api_port}'], cwd=ROOT, start_new_session=True))
        children.append(subprocess.Popen(web_command, cwd=ROOT, env=env, start_new_session=True))
        if capture_previews:
            wait_for_http(base_url, children[-1])
            run([sys.executable, 'tools/with_native_render_lock.py', '--', 'node', 'apps/web/scripts/capture-previews.mjs'], env=env)
            if args.production:
                web = children[-1]
                os.killpg(web.pid, signal.SIGTERM)
                try:
                    web.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(web.pid, signal.SIGKILL)
                    web.wait(timeout=5)
                children[-1] = subprocess.Popen(web_command, cwd=ROOT, env=env, start_new_session=True)
                wait_for_http(base_url, children[-1])
        print(f'Procedurals: http://localhost:{args.port} | projects: .work/web-projects', flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.3)
    finally:
        stop()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
        failures = [child.returncode for child in children if child.returncode and child.returncode > 0]
        if failures:
            raise SystemExit(failures[0])

if __name__ == '__main__':
    main()
