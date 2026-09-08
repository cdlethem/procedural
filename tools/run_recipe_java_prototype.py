#!/usr/bin/env python3
"""Compare draft recipe commands with existing Java compositions; no renderer/export claim."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_grid_conformance import java_home, java_value, run
from tools.validate_recipe_draft import load_json, validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home', required=True)
    parser.add_argument('--processing-core', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    if (ROOT / '.work').resolve() not in output.parents or output.exists():
        parser.error('output must be a fresh directory below repository .work')
    processing = args.processing_core.resolve()
    manifest = json.loads((ROOT / 'packages/java/source-bundle.json').read_text())
    if hashlib.sha256(processing.read_bytes()).hexdigest() != manifest['processing_core_sha256']:
        parser.error('Processing core differs from reviewed dependency')
    recipes = []
    recipe_paths = []
    for name in ('field-marks', 'path-marks'):
        path = ROOT / 'design/recipes/examples' / (name + '.draft.json')
        recipe = load_json(path)
        validate(recipe)
        recipes.append(recipe)
        recipe_paths.append(path)
    source = '''import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
import org.procedurals.examples.pathmarks.PathMarkComposition;
public class RecipePrototypeComparison {
 static List<Object> list(Object... x){return new ArrayList<Object>(Arrays.asList(x));}
 static Map<String,Object> map(Object... x){Map<String,Object> r=new LinkedHashMap<>();for(int i=0;i<x.length;i+=2)r.put((String)x[i],x[i+1]);return r;}
 @SuppressWarnings("unchecked") static Map<String,Object> obj(Object x){return (Map<String,Object>)x;}
 static void same(Object a,Object b,String p){
  if(a instanceof Number && b instanceof Number){if(Double.doubleToLongBits(((Number)a).doubleValue())!=Double.doubleToLongBits(((Number)b).doubleValue()))throw new AssertionError("number at "+p+": "+a+" != "+b);return;}
  if(a instanceof List && b instanceof List){List<?> x=(List<?>)a,y=(List<?>)b;if(x.size()!=y.size())throw new AssertionError("length at "+p);for(int i=0;i<x.size();i++)same(x.get(i),y.get(i),p+"/"+i);return;}
  if(a instanceof Map && b instanceof Map){Map<?,?> x=(Map<?,?>)a,y=(Map<?,?>)b;if(!x.keySet().equals(y.keySet()))throw new AssertionError("keys at "+p);for(Object k:x.keySet())same(x.get(k),y.get(k),p+"/"+k);return;}
  if(!Objects.equals(a,b))throw new AssertionError("value at "+p);
 }
 static int[] colors(Map<String,Object> params){List<?> c=(List<?>)params.get("colors");int[] r=new int[c.size()];for(int i=0;i<r.length;i++)r[i]=((Number)c.get(i)).intValue();return r;}
 static void field(Map<String,Object> recipe,String label){
  Map<String,Object> p=obj(recipe.get("parameters")); List<Object> expected=new ArrayList<>();
  MarkField marks=MarkField.create(((Number)p.get("seed")).longValue(),((Number)p.get("columns")).intValue(),((Number)p.get("rows")).intValue(),((Number)p.get("pitch")).doubleValue());
  MarkCommands.stream(marks,((Number)p.get("maxLength")).doubleValue(),colors(p),(Boolean)p.get("bars"),batch->expected.addAll(batch));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());same(expected,result.commands,label);System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void path(Map<String,Object> recipe,String label){
  Map<String,Object> p=obj(recipe.get("parameters"));List<Object> expected=new ArrayList<>();
  PathMarkComposition movement=PathMarkComposition.create(((Number)p.get("seed")).longValue(),((Number)p.get("steps")).intValue(),((Number)p.get("distance")).doubleValue());
  movement.streamForCanvas((Boolean)p.get("trace"),((Number)p.get("markLength")).doubleValue(),colors(p),batch->expected.addAll(batch));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());same(expected,result.commands,label);System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static Map<String,Object> fieldRecipe(){return __FIELD__;}
 static Map<String,Object> pathRecipe(){return __PATH__;}
 public static void main(String[] args){
  Map<String,Object> f=fieldRecipe();field(f,"field-baseline");obj(f.get("parameters")).put("maxLength",32.0);field(f,"field-length");obj(f.get("parameters")).put("bars",true);field(f,"field-bars");obj(f.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));field(f,"field-palette");
  Map<String,Object> p=pathRecipe();path(p,"path-baseline");obj(p.get("parameters")).put("trace",true);path(p,"path-trace");obj(p.get("parameters")).put("steps",2001.0);path(p,"path-steps");obj(p.get("parameters")).put("distance",0.8);path(p,"path-distance");obj(p.get("parameters")).put("trace",false);obj(p.get("parameters")).put("markLength",24.0);obj(p.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));path(p,"path-style");
  System.out.println("COMMAND_COMPARISON_PASSED");
 }
}
'''.replace('__FIELD__', java_value(recipes[0])).replace('__PATH__', java_value(recipes[1]))
    inputs = sorted((ROOT / 'packages/java/src/main/java').rglob('*.java'))
    inputs += sorted((ROOT / 'packages/java-processing/src/main/java').rglob('*.java'))
    inputs += [ROOT / p for p in (
        'packages/java-recipe-prototype/src/main/java/org/procedurals/recipe/RecipeEvaluator.java',
        'packages/java/examples/FieldMarks/MarkField.java',
        'packages/java-processing/examples/FieldMarks/MarkCommands.java',
        'packages/java/examples/PathMarks/PathMarkComposition.java')]
    home = java_home(args.java_home)
    metadata = [ROOT / name for name in (
        'design/recipes/recipe.schema.json', 'design/recipes/execution-bindings.json',
        'design/recipes/expression-model.md', 'design/recipes/runtime-accounting.md',
        'tools/validate_recipe_draft.py', 'tools/run_grid_conformance.py')]
    binding_data = json.loads((ROOT / 'design/recipes/execution-bindings.json').read_text())
    metadata += [ROOT / row['contract'] for row in binding_data['operations']]
    metadata += list((ROOT / 'catalog/drawing').glob('*.json'))
    bound = inputs + recipe_paths + metadata + [processing, Path(__file__).resolve(),
        *[home / name for name in ('bin/java', 'bin/javac', 'release', 'lib/modules')]]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}
    output.mkdir(parents=True)
    driver = output / 'RecipePrototypeComparison.java'
    driver.write_text(source)
    classes = output / 'classes'
    classes.mkdir()
    run([home / 'bin/javac', '--release', '8', '-encoding', 'UTF-8', '-cp', processing,
         '-d', classes, *inputs, driver], timeout=120)
    import os
    result = run([home / 'bin/java', '-Xmx512m', '-cp', os.pathsep.join(map(str, (classes, processing))),
                  'RecipePrototypeComparison'], timeout=120)
    if 'COMMAND_COMPARISON_PASSED' not in result.stdout:
        raise RuntimeError('comparison did not finish')
    if hashes != {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}:
        raise RuntimeError('comparison input changed during execution')
    report = {'status': 'prototype-command-comparison-passed', 'scope': 'Nine command scenarios only; no runtime failure, cache, export or native acceptance.',
              'input_sha256': hashes, 'stdout': result.stdout}
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(result.stdout)


if __name__ == '__main__':
    main()
