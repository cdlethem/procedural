#!/usr/bin/env python3
"""Build portable Java and Processing-library artifacts without running conformance suites."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CORE_SOURCES = ROOT / "packages/java/src/main/java"
FIELD_MARKS = ROOT / "packages/java/examples/FieldMarks"
NOISE_FIXTURE = ROOT / "fixtures/operations/gradient-noise-2d-01.json"
VERSION = "0.1.0"
DEFAULT_OUTPUT = ROOT / ".work/dist/java"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command, *, cwd=ROOT):
    try:
        return subprocess.run([str(value) for value in command], cwd=cwd, check=True,
                              text=True, capture_output=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError("Command failed: " + " ".join(map(str, command)) + "\n" +
                           error.stdout + error.stderr) from error


def java_home(explicit: str | None) -> Path:
    if explicit:
        candidate = Path(explicit).expanduser().resolve()
    elif os.environ.get("JAVA_HOME"):
        candidate = Path(os.environ["JAVA_HOME"]).expanduser().resolve()
    elif shutil.which("javac"):
        candidate = Path(shutil.which("javac")).resolve().parents[1]
    else:
        candidates = sorted((ROOT / ".work/toolchains").glob("jdk-17*"))
        if len(candidates) != 1:
            raise RuntimeError("Pass --java-home or set JAVA_HOME; no unique JDK is available")
        candidate = candidates[0]
    if not (candidate / "bin/javac").is_file() or not (candidate / "bin/jar").is_file():
        raise RuntimeError("Java home lacks bin/javac and bin/jar: " + str(candidate))
    return candidate


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents)


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def zip_entries(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        return [{"path": info.filename, "sha256": hashlib.sha256(archive.read(info)).hexdigest()}
                for info in sorted(archive.infolist(), key=lambda item: item.filename)
                if not info.is_dir()]


def library_properties() -> str:
    return """name=Procedurals
category=Utilities
sentence=Evidence-backed portable generative-art operations.
paragraph=Regular grid, gradient noise and cyclic palette for editable Processing sketches.
url=https://github.com/cdlethem/procedural
version=1
prettyVersion=0.1.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
"""


def smoke_noise_vector() -> dict:
    fixture = json.loads(NOISE_FIXTURE.read_text())
    for case in fixture.get("cases", []):
        if case.get("id") != "seed-0" or case.get("input") != {"seed": 0}:
            continue
        for query in case.get("queries", []):
            if query.get("input") == [0.25, 0.75] and isinstance(query.get("output"), (int, float)):
                return {"fixture": relative(NOISE_FIXTURE), "case": case["id"],
                        "input": query["input"], "output": query["output"]}
    raise RuntimeError("Expected seed-0 [0.25,0.75] noise fixture vector is missing")


def smoke_source(noise_value: float) -> str:
    return """import java.io.File;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.color.CyclicPalette;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.layout.RegularGrid;

public final class InstalledCoreSmoke {
  private static void check(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }
  public static void main(String[] args) throws Exception {
    check(args.length == 1, "expected generated JAR path");
    String expectedSource = new File(args[0]).getCanonicalFile().toURI().toURL().toString();
    String actualSource = RegularGrid.class.getProtectionDomain().getCodeSource().getLocation().toString();
    check(expectedSource.equals(actualSource), "RegularGrid was not loaded from generated JAR: " + actualSource);
    Map<String,Object> gridInput = new LinkedHashMap<String,Object>();
    gridInput.put("origin", Arrays.<Object>asList(-2.0, 4.0));
    gridInput.put("spacing", Arrays.<Object>asList(3.0, 0.5));
    gridInput.put("columns", 3);
    gridInput.put("rows", 2);
    RegularGrid grid = RegularGrid.create(gridInput);
    double[] point = grid.pointAt(4);
    check(grid.size() == 6 && point[0] == 1.0 && point[1] == 4.5, "regular grid");

    Map<String,Object> noiseInput = new LinkedHashMap<String,Object>();
    noiseInput.put("seed", 0);
    double noise = GradientNoise2D01.create(noiseInput).sample(0.25, 0.75);
    check(Double.doubleToLongBits(noise) == Double.doubleToLongBits(__NOISE_VALUE__), "noise");
    System.out.println("code_source=" + actualSource);

    Map<String,Object> paletteInput = new LinkedHashMap<String,Object>();
    paletteInput.put("colors", Arrays.<Object>asList(0xff0000, 0x0000ff));
    check(CyclicPalette.create(paletteInput).sample(0.25) == 0x800080, "palette");
  }
}
""".replace("__NOISE_VALUE__", repr(noise_value))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", help="JDK home; otherwise JAVA_HOME, PATH, then one .work JDK")
    parser.add_argument("--processing-core", type=Path,
                        help="Processing core JAR; include the separately compiled desktop adapter when supplied")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="ignored artifact directory (default: .work/dist/java)")
    args = parser.parse_args()
    home = java_home(args.java_home)
    output = args.output.resolve()
    allowed_outputs = (ROOT / ".work", ROOT / "dist")
    if not any(output.is_relative_to(path) for path in allowed_outputs):
        raise ValueError("output must stay under ignored .work or dist")
    sources = sorted(CORE_SOURCES.rglob("*.java"))
    if not sources:
        raise RuntimeError("No portable Java sources found")
    example_tabs = [FIELD_MARKS / "FieldMarks.pde", FIELD_MARKS / "MarkField.java"]
    notices = [ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md"]
    for path in (*example_tabs, *notices, NOISE_FIXTURE):
        if not path.is_file():
            raise FileNotFoundError("Required distribution input is missing: " + str(path))

    build = output / "build"
    if build.exists():
        shutil.rmtree(build)
    classes = build / "classes"
    smoke = build / "smoke"
    classes.mkdir(parents=True)
    smoke.mkdir()
    core_jar = output / ("procedurals-core-" + VERSION + ".jar")
    library_zip = output / ("procedurals-processing-" + VERSION + ".zip")
    noise_vector = smoke_noise_vector()
    input_paths = [*sources, *example_tabs, *notices, NOISE_FIXTURE, Path(__file__).resolve()]
    adapter_sources=[]
    if args.processing_core:
        processing_core=args.processing_core.resolve()
        if not processing_core.is_file():raise FileNotFoundError(processing_core)
        adapter_sources=sorted((ROOT/'packages/java-processing/src/main/java').rglob('*.java'))
        input_paths.extend(adapter_sources)
        command_example=ROOT/'packages/java-processing/examples/FieldMarks'
        input_paths.extend([command_example/'FieldMarks.pde',command_example/'MarkCommands.java'])
    input_hashes = {relative(path): digest(path) for path in input_paths}

    run([home / "bin/javac", "--release", "8", "-d", classes, *sources])
    copy(ROOT / "LICENSE", classes / "META-INF/LICENSE")
    copy(ROOT / "THIRD_PARTY_NOTICES.md", classes / "META-INF/THIRD_PARTY_NOTICES.md")
    run([home / "bin/jar", "cf", core_jar, "-C", classes, "org", "-C", classes, "META-INF"])

    consumer = smoke / "InstalledCoreSmoke.java"
    write(consumer, smoke_source(noise_vector["output"]))
    compile = run([home / "bin/javac", "--release", "8", "-cp", core_jar,
                   "-d", smoke, consumer])
    execute = run([home / "bin/java", "-cp", os.pathsep.join((str(smoke), str(core_jar))),
                   "InstalledCoreSmoke", core_jar])
    actual_code_source = next((line.removeprefix("code_source=") for line in execute.stdout.splitlines()
                               if line.startswith("code_source=")), None)
    if actual_code_source is None:
        raise RuntimeError("Installed consumer did not report its generated JAR code source")

    library_root = build / "procedurals"
    copy(core_jar, library_root / "library/procedurals.jar")
    adapter_artifact=None
    if adapter_sources:
        adapter_classes=build/'adapter-classes'; adapter_classes.mkdir()
        runtime_hash=digest(processing_core)
        run([home/'bin/javac','--release','8','-cp',os.pathsep.join(map(str,(core_jar,processing_core))),
             '-d',adapter_classes,*adapter_sources])
        copy(ROOT/'LICENSE',adapter_classes/'META-INF/LICENSE')
        copy(ROOT/'THIRD_PARTY_NOTICES.md',adapter_classes/'META-INF/THIRD_PARTY_NOTICES.md')
        adapter_jar=output/('procedurals-processing-adapter-'+VERSION+'.jar')
        run([home/'bin/jar','cf',adapter_jar,'-C',adapter_classes,'org',
             '-C',adapter_classes,'META-INF'])
        copy(adapter_jar,library_root/'library/procedurals-processing-adapter.jar')
        if digest(processing_core)!=runtime_hash:raise RuntimeError('Processing core changed during build')
        adapter_artifact={'path':relative(adapter_jar),'sha256':digest(adapter_jar),
                          'entries':zip_entries(adapter_jar),
                          'processing_core':str(processing_core),'processing_core_sha256':runtime_hash}
    write(library_root / "library.properties", library_properties())
    for tab in example_tabs:
        copy(tab, library_root / "examples/FieldMarks" / tab.name)
    if adapter_sources:
        # Keep the original sampled model verbatim; omit its unused direct-PGraphics
        # painting methods so the editable starter has only one mark-treatment entry.
        original=(FIELD_MARKS/'MarkField.java').read_text()
        boundary='    /** Draw retained attributes with supplied colour and mark treatment. */'
        if original.count(boundary)!=1:raise RuntimeError('Unexpected MarkField source boundary')
        model_source=original.split(boundary)[0]+'}\n'
        write(library_root/'examples/FieldMarks/MarkField.java',model_source)
        copy(command_example/'FieldMarks.pde',library_root/'examples/FieldMarks/FieldMarks.pde')
        copy(command_example/'MarkCommands.java',library_root/'examples/FieldMarks/MarkCommands.java')
    for notice in notices:
        copy(notice, library_root / notice.name)
    included_before_zip = []
    for path in sorted(library_root.rglob("*")):
        if path.is_file():
            included_before_zip.append({"path": str(path.relative_to(build)), "sha256": digest(path)})
    with zipfile.ZipFile(library_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in included_before_zip:
            source = build / item["path"]
            archive.write(source, item["path"])

    if input_hashes != {relative(path): digest(path) for path in input_paths}:
        raise RuntimeError("Distribution inputs changed during build")
    report = {
        "status": "passed",
        "scope": "Portable Java core, optional separate desktop adapter and Processing library ZIP; build and installed core consumption only, no new native renderer claim",
        "commands": {
            "compile": [str(home / "bin/javac"), "--release", "8"],
            "jar": [str(home / "bin/jar"), "cf"],
            "consumer_compile": [str(home / "bin/javac"), "--release", "8", "-cp", str(core_jar)],
            "consumer_run": [str(home / "bin/java"), "-cp", "<isolated-consumer>" + os.pathsep + str(core_jar)],
        },
        "java_home": str(home),
        "java_version": run([home / "bin/java", "-version"]).stderr.strip(),
        "input_sha256": input_hashes,
        "artifacts": {
            "core_jar": {"path": relative(core_jar), "sha256": digest(core_jar),
                         "entries": zip_entries(core_jar)},
            "processing_library_zip": {"path": relative(library_zip), "sha256": digest(library_zip),
                                        "entries": zip_entries(library_zip)},
        },
        "included_file_manifest": included_before_zip,
        "consumer_smoke": {
            "source": "InstalledCoreSmoke imports only the generated core JAR",
            "known_values": {"grid": [6, 1.0, 4.5], "noise": noise_vector,
                             "palette_rgb24": 0x800080},
            "actual_code_source": actual_code_source,
            "compiler_stdout": compile.stdout, "runtime_stdout": execute.stdout,
        },
    }
    if adapter_artifact:report['artifacts']['processing_adapter_jar']=adapter_artifact
    report['starter_route']='installed-command-adapter' if adapter_artifact else 'direct-processing-core-only'
    if adapter_artifact:
        report['starter_transformations']=['MarkField: retain original prefix through create(); omit unused direct painting methods.',
            'Use authored command-route FieldMarks.pde and MarkCommands.java; installed core and desktop adapter JARs.']
    output.mkdir(parents=True, exist_ok=True)
    result = output / "build-result.json"
    result.write_text(json.dumps(report, indent=2) + "\n")
    evidence=ROOT/'evidence/distribution/java-artifacts.json'
    evidence.parent.mkdir(parents=True,exist_ok=True)
    evidence.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({"core_jar": relative(core_jar), "processing_library_zip": relative(library_zip),
                      "result": relative(result), "scope": report["scope"]}))


if __name__ == "__main__":
    main()
