#!/usr/bin/env python3
"""Build six restoration-fixed Android starters from one new adapter JAR.

This is a consumer-package compile check only.  It never installs, launches, or
renders an APK, and it deliberately leaves historical distribution records intact.
"""
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

from build_android_artifacts import (
    DEFAULT_GRADLE, DEFAULT_JAVA_HOME, DEFAULT_PROCESSING_CORE, DEFAULT_SDK,
    NOTICES, PROCESSING_CORE_SHA256, PROCESSING_RELEASE_SHA256, PROCESSING_RELEASE_URL,
    TEMPLATES, adapter_project, copy, files,
    require_dir, require_file, write_project_base, zip_manifest,
)

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.3.0"
DEFAULT_OUTPUT = ROOT / ".work/dist/android-restoration1"
REVIEW = ROOT / "evidence/conformance/android-snapshot-restoration-root-review.json"
ADAPTER_SOURCES = tuple(ROOT / "packages/java-android/src/main/java/org/procedurals/android/internal" / name for name in (
    "Android2DFragment.java", "Android2DFrame.java", "AndroidFrameHost.java",
    "AndroidSnapshotPresentation.java", "AndroidSurface.java",
))
DRAWING_STATE = "org/procedurals/internal/DrawingFrameState.class"
SNAPSHOT_PRESENTATION_CLASS = "org/procedurals/android/internal/AndroidSnapshotPresentation.class"
RUN_INDEX = 0
FAILURE_OUTPUT: Path | None = None


def path(*parts: str) -> Path:
    return ROOT.joinpath(*parts)


SPECS = (
    {"name": "FieldMarks", "slug": "field-marks", "version": "0.1.1", "code": 101, "app_id": "org.procedurals.fieldmarks",
     "package": "org.procedurals.examples.fieldmarks", "starter": "procedurals-field-marks-android",
     "core": path(".work/dist/java/procedurals-core-0.1.0.jar"),
     "evidence": path("evidence/distribution/android.json"), "artifact": "core_jar",
     "composition": path("packages/java/examples/FieldMarks/MarkField.java"), "composition_name": "MarkField.java"},
    {"name": "PathMarks", "slug": "path-marks", "version": "0.2.1", "code": 201, "app_id": "org.procedurals.pathmarks",
     "package": "org.procedurals.examples.pathmarks", "starter": "procedurals-path-marks-android",
     "core": path(".work/dist/cp2/java/procedurals-core-0.2.0.jar"),
     "evidence": path("evidence/distribution/cp2-android.json"), "artifact": "core",
     "composition": path("packages/java/examples/PathMarks/PathMarkComposition.java"), "composition_name": "PathMarkComposition.java"},
    {"name": "PlacementMarks", "slug": "placement-marks", "version": "0.3.1", "code": 301, "app_id": "org.procedurals.placementmarks",
     "package": "org.procedurals.examples.placementmarks", "starter": "procedurals-placement-marks-android",
     "core": path(".work/dist/cp3/java/procedurals-core-0.3.0.jar"),
     "evidence": path("evidence/distribution/cp3-android.json"), "artifact": "core",
     "composition": path("packages/java/examples/PlacementMarks/PlacementComposition.java"), "composition_name": "PlacementComposition.java"},
    {"name": "RegionMarks", "slug": "region-marks", "version": "0.4.1", "code": 401, "app_id": "org.procedurals.regionmarks",
     "package": "org.procedurals.examples.regionmarks", "starter": "procedurals-region-marks-android",
     "core": path(".work/dist/cp4/java/procedurals-core-0.4.0.jar"),
     "evidence": path("evidence/distribution/cp4-android.json"), "artifact": "core",
     "composition": path("packages/java/examples/RegionMarks/RegionComposition.java"), "composition_name": "RegionComposition.java"},
    {"name": "GrainMarks", "slug": "grain-marks", "version": "0.5.1", "code": 501, "app_id": "org.procedurals.grainmarks",
     "package": "org.procedurals.examples.grainmarks", "starter": "procedurals-grain-marks-android",
     "core": path(".work/dist/cp5/java/procedurals-core-0.5.0.jar"),
     "evidence": path("evidence/distribution/cp5-android.json"), "artifact": "core",
     "composition": path("packages/java/examples/GrainMarks/GrainComposition.java"), "composition_name": "GrainComposition.java"},
    {"name": "BranchMarks", "slug": "branch-marks", "version": "0.6.1", "code": 601, "app_id": "org.procedurals.branchmarks",
     "package": "org.procedurals.examples.branchmarks", "starter": "procedurals-branch-marks-android",
     "core": path(".work/dist/cp6/java/procedurals-core-0.6.0.jar"),
     "evidence": path("evidence/distribution/cp6-android.json"), "artifact": "core",
     "composition": path("packages/java/examples/BranchMarks/BranchComposition.java"), "composition_name": "BranchComposition.java"},
)


def digest(value: Path) -> str:
    return hashlib.sha256(value.read_bytes()).hexdigest()


def shown(value: Path) -> str:
    try:
        return str(value.resolve().relative_to(ROOT))
    except ValueError:
        return str(value.resolve())


def run(command: list[Path | str], *, cwd: Path, env: dict[str, str], timeout: int) -> str:
    global RUN_INDEX
    result = subprocess.run([str(item) for item in command], cwd=cwd, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
    log_dir = env.get("PROCEDURALS_RESTORATION_LOG_DIR")
    if log_dir:
        RUN_INDEX += 1
        log = Path(log_dir) / f"{RUN_INDEX:02d}-{'-'.join(Path(str(command[0])).parts[-2:])}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        log.write_text("$ " + " ".join(map(str, command)) + "\n\n" + result.stdout, encoding="utf-8")
    if result.returncode:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" + result.stdout)
    return result.stdout


def hashes(values: list[Path]) -> dict[str, str]:
    return {shown(value): digest(value) for value in values}


def review_bindings() -> dict[str, str]:
    review = json.loads(require_file(REVIEW, "root restoration review").read_text(encoding="utf-8"))
    if review.get("status") != "accepted" or review.get("owner") != "root" or review.get("reviewer") != "root":
        raise RuntimeError("root restoration review is not accepted")
    bindings: dict[str, str] = {}
    for key in ("implementation_sha256", "evidence_sha256"):
        values = review.get(key)
        if not isinstance(values, dict) or not values:
            raise RuntimeError("root restoration review lacks " + key)
        for name, expected in values.items():
            item = ROOT / name
            if not item.is_file() or digest(item) != expected:
                raise RuntimeError("root restoration review binding changed: " + name)
            bindings[name] = expected
    return bindings


def core_provenance(spec: dict[str, object]) -> dict[str, object]:
    core = require_file(spec["core"], str(spec["name"]) + " historical core")
    evidence = json.loads(require_file(spec["evidence"], str(spec["name"]) + " distribution evidence").read_text())
    if evidence.get("status") != "passed":
        raise RuntimeError(str(spec["name"]) + " historical distribution record is not passed")
    record = evidence.get("artifacts", {}).get(spec["artifact"])
    if not isinstance(record, dict) or record.get("sha256") != digest(core):
        raise RuntimeError(str(spec["name"]) + " core does not match historical evidence")
    return {"core": core, "evidence": Path(spec["evidence"]), "record": record}


def require_adapter_sources() -> None:
    actual = tuple(sorted((ROOT / "packages/java-android/src/main/java").rglob("*.java")))
    if tuple(sorted(ADAPTER_SOURCES)) != actual:
        raise RuntimeError("adapter source boundary must be exactly the five restoration sources")
    for source in ADAPTER_SOURCES:
        require_file(source, "adapter source")


def drawing_state_identity(provenance: list[dict[str, object]]) -> dict[str, str]:
    result = {}
    for item in provenance:
        core = item["core"]
        with zipfile.ZipFile(core) as archive:
            result[shown(core)] = hashlib.sha256(archive.read(DRAWING_STATE)).hexdigest()
    if len(set(result.values())) != 1:
        raise RuntimeError("historical cores do not share an identical DrawingFrameState class")
    return result


def make_adapter(build: Path, output: Path, core: Path, processing: Path, gradle: Path,
                 sdk: Path, env: dict[str, str]) -> tuple[Path, list[dict[str, str]]]:
    stage = build / "adapter-project"
    module = adapter_project(stage, core, processing)
    (stage / "local.properties").write_text("sdk.dir=" + str(sdk) + "\n", encoding="utf-8")
    run([gradle, "--no-daemon", "--console=plain", ":adapter:assembleRelease"], cwd=stage, env=env, timeout=600)
    aar = require_file(module / "build/outputs/aar/adapter-release.aar", "adapter AAR")
    unpacked = build / "adapter-classes"
    with zipfile.ZipFile(aar) as archive:
        archive.extract("classes.jar", unpacked)
    with zipfile.ZipFile(unpacked / "classes.jar") as archive:
        archive.extractall(unpacked / "jar")
    for notice in NOTICES:
        copy(notice, unpacked / "jar/META-INF" / notice.name)
    adapter = output / ("procedurals-android-" + VERSION + ".jar")
    with zipfile.ZipFile(adapter, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for member in files(unpacked / "jar"):
            archive.write(member, str(member.relative_to(unpacked / "jar")))
    entries = zip_manifest(adapter)
    names = {entry["path"] for entry in entries}
    allowed_notices = {"META-INF/LICENSE", "META-INF/THIRD_PARTY_NOTICES.md"}
    if any(name not in allowed_notices and not name.startswith("org/procedurals/android/internal/") for name in names):
        raise RuntimeError("adapter contains a non-adapter runtime asset")
    if any(not name.endswith(".class") for name in names if name not in allowed_notices):
        raise RuntimeError("adapter contains a non-class adapter asset")
    if {"META-INF/LICENSE", "META-INF/THIRD_PARTY_NOTICES.md"} - names:
        raise RuntimeError("adapter notices are missing")
    if SNAPSHOT_PRESENTATION_CLASS not in names:
        raise RuntimeError("adapter lacks AndroidSnapshotPresentation.class")
    return adapter, entries


def gradle_text(spec: dict[str, object]) -> str:
    text = (TEMPLATES / "sample-app-build.gradle").read_text(encoding="utf-8")
    replacements = (("org.procedurals.fieldmarks", spec["app_id"]),
                    ("versionCode 1", "versionCode " + str(spec["code"])),
                    ("versionName '0.1.0'", "versionName '" + str(spec["version"]) + "'"))
    for old, new in replacements:
        expected_count = 2 if old == "org.procedurals.fieldmarks" else 1
        if text.count(old) != expected_count:
            raise RuntimeError("unexpected app Gradle template marker: " + old)
        text = text.replace(old, str(new))
    return text


def source_targets(spec: dict[str, object], stage: Path) -> dict[Path, Path]:
    name = str(spec["name"])
    example = ROOT / "packages/java-android/examples" / name
    java = stage / "app/src/main/java" / Path(str(spec["package"]).replace(".", "/"))
    targets = {example / (name + "Activity.java"): java / (name + "Activity.java"),
               example / (name + "Renderer.java"): java / (name + "Renderer.java"),
               Path(spec["composition"]): java / str(spec["composition_name"]),
               ROOT / "packages/java-android/examples/FieldMarks/GalleryWriter.java":
                   stage / "app/src/main/java/org/procedurals/examples/fieldmarks/GalleryWriter.java"}
    return targets


def field_source(spec: dict[str, object], target: Path) -> bool:
    if spec["name"] != "FieldMarks":
        return False
    source = Path(spec["composition"])
    body = source.read_text(encoding="utf-8")
    if body.startswith("package "):
        raise RuntimeError("Field MarkField unexpectedly declares a package")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("package org.procedurals.examples.fieldmarks;\n\n" + body, encoding="utf-8")
    return True


def starter_readme(spec: dict[str, object]) -> str:
    return f"""# Procedurals Android {spec['name']} starter {spec['version']}

This API-29+ editable starter contains its retained composition, Activity, Renderer and
GalleryWriter. It includes the historical matching portable core JAR and Android adapter
{VERSION}; Processing Android Mode remains external. `USAGE.md` is a byte-exact copy of
the repository’s example instructions and describes this starter’s controls and which
edits retain geometry versus rebuild it.

Use JDK 17, Android SDK platform 33/build-tools 30.0.3, and Gradle 7.4.2. Copy
`AndroidMode/processing-core.zip` byte-for-byte to a local `.jar` filename, then run:

```sh
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
adb -s YOUR_DEVICE_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
```

Open {spec['name']} on the device. Use the controls described in `USAGE.md`; Save PNG
writes the current image to `Pictures/Procedurals`.

Create `local.properties` locally with `sdk.dir=/absolute/path/to/sdk`. This ZIP excludes
the Processing runtime, SDK, signing keys, `local.properties`, and build output.

Pinned Processing Android Mode 4.6.0 (`android-412`) download:

- {PROCESSING_RELEASE_URL}
- AndroidMode-412.zip SHA-256: `{PROCESSING_RELEASE_SHA256}`
- `AndroidMode/processing-core.zip` SHA-256: `{PROCESSING_CORE_SHA256}`

The editable source provenance is `packages/java-android/examples/{spec['name']}` and
`packages/java/examples/{spec['name']}` in the Procedurals repository. Verify the pinned
runtime hash before compiling.
"""


def stage_starter(spec: dict[str, object], stage: Path, core: Path, adapter: Path) -> tuple[dict[str, str], list[dict[str, str]]]:
    write_project_base(stage, "Procedurals" + str(spec["name"]), "app")
    (stage / "app/build.gradle").parent.mkdir(parents=True, exist_ok=True)
    (stage / "app/build.gradle").write_text(gradle_text(spec), encoding="utf-8")
    example = ROOT / "packages/java-android/examples" / str(spec["name"])
    copy(example / "AndroidManifest.xml", stage / "app/src/main/AndroidManifest.xml")
    bindings: dict[str, str] = {shown(example / "AndroidManifest.xml"): digest(example / "AndroidManifest.xml")}
    transforms: list[dict[str, str]] = []
    for source, target in source_targets(spec, stage).items():
        transformed = field_source(spec, target) if source == spec["composition"] else False
        if not transformed:
            copy(source, target)
            if digest(source) != digest(target):
                raise RuntimeError("staged source changed: " + shown(source))
        if transformed:
            transforms.append({"source": shown(source), "source_sha256": digest(source), "target": str(target.relative_to(stage)),
                               "kind": "Field MarkField package-prefix", "target_sha256": digest(target)})
        else:
            bindings[shown(source)] = digest(source)
    copy(core, stage / "app/libs/procedurals-core.jar")
    copy(adapter, stage / "app/libs/procedurals-android.jar")
    for notice in NOTICES:
        copy(notice, stage / notice.name)
    copy(example / "README.md", stage / "USAGE.md")
    if digest(example / "README.md") != digest(stage / "USAGE.md"):
        raise RuntimeError("staged example usage changed")
    bindings[shown(example / "README.md")] = digest(example / "README.md")
    (stage / "README.md").write_text(starter_readme(spec), encoding="utf-8")
    return bindings, transforms


def generated_key(path_: Path, java: Path, env: dict[str, str]) -> Path:
    run([java / "bin/keytool", "-genkeypair", "-keystore", path_, "-storepass", "procedurals-local-debug",
         "-keypass", "procedurals-local-debug", "-alias", "procedurals-debug", "-keyalg", "RSA",
         "-keysize", "2048", "-validity", "10000", "-dname", "CN=Procedurals Local Debug", "-noprompt"],
        cwd=path_.parent, env=env, timeout=120)
    return require_file(path_, "generated debug key")


def verify_starter(spec: dict[str, object], build: Path, output: Path, core: Path, adapter: Path,
                   external_processing: Path, gradle: Path, sdk: Path, java: Path,
                   env: dict[str, str]) -> dict[str, object]:
    stage = build / str(spec["starter"])
    bindings, transforms = stage_starter(spec, stage, core, adapter)
    archive = output / (str(spec["starter"]) + "-" + str(spec["version"]) + ".zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as result:
        for member in files(stage):
            result.write(member, str(Path(spec["starter"]) / member.relative_to(stage)))
    entries = zip_manifest(archive)
    forbidden = ("processing-core", "local.properties", "debug.keystore", "/build/", "/.gradle/", "/sdk/", "/runtime/")
    bad = [entry["path"] for entry in entries if any(item in entry["path"].lower() for item in forbidden)]
    if bad:
        raise RuntimeError("starter ZIP contains excluded payload: " + ", ".join(bad))
    consumer = build / "consumer" / str(spec["slug"])
    with zipfile.ZipFile(archive) as source:
        source.extractall(consumer)
    extracted = consumer / str(spec["starter"])
    expected = [{"path": entry["path"].removeprefix(str(spec["starter"]) + "/"), "sha256": entry["sha256"]}
                for entry in entries]
    actual = [{"path": str(member.relative_to(extracted)).replace(os.sep, "/"), "sha256": digest(member)}
              for member in files(extracted)]
    if actual != expected:
        raise RuntimeError("extracted ZIP manifest differs: " + str(spec["name"]))
    for source, target in source_targets(spec, extracted).items():
        if spec["name"] == "FieldMarks" and source == spec["composition"]:
            expected_body = "package org.procedurals.examples.fieldmarks;\n\n" + source.read_text(encoding="utf-8")
            if target.read_text(encoding="utf-8") != expected_body:
                raise RuntimeError("extracted Field MarkField package transform differs")
        elif digest(source) != digest(target):
            raise RuntimeError("extracted source differs: " + shown(source))
    if digest(extracted / "app/src/main/AndroidManifest.xml") != digest(ROOT / "packages/java-android/examples" / str(spec["name"]) / "AndroidManifest.xml"):
        raise RuntimeError("extracted manifest differs: " + str(spec["name"]))
    if digest(extracted / "app/libs/procedurals-core.jar") != digest(core) or digest(extracted / "app/libs/procedurals-android.jar") != digest(adapter):
        raise RuntimeError("extracted JAR differs: " + str(spec["name"]))
    for notice in NOTICES:
        if digest(extracted / notice.name) != digest(notice):
            raise RuntimeError("extracted notice differs: " + notice.name)
    usage = ROOT / "packages/java-android/examples" / str(spec["name"]) / "README.md"
    if digest(extracted / "USAGE.md") != digest(usage):
        raise RuntimeError("extracted usage differs: " + str(spec["name"]))
    (extracted / "local.properties").write_text("sdk.dir=" + str(sdk) + "\n", encoding="utf-8")
    key_path = build / "keys" / (str(spec["slug"]) + ".keystore")
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key = generated_key(key_path, java, env)
    run([gradle, "--no-daemon", "--console=plain", ":app:assembleDebug", "-PprocessingCore=" + str(external_processing),
         "-PdebugKeystore=" + str(key)], cwd=extracted, env=env, timeout=600)
    apk = require_file(extracted / "app/build/outputs/apk/debug/app-debug.apk", "compiled starter APK")
    return {"version": spec["version"], "starter": {"path": shown(archive), "sha256": digest(archive), "entries": entries},
            "sources_byte_exact": bindings, "source_transforms": transforms, "extracted_core_byte_exact": True, "extracted_adapter_byte_exact": True,
            "extracted_notices_byte_exact": True, "compiled_apk_sha256": digest(apk)}


def main() -> int:
    global FAILURE_OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="assemble adapter and extracted starters")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--sdk", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--gradle", type=Path, default=DEFAULT_GRADLE)
    parser.add_argument("--processing-core", type=Path, default=DEFAULT_PROCESSING_CORE)
    args = parser.parse_args()
    if not args.build:
        print(json.dumps({"prepared": True, "required_command": "tools/build_android_restoration_starters.py --build",
                          "scope": "no build, install, launch, render, or acceptance action"}, sort_keys=True))
        return 0
    output = args.output.resolve()
    try:
        output.relative_to((ROOT / ".work").resolve())
    except ValueError as error:
        raise ValueError("output must remain under ignored .work") from error
    if output.exists():
        raise RuntimeError("refusing occupied output: " + shown(output))
    require_adapter_sources()
    review = review_bindings()
    provenance = [core_provenance(spec) for spec in SPECS]
    identities = drawing_state_identity(provenance)
    java = require_dir(args.java_home, "Java home")
    sdk = require_dir(args.sdk, "Android SDK")
    gradle = require_file(args.gradle, "Gradle")
    processing = require_file(args.processing_core, "Processing Android core")
    if digest(processing) != PROCESSING_CORE_SHA256:
        raise RuntimeError("Processing Android core differs from the pinned digest")
    require_file(sdk / "platforms/android-33/android.jar", "Android API 33")
    require_file(sdk / "build-tools/30.0.3/aapt2", "Android build tools")
    inputs = [Path(__file__).resolve(), REVIEW, *ADAPTER_SOURCES, *NOTICES, *files(TEMPLATES), processing, gradle,
              sdk / "platforms/android-33/android.jar", sdk / "build-tools/30.0.3/source.properties",
              java / "release", java / "lib/modules", java / "bin/java", java / "bin/javac", ROOT / "tools/build_android_artifacts.py"]
    for spec, item in zip(SPECS, provenance):
        example = ROOT / "packages/java-android/examples" / str(spec["name"])
        inputs += [item["core"], item["evidence"], example / "AndroidManifest.xml", example / (str(spec["name"]) + "Activity.java"),
                   example / (str(spec["name"]) + "Renderer.java"), example / "README.md", Path(spec["composition"]),
                   ROOT / "packages/java-android/examples/FieldMarks/GalleryWriter.java"]
    inputs += files(gradle.parent.parent / "lib")
    before = hashes(inputs)
    output.mkdir(parents=True)
    FAILURE_OUTPUT = output
    build = output / "build"; build.mkdir()
    cache = output / "gradle-cache"; cache.mkdir(); user = output / "android-user-home"; user.mkdir()
    env = {**os.environ, "JAVA_HOME": str(java), "GRADLE_USER_HOME": str(cache), "ANDROID_USER_HOME": str(user),
           "PROCEDURALS_RESTORATION_LOG_DIR": str(output / "logs")}
    external = build / "external/processing-core.jar"; copy(processing, external)
    if digest(external) != digest(processing):
        raise RuntimeError("external Processing core differs from pinned source")
    adapter, adapter_entries = make_adapter(build, output, provenance[0]["core"], processing, gradle, sdk, env)
    starters = {str(spec["name"]): verify_starter(spec, build, output, item["core"], adapter, external, gradle, sdk, java, env)
                for spec, item in zip(SPECS, provenance)}
    if review_bindings() != review:
        raise RuntimeError("root restoration-review bindings changed during build")
    after = hashes(inputs)
    if before != after:
        raise RuntimeError("packaging inputs changed during build")
    report = {"status": "passed", "scope": "six extracted Android starter debug APK compilation checks only; no install, launch, render, or Android support acceptance",
              "adapter": {"version": VERSION, "path": shown(adapter), "sha256": digest(adapter), "entries": adapter_entries,
                          "five_sources": hashes(list(ADAPTER_SOURCES)), "compile_core": shown(provenance[0]["core"])},
              "drawing_frame_state_sha256": identities, "review_bindings": review,
              "historical_core_provenance": {str(spec["name"]): {"core": shown(item["core"]), "sha256": digest(item["core"]),
                  "evidence": shown(item["evidence"]), "evidence_artifact": item["record"]} for spec, item in zip(SPECS, provenance)},
              "starters": starters, "input_sha256_before": before, "input_sha256_after": after,
              "zip_exclusions": {"processing_runtime": True, "sdk": True, "debug_key": True, "local_properties": True, "build_output": True, "gradle_cache": True}}
    (output / "build-result.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "adapter": shown(adapter), "starters": sorted(starters)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        if FAILURE_OUTPUT is not None:
            failed = {"status": "failed", "scope": "Android restoration package build failed before acceptance; no install, launch, or render",
                      "error": str(error), "stdout_logs": "logs"}
            (FAILURE_OUTPUT / "build-result.failed.json").write_text(json.dumps(failed, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
