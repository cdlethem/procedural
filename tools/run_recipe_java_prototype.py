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
    run([sys.executable, ROOT / 'tools/generate_recipe_java_schemas.py', '--check'], timeout=30)
    run([sys.executable, ROOT / 'tools/generate_recipe_java_grammar.py', '--check'], timeout=30)
    output = args.output.resolve()
    if (ROOT / '.work').resolve() not in output.parents or output.exists():
        parser.error('output must be a fresh directory below repository .work')
    processing = args.processing_core.resolve()
    manifest = json.loads((ROOT / 'packages/java/source-bundle.json').read_text())
    if hashlib.sha256(processing.read_bytes()).hexdigest() != manifest['processing_core_sha256']:
        parser.error('Processing core differs from reviewed dependency')
    recipes = []
    recipe_paths = []
    for name in ('field-marks', 'path-marks', 'placement-bars', 'region-panels', 'triangle-grain', 'triangle-timed-marks'):
        path = ROOT / 'design/recipes/examples' / (name + '.draft.json')
        recipe = load_json(path)
        validate(recipe)
        # Reorder JSON object keys while retaining expression/statement arrays and numbers.
        # Execute the deserialized form, not merely a structural comparison of serialization.
        roundtrip = json.loads(json.dumps(recipe, sort_keys=True, allow_nan=False),
                               parse_int=float, parse_float=float)
        if roundtrip != recipe:
            raise RuntimeError('recipe changed during JSON round trip')
        validate(roundtrip)
        recipes.append(roundtrip)
        recipe_paths.append(path)
    source = '''import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
import org.procedurals.examples.pathmarks.PathMarkComposition;
public class RecipePrototypeComparison {
 static final RecipeEvaluator.Session fieldSession=new RecipeEvaluator.Session();
 static final RecipeEvaluator.Session pathSession=new RecipeEvaluator.Session();
 static final RecipeEvaluator.Session placementSession=new RecipeEvaluator.Session();
 static final RecipeEvaluator.Session timedSession=new RecipeEvaluator.Session();
 static final RecipeEvaluator.Session triangleSession=new RecipeEvaluator.Session();
 static final RecipeEvaluator.Session regionSession=new RecipeEvaluator.Session();
 static void session(RecipeEvaluator.Session session,Map<String,Object> recipe,RecipeEvaluator.Result fresh,String label,boolean reuse){
  RecipeEvaluator.Result cached=session.evaluate(recipe,new RecipeEvaluator.Limits());
  same(fresh.commands,cached.commands,label+"-session");same(fresh.environment,cached.environment,label+"-environment");
  if(cached.retainedReused!=reuse)throw new AssertionError("unexpected retain reuse: "+label);
  if(reuse && cached.retainedExecutedCalls!=0)throw new AssertionError("warm retain executed calls: "+label);
  System.out.println("SESSION "+label+" "+cached.retainedReused+" "+cached.retainedExecutedCalls+" "+cached.retainedReservedUnits);
 }
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
 static void field(Map<String,Object> recipe,String label,boolean reuse){
  Map<String,Object> p=obj(recipe.get("parameters")); List<Object> expected=new ArrayList<>();
  MarkField marks=MarkField.create(((Number)p.get("seed")).longValue(),((Number)p.get("columns")).intValue(),((Number)p.get("rows")).intValue(),((Number)p.get("pitch")).doubleValue());
  MarkCommands.stream(marks,((Number)p.get("maxLength")).doubleValue(),colors(p),(Boolean)p.get("bars"),batch->expected.addAll(batch));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());same(expected,result.commands,label);session(fieldSession,recipe,result,label,reuse);System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void path(Map<String,Object> recipe,String label,boolean reuse){
  Map<String,Object> p=obj(recipe.get("parameters"));List<Object> expected=new ArrayList<>();
  PathMarkComposition movement=PathMarkComposition.create(((Number)p.get("seed")).longValue(),((Number)p.get("steps")).intValue(),((Number)p.get("distance")).doubleValue());
  movement.streamForCanvas((Boolean)p.get("trace"),((Number)p.get("markLength")).doubleValue(),colors(p),batch->expected.addAll(batch));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());same(expected,result.commands,label);session(pathSession,recipe,result,label,reuse);System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void placement(Map<String,Object> recipe,String label,boolean reuse){
  List<Object> expected=PlacementRecipeComposition.commands(obj(recipe.get("parameters")));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());
  same(expected,result.commands,label);session(placementSession,recipe,result,label,reuse);
  System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void region(Map<String,Object> recipe,String label,boolean reuse){
  List<Object> expected=RegionRecipeComposition.commands(obj(recipe.get("parameters")));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());
  same(expected,result.commands,label);session(regionSession,recipe,result,label,reuse);
  System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void triangle(Map<String,Object> recipe,String label,boolean reuse){
  List<Object> expected=TriangleRecipeComposition.commands(obj(recipe.get("parameters")));
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());
  same(expected,result.commands,label);session(triangleSession,recipe,result,label,reuse);
  System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static void timed(Map<String,Object> recipe,String label,boolean reuse){
  Map<String,Object> p=new LinkedHashMap<>(obj(recipe.get("parameters")));
  double time=((Number)obj(recipe.get("frameContext")).get("timeSeconds")).doubleValue();
  double frequency=((Number)p.get("frequencyHz")).doubleValue();
  double length=((Number)p.get("markLength")).doubleValue();
  p.put("markLength",length*(1.0+0.75*Math.sin((time*frequency)*6.283185307179586)));
  List<Object> expected=TriangleRecipeComposition.commands(p);
  RecipeEvaluator.Result result=RecipeEvaluator.evaluate(recipe,new RecipeEvaluator.Limits());
  same(expected,result.commands,label);session(timedSession,recipe,result,label,reuse);
  System.out.println(label+" "+expected.size()+" "+result.counters);
 }
 static Map<String,Object> timedRecipe(){return __TIMED__;}
 static Map<String,Object> triangleRecipe(){return __TRIANGLE__;}
 static Map<String,Object> regionRecipe(){return __REGION__;}
 static Map<String,Object> placementRecipe(){return __PLACEMENT__;}
 static Map<String,Object> fieldRecipe(){return __FIELD__;}
 static Map<String,Object> pathRecipe(){return __PATH__;}
 public static void main(String[] args){
  Map<String,Object> f=fieldRecipe();field(f,"field-baseline",false);obj(f.get("parameters")).put("maxLength",32.0);field(f,"field-length",true);obj(f.get("parameters")).put("bars",true);field(f,"field-bars",true);obj(f.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));field(f,"field-palette",true);obj(f.get("parameters")).put("seed",43.0);field(f,"field-seed",false);obj(f.get("parameters")).put("columns",159.0);field(f,"field-count",false);
  Map<String,Object> p=pathRecipe();path(p,"path-baseline",false);obj(p.get("parameters")).put("trace",true);path(p,"path-trace",true);obj(p.get("parameters")).put("steps",2001.0);path(p,"path-steps",false);obj(p.get("parameters")).put("distance",0.8);path(p,"path-distance",false);obj(p.get("parameters")).put("trace",false);obj(p.get("parameters")).put("markLength",24.0);obj(p.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));path(p,"path-style",true);
  Map<String,Object> q=placementRecipe();placement(q,"placement-baseline",false);
  obj(q.get("parameters")).put("lengthScale",0.75);placement(q,"placement-length",true);
  obj(q.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));placement(q,"placement-palette",true);
  obj(q.get("parameters")).put("seed",43.0);placement(q,"placement-seed",false);
  obj(q.get("parameters")).put("attempts",320.0);placement(q,"placement-count",false);
  obj(q.get("parameters")).put("attempts",0.0);placement(q,"placement-empty",false);
  Map<String,Object> regions=regionRecipe();region(regions,"region-baseline",false);
  obj(regions.get("parameters")).put("insetFraction",0.22);region(regions,"region-inset",true);
  obj(regions.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));region(regions,"region-palette",true);
  obj(regions.get("parameters")).put("seed",43.0);region(regions,"region-seed",false);
  obj(regions.get("parameters")).put("replacements",64.0);region(regions,"region-count",false);
  obj(regions.get("parameters")).put("replacements",0.0);region(regions,"region-root",false);
  Map<String,Object> grain=triangleRecipe();triangle(grain,"triangle-baseline",false);
  obj(grain.get("parameters")).put("markLength",6.0);triangle(grain,"triangle-length",true);
  obj(grain.get("parameters")).put("colors",list(0x2E0551,0xFF00C7,0x01AFC2,0xFDBE03,0xF4F9FD));triangle(grain,"triangle-palette",true);
  obj(grain.get("parameters")).put("seed",43.0);triangle(grain,"triangle-seed",false);
  obj(grain.get("parameters")).put("count",1600.0);triangle(grain,"triangle-count",false);
  obj(grain.get("parameters")).put("triangle",list(list(64.0,64.0),list(576.0,320.0),list(64.0,576.0)));triangle(grain,"triangle-shape",false);
  obj(grain.get("parameters")).put("count",0.0);triangle(grain,"triangle-empty",false);
  Map<String,Object> timed=timedRecipe();timed(timed,"timed-zero",false);
  obj(timed.get("frameContext")).put("timeSeconds",0.5);obj(timed.get("frameContext")).put("index",30.0);timed(timed,"timed-later",true);
  timed(timed,"timed-repeat",true);
  obj(timed.get("frameContext")).put("timeSeconds",0.125);obj(timed.get("frameContext")).put("index",7.0);timed(timed,"timed-backward",true);
  obj(timed.get("frameContext")).put("timeSeconds",0.0);obj(timed.get("frameContext")).put("index",0.0);timed(timed,"timed-zero-replay",true);
  System.out.println("COMMAND_COMPARISON_PASSED");
 }
}
'''.replace('__FIELD__', java_value(recipes[0])).replace('__PATH__', java_value(recipes[1])).replace('__PLACEMENT__', java_value(recipes[2])).replace('__REGION__', java_value(recipes[3])).replace('__TRIANGLE__', java_value(recipes[4])).replace('__TIMED__', java_value(recipes[5]))
    inputs = sorted((ROOT / 'packages/java/src/main/java').rglob('*.java'))
    inputs += sorted((ROOT / 'packages/java-processing/src/main/java').rglob('*.java'))
    inputs += sorted((ROOT / 'packages/java-recipe-prototype/src/main/java').rglob('*.java'))
    inputs += [ROOT / p for p in (
        'packages/java/examples/FieldMarks/MarkField.java',
        'packages/java-processing/examples/FieldMarks/MarkCommands.java',
        'packages/java/examples/PathMarks/PathMarkComposition.java',
        'tests/native/RecipePrototypeFailures.java', 'tests/native/PlacementRecipeComposition.java', 'tests/native/RegionRecipeComposition.java', 'tests/native/TriangleRecipeComposition.java')]
    home = java_home(args.java_home)
    metadata = [ROOT / name for name in (
        'catalog/recipes/recipe.schema.json', 'catalog/recipes/execution-bindings.json',
        'design/recipes/expression-model.md', 'design/recipes/runtime-accounting.md',
        'design/recipes/retained-session.md', 'design/recipes/triangle-grain-binding.md', 'design/recipes/explicit-frame-context.md',
        'tools/validate_recipe_draft.py', 'tools/run_grid_conformance.py',
        'tools/generate_recipe_java_schemas.py', 'tools/generate_recipe_java_grammar.py')]
    binding_data = json.loads((ROOT / 'catalog/recipes/execution-bindings.json').read_text())
    metadata += [ROOT / row['contract'] for row in binding_data['operations']]
    metadata += list((ROOT / 'catalog/drawing').glob('*.json'))
    bound = inputs + recipe_paths + metadata + [processing, Path(__file__).resolve(),
        *[home / name for name in ('bin/java', 'bin/javac', 'release', 'lib/modules')]]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}
    output.mkdir(parents=True)
    for original, recipe in zip(recipe_paths, recipes):
        (output / original.name).write_text(json.dumps(recipe, sort_keys=True, allow_nan=False) + '\n')
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
    failures = run([home / 'bin/java', '-Xmx128m', '-cp', str(classes),
                    'RecipePrototypeFailures'], timeout=30)
    if 'PROTOTYPE_FAILURE_CASES_PASSED' not in failures.stdout:
        raise RuntimeError('focused failure probes did not finish')
    if hashes != {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in bound}:
        raise RuntimeError('comparison input changed during execution')
    report = {'status': 'prototype-command-comparison-passed', 'scope': 'Thirty-five fresh/session command scenarios and focused failure probes; complete budget/type/replay, cache, export and native acceptance remain pending.',
              'input_sha256': hashes, 'roundtripped_recipes': [p.name for p in recipe_paths], 'stdout': result.stdout, 'failure_stdout': failures.stdout}
    (output / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(result.stdout + failures.stdout)


if __name__ == '__main__':
    main()
