#!/usr/bin/env python3
"""Export a statically valid recipe as an explicitly unaccepted Java prototype."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.build_java_source_bundle import fresh_output, require_hash
from tools.run_grid_conformance import java_value
from tools.validate_recipe_draft import load_json, validate



def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def accepted_java_manifest():
    manifest = json.loads((ROOT / "packages/java/source-bundle.json").read_text())
    review = manifest["accepted_distribution_review"]
    require_hash(ROOT / review["path"], review["sha256"])
    acceptance = json.loads((ROOT / review["path"]).read_text())
    if acceptance.get("status") != "accepted" or acceptance.get("reviewer") != "root":
        raise ValueError("reviewed Java distribution baseline required")
    for group, directory in (("core_sources", "packages/java/src/main/java"),
                             ("adapter_sources", "packages/java-processing/src/main/java")):
        actual = {str(p.relative_to(ROOT)) for p in (ROOT / directory).rglob("*.java")}
        if actual != set(manifest[group]):
            raise ValueError("Java source inventory differs from baseline: " + group)
        for name, digest in manifest[group].items():
            if sha(ROOT / name) != digest:
                raise ValueError("accepted Java source hash changed: " + name)
    return manifest


def export_java(recipe):
    return """import java.nio.file.*; import java.util.*; import processing.core.PApplet; import processing.awt.PGraphicsJava2D;
import org.procedurals.processing.internal.Java2DFrame; import org.procedurals.recipe.RecipeEvaluator;
public final class RecipeExport {
 static Map<String,Object> map(Object... x){Map<String,Object> r=new LinkedHashMap<String,Object>();for(int i=0;i<x.length;i+=2)r.put((String)x[i],x[i+1]);return r;}
 static List<Object> list(Object... x){return new ArrayList<Object>(Arrays.asList(x));}
 static Map<String,Object> recipe(){return %s;}
 public static void main(String[] a)throws Throwable{
  if(a.length!=1)throw new IllegalArgumentException("provide fresh PNG path");
  Path out=Paths.get(a[0]).toAbsolutePath();
  if(!out.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".png"))throw new IllegalArgumentException("output must end in .png");
  if(Files.exists(out))throw new IllegalArgumentException("PNG exists");
  RecipeEvaluator.Result r=RecipeEvaluator.evaluate(recipe(),new RecipeEvaluator.Limits());
  Java2DFrame f=new Java2DFrame(new PApplet()); PGraphicsJava2D done=null; Throwable primary=null;
  try { f.begin(r.environment); for(int i=0;i<r.commands.size();i+=4096) f.batch(r.commands.subList(i,Math.min(i+4096,r.commands.size()))); done=f.end(); if(!done.save(out.toString()))throw new IllegalStateException("PNG save failed"); }
  catch(Throwable e){primary=e;throw e;}
  finally { try { if(done!=null)Java2DFrame.releaseCompleted(done); else if(!"completed".equals(f.state()))f.abort(); } catch(Throwable e){if(primary==null)throw e;if(e!=primary)primary.addSuppressed(e);} }
 }
}
""" % java_value(recipe)


BUILD = '''#!/usr/bin/env python3
import argparse, hashlib, json, os, shlex, subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument("--java-home",required=True);p.add_argument("--processing-core",required=True);p.add_argument("--output",required=True);a=p.parse_args()
out=Path(a.output).resolve(); core=Path(a.processing_core).resolve(); home=Path(a.java_home).resolve(); m=json.loads((root/"manifest.json").read_text())
if out.exists(): raise SystemExit("--output must be fresh")
if sha(core)!=m["processing_core_sha256"]: raise SystemExit("Processing core digest differs")
for name, digest in m["files"].items():
 if sha(root/name)!=digest: raise SystemExit("export file hash differs: "+name)
out.mkdir(parents=True); sources=sorted(str(x) for x in (root/"src").rglob("*.java")); subprocess.run([str(home/"bin/javac"),"--release","8","-encoding","UTF-8","-classpath",str(core),"-d",str(out),*sources],check=True)
print("Run: "+shlex.join([str(home/"bin/java"),"-cp",str(out)+os.pathsep+str(core),"RecipeExport","/absolute/fresh-output.png"]))
'''


def copy_file(source, destination, hashes, output):
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    hashes[str(destination.relative_to(output))] = sha(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = fresh_output(ROOT, args.output)
    recipe = load_json(args.recipe)
    validate(recipe)
    subprocess.run([sys.executable, str(ROOT / "tools/generate_recipe_java_schemas.py"), "--check"], check=True)
    manifest_source = accepted_java_manifest()
    output.mkdir(parents=True); hashes = {}
    roots = ((ROOT / "packages/java/src/main/java", "src/core"),
             (ROOT / "packages/java-processing/src/main/java", "src/adapter"),
             (ROOT / "packages/java-recipe-prototype/src/main/java", "src/prototype"))
    for source_root, prefix in roots:
        for source in source_root.rglob("*.java"):
            copy_file(source, output / prefix / source.relative_to(source_root), hashes, output)
    metadata = ("LICENSE", "THIRD_PARTY_NOTICES.md", "design/recipes/execution-bindings.json",
                "design/recipes/recipe.schema.json", "catalog/drawing/fresh-raster-2d.json",
                "packages/java/source-bundle.json", manifest_source["accepted_distribution_review"]["path"],
                "catalog/operations/regular-grid.json", "catalog/operations/gradient-noise-2d-01.json",
                "catalog/operations/cyclic-palette.json", "catalog/operations/gradient-path.json")
    for name in metadata: copy_file(ROOT / name, output / "metadata" / name, hashes, output)
    snapshot = output / "recipe.json"; snapshot.write_text(json.dumps(recipe, indent=2) + "\n"); hashes["recipe.json"] = sha(snapshot)
    source = output / "src/RecipeExport.java"; source.parent.mkdir(exist_ok=True); source.write_text(export_java(recipe)); hashes["src/RecipeExport.java"] = sha(source)
    build = output / "build.py"; build.write_text(BUILD); hashes["build.py"] = sha(build)
    readme = output / "README.md"; readme.write_text("# Recipe Java prototype export\n\nPrototype-unaccepted snapshot; no support or native acceptance claim.\n\nBuild: `python3 build.py --java-home /path/jdk --processing-core /path/core.jar --output /fresh/classes`. Run the printed command. On this machine launch through `/home/colin/dev/procedural/tools/with_native_render_lock.py -- xvfb-run -a java ...`.\n\nThe recipe is a snapshot: edit the source recipe and export again. This export has no parser or retained-cache claim.\n"); hashes["README.md"] = sha(readme)
    (output / "manifest.json").write_text(json.dumps({"status":"prototype-unaccepted","processing_core_sha256":manifest_source["processing_core_sha256"],"files":hashes,"provenance":{"schema_generator_sha256":sha(ROOT / "tools/generate_recipe_java_schemas.py"),"exporter_sha256":sha(Path(__file__)),"source_revision":subprocess.run(["git","rev-parse","HEAD"],cwd=ROOT,capture_output=True,text=True,check=True).stdout.strip()}}, indent=2, sort_keys=True) + "\n")
    print(output)


if __name__ == "__main__": main()
