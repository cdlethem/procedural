#!/usr/bin/env python3
"""Compile Android-only adapter against its actual pinned core/SDK; no native claim."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]


def main():
    output=ROOT/'.work/build/android-adapter'
    output.mkdir(parents=True,exist_ok=True)
    sources=[*sorted((ROOT/'packages/java/src/main/java').rglob('*.java')),
             *sorted((ROOT/'packages/java-android/src/main/java').rglob('*.java'))]
    dependencies=[ROOT/'.work/toolchains/android/sdk/platforms/android-33/android.jar',
                  ROOT/'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip']
    # Binary superinterfaces needed by the appcompat-1.6.0 Fragment carrier.
    # Resolve immutable module coordinates, not machine-specific transform hashes.
    coordinates = [
        ('androidx.fragment', 'fragment', '1.3.6', 'aar'),
        ('androidx.lifecycle', 'lifecycle-common', '2.5.1', 'jar'),
        ('androidx.lifecycle', 'lifecycle-viewmodel', '2.5.1', 'aar'),
        ('androidx.savedstate', 'savedstate', '1.2.0', 'aar'),
        ('androidx.activity', 'activity', '1.6.0', 'aar'),
        ('androidx.annotation', 'annotation', '1.3.0', 'jar'),
    ]
    cache = ROOT/'.work/environments/android/gradle/caches/modules-2/files-2.1'
    artifacts = []
    dependency_dir = output/'deps'
    dependency_dir.mkdir(exist_ok=True)
    for group, name, version, extension in coordinates:
        matches = list((cache/group/name/version).glob('*/'+name+'-'+version+'.'+extension))
        if len(matches) != 1:
            raise RuntimeError('Expected one resolved AndroidX artifact: '+group+':'+name+':'+version)
        artifact = matches[0]
        artifacts.append(artifact)
        if extension == 'aar':
            dependency = dependency_dir/(name+'-'+version+'.jar')
            with zipfile.ZipFile(artifact) as archive:
                dependency.write_bytes(archive.read('classes.jar'))
            dependencies.append(dependency)
        else:
            dependencies.append(artifact)
    bindings = [*sources, *dependencies, *artifacts, Path(__file__).resolve(),
                ROOT/'tests/native/android-bootstrap/app/build.gradle']
    inputs={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in bindings}
    subprocess.run([str(ROOT/'.work/toolchains/jdk-17.0.20.1+1/bin/javac'),'--release','8',
        '-classpath',':'.join(str(p) for p in dependencies),'-d',str(output),*map(str,sources)],check=True)
    report={'status':'passed','scope':'Android core/adapter compilation only; makes no native-runtime claim',
            'input_sha256':inputs,
            'androidx_coordinates':[':'.join(row[:3]) for row in coordinates]}
    destination=ROOT/'evidence/conformance/android-adapter-compile.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(destination.relative_to(ROOT))


if __name__=='__main__':main()
