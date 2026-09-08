#!/usr/bin/env python3
"""Compile the packaged PDE starter against its packaged JAR and Processing runtime."""
import argparse
import json
import os
from pathlib import Path
import shutil
import zipfile

from build_java_artifacts import ROOT, DEFAULT_OUTPUT, digest, java_home, run
from check_field_marks_pde import NAMES


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library-zip',type=Path,default=DEFAULT_OUTPUT/'procedurals-processing-0.1.0.zip')
    parser.add_argument('--processing-runtime',type=Path,default=ROOT/'.work/toolchains/processing-4.5.6',
                        help='Directory containing core-4.5.6.jar and preprocessor/*.jar')
    parser.add_argument('--java-home')
    args=parser.parse_args()
    home=java_home(args.java_home)
    archive=args.library_zip.resolve()
    runtime=args.processing_runtime.resolve()
    core=runtime/'core-4.5.6.jar'
    dependencies=[core,*[runtime/'preprocessor'/name for name in NAMES]]
    for dependency in dependencies:
        if not dependency.is_file():raise FileNotFoundError(dependency)
    build=ROOT/'.work/build/java-distribution-consumer'
    if build.exists():shutil.rmtree(build)
    build.mkdir(parents=True)
    with zipfile.ZipFile(archive) as zipped:
        for info in zipped.infolist():
            target=(build/info.filename).resolve()
            if not target.is_relative_to(build):raise ValueError('Unsafe distribution ZIP entry')
        zipped.extractall(build)
    library=build/'procedurals'
    properties=dict(line.split('=',1) for line in (library/'library.properties').read_text().splitlines()
                    if '=' in line and not line.startswith('#'))
    if properties.get('name')!='Procedurals':raise ValueError('Incorrect Processing library metadata')
    jar=library/'library/procedurals.jar'
    adapter=library/'library/procedurals-processing-adapter.jar'
    library_jars=sorted((library/'library').glob('*.jar'))
    example=library/'examples/FieldMarks'
    bridge=ROOT/'tests/native/PreprocessFieldMarks.java'
    classes=build/'consumer'; classes.mkdir()
    user_home=build/'home'; user_home.mkdir()
    classpath=os.pathsep.join(map(str,dependencies))
    run([home/'bin/javac','-cp',classpath,'-d',classes,bridge],cwd=build)
    generated=classes/'FieldMarks.java'
    # Preferences must stay inside the isolated consumer rather than the user's config.
    import subprocess
    environment=dict(os.environ)
    for name in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA'):environment.pop(name,None)
    preprocess=subprocess.run([str(home/'bin/java'),'-Duser.home='+str(user_home),'-cp',
        str(classes)+os.pathsep+classpath,'PreprocessFieldMarks',str(example/'FieldMarks.pde'),str(generated)],
        cwd=build,env=environment,text=True,capture_output=True,check=True)
    compile_command=[home/'bin/javac','-cp',os.pathsep.join(map(str,[core,*library_jars])),
                     '-d',classes,generated,*sorted(example.glob('*.java'))]
    run(compile_command,cwd=build)
    command_checks=None
    if adapter.is_file() and (example/'MarkCommands.java').is_file():
        probe=ROOT/'tests/native/InstalledFieldMarksCommands.java'
        consumer_classpath=os.pathsep.join(map(str,[classes,core,*library_jars]))
        run([home/'bin/javac','-cp',consumer_classpath,'-d',classes,probe],cwd=build)
        plan_path=ROOT/'evidence/reproductions/cp1-java2d/plan.json'
        accepted_path=ROOT/'evidence/reproductions/cp1-java2d-adapter/result.json'
        plan=json.loads(plan_path.read_text()); accepted=json.loads(accepted_path.read_text())
        if accepted.get('status')!='passed':raise ValueError('CP1 reference not accepted')
        arguments=[]
        for case in plan['cases']:
            arguments.extend([case['id'],str(case['maxLength']),str(case['mark']=='bar').lower(),','.join(case['colors'])])
        result=run([home/'bin/java','-cp',consumer_classpath,'InstalledFieldMarksCommands',*arguments],cwd=build)
        lines=result.stdout.splitlines()
        expected_locations=['core='+jar.as_uri(),'noise='+jar.as_uri(),'palette='+jar.as_uri(),'adapter='+adapter.as_uri()]
        # Java file URLs have one slash after file:, while pathlib uses three.
        if [line.replace('file:/','file:///') for line in lines[:4]]!=expected_locations:
            raise AssertionError('Command consumer did not load packaged JARs')
        checks=[]
        for line,expected in zip(lines[4:],accepted['native']):
            case_id,model,geometry,color,count=line.split()
            actual={'id':case_id,'model_sha256':model,'geometry_sha256':geometry,'color_sha256':color,'commands':int(count)}
            if any(actual[key]!=expected[key] for key in actual):raise AssertionError('Packaged command mismatch: '+case_id)
            checks.append(actual)
        if len(checks)!=4 or len(lines)!=8 or [c['id'] for c in checks]!=['base','length','palette','bar']:
            raise AssertionError('Incomplete packaged CP1 comparison')
        command_checks={'cases':checks,'loaded_from':lines[:4],
            'input_sha256':{str(p.relative_to(ROOT)):digest(p) for p in (probe,plan_path,accepted_path)}}
    report={'status':'passed','scope':'Packaged Processing starter extracted, officially preprocessed and compiled against its packaged JAR; no new native render or IDE interaction.',
        'library_zip':str(archive),'library_zip_sha256':digest(archive),
        'packaged_jar_sha256':digest(jar),'library_properties':properties,
        'packaged_adapter_sha256':digest(adapter) if adapter.is_file() else None,
        'installed_command_checks':command_checks,
        'starter_route':'installed-command-adapter' if adapter.is_file() and (example/'MarkCommands.java').is_file() else 'direct-processing-core-only',
        'packaged_example_sha256':{p.name:digest(p) for p in example.iterdir() if p.is_file()},
        'runtime_sha256':{str(p):digest(p) for p in dependencies},
        'verifier_sha256':{str(p.relative_to(ROOT)):digest(p) for p in (Path(__file__).resolve(),bridge)},
        'preprocess_stdout':preprocess.stdout,'compile_command':list(map(str,compile_command)),
        'compiled_class_sha256':digest(classes/'FieldMarks.class'),
        'java_version':run([home/'bin/java','-version']).stderr.strip()}
    destination=ROOT/'evidence/distribution/java-starter.json'
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':'passed','evidence':str(destination.relative_to(ROOT))}))


if __name__=='__main__':main()
