#!/usr/bin/env python3
"""Build the local CP6 Java 0.6.0 archive and installed BranchMarks consumer; no render."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.build_java_artifacts import copy, digest, java_home, relative, write, zip_entries
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256

VERSION = "0.6.0"
OUTPUT = ROOT / ".work/dist/cp6/java"
EVIDENCE = ROOT / "evidence/distribution/cp6-java.json"
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
    output = case["output"]
    checks = ["check(value.size()==" + str(len(output["segments"])) + ",\"segment count\");"]
    for index, expected in enumerate(output["segments"]):
        checks.append("double[] segment" + str(index) + "=value.segmentAt(" + str(index) + "L);")
        for component, number in enumerate(expected):
            checks.append("bits(segment" + str(index) + "[" + str(component) + "]," + repr(number) + ");")
        checks.append("check(value.parentAt(" + str(index) + "L)==" + str(output["parents"][index]) + ",\"parent\");")
        checks.append("check(value.generationAt(" + str(index) + "L)==" + str(output["generations"][index]) + ",\"generation\");")
        checks.append("check(value.childCountAt(" + str(index) + "L)==" + str(output["childCounts"][index]) + ",\"children\");")
        checks.append("bits(value.headingAt(" + str(index) + "L)," + repr(output["headings"][index]) + ");")
        checks.append("bits(value.lengthAt(" + str(index) + "L)," + repr(output["lengths"][index]) + ");")
    return """import java.io.File;
import java.util.*;
import org.procedurals.topology.BranchTree2D;
public final class InstalledBranchSmoke {
  static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
  static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  static void check(boolean condition,String message) { if(!condition) throw new AssertionError(message); }
  static void bits(double actual,double expected) { if(Double.doubleToRawLongBits(actual)!=Double.doubleToRawLongBits(expected))throw new AssertionError("binary64 fixture mismatch"); }
  public static void main(String[] args) throws Exception {
    String expected=new File(args[0]).getCanonicalFile().toURI().toURL().toString();
    String actual=BranchTree2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
    check(expected.equals(actual),"BranchTree2D did not load from installed JAR: "+actual);
    BranchTree2D value=BranchTree2D.generate(__INPUT__);
    __CHECKS__
    double[] destination={7.0,7.0,7.0,7.0,7.0,7.0}; value.segmentInto(0L,destination,1);
    bits(destination[0],7.0); bits(destination[5],7.0);
    System.out.println("code_source="+actual);
  }
}
""".replace("__INPUT__", literal(case["input"])).replace("__CHECKS__", "\n    ".join(checks))


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
paragraph=Grid, noise, palette, path, placement, region, triangle-point and endpoint-branch operations with editable Processing sketches.
url=https://github.com/cdlethem/procedural
version=6
prettyVersion=0.6.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
"""


def passed_native_report(path: Path, required_paths: list[Path]) -> dict:
    if not path.is_file():
        raise RuntimeError("a passed current CP6 native report is required before creating a local distribution")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("vectors", {}).get("status") != "passed" or payload.get("native", {}).get("status") != "passed":
        raise RuntimeError("native CP6 vectors and native checks must both be passed")
    before, after = payload.get("source_sha256_before"), payload.get("source_sha256_after")
    if not isinstance(before, dict) or not before or before != after:
        raise RuntimeError("native CP6 report must contain matching nonempty source bindings")
    for name, expected in before.items():
        if not isinstance(name, str) or not isinstance(expected, str):
            raise RuntimeError("native CP6 report has malformed source binding")
        source = ROOT / name
        if Path(name).is_absolute() or not source.resolve().is_relative_to(ROOT) or not source.is_file() or digest(source) != expected:
            raise RuntimeError("native CP6 report source binding is stale: " + name)
    for required in required_paths:
        if before.get(relative(required)) != digest(required):
            raise RuntimeError("native CP6 report omits current binding: " + relative(required))
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--processing-core", type=Path, default=RUNTIME / "core-4.5.6.jar")
    parser.add_argument("--native-report", type=Path,
                        default=ROOT / "evidence/conformance/branch-tree-java.json")
    args = parser.parse_args()
    home = java_home(args.java_home)
    runtime = args.processing_core.resolve()
    if not runtime.is_file() or digest(runtime) != CORE_SHA256:
        raise RuntimeError("expected pinned Processing 4.5.6 core JAR")
    preprocessor = [RUNTIME / "preprocessor" / name for name in NAMES]
    if any(not path.is_file() for path in preprocessor):
        raise RuntimeError("missing pinned Processing preprocessor dependency")

    branch_fixture = ROOT / "fixtures/operations/seeded-endpoint-branches.json"
    branch_catalog = ROOT / "catalog/operations/seeded-endpoint-branches.json"
    branch_source = ROOT / "packages/java/src/main/java/org/procedurals/topology/BranchTree2D.java"
    native_report = args.native_report.resolve()
    # This occurs before output creation: an unpassed native report cannot leave a candidate release.
    native_payload = passed_native_report(native_report, [branch_source, branch_fixture, branch_catalog,
        ROOT / "tools/run_branch_tree_java.py", ROOT / "tests/native/BranchTreeNative.java"])
    fixture = json.loads(branch_fixture.read_text(encoding="utf-8"))
    if fixture.get("catalog_sha256") != digest(branch_catalog):
        raise RuntimeError("stale endpoint-branch fixture catalog binding")
    smoke_case = next((case for case in fixture.get("cases", []) if case.get("id") == "constant-interval-chain"), None)
    if not isinstance(smoke_case, dict) or "output" not in smoke_case:
        raise RuntimeError("required branch installed-consumer fixture is missing")

    if OUTPUT.exists() or EVIDENCE.exists():
        raise RuntimeError("CP6 Java destination/evidence exists; preserve it for review rather than overwrite it")
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
        "BranchMarks": [ROOT / "packages/java-processing/examples/BranchMarks/BranchMarks.pde",
                        ROOT / "packages/java/examples/BranchMarks/BranchComposition.java"],
    }
    notices = [ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md"]
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    docs = [ROOT / "docs/branch-marks.md", ROOT / "docs/installing-branch-marks.md"]
    inputs = [*core_sources, *adapter_sources, *(path for group in examples.values() for path in group), *docs,
              branch_fixture, branch_catalog, native_report, *notices, bridge, runtime, *preprocessor,
              ROOT / "tools/build_java_artifacts.py", ROOT / "tools/check_field_marks_pde.py",
              ROOT / "tools/check_processing_runtime.py", ROOT / "tools/check_branch_marks_pde.py",
              Path(__file__).resolve()]
    for path in inputs:
        if not path.is_file():
            raise FileNotFoundError("CP6 distribution input missing: " + str(path))
    # Guides are shipped artifact content and therefore included in source bindings.
    before = {relative(path): digest(path) for path in inputs}

    build = OUTPUT / "build"
    classes, adapter_classes = build / "core-classes", build / "adapter-classes"
    classes.mkdir(parents=True)
    adapter_classes.mkdir()
    core = OUTPUT / "procedurals-core-0.6.0.jar"
    adapter = OUTPUT / "procedurals-processing-adapter-0.6.0.jar"
    run([home / "bin/javac", "--release", "8", "-d", classes, *core_sources], cwd=build)
    for notice in notices: copy(notice, classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", core, "-C", classes, "."], cwd=build)
    run([home / "bin/javac", "--release", "8", "-cp", os.pathsep.join(map(str, (core, runtime))),
         "-d", adapter_classes, *adapter_sources], cwd=build)
    for notice in notices: copy(notice, adapter_classes / "META-INF" / notice.name)
    run([home / "bin/jar", "cf", adapter, "-C", adapter_classes, "."], cwd=build)

    library = build / "procedurals"
    copy(core, library / "library/procedurals.jar")
    copy(adapter, library / "library/procedurals-processing-adapter.jar")
    write(library / "library.properties", library_properties())
    for name, files in examples.items():
        for source in files: copy(source, library / "examples" / name / source.name)
    for guide in docs: copy(guide, library / "docs" / guide.name)
    for notice in notices: copy(notice, library / notice.name)
    included = [{"path": str(path.relative_to(build)), "sha256": digest(path)}
                for path in sorted(library.rglob("*")) if path.is_file()]
    starter = OUTPUT / "procedurals-processing-0.6.0.zip"
    with zipfile.ZipFile(starter, "w", zipfile.ZIP_DEFLATED) as archive:
        for item in included: archive.write(build / item["path"], item["path"])

    consumer = OUTPUT / "consumer"
    safe_extract(starter, consumer)
    extracted = consumer / "procedurals"
    extracted_core = extracted / "library/procedurals.jar"
    extracted_adapter = extracted / "library/procedurals-processing-adapter.jar"
    if digest(extracted_core) != digest(core) or digest(extracted_adapter) != digest(adapter):
        raise RuntimeError("extracted JAR bytes differ from packaged artifacts")
    extracted_branch = extracted / "examples/BranchMarks"
    for source in examples["BranchMarks"]:
        installed = extracted_branch / source.name
        if digest(installed) != digest(source):
            raise RuntimeError("editable BranchMarks tab differs from root source: " + source.name)
    consumer_classes = consumer / "classes"
    consumer_classes.mkdir()
    smoke = consumer / "InstalledBranchSmoke.java"
    write(smoke, smoke_source(smoke_case))
    run([home / "bin/javac", "--release", "8", "-cp", extracted_core, "-d", consumer_classes, smoke], cwd=consumer)
    smoke_result = run([home / "bin/java", "-cp", os.pathsep.join(map(str, (consumer_classes, extracted_core))),
                        "InstalledBranchSmoke", extracted_core], cwd=consumer)

    preprocessing_cp = os.pathsep.join(map(str, (runtime, *preprocessor)))
    run([home / "bin/javac", "-cp", preprocessing_cp, "-d", consumer_classes, bridge], cwd=consumer)
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"): environment.pop(key, None)
    home_dir = consumer / "home"; home_dir.mkdir()
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
    if before != after: raise RuntimeError("CP6 distribution inputs changed during build")
    if digest(native_report) != before[relative(native_report)]:
        raise RuntimeError("native CP6 report changed during distribution build")
    report = {
        "status": "passed", "package_version": VERSION,
        "scope": "Local Java core/Processing library artifact, extracted installed-JAR consumer, and official Processing 4.5.6 compilation of six examples only; native renderer/install acceptance and other targets remain pending.",
        "input_sha256_before": before, "input_sha256_after": after,
        "documentation": [relative(path) for path in docs],
        "artifacts": {name: {"path": relative(path), "sha256": digest(path), "entries": zip_entries(path)}
                      for name, path in (("core", core), ("processing_adapter", adapter), ("starter", starter))},
        "library_layout": {"root": "procedurals", "examples": sorted(examples), "included_files": included},
        "consumer": {"installed_core_origin": smoke_result.stdout.strip(), "branch_fixture_case": smoke_case["id"],
                     "branch_fixture_passed": True, "official_pde_compilation_passed": sorted(generated_hashes),
                     "generated_pde_sha256": generated_hashes},
        "native_cp6_report": {"path": relative(native_report), "sha256": digest(native_report),
                              "vectors_status": native_payload["vectors"]["status"], "native_status": native_payload["native"]["status"]},
        "runtime": run([home / "bin/java", "-version"], cwd=consumer).stderr.strip(),
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    write(EVIDENCE, json.dumps(report, indent=2) + "\n")
    write(OUTPUT / "result.json", json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "evidence": relative(EVIDENCE), "starter": relative(starter)}))


if __name__ == "__main__":
    main()
