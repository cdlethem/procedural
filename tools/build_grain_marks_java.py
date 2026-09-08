#!/usr/bin/env python3
"""Build the isolated local CP5 Java 0.5.0 archive and installed consumer; no render."""
from __future__ import annotations

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
from tools.build_java_artifacts import copy, digest, java_home, relative, write, zip_entries
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256


VERSION = "0.5.0"
OUTPUT = ROOT / ".work/dist/cp5/java"
EVIDENCE = ROOT / "evidence/distribution/cp5-java.json"
RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"


def run(command: list[object], *, cwd: Path, env: dict[str, str] | None = None,
        timeout: int = 120) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run([str(value) for value in command], cwd=cwd, env=env,
                              check=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.CalledProcessError as error:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" +
                           error.stdout + error.stderr) from error


def literal(value: object) -> str:
    if isinstance(value, dict):
        return "map(" + ",".join(json.dumps(str(key)) + "," + literal(item)
                                  for key, item in value.items()) + ")"
    if isinstance(value, list):
        return "list(" + ",".join(literal(item) for item in value) + ")"
    if isinstance(value, bool):
        return "Boolean." + ("TRUE" if value else "FALSE")
    if isinstance(value, int):
        return "Long.valueOf(" + str(value) + "L)"
    if isinstance(value, float):
        return "Double.valueOf(" + json.dumps(repr(value)) + ")"
    raise TypeError(value)


def smoke_source(case: dict) -> str:
    checks: list[str] = []
    for index, point in enumerate(case["output"]["points"]):
        checks.append("double[] point" + str(index) + "=value.pointAt(" + str(index) + "L);")
        checks.append("bits(point" + str(index) + "[0]," + repr(point[0]) + ");")
        checks.append("bits(point" + str(index) + "[1]," + repr(point[1]) + ");")
    return """import java.io.File;
import java.util.*;
import org.procedurals.sampling.TrianglePoints2D;
public final class InstalledGrainSmoke {
  static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
  static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  static void check(boolean condition,String message) { if(!condition) throw new AssertionError(message); }
  static void bits(double actual,double expected) { if(Double.doubleToRawLongBits(actual)!=Double.doubleToRawLongBits(expected))throw new AssertionError("binary64 fixture mismatch"); }
  public static void main(String[] args) throws Exception {
    String expected=new File(args[0]).getCanonicalFile().toURI().toURL().toString();
    String actual=TrianglePoints2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
    check(expected.equals(actual),"TrianglePoints2D did not load from installed JAR: "+actual);
    TrianglePoints2D value=TrianglePoints2D.seeded(__INPUT__);
    check(value.size()==__COUNT__,"point count");
    __CHECKS__
    double[] destination={7.0,7.0,7.0,7.0}; value.pointInto(0L,destination,1);
    bits(destination[0],7.0); bits(destination[3],7.0);
    System.out.println("code_source="+actual);
  }
}
""".replace("__INPUT__", literal(case["input"])).replace("__COUNT__", str(len(case["output"]["points"]))).replace("__CHECKS__", "\n    ".join(checks))


def safe_extract(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as zipped:
        root = destination.resolve()
        for info in zipped.infolist():
            if not (root / info.filename).resolve().is_relative_to(root):
                raise RuntimeError("unsafe ZIP entry: " + info.filename)
        zipped.extractall(destination)


def library_properties() -> str:
    return """name=Procedurals
category=Utilities
sentence=Evidence-backed portable generative-art operations.
paragraph=Grid, noise, palette, path, placement, region, and triangle-point operations with editable Processing sketches.
url=https://github.com/cdlethem/procedural
version=5
prettyVersion=0.5.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
"""


def passed_native_report(path: Path, required_paths: list[Path]) -> dict:
    if not path.is_file():
        raise RuntimeError("--native-report is required before publishing CP5 support evidence")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("vectors", {}).get("status") != "passed" or payload.get("native", {}).get("status") != "passed":
        raise RuntimeError("native CP5 vectors and native checks must both be passed")
    before, after = payload.get("source_sha256_before"), payload.get("source_sha256_after")
    if not isinstance(before, dict) or not before or before != after:
        raise RuntimeError("native CP5 report must contain matching nonempty source_sha256_before/after maps")
    for name, expected in before.items():
        if not isinstance(name, str) or not isinstance(expected, str):
            raise RuntimeError("native CP5 report contains malformed source binding")
        relative_path = Path(name)
        if relative_path.is_absolute():
            raise RuntimeError("native CP5 report contains an absolute source binding")
        current = (ROOT / relative_path).resolve()
        try:
            current.relative_to(ROOT)
        except ValueError as error:
            raise RuntimeError("native CP5 report source binding escapes repository: " + name) from error
        if not current.is_file() or digest(current) != expected:
            raise RuntimeError("native CP5 report source binding changed: " + name)
    for required in required_paths:
        key = relative(required)
        if before.get(key) != digest(required):
            raise RuntimeError("native CP5 report omits required current binding: " + key)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--processing-core", type=Path, default=RUNTIME / "core-4.5.6.jar")
    parser.add_argument("--native-report", type=Path,
                        default=ROOT / "evidence/conformance/triangle-points-java.json")
    parser.add_argument("--publish-evidence", action="store_true",
                        help="write evidence/distribution/cp5-java.json; requires a passed, current native CP5 report")
    args = parser.parse_args()
    home = java_home(args.java_home)
    runtime = args.processing_core.resolve()
    if not runtime.is_file() or digest(runtime) != CORE_SHA256:
        raise RuntimeError("expected pinned Processing 4.5.6 core JAR")
    preprocessor = [RUNTIME / "preprocessor" / name for name in NAMES]
    if any(not path.is_file() for path in preprocessor):
        raise RuntimeError("missing pinned Processing preprocessor dependency")

    core_sources = sorted((ROOT / "packages/java/src/main/java").rglob("*.java"))
    adapter_sources = sorted((ROOT / "packages/java-processing/src/main/java").rglob("*.java"))
    examples = {
        "FieldMarks": [ROOT / "packages/java-processing/examples/FieldMarks/FieldMarks.pde",
                       ROOT / "packages/java-processing/examples/FieldMarks/MarkCommands.java",
                       ROOT / "packages/java/examples/FieldMarks/MarkField.java"],
        "PathMarks": [ROOT / "packages/java-processing/examples/PathMarks/PathMarks.pde",
                      ROOT / "packages/java-processing/examples/PathMarks/PathMarksCanvas.java",
                      ROOT / "packages/java-processing/examples/PathMarks/README.md",
                      ROOT / "packages/java/examples/PathMarks/PathMarkComposition.java"],
        "PlacementMarks": [ROOT / "packages/java-processing/examples/PlacementMarks/PlacementMarks.pde",
                           ROOT / "packages/java/examples/PlacementMarks/PlacementComposition.java"],
        "RegionMarks": [ROOT / "packages/java-processing/examples/RegionMarks/RegionMarks.pde",
                        ROOT / "packages/java/examples/RegionMarks/RegionComposition.java"],
        "GrainMarks": [ROOT / "packages/java-processing/examples/GrainMarks/GrainMarks.pde",
                       ROOT / "packages/java/examples/GrainMarks/GrainComposition.java"],
    }
    triangle_fixture = ROOT / "fixtures/operations/seeded-triangle-points.json"
    triangle_catalog = ROOT / "catalog/operations/seeded-triangle-points.json"
    mapping_fixture = ROOT / "fixtures/operations/triangle-coordinate-map.json"
    mapping_catalog = ROOT / "catalog/operations/triangle-coordinate-map.json"
    triangle_source = ROOT / "packages/java/src/main/java/org/procedurals/sampling/TrianglePoints2D.java"
    notices = [ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md"]
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    inputs = [*core_sources, *adapter_sources, *(path for group in examples.values() for path in group),
              triangle_fixture, triangle_catalog, mapping_fixture, mapping_catalog, *notices, bridge, runtime, *preprocessor,
              ROOT / "tools/build_java_artifacts.py", ROOT / "tools/check_grain_marks_pde.py", Path(__file__).resolve()]
    for path in inputs:
        if not path.is_file():
            raise FileNotFoundError("CP5 distribution input missing: " + str(path))
    fixture = json.loads(triangle_fixture.read_text(encoding="utf-8"))
    if fixture.get("catalog_sha256") != digest(triangle_catalog):
        raise RuntimeError("stale seeded-triangle fixture catalog binding")
    mapping = json.loads(mapping_fixture.read_text(encoding="utf-8"))
    if mapping.get("catalog_sha256") != digest(mapping_catalog):
        raise RuntimeError("stale triangle-coordinate fixture catalog binding")
    case = next((item for item in fixture.get("cases", []) if item.get("id") == "seed-42-count-4"), None)
    if not isinstance(case, dict) or "output" not in case:
        raise RuntimeError("required CP5 smoke fixture is missing")
    native_payload = None
    native_report = args.native_report.resolve()
    required_native_paths = [triangle_source, triangle_fixture, triangle_catalog, mapping_fixture, mapping_catalog]
    if args.publish_evidence:
        # Publication evidence is preflighted before any output directory is created.
        native_payload = passed_native_report(native_report, required_native_paths)
        inputs.append(native_report)
    if OUTPUT.exists():
        raise RuntimeError("CP5 Java destination already exists; preserve it for review rather than overwrite it")
    if args.publish_evidence and EVIDENCE.exists():
        raise RuntimeError("CP5 distribution evidence already exists; preserve it for review rather than overwrite it")
    before = {relative(path): digest(path) for path in inputs}

    build = OUTPUT / "build"
    classes = build / "core-classes"
    adapter_classes = build / "adapter-classes"
    classes.mkdir(parents=True)
    adapter_classes.mkdir()
    core = OUTPUT / "procedurals-core-0.5.0.jar"
    adapter = OUTPUT / "procedurals-processing-adapter-0.5.0.jar"
    run([home / "bin/javac", "--release", "8", "-d", classes, *core_sources], cwd=build)
    for notice in notices:
        copy(notice, classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", core, "-C", classes, "."], cwd=build)
    run([home / "bin/javac", "--release", "8", "-cp", os.pathsep.join(map(str, (core, runtime))),
         "-d", adapter_classes, *adapter_sources], cwd=build)
    for notice in notices:
        copy(notice, adapter_classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", adapter, "-C", adapter_classes, "."], cwd=build)

    library = build / "procedurals"
    copy(core, library / "library/procedurals.jar")
    copy(adapter, library / "library/procedurals-processing-adapter.jar")
    write(library / "library.properties", library_properties())
    for name, files in examples.items():
        for source in files:
            copy(source, library / "examples" / name / source.name)
    for notice in notices:
        copy(notice, library / notice.name)
    included = [{"path": str(path.relative_to(build)), "sha256": digest(path)}
                for path in sorted(library.rglob("*")) if path.is_file()]
    starter = OUTPUT / "procedurals-processing-0.5.0.zip"
    with zipfile.ZipFile(starter, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in included:
            archive.write(build / item["path"], item["path"])

    consumer = OUTPUT / "consumer"
    safe_extract(starter, consumer)
    extracted = consumer / "procedurals"
    extracted_core = extracted / "library/procedurals.jar"
    extracted_adapter = extracted / "library/procedurals-processing-adapter.jar"
    if digest(extracted_core) != digest(core) or digest(extracted_adapter) != digest(adapter):
        raise RuntimeError("extracted JAR bytes differ from packaged artifacts")
    consumer_classes = consumer / "classes"
    consumer_classes.mkdir()
    smoke = consumer / "InstalledGrainSmoke.java"
    write(smoke, smoke_source(case))
    run([home / "bin/javac", "--release", "8", "-cp", extracted_core, "-d", consumer_classes, smoke], cwd=consumer)
    smoke_result = run([home / "bin/java", "-cp", os.pathsep.join(map(str, (consumer_classes, extracted_core))),
                        "InstalledGrainSmoke", extracted_core], cwd=consumer)

    preprocessing_cp = os.pathsep.join(map(str, (runtime, *preprocessor)))
    run([home / "bin/javac", "-cp", preprocessing_cp, "-d", consumer_classes, bridge], cwd=consumer)
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(key, None)
    home_dir = consumer / "home"
    home_dir.mkdir()
    compile_cp = os.pathsep.join(map(str, (runtime, extracted_core, extracted_adapter)))
    generated_hashes: dict[str, str] = {}
    for name, files in examples.items():
        example = extracted / "examples" / name
        pde = next(path for path in files if path.suffix == ".pde")
        generated = consumer / (name + ".java")
        run([home / "bin/java", "-Duser.home=" + str(home_dir), "-cp",
             str(consumer_classes) + os.pathsep + preprocessing_cp,
             "PreprocessSketch", example / pde.name, generated, name], cwd=consumer, env=environment)
        java_tabs = sorted(example.glob("*.java"))
        run([home / "bin/javac", "--release", "17", "-cp", compile_cp, "-d", consumer_classes,
             generated, *java_tabs], cwd=consumer)
        generated_hashes[name] = digest(generated)

    after = {relative(path): digest(path) for path in inputs}
    if before != after:
        raise RuntimeError("CP5 distribution inputs changed during build")
    report = {
        "status": "passed-local-build",
        "package_version": VERSION,
        "scope": "Local Java core/Processing archive, extracted installed-JAR consumer, and official Processing 4.5.6 compilation of five examples only; no renderer, native-support, or publication claim.",
        "input_sha256_before": before,
        "input_sha256_after": after,
        "artifacts": {name: {"path": relative(path), "sha256": digest(path), "entries": zip_entries(path)}
                      for name, path in (("core", core), ("processing_adapter", adapter), ("starter", starter))},
        "library_layout": {"root": "procedurals", "examples": sorted(examples), "included_files": included},
        "consumer": {"installed_core_origin": smoke_result.stdout.strip(), "triangle_fixture_case": case["id"],
                     "triangle_fixture_passed": True, "official_pde_compilation_passed": sorted(generated_hashes),
                     "generated_pde_sha256": generated_hashes},
        "runtime": run([home / "bin/java", "-version"], cwd=consumer).stderr.strip(),
    }
    if args.publish_evidence:
        report["status"] = "passed"
        report["native_cp5_report"] = {
            "path": relative(native_report), "sha256_before": before[relative(native_report)],
            "sha256_after": digest(native_report),
            "vectors_status": native_payload["vectors"]["status"],
            "native_status": native_payload["native"]["status"],
        }
        if report["native_cp5_report"]["sha256_before"] != report["native_cp5_report"]["sha256_after"]:
            raise RuntimeError("native CP5 report changed during distribution build")
        EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
        write(EVIDENCE, json.dumps(report, indent=2) + "\n")
    write(OUTPUT / "result.json", json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "result": relative(OUTPUT / "result.json"), "starter": relative(starter)}))


if __name__ == "__main__":
    main()
