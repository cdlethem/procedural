#!/usr/bin/env python3
"""Real acceptance checks for the isolated Processing Java layer runner."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "tools/harness/run_java_layer.py"
LOCK = ROOT / "tools/with_native_render_lock.py"
WORK = ROOT / ".work/harness-java-check"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_info(path: Path) -> tuple[int, int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError("output is not PNG")
    width = int.from_bytes(data[16:20], "big")
    height = int.from_bytes(data[20:24], "big")
    # The runner reports minAlpha; this parser verifies dimensions and PNG signature.
    return width, height, len(data)


def make_job(name: str, source: str, controls: dict | None = None, declarations: list | None = None,
             render_seconds: int = 5, background: str = "transparent") -> tuple[dict, Path]:
    root = WORK / (name + "-source")
    root.mkdir(parents=True, exist_ok=True)
    source_path = root / "Layer.pde"
    source_path.write_text(source, encoding="utf-8")
    job_work = WORK / (name + "-job")
    spec = {
        "jobSpecVersion": 1, "jobId": "job-" + name, "kind": "java-render", "candidateId": "cand-" + name,
        "layerId": "layer-1", "language": "processing-java", "runnerProfile": "java2d-static-640-v1",
        "entrypoint": "Layer.pde", "background": background, "sourceDirectory": str(root.resolve()),
        "sourceFiles": [{"path": "Layer.pde", "sha256": digest(source_path), "bytes": source_path.stat().st_size}],
        "controls": controls or {}, "controlDeclarations": declarations or [], "randomSeed": 42, "noiseSeed": 7,
        "tick": 1, "canvas": {"width": 640, "height": 640, "pixelDensity": 1},
        "limits": {"renderSeconds": render_seconds, "compileSeconds": 30, "heapMegabytes": 256,
                    "outputBytes": 8388608, "queueSeconds": 60},
        "workDirectory": str(job_work.resolve()), "outputPath": str((job_work / "frame.png").resolve()),
        "resultPath": str((WORK / (name + ".result.json")).resolve()),
        "progressPath": str((WORK / (name + ".progress.json")).resolve()),
    }
    job_path = WORK / (name + ".job.json")
    job_path.write_text(json.dumps(spec), encoding="utf-8")
    return spec, job_path


def run(name: str, source: str, controls: dict | None = None, declarations: list | None = None,
        render_seconds: int = 5, background: str = "transparent") -> tuple[dict, dict]:
    spec, job = make_job(name, source, controls, declarations, render_seconds, background)
    command = ["python3", str(LOCK), "--", "python3", str(RUNNER), "--job", str(job)]
    process = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=120)
    if not Path(spec["resultPath"]).is_file():
        raise AssertionError("runner did not write result: " + process.stdout + process.stderr)
    result = json.loads(Path(spec["resultPath"]).read_text(encoding="utf-8"))
    if process.returncode == 0 and result.get("status") != "succeeded":
        raise AssertionError(process.stdout + process.stderr)
    return result, spec


def main() -> int:
    WORK.mkdir(parents=True, exist_ok=True)
    ordinary = """void renderFrame(PGraphics g, LayerControls c, int tick) {
  g.fill(255, 0, 0, 255); g.ellipse(320, 320, 220, 220);
}
"""
    transparent, transparent_spec = run("ordinary", ordinary)
    assert transparent["status"] == "succeeded"
    assert png_info(Path(transparent["imagePath"]))[:2] == (640, 640)
    assert transparent["minAlpha"] == 0

    opaque, opaque_spec = run("opaque", """void renderFrame(PGraphics g, LayerControls c, int tick) {
  g.background(40, 70, 90);
}
""", background="opaque")
    assert opaque["status"] == "succeeded" and opaque["minAlpha"] == 255

    declarations = [
        {"key": "radius", "label": "Radius", "description": "circle radius", "type": "number", "min": 1, "max": 300, "step": 1, "value": 80},
        {"key": "bright", "label": "Bright", "description": "color", "type": "flag", "value": True},
        {"key": "mode", "label": "Mode", "description": "fill mode", "type": "option", "value": "red"},
    ]
    controls_source = """void renderFrame(PGraphics g, LayerControls c, int tick) {
  float r = c.number("radius");
  g.fill(c.flag("bright") ? 255 : 80, c.option("mode").equals("red") ? 0 : 255, 0);
  g.ellipse(320, 320, r, r);
}
"""
    controls = {"radius": 80, "bright": True, "mode": "red"}
    first, first_spec = run("controls-a", controls_source, controls, declarations)
    second, second_spec = run("controls-b", controls_source, controls, declarations)
    assert first["imageSha256"] == second["imageSha256"]
    changed, _ = run("controls-changed", controls_source, {**controls, "radius": 120}, declarations)
    assert changed["imageSha256"] != first["imageSha256"]

    syntax, _ = run("syntax-error", """void renderFrame(PGraphics g, LayerControls c, int tick) {
  g.fill(255;
  this is not valid;
}
""")
    assert syntax["status"] == "failed" and syntax["stage"] == "compile" and syntax["code"] == "COMPILE_FAILURE"
    assert "Layer.pde" in " ".join(syntax.get("diagnostics", [])) or "line" in " ".join(syntax.get("diagnostics", [])).lower()
    assert "imagePath" not in syntax

    leak = WORK / "procedurals-leak"
    if leak.exists(): leak.unlink()
    denied, _ = run("denied", """void renderFrame(PGraphics g, LayerControls c, int tick) {
  saveStrings("/etc/procedurals-leak", new String[] {"leak"});
}
""")
    assert denied["status"] == "failed" and denied["code"] == "RUNTIME_FAILURE"
    assert not leak.exists()

    endless, endless_spec = run("endless", """void renderFrame(PGraphics g, LayerControls c, int tick) {
  while (true) { }
}
""", render_seconds=2)
    assert endless["status"] == "failed" and endless["code"] == "RESOURCE_EXHAUSTED"
    survivors = subprocess.run(["pgrep", "-af", "LayerHost"], text=True, capture_output=True)
    assert survivors.returncode != 0, survivors.stdout

    summary = {"status": "passed", "ordinarySha256": transparent["imageSha256"],
               "controlsSha256": first["imageSha256"], "changedSha256": changed["imageSha256"],
               "compileDiagnostics": syntax.get("diagnostics", []),
               "sandboxDenial": denied.get("diagnostics", []), "timeoutCode": endless["code"]}
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "failed", "message": str(error)}))
        raise SystemExit(1)
