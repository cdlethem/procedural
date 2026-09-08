#!/usr/bin/env python3
"""Build local Android distribution artifacts without installing or rendering an APK."""
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
VERSION = "0.1.0"
ANDROID = ROOT / "packages/java-android"
TEMPLATES = ANDROID / "distribution/templates"
ADAPTER_SOURCES = tuple(sorted((ANDROID / "src/main/java").rglob("*.java")))
EXAMPLE = ANDROID / "examples/FieldMarks"
EXAMPLE_JAVA = ("FieldMarksActivity.java", "FieldMarksRenderer.java", "GalleryWriter.java")
MARK_FIELD = ROOT / "packages/java/examples/FieldMarks/MarkField.java"
NOTICES = (ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md")
DEFAULT_OUTPUT = ROOT / ".work/dist/android"
DEFAULT_JAVA_HOME = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
DEFAULT_SDK = ROOT / ".work/toolchains/android/sdk"
DEFAULT_GRADLE = ROOT / ".work/toolchains/android/gradle-7.4.2/bin/gradle"
DEFAULT_PROCESSING_CORE = ROOT / ".work/toolchains/android/mode-412/AndroidMode/processing-core.zip"
DEFAULT_CORE_JAR = ROOT / ".work/dist/java/procedurals-core-0.1.0.jar"
PROCESSING_RELEASE_URL = "https://github.com/processing/processing-android/releases/download/android-412/AndroidMode-412.zip"
PROCESSING_RELEASE_SHA256 = "b15418b1c8a7b20e21b407cba804f2777e2f5ddc9a28b1a5bfc3b9cba2ca992d"
PROCESSING_CORE_SHA256 = "0cdd89e2511a97728092619e89148b46a52700e5957d81f234db8fd3b1652338"


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def display(path):
    path = Path(path).resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def require_file(path, label):
    path = Path(path).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"{label} is missing: {path}")
    return path


def require_dir(path, label):
    path = Path(path).expanduser().resolve()
    if not path.is_dir():
        raise FileNotFoundError(f"{label} is missing: {path}")
    return path


def copy(source, target):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def write(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def run(command, *, cwd, env):
    result = subprocess.run([str(item) for item in command], cwd=cwd, env=env,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError("Command failed: " + " ".join(map(str, command)) + "\n" + result.stdout)
    return result.stdout


def replace_template(name, values):
    text = (TEMPLATES / name).read_text(encoding="utf-8")
    for key, value in values.items():
        token = "@" + key + "@"
        if text.count(token) != 1:
            raise RuntimeError(f"Template {name} must contain exactly one {token}")
        text = text.replace(token, value)
    if "@" in text:
        raise RuntimeError(f"Unreplaced template marker in {name}")
    return text


def files(root):
    return sorted(path for path in Path(root).rglob("*") if path.is_file())


def manifest(root, prefix=None):
    root = Path(root)
    prefix = Path(prefix) if prefix else root
    return [{"path": str(path.relative_to(prefix)).replace(os.sep, "/"), "sha256": sha256(path)}
            for path in files(root)]


def zip_manifest(path):
    with zipfile.ZipFile(path) as archive:
        return [{"path": entry.filename, "sha256": hashlib.sha256(archive.read(entry)).hexdigest()}
                for entry in sorted(archive.infolist(), key=lambda value: value.filename) if not entry.is_dir()]


def write_project_base(stage, project_name, module):
    write(stage / "settings.gradle", replace_template("settings.gradle", {"PROJECT_NAME": project_name, "MODULE": module}))
    copy(TEMPLATES / "build.gradle", stage / "build.gradle")
    copy(TEMPLATES / "gradle.properties", stage / "gradle.properties")


def adapter_project(stage, core_jar, processing_core):
    write_project_base(stage, "ProceduralsAndroidAdapter", "adapter")
    copy(TEMPLATES / "adapter-build.gradle", stage / "adapter/build.gradle")
    copy(TEMPLATES / "adapter-AndroidManifest.xml", stage / "adapter/src/main/AndroidManifest.xml")
    for source in ADAPTER_SOURCES:
        relative = source.relative_to(ANDROID / "src/main/java")
        copy(source, stage / "adapter/src/main/java" / relative)
    copy(core_jar, stage / "adapter/libs/procedurals-core.jar")
    copy(processing_core, stage / "adapter/libs/processing-core.jar")
    return stage / "adapter"


def prefixed_mark_field():
    text = MARK_FIELD.read_text(encoding="utf-8")
    if text.startswith("package "):
        raise RuntimeError("Original MarkField unexpectedly already declares a package")
    return "package org.procedurals.examples.fieldmarks;\n\n" + text


def sample_project(stage, core_jar, adapter_jar):
    write_project_base(stage, "ProceduralsFieldMarks", "app")
    copy(TEMPLATES / "sample-app-build.gradle", stage / "app/build.gradle")
    copy(EXAMPLE / "AndroidManifest.xml", stage / "app/src/main/AndroidManifest.xml")
    java_root = stage / "app/src/main/java/org/procedurals/examples/fieldmarks"
    for name in EXAMPLE_JAVA:
        copy(EXAMPLE / name, java_root / name)
    write(java_root / "MarkField.java", prefixed_mark_field())
    copy(core_jar, stage / "app/libs/procedurals-core.jar")
    copy(adapter_jar, stage / "app/libs/procedurals-android.jar")
    for notice in NOTICES:
        copy(notice, stage / notice.name)
    write(stage / "README.md", sample_readme())
    expected_paths = {java_root / name for name in (*EXAMPLE_JAVA, "MarkField.java")}
    actual_paths = set(path for path in files(stage) if path.suffix == ".java")
    if actual_paths != expected_paths:
        raise RuntimeError("Sample contains library/core source instead of exactly the four editable sources")
    return stage


def sample_readme():
    return f"""# Procedurals Android Field Marks starter

This starter contains editable Field Marks composition code and two local artifacts:
`app/libs/procedurals-core.jar` and `app/libs/procedurals-android.jar`. The Processing
Android runtime is intentionally external: it is not bundled in this source ZIP.

Install Android SDK platform 33 and build-tools 30.0.3, then use Gradle 7.4.2 with
Android Gradle Plugin 7.1.0. Processing Android Mode names its Java archive
`AndroidMode/processing-core.zip`; copy it byte-for-byte to a `.jar` filename before the
Gradle command (the SHA-256 remains the same):

```sh
cp AndroidMode/processing-core.zip /absolute/path/processing-core.jar
gradle -PprocessingCore=/absolute/path/processing-core.jar :app:assembleDebug
```

Alternatively, copy it to `app/libs/processing-core.jar`. The build rejects a `.zip`
path with this same instruction because AGP does not place `.zip` dependencies on the
Java classpath. The build accepts an explicit `-PprocessingCore` path and never requires
a checkout of Procedurals. Without a `-PdebugKeystore` override it uses Android Gradle
Plugin's ordinary local debug key.

Pinned Processing Android Mode 4.6.0 (`android-412`) archive:

- {PROCESSING_RELEASE_URL}
- AndroidMode-412.zip SHA-256: `{PROCESSING_RELEASE_SHA256}`
- extracted `AndroidMode/processing-core.zip` SHA-256: `{PROCESSING_CORE_SHA256}`

Verify the extracted core hash before use. AndroidX AppCompat is declared as
`androidx.appcompat:appcompat:1.6.0` through Google Maven. The debug key used by the
distribution build is task-local and deliberately absent; Android Gradle Plugin creates
or accepts a local debug signing configuration for your checkout.

This package is an editable example, not a new public operation or a claim of general
Android renderer support. It is API 29+; the pinned build compiles against API 33.
"""


def generated_debug_key(stage, java_home, env):
    keytool = java_home / "bin/keytool"
    require_file(keytool, "keytool")
    key = stage / "debug.keystore"
    run([keytool, "-genkeypair", "-keystore", key, "-storepass", "procedurals-local-debug",
         "-keypass", "procedurals-local-debug", "-alias", "procedurals-debug", "-keyalg", "RSA",
         "-keysize", "2048", "-validity", "10000", "-dname", "CN=Procedurals Local Debug", "-noprompt"],
        cwd=stage, env=env)
    return key


def clean_sample_for_zip(sample):
    for path in (sample / "build", sample / "app/build", sample / ".gradle", sample / "debug.keystore", sample / "local.properties"):
        if path.is_dir(): shutil.rmtree(path)
        else: path.unlink(missing_ok=True)


def zip_tree(source, archive, prefix):
    archive.unlink(missing_ok=True)
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as result:
        for path in files(source):
            result.write(path, str(Path(prefix) / path.relative_to(source)))


def resolved_appcompat(cache):
    matches = sorted(Path(cache).glob("caches/modules-2/files-2.1/androidx.appcompat/appcompat/1.6.0/*/appcompat-1.6.0.aar"))
    if len(matches) != 1:
        raise RuntimeError("Gradle did not resolve exactly one AppCompat 1.6.0 AAR")
    return matches[0]


def safe_output(path):
    path = Path(path).resolve()
    work = (ROOT / ".work").resolve()
    dist = (ROOT / "dist").resolve()
    if path != work and work not in path.parents and path != dist and dist not in path.parents:
        raise ValueError("output must remain under this checkout's ignored .work or dist directory")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--java-home", type=Path, default=DEFAULT_JAVA_HOME)
    parser.add_argument("--sdk", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--gradle", type=Path, default=DEFAULT_GRADLE)
    parser.add_argument("--processing-core", type=Path, default=DEFAULT_PROCESSING_CORE)
    parser.add_argument("--core-jar", type=Path, default=DEFAULT_CORE_JAR)
    parser.add_argument("--gradle-cache", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    output = safe_output(args.output)
    java_home = require_dir(args.java_home, "Java home")
    sdk = require_dir(args.sdk, "Android SDK")
    gradle = require_file(args.gradle, "Gradle executable")
    processing_core = require_file(args.processing_core, "Processing Android core")
    core_jar = require_file(args.core_jar, "Portable core JAR")
    require_file(sdk / "platforms/android-33/android.jar", "Android SDK platform 33")
    require_file(sdk / "build-tools/30.0.3/aapt2", "Android build-tools 30.0.3")
    if len(ADAPTER_SOURCES) != 4:
        raise RuntimeError("Android adapter source boundary is expected to contain exactly four Java files")

    build = output / "build"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir(parents=True)
    gradle_cache = (args.gradle_cache or output / "gradle-cache").expanduser().resolve()
    gradle_cache.mkdir(parents=True, exist_ok=True)
    android_user_home = output / "android-user-home"
    android_user_home.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "JAVA_HOME": str(java_home), "GRADLE_USER_HOME": str(gradle_cache),
           "ANDROID_USER_HOME": str(android_user_home)}
    external_processing_core = build / "external/processing-core.jar"
    copy(processing_core, external_processing_core)
    if sha256(external_processing_core) != sha256(processing_core):
        raise RuntimeError("Normalized external Processing core differs from supplied archive")
    source_inputs = [Path(__file__).resolve(), *ADAPTER_SOURCES, *(EXAMPLE / name for name in EXAMPLE_JAVA),
                     EXAMPLE / "AndroidManifest.xml", MARK_FIELD, *NOTICES, *files(TEMPLATES),
                     core_jar, processing_core, sdk / "platforms/android-33/android.jar",
                     sdk / "build-tools/30.0.3/source.properties"]
    input_hashes = {display(path): sha256(path) for path in source_inputs}

    adapter_stage = build / "adapter-project"
    adapter_module = adapter_project(adapter_stage, core_jar, processing_core)
    write(adapter_stage / "local.properties", "sdk.dir=" + str(sdk) + "\n")
    run([gradle, "--no-daemon", ":adapter:assembleRelease"], cwd=adapter_stage, env=env)
    aar_source = adapter_module / "build/outputs/aar/adapter-release.aar"
    require_file(aar_source, "Android adapter AAR")
    adapter_jar = output / f"procedurals-android-{VERSION}.jar"
    # The AAR is a Gradle intermediate. Ship the separately noticed JAR that the
    # sample actually consumes, not an un-noticed parallel artifact.
    (output / f"procedurals-android-{VERSION}.aar").unlink(missing_ok=True)
    adapter_contents = build / "adapter-classes"
    with zipfile.ZipFile(aar_source) as archive:
        archive.extract("classes.jar", adapter_contents)
    with zipfile.ZipFile(adapter_contents / "classes.jar") as archive:
        archive.extractall(adapter_contents / "jar")
    copy(ROOT / "LICENSE", adapter_contents / "jar/META-INF/LICENSE")
    copy(ROOT / "THIRD_PARTY_NOTICES.md", adapter_contents / "jar/META-INF/THIRD_PARTY_NOTICES.md")
    with zipfile.ZipFile(adapter_jar, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files(adapter_contents / "jar"):
            archive.write(path, str(path.relative_to(adapter_contents / "jar")))

    sample_stage = build / "field-marks-sample"
    sample_project(sample_stage, core_jar, adapter_jar)
    write(sample_stage / "local.properties", "sdk.dir=" + str(sdk) + "\n")
    key = generated_debug_key(sample_stage, java_home, env)
    run([gradle, "--no-daemon", ":app:assembleDebug", "-PprocessingCore=" + str(external_processing_core),
         "-PdebugKeystore=" + str(key)], cwd=sample_stage, env=env)
    apk_source = sample_stage / "app/build/outputs/apk/debug/app-debug.apk"
    require_file(apk_source, "Sample debug APK")
    apk = output / f"procedurals-field-marks-android-{VERSION}-debug.apk"
    copy(apk_source, apk)
    sample_core = sample_stage / "app/libs/procedurals-core.jar"
    sample_adapter = sample_stage / "app/libs/procedurals-android.jar"
    if sha256(sample_core) != sha256(core_jar) or sha256(sample_adapter) != sha256(adapter_jar):
        raise RuntimeError("Compiled sample did not consume byte-identical distributed JARs")
    if not key.is_file(): raise RuntimeError("Task-local debug key was not created")
    clean_sample_for_zip(sample_stage)
    zip_input_names = [str(path.relative_to(sample_stage)).replace(os.sep, "/") for path in files(sample_stage)]
    if any(path.name == "processing-core.jar" for path in files(sample_stage)):
        raise RuntimeError("Processing runtime core leaked into sample ZIP input")
    if any(name.startswith("app/build/") or "/.gradle/" in name or name.endswith("debug.keystore") for name in zip_input_names):
        raise RuntimeError("Generated build output, cache, or signing key leaked into sample ZIP input")
    sample_zip = output / f"procedurals-field-marks-android-{VERSION}.zip"
    zip_tree(sample_stage, sample_zip, "procedurals-field-marks-android")
    zip_consumer_root = build / "zip-consumer"
    with zipfile.ZipFile(sample_zip) as archive:
        archive.extractall(zip_consumer_root)
    zip_consumer = zip_consumer_root / "procedurals-field-marks-android"
    write(zip_consumer / "local.properties", "sdk.dir=" + str(sdk) + "\n")
    zip_key = generated_debug_key(zip_consumer, java_home, env)
    run([gradle, "--no-daemon", ":app:assembleDebug", "-PprocessingCore=" + str(external_processing_core),
         "-PdebugKeystore=" + str(zip_key)], cwd=zip_consumer, env=env)
    zip_apk = zip_consumer / "app/build/outputs/apk/debug/app-debug.apk"
    require_file(zip_apk, "Unpacked sample debug APK")
    appcompat = resolved_appcompat(gradle_cache)

    current_hashes = {display(path): sha256(path) for path in source_inputs}
    if input_hashes != current_hashes:
        raise RuntimeError("An Android distribution input changed during build")
    report = {
        "status": "passed",
        "scope": "Android adapter artifact and separate Field Marks sample APK compile only; no install, device run, renderer claim, or native render",
        "inputs_sha256": input_hashes,
        "environment": {"java_home": str(java_home), "java_version": run([java_home / "bin/java", "-version"], cwd=build, env=env),
                        "gradle": str(gradle), "gradle_sha256": sha256(gradle),
                        "gradle_version": run([gradle, "--version"], cwd=build, env=env),
                        "sdk": str(sdk), "sdk_platform": 33, "build_tools": "30.0.3",
                        "android_gradle_plugin": "7.1.0", "appcompat": "androidx.appcompat:appcompat:1.6.0",
                        "gradle_cache": str(gradle_cache), "android_user_home": str(android_user_home)},
        "resolved_dependencies": {"processing_core": {"path": display(processing_core), "sha256": sha256(processing_core)},
                                  "android_platform_33": {"path": display(sdk / "platforms/android-33/android.jar"),
                                                          "sha256": sha256(sdk / "platforms/android-33/android.jar")},
                                  "appcompat_1_6_0": {"path": display(appcompat), "sha256": sha256(appcompat)}},
        "artifacts": {
            "core_jar": {"path": display(core_jar), "sha256": sha256(core_jar)},
            "adapter_jar": {"path": display(adapter_jar), "sha256": sha256(adapter_jar)},
            "sample_apk": {"path": display(apk), "sha256": sha256(apk)},
            "sample_zip": {"path": display(sample_zip), "sha256": sha256(sample_zip), "entries": zip_manifest(sample_zip)},
        },
        "sample_consumption": {"core_jar_equal": sha256(sample_core) == sha256(core_jar),
                               "adapter_jar_equal": sha256(sample_adapter) == sha256(adapter_jar),
                               "sample_java": sorted(path.name for path in files(sample_stage / "app/src/main/java") if path.suffix == ".java"),
                               "processing_core_excluded_from_zip": True,
                               "task_local_debug_key_excluded_from_zip": True,
                               "unpacked_zip_external_processing_core_apk_sha256": sha256(zip_apk)},
        "pinned_processing": {"release_url": PROCESSING_RELEASE_URL, "release_sha256": PROCESSING_RELEASE_SHA256,
                              "core_sha256": PROCESSING_CORE_SHA256, "provided_core_sha256": sha256(processing_core),
                              "normalized_external_core_sha256": sha256(external_processing_core)},
        "manifests": {"adapter_source": manifest(adapter_module / "src"),
                      "adapter_jar": zip_manifest(adapter_jar),
                      "sample_zip_input": manifest(sample_stage)},
    }
    output.mkdir(parents=True, exist_ok=True)
    result = output / "build-result.json"
    result.write_text(json.dumps(report, indent=2) + "\n")
    evidence = ROOT / "evidence/distribution/android.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"adapter_jar": display(adapter_jar), "sample_zip": display(sample_zip),
                      "sample_apk": display(apk), "result": display(result), "evidence": display(evidence)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
