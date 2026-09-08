#!/usr/bin/env python3
"""Export a statically valid recipe as an explicitly unaccepted Java prototype."""
import argparse, hashlib, inspect, json, shutil, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from tools.build_java_source_bundle import fresh_output, require_hash
from tools.run_grid_conformance import java_value
from tools.validate_recipe_draft import load_json, validate, load_bindings, RecipeError
from tools.operation_attestations import validate_target_attestation

def sha_bytes(data): return hashlib.sha256(data).hexdigest()
def sha(path): return sha_bytes(path.read_bytes())

def accepted_java_manifest():
    manifest=json.loads((ROOT/'packages/java/source-bundle.json').read_text())
    review=manifest['accepted_distribution_review']; require_hash(ROOT/review['path'],review['sha256'])
    accepted=json.loads((ROOT/review['path']).read_text())
    if accepted.get('status')!='accepted' or accepted.get('reviewer')!='root': raise ValueError('reviewed Java distribution baseline required')
    for group,directory in (('core_sources','packages/java/src/main/java'),('adapter_sources','packages/java-processing/src/main/java')):
        actual={str(p.relative_to(ROOT)) for p in (ROOT/directory).rglob('*.java')}
        if actual!=set(manifest[group]): raise ValueError('Java source inventory differs from baseline: '+group)
        for name,digest in manifest[group].items():
            if sha(ROOT/name)!=digest: raise ValueError('accepted Java source hash changed: '+name)
    return manifest

def admit_target(recipe, target, root=ROOT):
    """Check this prototype's requested target and declared operation evidence."""
    if target != "processing-java":
        raise RecipeError("UNSUPPORTED_TARGET", "", "recipe exporter supports only processing-java")
    validate(recipe, root)
    if recipe["drawing"] != {"id": "drawing.fresh-raster-2d", "version": "0.1.0"}:
        raise RecipeError("UNSUPPORTED_DRAWING", "/drawing", "exporter requires fresh-raster-2d 0.1.0")
    bindings = load_bindings(root)
    records = []
    for index, declaration in enumerate(recipe["operations"]):
        binding = bindings[declaration["id"]]
        path = Path(binding["contract"])
        operation = json.loads((root / path).read_text())
        operation["_file"] = path.name
        errors, record = validate_target_attestation(root, operation, target)
        if errors or record is None:
            raise RecipeError("TARGET_EVIDENCE", "/operations/" + str(index), "; ".join(errors))
        dimensions = record["dimensions"]
        if dimensions["core"]["status"] != "conformant" or dimensions["native"]["status"] != "validated-scoped":
            raise RecipeError("UNSUPPORTED_OPERATION", "/operations/" + str(index), "target core/native evidence required")
        records.append(record)
    return {"status": "prototype-target-inputs-verified", "target": target,
            "scope": "Declared operation support only; recipe executor and export remain unaccepted.",
            "operations": records,
            "validated_recipe_sha256": sha_bytes(json.dumps(recipe, sort_keys=True,
                separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")),
            "validation_inputs": {name: sha(root / name) for name in (
                "tools/validate_recipe_draft.py", "tools/operation_attestations.py",
                "catalog/recipes/recipe.schema.json", "catalog/recipes/execution-bindings.json")}}

def export_java(recipe):
    return '''import java.nio.file.*;\nimport java.util.*;\nimport processing.core.PApplet;\nimport processing.awt.PGraphicsJava2D;\nimport org.procedurals.processing.internal.Java2DFrame;\nimport org.procedurals.recipe.RecipeEvaluator;\n\npublic final class RecipeExport {\n    static Map<String,Object> map(Object... x) { Map<String,Object> r=new LinkedHashMap<String,Object>(); for(int i=0;i<x.length;i+=2) r.put((String)x[i],x[i+1]); return r; }\n    static List<Object> list(Object... x) { return new ArrayList<Object>(Arrays.asList(x)); }\n    static Map<String,Object> baseRecipe() { return %s; }\n    static Map<String,Object> recipe() { Map<String,Object> r=baseRecipe(); r.put("parameters",RecipeParameters.values()); return r; }\n    public static void main(String[] arguments) throws Throwable {\n        if(arguments.length!=1) throw new IllegalArgumentException("provide fresh PNG path");\n        Path output=Paths.get(arguments[0]).toAbsolutePath();\n        if(!output.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".png")) throw new IllegalArgumentException("output must end in .png");\n        if(Files.exists(output)) throw new IllegalArgumentException("PNG exists");\n        RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe(),new RecipeEvaluator.Limits());\n        Java2DFrame frame=new Java2DFrame(new PApplet()); PGraphicsJava2D completed=null; Throwable primary=null;\n        try {\n            frame.begin(result.environment);\n            for(int i=0;i<result.commands.size();i+=4096) frame.batch(result.commands.subList(i,Math.min(i+4096,result.commands.size())));\n            completed=frame.end(); if(!completed.save(output.toString())) throw new IllegalStateException("PNG save failed");\n        } catch(Throwable error) { primary=error; throw error; }\n        finally { try { if(completed!=null) Java2DFrame.releaseCompleted(completed); else if(!"completed".equals(frame.state())) frame.abort(); } catch(Throwable cleanup) { if(primary==null) throw cleanup; if(cleanup!=primary) primary.addSuppressed(cleanup); } }\n    }\n}\n''' % java_value(recipe)

BUILD='''#!/usr/bin/env python3
import argparse, hashlib, json, math, os, shlex, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
MAX_BYTES=2*1024*1024; MAX_DEPTH=64; MAX_VALUES=20000
{java_value_source}
def sha_bytes(data): return hashlib.sha256(data).hexdigest()
def pairs(items):
 r={{}}
 for k,v in items:
  if k in r: raise ValueError("duplicate JSON key: "+k)
  r[k]=v
 return r
def bad(value): raise ValueError("non-finite JSON number: "+value)
def bounds(value):
 count=[0]
 def walk(item,depth):
  if depth>MAX_DEPTH: raise ValueError("JSON depth limit")
  count[0]+=1
  if count[0]>MAX_VALUES: raise ValueError("JSON value limit")
  if isinstance(item,float) and not math.isfinite(item): raise ValueError("non-finite JSON number")
  if isinstance(item,dict):
   for x in item.values(): walk(x,depth+1)
  elif isinstance(item,list):
   for x in item: walk(x,depth+1)
 try: walk(value,0)
 except RecursionError as e: raise ValueError("JSON depth limit") from e
def read_parameters(path):
 with path.open("rb") as f: data=f.read(MAX_BYTES+1)
 if len(data)>MAX_BYTES: raise ValueError("parameters.json exceeds 2 MiB")
 try: value=json.loads(data.decode("utf-8"),object_pairs_hook=pairs,parse_int=float,parse_float=float,parse_constant=bad)
 except (UnicodeDecodeError,json.JSONDecodeError,RecursionError,ValueError) as e: raise ValueError("invalid parameters.json: "+str(e))
 if not isinstance(value,dict): raise ValueError("parameters.json root must be an object")
 bounds(value); return data,value
def main():
 p=argparse.ArgumentParser(); p.add_argument("--java-home",required=True); p.add_argument("--processing-core",required=True); p.add_argument("--output",required=True); a=p.parse_args()
 out=Path(a.output).resolve(); home=Path(a.java_home).resolve(); core=Path(a.processing_core).resolve()
 if out.exists(): raise SystemExit("--output must be fresh")
 manifest=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))
 try:
  core_bytes=core.read_bytes()
  if sha_bytes(core_bytes)!=manifest["processing_core_sha256"]: raise ValueError("Processing core digest differs")
  sealed={{}}
  for name,digest in manifest["files"].items():
   data=(ROOT/name).read_bytes()
   if sha_bytes(data)!=digest: raise ValueError("export file hash differs: "+name)
   sealed[name]=data
  parameter_bytes,parameters=read_parameters(ROOT/"parameters.json")
  combined=json.loads(sealed["recipe.json"].decode("utf-8")); combined["parameters"]=parameters; bounds(combined)
  if len(json.dumps(combined,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8"))>MAX_BYTES: raise ValueError("combined recipe exceeds 2 MiB")
 except (OSError,UnicodeDecodeError,json.JSONDecodeError,ValueError) as e: raise SystemExit(str(e))
 out.mkdir(parents=True); sources=[]; source_hashes={{}}
 for name in manifest["java_sources"]:
  dst=out/"sealed-src"/name; dst.parent.mkdir(parents=True,exist_ok=True); dst.write_bytes(sealed[name]); sources.append(dst); source_hashes[name]=sha_bytes(sealed[name])
 generated=out/"generated-src"/"RecipeParameters.java"; generated.parent.mkdir()
 generated.write_text("import java.util.*;\\npublic final class RecipeParameters {{ static Map<String,Object> map(Object... x) {{ Map<String,Object> r=new LinkedHashMap<String,Object>(); for(int i=0;i<x.length;i+=2) r.put((String)x[i],x[i+1]); return r; }} static List<Object> list(Object... x) {{ return new ArrayList<Object>(Arrays.asList(x)); }} public static Map<String,Object> values() {{ return "+java_value(parameters)+"; }} }}\\n",encoding="utf-8")
 jdk={{n:sha_bytes((home/n).read_bytes()) for n in ("release","bin/javac","bin/java","lib/modules")}}
 report={{"status":"inputs-verified","parameters_file_sha256":sha_bytes(parameter_bytes),"parameters_canonical_sha256":sha_bytes(json.dumps(parameters,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8")),"java_source_sha256":source_hashes,"generated_parameters_sha256":sha_bytes(generated.read_bytes()),"processing_core_sha256":sha_bytes(core_bytes),"jdk_sha256":jdk}}
 (out/"build-manifest.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\\n",encoding="utf-8")
 subprocess.run([str(home/"bin/javac"),"--release","8","-encoding","UTF-8","-classpath",str(core),"-d",str(out),*[str(x) for x in sources],str(generated)],check=True)
 report["status"]="compiled"
 (out/"build-manifest.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\\n",encoding="utf-8")
 print("Run: "+shlex.join([str(home/"bin/java"),"-cp",str(out)+os.pathsep+str(core),"RecipeExport","/absolute/fresh-output.png"]))
if __name__=="__main__": main()
'''
def build_script(): return BUILD.format(java_value_source=inspect.getsource(java_value).rstrip())
def copy_file(source,destination,hashes,output):
 destination.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(source,destination); hashes[str(destination.relative_to(output))]=sha(destination)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--recipe',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--target',default='processing-java');args=p.parse_args()
 output=fresh_output(ROOT,args.output); recipe=load_json(args.recipe);admission=admit_target(recipe,args.target)
 subprocess.run([sys.executable,str(ROOT/'tools/generate_recipe_java_schemas.py'),'--check'],check=True)
 subprocess.run([sys.executable,str(ROOT/'tools/generate_recipe_java_grammar.py'),'--check'],check=True); source_manifest=accepted_java_manifest()
 base=dict(recipe); parameters=base.pop('parameters');base['parameters']={}; output.mkdir(parents=True); hashes={}
 for source_root,prefix in ((ROOT/'packages/java/src/main/java','src/core'),(ROOT/'packages/java-processing/src/main/java','src/adapter'),(ROOT/'packages/java-recipe-prototype/src/main/java','src/prototype')):
  for source in sorted(source_root.rglob('*.java')): copy_file(source,output/prefix/source.relative_to(source_root),hashes,output)
 for name in ('LICENSE','THIRD_PARTY_NOTICES.md','catalog/recipes/execution-bindings.json','catalog/recipes/recipe.schema.json','catalog/drawing/fresh-raster-2d.json','packages/java/source-bundle.json',source_manifest['accepted_distribution_review']['path'],'catalog/operations/regular-grid.json','catalog/operations/gradient-noise-2d-01.json','catalog/operations/cyclic-palette.json','catalog/operations/gradient-path.json'): copy_file(ROOT/name,output/'metadata'/name,hashes,output)
 (output/'recipe.json').write_text(json.dumps(base,indent=2,sort_keys=True)+'\n',encoding='utf-8');hashes['recipe.json']=sha(output/'recipe.json')
 (output/'parameters.json').write_text(json.dumps(parameters,indent=2,sort_keys=True,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')
 source=output/'src/RecipeExport.java';source.parent.mkdir(exist_ok=True);source.write_text(export_java(base),encoding='utf-8');hashes['src/RecipeExport.java']=sha(source)
 (output/'build.py').write_text(build_script(),encoding='utf-8');hashes['build.py']=sha(output/'build.py')
 readme=output/'README.md';readme.write_text('# Recipe Java prototype export\n\nPrototype-unaccepted snapshot; no support or native acceptance claim. `recipe.json` and Java sources are sealed by `manifest.json`. Edit `parameters.json`, then build a fresh output: `python3 build.py --java-home /path/jdk --processing-core /path/core.jar --output /fresh/classes`. Run the printed command. On this machine use `/home/colin/dev/procedural/tools/with_native_render_lock.py -- xvfb-run -a java ...`. The build records exact editable parameter bytes and canonical parameter values in `build-manifest.json`. Recipe structure, operations, drawing, or Java source changes require a new export.\n',encoding='utf-8');hashes['README.md']=sha(readme)
 manifest={'status':'prototype-unaccepted','target_admission':admission,'processing_core_sha256':source_manifest['processing_core_sha256'],'files':hashes,'java_sources':sorted(x for x in hashes if x.endswith('.java')),'parameters':{'path':'parameters.json','default_file_sha256':sha(output/'parameters.json'),'default_canonical_sha256':sha_bytes(json.dumps(parameters,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()),'sealed':False},'provenance':{'schema_generator_sha256':sha(ROOT/'tools/generate_recipe_java_schemas.py'),'exporter_sha256':sha(Path(__file__)),'java_value_source_sha256':sha_bytes(inspect.getsource(java_value).encode()),'source_revision':subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,text=True,check=True).stdout.strip()}}
 (output/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n',encoding='utf-8');print(output)
if __name__=='__main__': main()
