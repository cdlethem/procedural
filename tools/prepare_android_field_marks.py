#!/usr/bin/env python3
"""Prepare the ordinary Android Field Marks Gradle project; --build compiles only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP = ROOT / "tests/native/android-bootstrap"
EXAMPLE = ROOT / "packages/java-android/examples/FieldMarks"
MARK_FIELD = ROOT / "packages/java/examples/FieldMarks/MarkField.java"
CORE = ROOT / ".work/toolchains/android/mode-412/AndroidMode/processing-core.zip"
SDK = ROOT / ".work/toolchains/android/sdk"
GRADLE = ROOT / ".work/toolchains/android/gradle-7.4.2/bin/gradle"
KEYSTORE = ROOT / ".work/environments/android/bootstrap/debug.keystore"
DEFAULT_STAGE = ROOT / ".work/examples/android-field-marks"
DEFAULT_APPLICATION_ID = "org.procedurals.fieldmarks"
DEFAULT_ACTIVITY = "org.procedurals.examples.fieldmarks.FieldMarksActivity"
EXAMPLE_JAVA = ("FieldMarksActivity.java", "FieldMarksRenderer.java", "GalleryWriter.java")
PACKAGE = "org.procedurals.examples.fieldmarks"


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _display(path):
    path = Path(path).resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _hashes(paths):
    return {_display(path): sha256(path) for path in paths}


def _require_file(path):
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError("Required Field Marks input is missing: " + str(path))
    return path.resolve()


def _replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise RuntimeError("Unexpected " + label + " template")
    return text.replace(old, new)


def _source_inputs(extra_sources):
    extra = tuple(_require_file(path) for path in extra_sources)
    core_sources = tuple(sorted((ROOT / "packages/java/src/main/java").rglob("*.java")))
    adapter_sources = tuple(sorted((ROOT / "packages/java-android/src/main/java").rglob("*.java")))
    examples = tuple(_require_file(EXAMPLE / name) for name in EXAMPLE_JAVA)
    sources = (*core_sources, *adapter_sources, *examples, _require_file(MARK_FIELD), *extra)
    names = set()
    for source in sources:
        if source.name in names:
            raise RuntimeError("Duplicate staged Java filename: " + source.name)
        names.add(source.name)
    return sources


def _template_inputs():
    return tuple(sorted(path for path in BOOTSTRAP.rglob("*") if path.is_file())) + (
        _require_file(EXAMPLE / "AndroidManifest.xml"),
        _require_file(EXAMPLE / "README.md"),
        _require_file(CORE),
        _require_file(KEYSTORE),
        _require_file(SDK / "platforms/android-33/android.jar"),
        _require_file(GRADLE),
        Path(__file__).resolve(),
    )


def _staged_project_hashes(stage):
    staged = stage / "app/src/main/java"
    paths = [*sorted(staged.glob("*.java")),
             stage / "app/build.gradle", stage / "app/src/main/AndroidManifest.xml",
             stage / "app/libs/processing-core.jar", stage / "build.gradle",
             stage / "settings.gradle", stage / "gradle.properties", stage / "debug.keystore",
             stage / "local.properties"]
    return {str(path.relative_to(stage)): sha256(path) for path in paths}


def _stage_template(stage, application_id, activity_class):
    for source in sorted(path for path in BOOTSTRAP.rglob("*") if path.is_file()):
        target = stage / source.relative_to(BOOTSTRAP)
        target.parent.mkdir(parents=True, exist_ok=True)
        text = source.read_text()
        if source.name == "build.gradle" and source.parent.name == "app":
            text = _replace_once(text, "applicationId 'org.procedurals.bootstrap'",
                                 "applicationId '" + application_id + "'", "application id")
            text = _replace_once(text, "minSdkVersion 23", "minSdkVersion 29", "minimum SDK")
        target.write_text(text)
    manifest = (EXAMPLE / "AndroidManifest.xml").read_text()
    manifest = _replace_once(manifest, 'package="' + DEFAULT_APPLICATION_ID + '"',
                             'package="' + application_id + '"', "example manifest package")
    manifest = _replace_once(manifest, 'android:name="' + DEFAULT_ACTIVITY + '"',
                             'android:name="' + activity_class + '"', "example manifest activity")
    target = stage / "app/src/main/AndroidManifest.xml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(manifest)


def prepare(stage=DEFAULT_STAGE, application_id=DEFAULT_APPLICATION_ID,
            activity_class=DEFAULT_ACTIVITY, extra_sources=()):
    """Stage the ordinary example or a derived native-test app without compiling it.

    ``extra_sources`` supplies additional Java files for a derived test app only. It does
    not alter the ordinary app's source list, manifest defaults, or runtime behavior.
    """
    if not isinstance(application_id, str) or not re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", application_id):
        raise ValueError("application_id must be a dotted Android package name")
    if not isinstance(activity_class, str) or not re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", activity_class):
        raise ValueError("activity_class must be a fully qualified Java class name")
    stage = Path(stage).resolve()
    if ROOT not in stage.parents:
        raise ValueError("stage must be inside this repository")
    sources = _source_inputs(extra_sources)
    templates = _template_inputs()
    original_hashes = _hashes((*sources, *templates))

    stage.mkdir(parents=True, exist_ok=True)
    _stage_template(stage, application_id, activity_class)
    java = stage / "app/src/main/java"
    java.mkdir(parents=True, exist_ok=True)
    for old in java.rglob("*.java"):
        old.unlink()
    for source in sources:
        target = java / source.name
        if source == MARK_FIELD.resolve():
            target.write_text("package " + PACKAGE + ";\n" + source.read_text())
        else:
            shutil.copyfile(source, target)
    libraries = stage / "app/libs"
    libraries.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CORE, libraries / "processing-core.jar")
    shutil.copyfile(KEYSTORE, stage / "debug.keystore")
    (stage / "local.properties").write_text("sdk.dir=" + str(SDK) + "\n")

    if original_hashes != _hashes((*sources, *templates)):
        raise RuntimeError("Field Marks inputs changed during preparation")
    staged = _staged_project_hashes(stage)
    metadata = {
        "stage": str(stage.relative_to(ROOT)),
        "application_id": application_id,
        "activity_class": activity_class,
        "source_hashes": original_hashes,
        "staged_project_sha256": staged,
        "dependencies": {
            "processing_core": _display(CORE),
            "android_sdk_jar": _display(SDK / "platforms/android-33/android.jar"),
            "gradle": _display(GRADLE),
            "appcompat": "androidx.appcompat:appcompat:1.6.0",
            "android_gradle_plugin": "7.1.0",
        },
    }
    (stage / ".procedurals-inputs.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def build(stage):
    """Compile a prepared project and return its debug APK path without launching it."""
    stage = Path(stage).resolve()
    metadata_path = stage / ".procedurals-inputs.json"
    if not metadata_path.is_file():
        raise RuntimeError("Prepare the Field Marks project before building it")
    metadata = json.loads(metadata_path.read_text())
    if _staged_project_hashes(stage) != metadata.get("staged_project_sha256"):
        raise RuntimeError("Prepared project inputs changed; prepare again before building")
    environment = dict(os.environ,
        JAVA_HOME=str(ROOT / ".work/toolchains/jdk-17.0.20.1+1"),
        ANDROID_USER_HOME=str(ROOT / ".work/environments/android/user"),
        GRADLE_USER_HOME=str(ROOT / ".work/environments/android/gradle"))
    with (stage / "build.log").open("w") as log:
        subprocess.run([str(GRADLE), "--no-daemon", "--console=plain", ":app:assembleDebug"],
                       cwd=stage, env=environment, stdout=log, stderr=subprocess.STDOUT, check=True)
    apk = stage / "app/build/outputs/apk/debug/app-debug.apk"
    if not apk.is_file():
        raise RuntimeError("Android Gradle build did not create the debug APK")
    return apk


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, default=DEFAULT_STAGE)
    parser.add_argument("--application-id", default=DEFAULT_APPLICATION_ID)
    parser.add_argument("--activity-class", default=DEFAULT_ACTIVITY)
    parser.add_argument("--build", action="store_true", help="compile the staged debug APK; never launches it")
    args = parser.parse_args()
    result = prepare(args.stage, args.application_id, args.activity_class)
    if args.build:
        apk = build(args.stage)
        result["apk"] = str(apk.relative_to(ROOT))
        result["apk_sha256"] = sha256(apk)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
