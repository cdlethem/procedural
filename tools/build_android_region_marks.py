#!/usr/bin/env python3
"""Stage or compile the Android RegionMarks example; never install, launch, or render it."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
# Toolchains and the debug keystore live in a pinned task-local .work area. In the
# main checkout that is this repository's own .work; a porting checkout points
# PROCEDURALS_WORK at the shared machine area holding the Android SDK.
WORK = Path(os.environ.get("PROCEDURALS_WORK", str(ROOT / ".work")))
BOOTSTRAP = ROOT / "tests/native/android-bootstrap"
EXAMPLE = ROOT / "packages/java-android/examples/RegionMarks"
COMPOSITION = ROOT / "packages/java/examples/RegionMarks/RegionComposition.java"
GALLERY = ROOT / "packages/java-android/examples/FieldMarks/GalleryWriter.java"
CORE = WORK / "toolchains/android/mode-412/AndroidMode/processing-core.zip"
SDK = WORK / "toolchains/android/sdk"
GRADLE = WORK / "toolchains/android/gradle-7.4.2/bin/gradle"
KEYSTORE = WORK / "environments/android/bootstrap/debug.keystore"
DEFAULT_STAGE = ROOT / ".work/examples/android-region-marks"
DEFAULT_APP = "org.procedurals.regionmarks"
DEFAULT_ACTIVITY = "org.procedurals.examples.regionmarks.RegionMarksActivity"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def require(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError("required RegionMarks input is missing: " + str(path))
    return path.resolve()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError("unexpected " + label + " template")
    return text.replace(old, new)


def source_inputs(extra_sources: tuple[Path, ...] = ()) -> tuple[Path, ...]:
    sources = (*sorted((ROOT / "packages/java/src/main/java").rglob("*.java")),
               *sorted((ROOT / "packages/java-android/src/main/java").rglob("*.java")),
               require(EXAMPLE / "RegionMarksActivity.java"),
               require(EXAMPLE / "RegionMarksRenderer.java"),
               require(COMPOSITION), require(GALLERY),
               *(require(Path(source)) for source in extra_sources))
    names = [path.name for path in sources]
    if len(names) != len(set(names)):
        raise RuntimeError("duplicate staged Java filename")
    return sources


def template_inputs() -> tuple[Path, ...]:
    return (*sorted(path for path in BOOTSTRAP.rglob("*") if path.is_file()),
            require(EXAMPLE / "AndroidManifest.xml"),
            require(EXAMPLE / "README.md"),
            require(CORE), require(KEYSTORE),
            require(SDK / "platforms/android-33/android.jar"), require(GRADLE),
            Path(__file__).resolve())


def hashes(paths: tuple[Path, ...]) -> dict[str, str]:
    return {display(path): digest(path) for path in paths}


def staged_hashes(stage: Path) -> dict[str, str]:
    paths = [*sorted((stage / "app/src/main/java").rglob("*.java")),
             stage / "app/build.gradle", stage / "app/src/main/AndroidManifest.xml",
             stage / "app/libs/processing-core.jar", stage / "build.gradle",
             stage / "settings.gradle", stage / "gradle.properties",
             stage / "debug.keystore", stage / "local.properties"]
    return {str(path.relative_to(stage)): digest(path) for path in paths}


def prepare(stage: Path = DEFAULT_STAGE, application_id: str = DEFAULT_APP,
            activity_class: str = DEFAULT_ACTIVITY,
            extra_sources: tuple[Path, ...] = ()) -> dict[str, object]:
    if not re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", application_id):
        raise ValueError("application id must be dotted")
    if not re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", activity_class):
        raise ValueError("activity class must be fully qualified")
    stage = stage.resolve()
    if ROOT not in stage.parents:
        raise ValueError("stage must stay inside repository")
    sources = source_inputs(extra_sources)
    templates = template_inputs()
    before = hashes((*sources, *templates))
    stage.mkdir(parents=True, exist_ok=True)
    for source in sorted(path for path in BOOTSTRAP.rglob("*") if path.is_file()):
        target = stage / source.relative_to(BOOTSTRAP)
        target.parent.mkdir(parents=True, exist_ok=True)
        text = source.read_text()
        if source.name == "build.gradle" and source.parent.name == "app":
            text = replace_once(text, "applicationId 'org.procedurals.bootstrap'",
                                "applicationId '" + application_id + "'", "application id")
            text = replace_once(text, "minSdkVersion 23", "minSdkVersion 29", "minimum SDK")
        target.write_text(text)
    manifest = (EXAMPLE / "AndroidManifest.xml").read_text()
    manifest = replace_once(manifest, 'package="' + DEFAULT_APP + '"',
                            'package="' + application_id + '"', "manifest package")
    manifest = replace_once(manifest, 'android:name="' + DEFAULT_ACTIVITY + '"',
                            'android:name="' + activity_class + '"', "manifest activity")
    target = stage / "app/src/main/AndroidManifest.xml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(manifest)
    java = stage / "app/src/main/java"
    java.mkdir(parents=True, exist_ok=True)
    for old in java.rglob("*.java"):
        old.unlink()
    for source in sources:
        shutil.copyfile(source, java / source.name)
    libs = stage / "app/libs"
    libs.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CORE, libs / "processing-core.jar")
    shutil.copyfile(KEYSTORE, stage / "debug.keystore")
    (stage / "local.properties").write_text("sdk.dir=" + str(SDK) + "\n")
    if before != hashes((*sources, *templates)):
        raise RuntimeError("RegionMarks inputs changed during preparation")
    metadata = {
        "stage": display(stage),
        "application_id": application_id,
        "activity_class": activity_class,
        "source_hashes": before,
        "staged_project_sha256": staged_hashes(stage),
        "shared_composition": {
            "path": display(COMPOSITION),
            "sha256": digest(COMPOSITION),
            "staging": "exact source copied without package rewriting",
        },
        "scope": "compile preparation only; no install, emulator launch, render, or Android support acceptance",
    }
    (stage / ".procedurals-inputs.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def build(stage: Path) -> Path:
    stage = stage.resolve()
    metadata = json.loads((stage / ".procedurals-inputs.json").read_text())
    if staged_hashes(stage) != metadata["staged_project_sha256"]:
        raise RuntimeError("staged inputs changed; prepare again")
    env = dict(os.environ,
               JAVA_HOME=str(WORK / "toolchains/jdk-17.0.20.1+1"),
               ANDROID_USER_HOME=str(WORK / "environments/android/user"),
               GRADLE_USER_HOME=str(WORK / "environments/android/gradle"))
    with (stage / "build.log").open("w") as log:
        subprocess.run([str(GRADLE), "--no-daemon", "--console=plain", ":app:assembleDebug"],
                       cwd=stage, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=600)
    apk = stage / "app/build/outputs/apk/debug/app-debug.apk"
    if not apk.is_file():
        raise RuntimeError("debug APK not created")
    return apk


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, default=DEFAULT_STAGE)
    parser.add_argument("--application-id", default=DEFAULT_APP)
    parser.add_argument("--activity-class", default=DEFAULT_ACTIVITY)
    parser.add_argument("--build", action="store_true")
    args = parser.parse_args()
    result = prepare(args.stage, args.application_id, args.activity_class)
    if args.build:
        apk = build(args.stage)
        result["apk"] = display(apk)
        result["apk_sha256"] = digest(apk)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
