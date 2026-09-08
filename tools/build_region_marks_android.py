#!/usr/bin/env python3
"""Build the local Android RegionMarks 0.4.0 starter and compile its ZIP."""
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

from build_android_artifacts import (DEFAULT_GRADLE, DEFAULT_JAVA_HOME, DEFAULT_PROCESSING_CORE,
    DEFAULT_SDK, NOTICES, TEMPLATES, PROCESSING_CORE_SHA256, PROCESSING_RELEASE_SHA256,
    PROCESSING_RELEASE_URL, copy, files, replace_template, require_dir, require_file,
    write_project_base, zip_manifest)

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.4.0"
OUTPUT = ROOT / ".work/dist/cp4/android-region1"
CORE = ROOT / ".work/dist/cp4/java/procedurals-core-0.4.0.jar"
ADAPTER = ROOT / ".work/dist/cp2/android/procedurals-android-0.2.0.jar"
CORE_EVIDENCE = ROOT / "evidence/distribution/cp4-java.json"
ADAPTER_EVIDENCE = ROOT / "evidence/distribution/cp2-android.json"
EXAMPLE = ROOT / "packages/java-android/examples/RegionMarks"
COMPOSITION = ROOT / "packages/java/examples/RegionMarks/RegionComposition.java"
GALLERY = ROOT / "packages/java-android/examples/FieldMarks/GalleryWriter.java"
STARTER_ROOT = "procedurals-region-marks-android"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def run(command: list[Path | str], *, cwd: Path, env: dict[str, str], timeout: int = 300) -> str:
    result = subprocess.run([str(value) for value in command], cwd=cwd, env=env,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=timeout)
    if result.returncode:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" + result.stdout)
    return result.stdout


def source_hashes(paths: list[Path]) -> dict[str, str]:
    return {display(path): digest(path) for path in paths}


def zip_tree(source: Path, archive: Path) -> None:
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as result:
        for path in files(source):
            result.write(path, str(Path(STARTER_ROOT) / path.relative_to(source)))


def transformed_gradle() -> tuple[str, list[dict[str, str]]]:
    text = (TEMPLATES / "sample-app-build.gradle").read_text(encoding="utf-8")
    replacements = (("namespace 'org.procedurals.fieldmarks'", "namespace 'org.procedurals.regionmarks'", "namespace"),
                    ("applicationId 'org.procedurals.fieldmarks'", "applicationId 'org.procedurals.regionmarks'", "applicationId"),
                    ("versionCode 1", "versionCode 4", "versionCode"),
                    ("versionName '0.1.0'", "versionName '0.4.0'", "versionName"))
    records = []
    for old, new, label in replacements:
        if text.count(old) != 1:
            raise RuntimeError("unexpected Gradle template " + label)
        text = text.replace(old, new)
        records.append({"field": label, "from": old, "to": new})
    return text, records


def starter_readme() -> str:
    return f"""# Procedurals Android RegionMarks starter

This API-29+ project contains the editable RegionMarks Activity and Renderer,
the shared RegionComposition, and GalleryWriter. The portable core and Android
adapter are local JARs in `app/libs`; Processing Android runtime remains external.

Use Java 17, Android SDK platform 33/build-tools 30.0.3, and Gradle 7.4.2.
Set JAVA_HOME to your JDK17 installation and ANDROID_HOME to your SDK location,
or create local.properties in this project containing sdk.dir=/absolute/path/to/sdk.
Android Gradle Plugin uses its ordinary local debug key; no signing key is bundled.
Copy
Processing Android Mode's `AndroidMode/processing-core.zip` byte-for-byte to a local
`.jar` path, then compile with:

```sh
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
```

The ZIP contains no Processing runtime, SDK, signing key, `local.properties`, or build
outputs. This is a packaging compile check; it does not establish Android runtime or
renderer support acceptance.

Seed, Splits and Selection rebuild the seeded quadrant partition; Source switches
to an authored partition. Seed/Splits/Selection are ignored for authored regions.
Motif and Palette reuse the retained regions. Save PNG writes the displayed image
to Pictures/Procedurals.
These settings describe the example, not recommended library parameter ranges.

Pinned Processing Android Mode: {PROCESSING_RELEASE_URL}
Archive SHA-256: `{PROCESSING_RELEASE_SHA256}`
Extracted `AndroidMode/processing-core.zip` SHA-256: `{PROCESSING_CORE_SHA256}`
"""


def stage_project(stage: Path, core: Path, adapter: Path) -> tuple[dict[str, str], list[dict[str, str]]]:
    write_project_base(stage, "ProceduralsRegionMarks", "app")
    gradle, transformations = transformed_gradle()
    (stage / "app").mkdir(parents=True, exist_ok=True)
    (stage / "app/build.gradle").write_text(gradle, encoding="utf-8")
    copy(EXAMPLE / "AndroidManifest.xml", stage / "app/src/main/AndroidManifest.xml")
    java = stage / "app/src/main/java"
    targets = {
        EXAMPLE / "RegionMarksActivity.java": java / "org/procedurals/examples/regionmarks/RegionMarksActivity.java",
        EXAMPLE / "RegionMarksRenderer.java": java / "org/procedurals/examples/regionmarks/RegionMarksRenderer.java",
        COMPOSITION: java / "org/procedurals/examples/regionmarks/RegionComposition.java",
        GALLERY: java / "org/procedurals/examples/fieldmarks/GalleryWriter.java",
    }
    for source, target in targets.items(): copy(source, target)
    copy(core, stage / "app/libs/procedurals-core.jar")
    copy(adapter, stage / "app/libs/procedurals-android.jar")
    for notice in NOTICES: copy(notice, stage / notice.name)
    (stage / "README.md").write_text(starter_readme(), encoding="utf-8")
    bindings = {display(source): digest(source) for source, target in targets.items()}
    bindings[display(EXAMPLE / "AndroidManifest.xml")] = digest(EXAMPLE / "AndroidManifest.xml")
    for source, target in targets.items():
        if digest(source) != digest(target): raise RuntimeError("source copy changed: " + display(source))
    return bindings, transformations


def generated_key(path: Path, java: Path, env: dict[str, str]) -> Path:
    run([java / "bin/keytool", "-genkeypair", "-keystore", path, "-storepass", "procedurals-local-debug",
         "-keypass", "procedurals-local-debug", "-alias", "procedurals-debug", "-keyalg", "RSA",
         "-keysize", "2048", "-validity", "10000", "-dname", "CN=Procedurals Local Debug", "-noprompt"],
        cwd=path.parent, env=env, timeout=120)
    return require_file(path, "generated debug keystore")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--sdk", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--gradle", type=Path, default=DEFAULT_GRADLE)
    parser.add_argument("--processing-core", type=Path, default=DEFAULT_PROCESSING_CORE)
    parser.add_argument("--core-jar", type=Path, default=CORE)
    parser.add_argument("--adapter-jar", type=Path, default=ADAPTER)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists(): raise RuntimeError("refusing occupied output: " + display(output))
    try: output.relative_to((ROOT / ".work/dist/cp4").resolve())
    except ValueError as error: raise ValueError("output must remain under .work/dist/cp4") from error
    output.mkdir(parents=True)
    java = require_dir(args.java_home, "Java home"); sdk = require_dir(args.sdk, "Android SDK")
    gradle = require_file(args.gradle, "Gradle"); processing = require_file(args.processing_core, "Processing core")
    core = require_file(args.core_jar, "CP4 core JAR"); adapter = require_file(args.adapter_jar, "CP2 adapter JAR")
    require_file(sdk / "platforms/android-33/android.jar", "Android API 33")
    require_file(sdk / "build-tools/30.0.3/aapt2", "Android build-tools")
    core_doc = json.loads(CORE_EVIDENCE.read_text()); adapter_doc = json.loads(ADAPTER_EVIDENCE.read_text())
    if core_doc.get('status') != 'passed' or core_doc.get('package_version') != VERSION or adapter_doc.get('status') != 'passed': raise RuntimeError("distribution evidence is not passed")
    core_record = core_doc['artifacts']['core']; adapter_record = adapter_doc['artifacts']['adapter']
    if core_record['sha256'] != digest(core) or adapter_record['sha256'] != digest(adapter): raise RuntimeError("provided JAR does not match accepted distribution evidence")
    if digest(processing) != PROCESSING_CORE_SHA256: raise RuntimeError("Processing core does not match pinned SHA-256")
    inputs = [Path(__file__).resolve(), CORE_EVIDENCE, ADAPTER_EVIDENCE, core, adapter, processing, gradle,
              sdk / "platforms/android-33/android.jar", sdk / "build-tools/30.0.3/aapt2", sdk / "build-tools/30.0.3/source.properties", EXAMPLE / "AndroidManifest.xml", EXAMPLE / "README.md",
              EXAMPLE / "RegionMarksActivity.java", EXAMPLE / "RegionMarksRenderer.java", COMPOSITION, GALLERY,
              *NOTICES, *files(TEMPLATES), ROOT / "tools/build_android_artifacts.py"]
    inputs += [java / "release", java / "lib/modules", java / "bin/java", java / "bin/javac", *files(gradle.parent.parent / "lib")]
    before = source_hashes(inputs)
    build = output / "build"; build.mkdir(); cache = ROOT / ".work/environments/android/gradle"; cache.mkdir(parents=True, exist_ok=True); user = ROOT / ".work/environments/android/user"; user.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "JAVA_HOME": str(java), "GRADLE_USER_HOME": str(cache), "ANDROID_USER_HOME": str(user)}
    external = build / "external/processing-core.jar"; copy(processing, external)
    key = generated_key(build / "external/debug.keystore", java, env)
    staged = build / STARTER_ROOT; bindings, transformations = stage_project(staged, core, adapter)
    zip_path = output / f"procedurals-region-marks-android-{VERSION}.zip"; zip_tree(staged, zip_path)
    entries = zip_manifest(zip_path)
    forbidden = [e['path'] for e in entries if any(x in e['path'].lower() for x in ('processing-core', 'local.properties', 'debug.keystore', '/build/', '/.gradle/'))]
    if forbidden: raise RuntimeError("forbidden build/runtime payload in ZIP: " + ", ".join(forbidden))
    consumer = build / "consumer"; consumer.mkdir()
    with zipfile.ZipFile(zip_path) as archive: archive.extractall(consumer)
    extracted = consumer / STARTER_ROOT
    extracted_entries = [{"path": str(path.relative_to(extracted)).replace(os.sep, "/"), "sha256": digest(path)} for path in files(extracted)]
    expected_entries = [{"path": entry["path"].removeprefix(STARTER_ROOT + "/"), "sha256": entry["sha256"]} for entry in entries]
    if extracted_entries != expected_entries: raise RuntimeError("ZIP manifest differs from extracted starter")
    for source, target in {EXAMPLE / "RegionMarksActivity.java": extracted / "app/src/main/java/org/procedurals/examples/regionmarks/RegionMarksActivity.java", EXAMPLE / "RegionMarksRenderer.java": extracted / "app/src/main/java/org/procedurals/examples/regionmarks/RegionMarksRenderer.java", COMPOSITION: extracted / "app/src/main/java/org/procedurals/examples/regionmarks/RegionComposition.java", GALLERY: extracted / "app/src/main/java/org/procedurals/examples/fieldmarks/GalleryWriter.java"}.items():
        if digest(source) != digest(target): raise RuntimeError("extracted source changed: " + display(source))
    if digest(extracted / "app/libs/procedurals-core.jar") != digest(core) or digest(extracted / "app/libs/procedurals-android.jar") != digest(adapter): raise RuntimeError("extracted JAR changed")
    (extracted / "local.properties").write_text("sdk.dir=" + str(sdk) + "\n")
    run([gradle, "--no-daemon", "--console=plain", ":app:assembleDebug", "-PprocessingCore=" + str(external), "-PdebugKeystore=" + str(key)], cwd=extracted, env=env, timeout=600)
    apk = require_file(extracted / "app/build/outputs/apk/debug/app-debug.apk", "compiled APK")
    after = source_hashes(inputs)
    if before != after: raise RuntimeError("inputs changed during build")
    report = {"status":"passed", "package_version":VERSION, "scope":"Android RegionMarks starter packaging and extracted debug APK compilation only; no install, launch, render, or Android support acceptance", "input_sha256_before":before, "input_sha256_after":after, "artifacts":{"starter":{"path":display(zip_path),"sha256":digest(zip_path),"entries":entries},"core":{"path":display(core),"sha256":digest(core)},"adapter":{"path":display(adapter),"sha256":digest(adapter)}}, "starter_sources_byte_exact":bindings, "starter_transformations":transformations, "consumer":{"extracted_core_byte_exact":True,"extracted_adapter_byte_exact":True,"compiled_apk_sha256":digest(apk),"external_processing_core":{"path":display(external),"sha256":digest(external)},"external_sdk":display(sdk)}, "zip_exclusions":{"processing_runtime":True,"sdk":True,"debug_key":True,"build_output":True}, "environment":{"java_home":display(java),"gradle":display(gradle),"sdk_platform":33,"build_tools":"30.0.3"}}
    (output / "build-result.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status":"passed","starter":display(zip_path),"apk_sha256":digest(apk)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
