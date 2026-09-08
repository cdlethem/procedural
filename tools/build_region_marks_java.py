#!/usr/bin/env python3
"""Build and consume the local Processing 0.4.0 RegionMarks distribution; no render."""
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

VERSION = "0.4.0"
OUTPUT = ROOT / ".work/dist/cp4/java"
EVIDENCE = ROOT / "evidence/distribution/cp4-java.json"
RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"


def run(command, *, cwd: Path, env: dict[str, str] | None = None, timeout: int = 120) -> subprocess.CompletedProcess[str]:
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
        return "Double.valueOf(" + json.dumps(str(value)) + ")"
    raise TypeError(value)


def installed_smoke_source(cases: list[dict]) -> str:
    checks = []
    for ordinal, case in enumerate(cases):
        name = "value" + str(ordinal)
        output = case["output"]
        checks.append("QuadrantPartition2D " + name + "=QuadrantPartition2D.generate(" + literal(case["input"]) + ");")
        checks.append("check(" + name + ".size()==" + str(len(output["ids"])) + ",\"leaf count\");")
        checks.append("check(" + name + ".replacements()==" + str(output["replacements"]) + ",\"replacements\");")
        for index, (bounds, identity) in enumerate(zip(output["bounds"], output["ids"])):
            checks.append("check(" + name + ".idAt(" + str(index) + "L)==" + str(identity) + ",\"id\");")
            checks.append(name + ".boundsInto(" + str(index) + "L,destination,1);")
            checks.extend("bits(destination[" + str(component + 1) + "],Double.valueOf(" + json.dumps(repr(value)) + "));" for component, value in enumerate(bounds))
            checks.append("bits(destination[0],7.0);bits(destination[5],7.0);")
    return """import java.io.File;
import java.util.*;
import org.procedurals.layout.QuadrantPartition2D;
public final class InstalledRegionSmoke {
  static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
  static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  static void check(boolean value,String detail) { if(!value) throw new AssertionError(detail); }
  static void bits(double actual,double expected) { if(Double.doubleToRawLongBits(actual)!=Double.doubleToRawLongBits(expected))throw new AssertionError("binary64 fixture mismatch"); }
  public static void main(String[] args) throws Exception {
    String expected=new File(args[0]).getCanonicalFile().toURI().toURL().toString();
    String actual=QuadrantPartition2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
    check(expected.equals(actual),"QuadrantPartition2D did not load from installed JAR: "+actual);
    double[] destination={7,7,7,7,7,7};
    __CHECKS__
    System.out.println("code_source="+actual);
  }
}
""".replace("__CHECKS__", "\n    ".join(checks))


def library_properties() -> str:
    return """name=Procedurals
category=Utilities
sentence=Evidence-backed portable generative-art operations.
paragraph=Grid, noise, palette, path, circle-placement and quadrant-region operations with editable Processing sketches.
url=https://github.com/cdlethem/procedural
version=4
prettyVersion=0.4.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
"""


def readme() -> str:
    return """# RegionMarks

Install the `procedurals` folder in your Processing sketchbook `libraries` directory and
open `examples/RegionMarks/RegionMarks.pde` with Processing 4.5.6 and JAVA2D.

`R`, `N`, `G` and `X` change regions; `M` and `C` only restyle
them; `S` saves the displayed frame. The constants and authored grid transfer describe
this starter, not library defaults or recommended ranges. Native rendering acceptance is recorded separately in the repository under
`evidence/reproductions/cp4-java2d/`; this archive build checks installation and compilation.
"""


def safe_extract(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as zipped:
        for info in zipped.infolist():
            target = (destination / info.filename).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise RuntimeError("unsafe ZIP entry: " + info.filename)
        zipped.extractall(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home")
    parser.add_argument("--processing-core", type=Path, default=RUNTIME / "core-4.5.6.jar")
    args = parser.parse_args()
    if OUTPUT.exists() or EVIDENCE.exists():
        raise RuntimeError("CP4 Java destination exists; preserve it for review rather than overwrite it")
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
    }
    notices = [ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md"]
    fixture_path = ROOT / "fixtures/operations/seeded-quadrant-partition.json"
    catalog_path = ROOT / "catalog/operations/seeded-quadrant-partition.json"
    conformance_path = ROOT / "evidence/conformance/quadrant-partition-java.json"
    conformance = json.loads(conformance_path.read_text())
    if conformance.get("vectors", {}).get("status") != "passed" or conformance.get("native", {}).get("status") != "passed":
        raise RuntimeError("CP4 core conformance has not passed")
    if conformance["source_sha256_before"] != conformance["source_sha256_after"]:
        raise RuntimeError("core conformance inputs changed during execution")
    for path, expected in conformance["source_sha256_after"].items():
        if digest(ROOT / path) != expected:
            raise RuntimeError("stale core conformance: " + path)
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    configuration = ROOT / "tests/native/RegionMarksPdeConfiguration.java"
    inputs = [*core_sources, *adapter_sources, *(path for files in examples.values() for path in files), *notices,
              fixture_path, catalog_path, conformance_path, bridge, configuration, runtime, *preprocessor,
              ROOT / "tools/build_java_artifacts.py", ROOT / "tools/check_field_marks_pde.py",
              ROOT / "tools/check_processing_runtime.py",
              Path(__file__).resolve()]
    for path in inputs:
        if not path.is_file():
            raise FileNotFoundError("distribution input missing: " + str(path))
    before = {relative(path): digest(path) for path in inputs}
    fixture = json.loads(fixture_path.read_text())
    if fixture["catalog_sha256"] != digest(catalog_path):
        raise RuntimeError("stale partition fixture contract binding")
    selected_cases = [next(case for case in fixture["cases"] if case["id"] == name)
                      for name in ("zero-replacements-root", "selected-middle-parent-live-list-order")]

    build = OUTPUT / "build"
    classes = build / "core-classes"
    adapter_classes = build / "adapter-classes"
    classes.mkdir(parents=True)
    adapter_classes.mkdir()
    core = OUTPUT / "procedurals-core-0.4.0.jar"
    adapter = OUTPUT / "procedurals-processing-adapter-0.4.0.jar"
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
    write(library / "examples/RegionMarks/README.md", readme())
    for notice in notices:
        copy(notice, library / notice.name)
    included = [{"path": str(path.relative_to(build)), "sha256": digest(path)}
                for path in sorted(library.rglob("*")) if path.is_file()]
    starter = OUTPUT / "procedurals-processing-0.4.0.zip"
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
    smoke = consumer / "InstalledRegionSmoke.java"
    write(smoke, installed_smoke_source(selected_cases))
    consumer_classes = consumer / "classes"
    consumer_classes.mkdir()
    run([home / "bin/javac", "--release", "8", "-cp", extracted_core, "-d", consumer_classes, smoke], cwd=consumer)
    smoke_result = run([home / "bin/java", "-cp", os.pathsep.join(map(str, (consumer_classes, extracted_core))),
                        "InstalledRegionSmoke", extracted_core], cwd=consumer)

    # Official Processing preprocessing is performed on the extracted distribution, not checkout sources.
    preprocessing_cp = os.pathsep.join(map(str, (runtime, *preprocessor)))
    run([home / "bin/javac", "-cp", preprocessing_cp, "-d", consumer_classes, bridge], cwd=consumer)
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(key, None)
    home_dir = consumer / "home"
    home_dir.mkdir()
    generated = consumer / "RegionMarks.java"
    extracted_example = extracted / "examples/RegionMarks"
    run([home / "bin/java", "-Duser.home=" + str(home_dir), "-cp", str(consumer_classes) + os.pathsep + preprocessing_cp,
         "PreprocessSketch", extracted_example / "RegionMarks.pde", generated, "RegionMarks"], cwd=consumer, env=environment)
    classpath = os.pathsep.join(map(str, (runtime, extracted_core, extracted_adapter)))
    run([home / "bin/javac", "--release", "17", "-cp", classpath, "-d", consumer_classes,
         generated, extracted_example / "RegionComposition.java", configuration], cwd=consumer)
    run([home / "bin/java", "-cp", str(consumer_classes) + os.pathsep + classpath,
         "RegionMarksPdeConfiguration"], cwd=consumer)

    after = {relative(path): digest(path) for path in inputs}
    if before != after:
        raise RuntimeError("distribution inputs changed during build")
    report = {
        "status": "passed", "package_version": VERSION,
        "scope": "Local Java core/Processing library artifact, extracted installed-JAR consumer, and official Processing 4.5.6 RegionMarks PDE compilation only; native renderer/install acceptance and other targets remain pending.",
        "input_sha256_before": before, "input_sha256_after": after,
        "artifacts": {name: {"path": relative(path), "sha256": digest(path), "entries": zip_entries(path)}
                      for name, path in (("core", core), ("processing_adapter", adapter), ("starter", starter))},
        "library_layout": {"root": "procedurals", "examples": sorted(examples), "included_files": included},
        "consumer": {"installed_core_origin": smoke_result.stdout.strip(), "partition_fixture_cases": [case["id"] for case in selected_cases],
                     "retained_access_passed": True, "official_pde_compilation_passed": True,
                     "extracted_core_sha256": digest(extracted_core), "extracted_adapter_sha256": digest(extracted_adapter),
                     "generated_pde_sha256": digest(generated)},
        "runtime": run([home / "bin/java", "-version"], cwd=consumer).stderr.strip(),
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    write(EVIDENCE, json.dumps(report, indent=2) + "\n")
    write(OUTPUT / "result.json", json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "evidence": relative(EVIDENCE), "starter": relative(starter)}))


if __name__ == "__main__":
    main()
