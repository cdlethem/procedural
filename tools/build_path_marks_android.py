#!/usr/bin/env python3
"""Assemble and externally compile the CP2 Android PathMarks 0.2.0 starter.

This is a packaging/consumer check only. It never installs, launches, or renders. It
requires the separately accepted read-only Android recovery review as a source binding;
the package build itself does not add native capability evidence.
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
    ADAPTER_SOURCES,
    DEFAULT_GRADLE,
    DEFAULT_JAVA_HOME,
    DEFAULT_PROCESSING_CORE,
    DEFAULT_SDK,
    NOTICES,
    PROCESSING_CORE_SHA256,
    PROCESSING_RELEASE_SHA256,
    PROCESSING_RELEASE_URL,
    TEMPLATES,
    adapter_project,
    copy,
    files,
    replace_template,
    require_dir,
    require_file,
    write_project_base,
    zip_manifest,
)
from build_path_marks_java import consumer_source

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.2.0"
OUTPUT = ROOT / ".work/dist/cp2/android"
EVIDENCE = ROOT / "evidence/distribution/cp2-android.json"
JAVA_EVIDENCE = ROOT / "evidence/distribution/cp2-java.json"
ANDROID_REVIEW = ROOT / "evidence/reproductions/cp2-android/review.json"
CORE = ROOT / ".work/dist/cp2/java/procedurals-core-0.2.0.jar"
EXAMPLE = ROOT / "packages/java-android/examples/PathMarks"
COMPOSITION = ROOT / "packages/java/examples/PathMarks/PathMarkComposition.java"
GALLERY = ROOT / "packages/java-android/examples/FieldMarks/GalleryWriter.java"
FIXTURE = ROOT / "fixtures/operations/gradient-path.json"

APP_ID = "org.procedurals.pathmarks"
NAMESPACE = "org.procedurals.pathmarks"
STARTER_ROOT = "procedurals-path-marks-android"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    path = path.resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def run(command: list[Path | str], *, cwd: Path, env: dict[str, str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    result = subprocess.run([str(value) for value in command], cwd=cwd, env=env,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=timeout)
    if result.returncode:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" + result.stdout)
    return result


def zip_tree(source: Path, archive: Path) -> None:
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as result:
        for path in files(source):
            result.write(path, str(Path(STARTER_ROOT) / path.relative_to(source)))


def normalized_processing_core(source: Path, build: Path) -> Path:
    target = build / "external/processing-core.jar"
    copy(source, target)
    if digest(target) != digest(source):
        raise RuntimeError("normalized external Processing Android core changed bytes")
    return target


def generated_debug_key(build: Path, java_home: Path, env: dict[str, str]) -> Path:
    """Create the template's documented local signing key outside the starter ZIP."""
    key = build / "external/procedurals-local-debug.keystore"
    run([java_home / "bin/keytool", "-genkeypair", "-keystore", key,
         "-storepass", "procedurals-local-debug", "-keypass", "procedurals-local-debug",
         "-alias", "procedurals-debug", "-keyalg", "RSA", "-keysize", "2048",
         "-validity", "10000", "-dname", "CN=Procedurals Local Debug", "-noprompt"], cwd=build, env=env)
    return require_file(key, "generated external debug keystore")


def transformed_sample_gradle() -> tuple[str, list[dict[str, str]]]:
    text = (TEMPLATES / "sample-app-build.gradle").read_text(encoding="utf-8")
    replacements = (
        ("namespace 'org.procedurals.fieldmarks'", "namespace 'org.procedurals.pathmarks'", "namespace"),
        ("applicationId 'org.procedurals.fieldmarks'", "applicationId 'org.procedurals.pathmarks'", "applicationId"),
        ("versionCode 1", "versionCode 2", "versionCode"),
        ("versionName '0.1.0'", "versionName '0.2.0'", "versionName"),
    )
    recorded = []
    for old, new, label in replacements:
        if text.count(old) != 1:
            raise RuntimeError("sample Gradle template has unexpected " + label + " occurrence")
        text = text.replace(old, new)
        recorded.append({"field": label, "from": old, "to": new})
    if "org.procedurals.fieldmarks" in text or "versionCode 1" in text or "versionName '0.1.0'" in text:
        raise RuntimeError("sample Gradle template retains FieldMarks/0.1 metadata")
    return text, recorded


def starter_readme() -> str:
    return f"""# Procedurals Android PathMarks starter

This editable API-29+ PathMarks project contains the portable core and Android adapter
JARs used by its build. Processing Android Mode's runtime remains external and is not
bundled in this ZIP. Use Java 17, SDK platform 33, build-tools 30.0.3, and Gradle 7.4.2.
Set `JAVA_HOME` to your Java 17 installation and configure the SDK through
`ANDROID_HOME` and the project-local `local.properties` file:

```sh
export JAVA_HOME=/absolute/path/to/jdk-17
export ANDROID_HOME=/absolute/path/to/android-sdk
printf 'sdk.dir=%s\\n' "$ANDROID_HOME" > local.properties
```

Download pinned Processing Android Mode 4.6.0 (`android-412`):

- {PROCESSING_RELEASE_URL}
- AndroidMode-412.zip SHA-256: `{PROCESSING_RELEASE_SHA256}`
- `AndroidMode/processing-core.zip` SHA-256: `{PROCESSING_CORE_SHA256}`

Verify the archive and extracted core hashes. Then copy the extracted core byte-for-byte
to a filename ending in `.jar`, because Android Gradle Plugin does not place a `.zip`
dependency on the Java classpath:

```sh
cp /path/to/AndroidMode/processing-core.zip /absolute/path/processing-core.jar
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
```

The command intentionally omits `-PdebugKeystore`: Android Gradle Plugin creates or
uses its ordinary local debug key. The starter does not include a signing key.

The starter includes four editable Java sources: `PathMarksActivity.java`,
`PathMarksRenderer.java`, shared `PathMarkComposition.java`, and `GalleryWriter.java`.
Mode, mark length, and palette retain paths; count and distance rebuild them. Save writes
the currently displayed cached PNG. Fixed canvas culling affects only submitted drawing
segments and leaves generated movement unchanged.

This package compile check does not install an APK, render, or establish Android runtime
support. See `docs/path-marks.md` in the repository for provenance and validation scope.
"""


def source_targets(stage: Path) -> dict[Path, Path]:
    pathmarks = stage / "app/src/main/java/org/procedurals/examples/pathmarks"
    fieldmarks = stage / "app/src/main/java/org/procedurals/examples/fieldmarks"
    return {
        EXAMPLE / "PathMarksActivity.java": pathmarks / "PathMarksActivity.java",
        EXAMPLE / "PathMarksRenderer.java": pathmarks / "PathMarksRenderer.java",
        COMPOSITION: pathmarks / "PathMarkComposition.java",
        GALLERY: fieldmarks / "GalleryWriter.java",
    }


def stage_starter(stage: Path, core: Path, adapter: Path) -> tuple[dict[str, str], list[dict[str, str]]]:
    write_project_base(stage, "ProceduralsPathMarks", "app")
    app_gradle, transformations = transformed_sample_gradle()
    write(stage / "app/build.gradle", app_gradle)
    copy(EXAMPLE / "AndroidManifest.xml", stage / "app/src/main/AndroidManifest.xml")
    for source, target in source_targets(stage).items():
        copy(source, target)
    copy(core, stage / "app/libs/procedurals-core.jar")
    copy(adapter, stage / "app/libs/procedurals-android.jar")
    for notice in NOTICES:
        copy(notice, stage / notice.name)
    write(stage / "README.md", starter_readme())
    bindings = {}
    for source, target in source_targets(stage).items():
        if digest(source) != digest(target):
            raise RuntimeError("starter source was not copied byte-exactly: " + relative(source))
        bindings[relative(source)] = digest(source)
    if digest(EXAMPLE / "AndroidManifest.xml") != digest(stage / "app/src/main/AndroidManifest.xml"):
        raise RuntimeError("starter Android manifest was not copied byte-exactly")
    return bindings, transformations


def no_forbidden_zip_entries(entries: list[dict[str, str]]) -> None:
    names = [entry["path"] for entry in entries]
    forbidden = [name for name in names if (
        "/build/" in name or "/.gradle/" in name or name.endswith("debug.keystore")
        or name.endswith("local.properties") or "processing-core" in name.lower()
        or name.startswith(STARTER_ROOT + "/sdk/") or name.startswith(STARTER_ROOT + "/runtime/")
    )]
    if forbidden:
        raise RuntimeError("SDK, runtime, signing, or build output leaked into starter ZIP: " + ", ".join(forbidden))


def verify_java_core(core: Path, consumer: Path, java_home: Path, env: dict[str, str]) -> str:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    case = next(item for item in fixture["cases"] if item["id"] == "evolving-field")
    source = consumer / "InstalledPathSmoke.java"
    classes = consumer / "consumer-classes"
    classes.mkdir()
    write(source, consumer_source(case))
    run([java_home / "bin/javac", "--release", "8", "-cp", core, "-d", classes, source], cwd=consumer, env=env)
    result = run([java_home / "bin/java", "-cp", str(classes) + os.pathsep + str(core),
                  "InstalledPathSmoke", core], cwd=consumer, env=env)
    # java.io.File#toURI().toURL().toString() uses `file:/absolute/path`; Python's
    # Path.as_uri() uses the equivalent but differently spelled `file:///` form.
    expected = "file:" + str(core.resolve())
    actual = result.stdout.strip().removeprefix("code_source=")
    if actual != expected:
        raise RuntimeError("fixture core origin is not the extracted starter core JAR: " + actual)
    return case["id"]


def source_hashes(paths: list[Path]) -> dict[str, str]:
    return {relative(path): digest(path) for path in paths}


def ensure_new(output: Path, evidence: Path) -> None:
    if output.exists():
        raise RuntimeError("CP2 Android output already exists; preserve it rather than overwrite")
    if evidence.exists():
        raise RuntimeError("CP2 Android distribution evidence already exists; preserve it rather than overwrite")


def require_accepted_android_review() -> dict[str, object]:
    review = json.loads(ANDROID_REVIEW.read_text(encoding="utf-8"))
    if review.get("status") != "accepted":
        raise RuntimeError("CP2 Android review is not accepted")
    for group in ("evidence_sha256", "implementation_sha256", "recovery_tool_sha256"):
        values = review.get(group)
        if not isinstance(values, dict):
            raise RuntimeError("CP2 Android review lacks " + group)
        for name, expected in values.items():
            path = ROOT / name
            if not path.is_file() or digest(path) != expected:
                raise RuntimeError("CP2 Android review binding changed: " + name)
    return review


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="assemble artifacts and compile only the extracted starter")
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--sdk", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--gradle", type=Path, default=DEFAULT_GRADLE)
    parser.add_argument("--processing-core", type=Path, default=DEFAULT_PROCESSING_CORE)
    parser.add_argument("--debug-keystore", type=Path,
                        help="external keystore matching the starter template's procedurals-debug credentials")
    parser.add_argument("--core-jar", type=Path, default=CORE)
    args = parser.parse_args()
    if not args.build:
        print(json.dumps({"prepared": True, "required_command": "tools/build_path_marks_android.py --build",
                          "scope": "no build, install, launch, render, or Android acceptance action"}, sort_keys=True))
        return 0

    output = OUTPUT.resolve()
    evidence = EVIDENCE.resolve()
    ensure_new(output, evidence)
    java_home = require_dir(args.java_home, "Java home")
    sdk = require_dir(args.sdk, "Android SDK")
    gradle = require_file(args.gradle, "Gradle executable")
    processing_core = require_file(args.processing_core, "Processing Android core")
    debug_keystore = require_file(args.debug_keystore, "external debug keystore") if args.debug_keystore else None
    core = require_file(args.core_jar, "CP2 portable core JAR")
    require_file(sdk / "platforms/android-33/android.jar", "Android SDK platform 33")
    require_file(sdk / "build-tools/30.0.3/aapt2", "Android build-tools 30.0.3")
    java_report = json.loads(JAVA_EVIDENCE.read_text(encoding="utf-8"))
    if java_report.get("status") != "passed" or java_report.get("package_version") != VERSION:
        raise RuntimeError("CP2 Java consumer evidence is not a passed 0.2.0 core build")
    if java_report.get("artifacts", {}).get("core", {}).get("sha256") != digest(core):
        raise RuntimeError("provided core JAR does not match CP2 Java consumer evidence")
    android_review = require_accepted_android_review()
    if len(ADAPTER_SOURCES) != 4:
        raise RuntimeError("legacy Android adapter boundary no longer has four Java sources")

    app_sources = list(source_targets(Path("staging-placeholder")).keys())
    inputs = [Path(__file__).resolve(), JAVA_EVIDENCE, core, processing_core,
              sdk / "platforms/android-33/android.jar", sdk / "build-tools/30.0.3/source.properties",
              gradle, FIXTURE, EXAMPLE / "AndroidManifest.xml", EXAMPLE / "README.md", ANDROID_REVIEW, *app_sources,
              *ADAPTER_SOURCES, *NOTICES, *files(TEMPLATES), ROOT / "tools/build_android_artifacts.py",
              ROOT / "tools/build_path_marks_java.py", ROOT / "design/cp2-distribution-plan.md"]
    if debug_keystore is not None:
        inputs.append(debug_keystore)
    before = source_hashes(inputs)
    output.mkdir(parents=True)
    build = output / "build"
    gradle_cache = output / "gradle-cache"
    android_user_home = output / "android-user-home"
    gradle_cache.mkdir()
    android_user_home.mkdir()
    env = {**os.environ, "JAVA_HOME": str(java_home), "GRADLE_USER_HOME": str(gradle_cache),
           "ANDROID_USER_HOME": str(android_user_home), "XDG_CACHE_HOME": str(output / "xdg-cache")}
    external_processing = normalized_processing_core(processing_core, build)
    if debug_keystore is None:
        debug_keystore = generated_debug_key(build, java_home, env)

    adapter_stage = build / "adapter-project"
    adapter_module = adapter_project(adapter_stage, core, processing_core)
    write(adapter_stage / "local.properties", "sdk.dir=" + str(sdk) + "\n")
    run([gradle, "--no-daemon", "--console=plain", ":adapter:assembleRelease"], cwd=adapter_stage, env=env)
    aar = require_file(adapter_module / "build/outputs/aar/adapter-release.aar", "compiled Android adapter AAR")
    adapter_classes = build / "adapter-classes"
    with zipfile.ZipFile(aar) as archive:
        archive.extract("classes.jar", adapter_classes)
    with zipfile.ZipFile(adapter_classes / "classes.jar") as archive:
        archive.extractall(adapter_classes / "jar")
    for notice in NOTICES:
        copy(notice, adapter_classes / "jar/META-INF" / notice.name)
    adapter = output / "procedurals-android-0.2.0.jar"
    with zipfile.ZipFile(adapter, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files(adapter_classes / "jar"):
            archive.write(path, path.relative_to(adapter_classes / "jar"))

    staged = build / STARTER_ROOT
    source_bindings, transformations = stage_starter(staged, core, adapter)
    starter = output / "procedurals-path-marks-android-0.2.0.zip"
    zip_tree(staged, starter)
    starter_entries = zip_manifest(starter)
    no_forbidden_zip_entries(starter_entries)

    consumer = build / "consumer"
    with zipfile.ZipFile(starter) as archive:
        archive.extractall(consumer)
    extracted = consumer / STARTER_ROOT
    for source, target in source_targets(extracted).items():
        if digest(source) != digest(target):
            raise RuntimeError("extracted starter source differs from original: " + relative(source))
    extracted_core = extracted / "app/libs/procedurals-core.jar"
    extracted_adapter = extracted / "app/libs/procedurals-android.jar"
    if digest(extracted_core) != digest(core) or digest(extracted_adapter) != digest(adapter):
        raise RuntimeError("extracted starter JAR bytes differ from distributed artifacts")
    for notice in NOTICES:
        if digest(extracted / notice.name) != digest(notice):
            raise RuntimeError("extracted starter notice differs: " + notice.name)
    fixture_id = verify_java_core(extracted_core, consumer, java_home, env)
    write(extracted / "local.properties", "sdk.dir=" + str(sdk) + "\n")
    run([gradle, "--no-daemon", "--console=plain", ":app:assembleDebug",
         "-PprocessingCore=" + str(external_processing), "-PdebugKeystore=" + str(debug_keystore)], cwd=extracted, env=env)
    apk = require_file(extracted / "app/build/outputs/apk/debug/app-debug.apk", "extracted starter debug APK")

    after = source_hashes(inputs)
    if before != after:
        raise RuntimeError("CP2 Android distribution inputs changed during assembly")
    report = {
        "status": "passed",
        "package_version": VERSION,
        "scope": "Android adapter JAR and extracted PathMarks starter compile only; no install, launch, native render, or Android capability acceptance",
        "input_sha256": before,
        "artifacts": {
            "core": {"path": relative(core), "sha256": digest(core)},
            "adapter": {"path": relative(adapter), "sha256": digest(adapter), "entries": zip_manifest(adapter)},
            "starter": {"path": relative(starter), "sha256": digest(starter), "entries": starter_entries},
        },
        "starter_transformations": transformations,
        "starter_sources_byte_exact": source_bindings,
        "consumer": {
            "fixture": fixture_id,
            "fixture_output_passed": True,
            "extracted_core_origin_passed": True,
            "extracted_core_byte_exact": True,
            "extracted_adapter_byte_exact": True,
            "all_four_sources_byte_exact": True,
            "external_processing_core": {"path": relative(external_processing), "sha256": digest(external_processing)},
            "external_sdk": str(sdk),
            "external_debug_keystore": str(debug_keystore),
            "debug_keystore_provenance": "task-local generated external key" if args.debug_keystore is None else "caller-supplied external key",
            "compiled_apk_sha256": digest(apk),
        },
        "zip_exclusions": {"processing_runtime": True, "sdk": True, "debug_key": True, "build_output": True},
        "native_review": {"path": relative(ANDROID_REVIEW), "sha256": digest(ANDROID_REVIEW),
                          "status": android_review["status"],
                          "scope": "bound supplemental native/recovery review; this package build does not add runtime evidence"},
        "environment": {
            "java_home": str(java_home), "gradle": str(gradle), "gradle_sha256": digest(gradle),
            "sdk_platform": 33, "build_tools": "30.0.3", "gradle_cache": str(gradle_cache),
            "android_user_home": str(android_user_home),
        },
    }
    write(output / "build-result.json", json.dumps(report, indent=2, sort_keys=True) + "\n")
    write(evidence, json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": "passed", "starter": relative(starter), "evidence": relative(evidence)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
