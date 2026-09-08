#!/usr/bin/env python3
"""Record installed Android prerequisites; this does not certify native drawing."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def main():
    sdk=ROOT/'.work/toolchains/android/sdk'
    properties=sorted(sdk.rglob('source.properties'))
    files=[*properties,ROOT/'.work/downloads/android/AndroidMode-412.zip',
           ROOT/'.work/downloads/android/commandline-tools-19.zip',
           ROOT/'.work/downloads/android/gradle-7.4.2-bin.zip',
           ROOT/'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip',
           ROOT/'.work/toolchains/android/mode-412/AndroidMode/version.properties']
    report={'scope':'Installed prerequisites only; no Android drawing support claim',
            'source_revision':subprocess.check_output(['git','-C',str(ROOT/'.work/toolchains/android/processing-source-412'),
                'rev-parse','HEAD'],text=True).strip(),
            'sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
            'packages':{str(p.parent.relative_to(sdk)):p.read_text() for p in properties}}
    destination=ROOT/'evidence/conformance/android-environment.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(destination.relative_to(ROOT))


if __name__=='__main__':main()
