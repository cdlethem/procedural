#!/usr/bin/env python3
"""Build and consume the local Processing 0.3.0 PlacementMarks distribution; no render."""
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

VERSION = "0.3.0"
OUTPUT = ROOT / ".work/dist/cp3/java"
EVIDENCE = ROOT / "evidence/distribution/cp3-java.json"
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


def installed_smoke_source(seeded_case: dict, filter_case: dict) -> str:
    seeded = seeded_case["output"]
    filtered = filter_case["output"]
    def checks(name: str, output: dict) -> str:
        lines = ["check(" + name + ".size()==" + str(len(output["radii"])) + ",\"accepted count\");",
                 "check(" + name + ".attempts()==" + str(output["attempts"]) + ",\"attempt count\");"]
        for index, (centre, radius, source) in enumerate(zip(output["centres"], output["radii"], output["sourceIndices"])):
            lines.extend([
                "bits(" + name + ".pointAt(" + str(index) + "L)[0]," + repr(centre[0]) + ");",
                "bits(" + name + ".pointAt(" + str(index) + "L)[1]," + repr(centre[1]) + ");",
                "bits(" + name + ".radiusAt(" + str(index) + "L)," + repr(radius) + ");",
                "check(" + name + ".sourceIndexAt(" + str(index) + "L)==" + str(source) + ",\"source index\");",
            ])
        return "\n    ".join(lines)
    return """import java.io.File;
import java.util.*;
import org.procedurals.sampling.CirclePlacements2D;
public final class InstalledPlacementSmoke {
  static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
  static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  static void check(boolean value,String detail) { if(!value) throw new AssertionError(detail); }
  static void bits(double actual,double expected) { if(Double.doubleToRawLongBits(actual)!=Double.doubleToRawLongBits(expected))throw new AssertionError("binary64 fixture mismatch"); }
  public static void main(String[] args) throws Exception {
    String expected=new File(args[0]).getCanonicalFile().toURI().toURL().toString();
    String actual=CirclePlacements2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
    check(expected.equals(actual),"CirclePlacements2D did not load from extracted core JAR: "+actual);
    CirclePlacements2D seeded=CirclePlacements2D.seeded(__SEEDED_INPUT__);
    __SEEDED_CHECKS__
    CirclePlacements2D filtered=CirclePlacements2D.filter(__FILTER_INPUT__);
    __FILTER_CHECKS__
    double[] destination={7.0,7.0,7.0}; filtered.pointInto(0L,destination,1);
    bits(destination[1],__FILTER_X__); bits(destination[2],__FILTER_Y__);
    System.out.println("code_source="+actual);
  }
}
""".replace("__SEEDED_INPUT__", literal(seeded_case["input"])).replace("__FILTER_INPUT__", literal(filter_case["input"])).replace("__SEEDED_CHECKS__", checks("seeded", seeded)).replace("__FILTER_CHECKS__", checks("filtered", filtered)).replace("__FILTER_X__", repr(filtered["centres"][0][0])).replace("__FILTER_Y__", repr(filtered["centres"][0][1]))


def library_properties() -> str:
    return """name=Procedurals
category=Utilities
sentence=Evidence-backed portable generative-art operations.
paragraph=Grid, noise, palette, path and retained circle-placement operations with editable Processing sketches.
url=https://github.com/cdlethem/procedural
version=3
prettyVersion=0.3.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
"""


def readme() -> str:
    return """# PlacementMarks

Install the `procedurals` folder in your Processing sketchbook `libraries` directory and
open `examples/PlacementMarks/PlacementMarks.pde` with Processing 4.5.6 and JAVA2D.

`R`, `N`, `G`, `I`, `O`, and `X` rebuild retained placements; `M` and `C` only restyle
them; `S` saves the displayed frame. The constants and authored radial transfer describe
this starter, not library defaults or recommended ranges. The native rendering check is
pending separately from this local installation and compile check.
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
        raise RuntimeError("CP3 Java destination exists; preserve it for review rather than overwrite it")
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
    }
    notices = [ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md"]
    ordered_fixture = ROOT / "fixtures/operations/ordered-circle-filter.json"
    seeded_fixture = ROOT / "fixtures/operations/seeded-circle-placement.json"
    bridge = ROOT / "tests/native/PreprocessSketch.java"
    configuration = ROOT / "tests/native/PlacementMarksPdeConfiguration.java"
    inputs = [*core_sources, *adapter_sources, *(path for files in examples.values() for path in files), *notices,
              ordered_fixture, seeded_fixture, bridge, configuration, runtime, *preprocessor,
              Path(__file__).resolve()]
    for path in inputs:
        if not path.is_file():
            raise FileNotFoundError("distribution input missing: " + str(path))
    before = {relative(path): digest(path) for path in inputs}
    ordered = json.loads(ordered_fixture.read_text(encoding="utf-8"))
    seeded = json.loads(seeded_fixture.read_text(encoding="utf-8"))
    seeded_case = next(case for case in seeded["cases"] if case["id"] == "ordinary-8")
    filter_case = next(case for case in ordered["cases"] if case["id"] == "ordinary-tangent")

    build = OUTPUT / "build"
    classes = build / "core-classes"
    adapter_classes = build / "adapter-classes"
    classes.mkdir(parents=True)
    adapter_classes.mkdir()
    core = OUTPUT / "procedurals-core-0.3.0.jar"
    adapter = OUTPUT / "procedurals-processing-adapter-0.3.0.jar"
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
    write(library / "examples/PlacementMarks/README.md", readme())
    for notice in notices:
        copy(notice, library / notice.name)
    included = [{"path": str(path.relative_to(build)), "sha256": digest(path)}
                for path in sorted(library.rglob("*")) if path.is_file()]
    starter = OUTPUT / "procedurals-processing-0.3.0.zip"
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
    smoke = consumer / "InstalledPlacementSmoke.java"
    write(smoke, installed_smoke_source(seeded_case, filter_case))
    consumer_classes = consumer / "classes"
    consumer_classes.mkdir()
    run([home / "bin/javac", "--release", "8", "-cp", extracted_core, "-d", consumer_classes, smoke], cwd=consumer)
    smoke_result = run([home / "bin/java", "-cp", os.pathsep.join(map(str, (consumer_classes, extracted_core))),
                        "InstalledPlacementSmoke", extracted_core], cwd=consumer)

    # Official Processing preprocessing is performed on the extracted distribution, not checkout sources.
    preprocessing_cp = os.pathsep.join(map(str, (runtime, *preprocessor)))
    run([home / "bin/javac", "-cp", preprocessing_cp, "-d", consumer_classes, bridge], cwd=consumer)
    environment = os.environ.copy()
    for key in ("XDG_CONFIG_HOME", "SNAP_USER_COMMON", "APPDATA"):
        environment.pop(key, None)
    home_dir = consumer / "home"
    home_dir.mkdir()
    generated = consumer / "PlacementMarks.java"
    extracted_example = extracted / "examples/PlacementMarks"
    run([home / "bin/java", "-Duser.home=" + str(home_dir), "-cp", str(consumer_classes) + os.pathsep + preprocessing_cp,
         "PreprocessSketch", extracted_example / "PlacementMarks.pde", generated, "PlacementMarks"], cwd=consumer, env=environment)
    classpath = os.pathsep.join(map(str, (runtime, extracted_core, extracted_adapter)))
    run([home / "bin/javac", "--release", "17", "-cp", classpath, "-d", consumer_classes,
         generated, extracted_example / "PlacementComposition.java", configuration], cwd=consumer)
    run([home / "bin/java", "-cp", str(consumer_classes) + os.pathsep + classpath,
         "PlacementMarksPdeConfiguration"], cwd=consumer)

    after = {relative(path): digest(path) for path in inputs}
    if before != after:
        raise RuntimeError("distribution inputs changed during build")
    report = {
        "status": "passed", "package_version": VERSION,
        "scope": "Local Java core/Processing library artifact, extracted installed-JAR consumer, and official Processing 4.5.6 PlacementMarks PDE compilation only; native renderer/install acceptance and other targets remain pending.",
        "input_sha256_before": before, "input_sha256_after": after,
        "artifacts": {name: {"path": relative(path), "sha256": digest(path), "entries": zip_entries(path)}
                      for name, path in (("core", core), ("processing_adapter", adapter), ("starter", starter))},
        "library_layout": {"root": "procedurals", "examples": sorted(examples), "included_files": included},
        "consumer": {"installed_core_origin": smoke_result.stdout.strip(), "seeded_and_filter_fixture_cases": [seeded_case["id"], filter_case["id"]],
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
