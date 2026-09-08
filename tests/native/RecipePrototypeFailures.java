import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;

/** Focused prototype failures; no renderer or executor acceptance claim. */
public final class RecipePrototypeFailures {
    static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i=0; i<pairs.length; i+=2) result.put((String)pairs[i], pairs[i+1]);
        return result;
    }
    static List<Object> list(Object... values) { return new ArrayList<>(Arrays.asList(values)); }
    static Map<String,Object> literal(Object value) { return map("kind","literal","value",value); }
    static Map<String,Object> arithmetic(String op,Object... args) { return map("kind","math","op",op,"args",list(args)); }
    static Map<String,Object> recipe(Object retain,Object frame) {
        return map("format","procedurals.recipe","version","0.1.0","status","draft",
                "drawing",map("id","drawing.fresh-raster-2d","version","0.1.0"),
                "parameters",map(),"operations",list(),"retain",retain,"frame",frame,
                "environment",literal(map("width",64,"height",64,"density",1,"background",0)));
    }
    static Object binding(Object value) { return list(map("name","value","value",value)); }
    static Map<String,Object> operationRecipe(String id,Object value) {
        Map<String,Object> result=recipe(binding(value),list());
        result.put("operations",list(map("id",id,"version","0.1.0")));
        return result;
    }
    static Map<String,Object> gridValuesRecipe() {
        Object input=literal(map("origin",list(0,0),"spacing",list(1,1),"columns",1,"rows",1));
        Object grid=map("kind","construct","operation","layout.regular-grid","input",input);
        Object values=map("kind","values","instance",map("kind","ref","name","grid"));
        Map<String,Object> result=recipe(list(map("name","grid","value",grid),map("name","descriptor","value",values)),list());
        result.put("operations",list(map("id","layout.regular-grid","version","0.1.0")));
        return result;
    }
    static void check(boolean yes,String message) { if(!yes)throw new AssertionError(message); }
    static RecipeEvaluator.RecipeFailure failure(Map<String,Object> recipe, RecipeEvaluator.Limits limits,String code) {
        try { RecipeEvaluator.evaluate(recipe,limits); throw new AssertionError("expected "+code); }
        catch(RecipeEvaluator.RecipeFailure error) { check(code.equals(error.code),"expected "+code+", got "+error.code); return error; }
    }
    static Map<String,Object> placementInput(int attempts) {
        return map("seed",42,"attempts",attempts,"origin",list(32,32),"extent",list(576,576),
                "radiusRange",list(4,28),"separationScale",1);
    }
    static Map<String,Object> placementRecipe(Map<String,Object> input) {
        return operationRecipe("sampling.seeded-circle-placement-2d",map("kind","construct",
                "operation","sampling.seeded-circle-placement-2d","input",literal(input)));
    }
    static void placementAdmission() {
        RecipeEvaluator.evaluate(placementRecipe(placementInput(0)),new RecipeEvaluator.Limits());
        RecipeEvaluator.evaluate(placementRecipe(placementInput(64)),new RecipeEvaluator.Limits());
        RecipeEvaluator.Limits work=new RecipeEvaluator.Limits();work.work=1;
        failure(placementRecipe(placementInput(64)),work,"LIMIT_WORK");
        RecipeEvaluator.Limits array=new RecipeEvaluator.Limits();array.arrayLength=64;
        failure(placementRecipe(placementInput(64)),array,"LIMIT_ARRAY_LENGTH");
        RecipeEvaluator.Limits values=new RecipeEvaluator.Limits();values.valueUnits=100;
        failure(placementRecipe(placementInput(64)),values,"LIMIT_VALUE_UNITS");
        Map<String,Object> reversed=placementInput(1);reversed.put("radiusRange",list(28,4));
        RecipeEvaluator.RecipeFailure error=failure(placementRecipe(reversed),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check("INVALID_INPUT".equals(error.original),"placement native input code");
        Map<String,Object> overflow=placementInput(1);overflow.put("origin",list(Double.MAX_VALUE,0));overflow.put("extent",list(Double.MAX_VALUE,1));
        error=failure(placementRecipe(overflow),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check(error.original.equals("PLACEMENT_ARITHMETIC_INVALID candidate=0 stage=proposal_x"),"placement arithmetic metadata");
        check(error.operation.equals("sampling.seeded-circle-placement-2d"),"placement operation identity");
        // Exhausted work rejects before the deliberately overflowing core proposal runs.
        failure(placementRecipe(overflow),work,"LIMIT_WORK");
        System.out.println("placement-budgets-and-native-errors passed");
    }
    @SuppressWarnings("unchecked") static Map<String,Object> obj(Object value) { return (Map<String,Object>)value; }
    static void frameContextAdmission() {
        Map<String,Object> r=gridValuesRecipe();
        r.put("frameContext",map("index",23,"timeSeconds",0.5));
        r.put("environment",map("kind","record","fields",list(
                map("name","width","value",literal(64)),map("name","height","value",literal(64)),
                map("name","density","value",literal(1)),map("name","background","value",
                map("kind","get","value",map("kind","ref","name","clock"),"key","index")))));
        RecipeEvaluator.Session session=new RecipeEvaluator.Session();
        RecipeEvaluator.Result first=session.evaluate(r,new RecipeEvaluator.Limits());
        check(((Number)first.environment.get("background")).intValue()==23,"explicit clock index unavailable");
        for(Object bad:list(map("index",0),map("index",-1,"timeSeconds",0),
                map("index",0.5,"timeSeconds",0),map("index",9007199254740992.0,"timeSeconds",0),
                map("index",0,"timeSeconds",-0.1),map("index",0,"timeSeconds",0,"extra",0))) {
            r.put("frameContext",bad);
            failure(r,new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
            try { session.evaluate(r,new RecipeEvaluator.Limits());throw new AssertionError("invalid clock admitted"); }
            catch(RecipeEvaluator.RecipeFailure expected){check(expected.code.equals("SCHEMA_INVALID"),"clock schema failure");}
        }
        r.put("frameContext",map("index",0,"timeSeconds",Double.POSITIVE_INFINITY));
        failure(r,new RecipeEvaluator.Limits(),"NONFINITE_NUMBER");
        r.put("frameContext",map("index",0,"timeSeconds",0));
        check(session.evaluate(r,new RecipeEvaluator.Limits()).retainedReused,"invalid clock destroyed retained cache");
        check(((Number)first.environment.get("background")).intValue()==23,"clock input aliased prior result");
        Map<String,Object> retainClock=recipe(binding(map("kind","ref","name","clock")),list());
        retainClock.put("frameContext",map("index",0,"timeSeconds",0));
        failure(retainClock,new RecipeEvaluator.Limits(),"UNBOUND_NAME");
        Map<String,Object> collision=recipe(list(map("name","clock","value",literal(1))),list());
        RecipeEvaluator.evaluate(collision,new RecipeEvaluator.Limits()); // Previous documents remain valid.
        collision.put("frameContext",map("index",0,"timeSeconds",0));
        RecipeEvaluator.RecipeFailure error=failure(collision,new RecipeEvaluator.Limits(),"SHADOWED_NAME");
        check(error.path.equals("/frameContext"),"clock collision pointer");
        r.remove("frameContext");failure(r,new RecipeEvaluator.Limits(),"UNBOUND_NAME");
        System.out.println("explicit-frame-context-and-cache-recovery passed");
    }
    static Map<String,Object> triangleRecipe(int count) {
        return operationRecipe("sampling.seeded-triangle-points-2d",map("kind","construct",
                "operation","sampling.seeded-triangle-points-2d","input",literal(map(
                "seed",42,"count",count,"triangle",list(list(0,0),list(1,0),list(0,1))))));
    }
    static void triangleAdmission() {
        RecipeEvaluator.evaluate(triangleRecipe(0),new RecipeEvaluator.Limits());
        RecipeEvaluator.Limits packed=new RecipeEvaluator.Limits();packed.arrayLength=100;
        failure(triangleRecipe(64),packed,"LIMIT_ARRAY_LENGTH");
        RecipeEvaluator.Limits work=new RecipeEvaluator.Limits();work.work=1000;
        failure(triangleRecipe(64),work,"LIMIT_WORK");
        RecipeEvaluator.Limits units=new RecipeEvaluator.Limits();units.valueUnits=100;
        failure(triangleRecipe(64),units,"LIMIT_VALUE_UNITS");
        // The representational ceiling must fail before attempting a multi-gigabyte allocation.
        failure(triangleRecipe(1073741823),new RecipeEvaluator.Limits(),"LIMIT_ARRAY_LENGTH");
        Map<String,Object> malformed=triangleRecipe(0);
        Map<String,Object> construct=obj(obj(((List<?>)malformed.get("retain")).get(0)).get("value"));
        obj(obj(construct.get("input")).get("value")).put("triangle",list(list(0,0),list(1,0),list(0)));
        failure(malformed,new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        System.out.println("triangle-packed-capacity-and-schema passed");
    }
    static Map<String,Object> partitionInput(int replacements) {
        return map("seed",42,"replacements",replacements,"origin",list(32,32),"extent",list(576,576),"selectionFraction",0.5);
    }
    static Map<String,Object> partitionRecipe(Map<String,Object> input) {
        return operationRecipe("layout.seeded-quadrant-partition-2d",map("kind","construct",
                "operation","layout.seeded-quadrant-partition-2d","input",literal(input)));
    }
    static void partitionAdmission() {
        RecipeEvaluator.evaluate(partitionRecipe(partitionInput(0)),new RecipeEvaluator.Limits());
        RecipeEvaluator.Limits transientArray=new RecipeEvaluator.Limits();transientArray.arrayLength=4;
        failure(partitionRecipe(partitionInput(1)),transientArray,"LIMIT_ARRAY_LENGTH");
        RecipeEvaluator.Limits work=new RecipeEvaluator.Limits();work.work=1;
        failure(partitionRecipe(partitionInput(48)),work,"LIMIT_WORK");
        RecipeEvaluator.Limits units=new RecipeEvaluator.Limits();units.valueUnits=100;
        failure(partitionRecipe(partitionInput(48)),units,"LIMIT_VALUE_UNITS");
        Map<String,Object> rectangle=partitionInput(0);rectangle.put("origin",list(Double.MAX_VALUE,0));rectangle.put("extent",list(Double.MAX_VALUE,1));
        RecipeEvaluator.RecipeFailure error=failure(partitionRecipe(rectangle),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check(error.original.equals("INVALID_RECTANGLE"),"partition root arithmetic error");
        Map<String,Object> midpoint=partitionInput(1);midpoint.put("origin",list(1,0));midpoint.put("extent",list(Math.ulp(1.0),1));
        error=failure(partitionRecipe(midpoint),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check(error.original.equals("PARTITION_ARITHMETIC_INVALID replacement=0 stage=midpoint_x"),"partition midpoint context");
        failure(partitionRecipe(midpoint),work,"LIMIT_WORK");
        System.out.println("partition-transient-capacity-and-native-errors passed");
    }
    static void structuralAdmission() {
        Map<String,Object> bad=recipe(list(),list());bad.put("format","other");
        failure(bad,new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
        bad=recipe(list(),list());bad.put("drawing",map("id","other","version","0.1.0"));
        failure(bad,new RecipeEvaluator.Limits(),"UNKNOWN_DRAWING");
        Object unbound=map("kind","ref","name","missing");
        Object branch=map("kind","if","condition",literal(true),"then",literal(1),"else",unbound);
        RecipeEvaluator.RecipeFailure e=failure(recipe(binding(branch),list()),new RecipeEvaluator.Limits(),"UNBOUND_NAME");
        check(e.path.equals("/retain/0/value/else/name"),"unselected lexical path");
        Map<String,Object> extra=literal(1);extra.put("unexpected",0);
        branch=map("kind","if","condition",literal(true),"then",literal(1),"else",extra);
        failure(recipe(binding(branch),list()),new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
        failure(recipe(binding(arithmetic("add",literal(1))),list()),new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
        Object duplicate=map("kind","record","fields",list(map("name","x","value",literal(1)),map("name","x","value",literal(2))));
        failure(recipe(binding(duplicate),list()),new RecipeEvaluator.Limits(),"DUPLICATE_FIELD");
        failure(recipe(list(),list(map("kind","when","condition",literal(false),"body",list(map("kind","emit","value",unbound))))),new RecipeEvaluator.Limits(),"UNBOUND_NAME");
        // Literal records resembling syntax remain data.
        RecipeEvaluator.evaluate(recipe(binding(literal(unbound)),list()),new RecipeEvaluator.Limits());
        failure(recipe(binding(literal(new Object())),list()),new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
        failure(recipe(binding(literal(new java.math.BigDecimal("1"))),list()),new RecipeEvaluator.Limits(),"SCHEMA_INVALID");
        List<Object> cycle=new ArrayList<>();cycle.add(cycle);
        failure(recipe(binding(literal(cycle)),list()),new RecipeEvaluator.Limits(),"AST_DEPTH_LIMIT");
        failure(recipe(binding(literal(Collections.nCopies(20001,0))),list()),new RecipeEvaluator.Limits(),"AST_SIZE_LIMIT");
        Object nested=0;for(int i=0;i<60;i++)nested=list(nested);
        RecipeEvaluator.evaluate(recipe(binding(literal(nested)),list()),new RecipeEvaluator.Limits());
        Map<String,Object> valid=recipe(binding(literal(1)),list());
        RecipeEvaluator.Session session=new RecipeEvaluator.Session();session.evaluate(valid,new RecipeEvaluator.Limits());
        try {session.evaluate(bad,new RecipeEvaluator.Limits());throw new AssertionError("session admitted wrong drawing");}
        catch(RecipeEvaluator.RecipeFailure error){check("UNKNOWN_DRAWING".equals(error.code),"session admission error");}
        check(session.evaluate(valid,new RecipeEvaluator.Limits()).retainedReused,"admission failure evicted retained cache");
        System.out.println("structural-admission-and-session-recovery passed");
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        Object division=arithmetic("div",literal(1),literal(0));
        RecipeEvaluator.evaluate(recipe(binding(map("kind","if","condition",literal(true),"then",literal(1),"else",division)),list()),new RecipeEvaluator.Limits());
        check("/retain/0/value".equals(failure(recipe(binding(division),list()),new RecipeEvaluator.Limits(),"ARITHMETIC").path),"arithmetic path");
        failure(recipe(binding(arithmetic("add",literal(true),literal(1))),list()),new RecipeEvaluator.Limits(),"TYPE");
        System.out.println("lazy-branch-and-types passed");

        RecipeEvaluator.Limits small=new RecipeEvaluator.Limits();small.arrayLength=2;
        Object range=map("kind","range","start",literal(0),"stop",literal(3),"step",literal(1));
        failure(recipe(binding(range),list()),small,"LIMIT_ARRAY_LENGTH");
        System.out.println("array-preallocation-limit passed");

        Map<String,Object> command=map("kind","segment2","from",list(0,0),"to",list(1,1),"rgb",0,"opacity8",255,"width",1,"cap","round");
        Object emit=map("kind","emit","value",literal(command));
        RecipeEvaluator.Limits commands=new RecipeEvaluator.Limits();commands.commands=1;
        failure(recipe(list(),list(emit,emit)),commands,"LIMIT_COMMANDS");
        check(RecipeEvaluator.evaluate(recipe(list(),list(emit)),commands).commands.size()==1,"failure contaminated next evaluation");
        System.out.println("command-limit-and-recovery passed");

        Object nested=map("kind","map","items",literal(list(0)),"as","outer","indexAs","outerIndex","value",
                map("kind","map","items",literal(list(0)),"as","inner","indexAs","innerIndex","value",division));
        RecipeEvaluator.RecipeFailure error=failure(recipe(binding(nested),list()),new RecipeEvaluator.Limits(),"ARITHMETIC");
        check(error.iteration!=null && error.iteration.contains("/retain/0/value/0") && error.iteration.contains("/retain/0/value/value/0"),"nested arithmetic lost iteration context: "+error.iteration);
        System.out.println("nested-iteration-diagnostic passed");
        Object loop=map("kind","for","items",literal(list(0)),"as","item","indexAs","index",
                "body",list(map("kind","bind","name","bad","value",division)));
        error=failure(recipe(list(),list(loop)),new RecipeEvaluator.Limits(),"ARITHMETIC");
        check("/frame/0/0".equals(error.iteration),"statement loop diagnostic");
        RecipeEvaluator.Limits iterations=new RecipeEvaluator.Limits();iterations.iterations=1;
        Object two=map("kind","map","items",literal(list(0,1)),"as","item","indexAs","index","value",literal(0));
        error=failure(recipe(binding(two),list()),iterations,"LIMIT_ITERATIONS");
        check("/retain/0/value/1".equals(error.iteration),"budget failure lost attempted iteration");
        System.out.println("statement-and-budget-iteration-diagnostics passed");
        Map<String,Object> ownedRecipe=recipe(list(),list(emit));
        RecipeEvaluator.Result owned=RecipeEvaluator.evaluate(ownedRecipe,new RecipeEvaluator.Limits());
        Map<?,?> oldCommand=(Map<?,?>)owned.commands.get(0);
        command.put("rgb",0xffffff);
        check(((Number)oldCommand.get("rgb")).intValue()==0,"input edit changed prior result");
        try {
            ((List<Object>)oldCommand.get("from")).set(0,99);
            throw new AssertionError("nested result coordinates are mutable");
        } catch(UnsupportedOperationException expected) { }
        RecipeEvaluator.Result replay=RecipeEvaluator.evaluate(ownedRecipe,new RecipeEvaluator.Limits());
        check(((Number)((Map<?,?>)replay.commands.get(0)).get("rgb")).intValue()==0xffffff,"fresh evaluation did not use edited input");
        check(((Number)oldCommand.get("rgb")).intValue()==0,"replay changed prior result");
        RecipeEvaluator.Limits snapshotBudget=new RecipeEvaluator.Limits();snapshotBudget.valueUnits=12;
        failure(ownedRecipe,snapshotBudget,"LIMIT_VALUE_UNITS");
        System.out.println("detached-results-and-fresh-replay passed");
        RecipeEvaluator.Limits widened=new RecipeEvaluator.Limits();
        widened.arrayLength=Long.MAX_VALUE;widened.valueUnits=Long.MAX_VALUE;
        Object huge=map("kind","range","start",literal(0),"stop",literal(2147483648.0),"step",literal(1));
        failure(recipe(binding(huge),list()),widened,"LIMIT_ARRAY_LENGTH");
        System.out.println("native-array-index-ceiling passed");
        RecipeEvaluator.Limits copyUnits=new RecipeEvaluator.Limits();copyUnits.valueUnits=8;
        failure(gridValuesRecipe(),copyUnits,"LIMIT_VALUE_UNITS");
        RecipeEvaluator.Limits copyWork=new RecipeEvaluator.Limits();copyWork.work=10;
        failure(gridValuesRecipe(),copyWork,"LIMIT_WORK");
        RecipeEvaluator.Limits snapshot=new RecipeEvaluator.Limits();snapshot.valueUnits=1000;
        final RecipeEvaluator.Limits callerLimits=snapshot;
        Map<String,Object> changingRecipe=new LinkedHashMap<String,Object>(gridValuesRecipe()) {
            @Override public Object get(Object key) {
                if ("parameters".equals(key)) callerLimits.valueUnits=1;
                return super.get(key);
            }
        };
        RecipeEvaluator.Result descriptor=RecipeEvaluator.evaluate(changingRecipe,snapshot);
        check(descriptor.counters.get("work").longValue()==11,"grid values work reservation");
        RecipeEvaluator.Limits gridArrays=new RecipeEvaluator.Limits();gridArrays.arrayLength=1;
        failure(gridValuesRecipe(),gridArrays,"LIMIT_ARRAY_LENGTH");
        System.out.println("values-copy-boundaries-and-limit-snapshot passed");
        Object badPalette=map("kind","construct","operation","color.cyclic-palette",
                "input",literal(map("colors",list(true))));
        error=failure(operationRecipe("color.cyclic-palette",badPalette),new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        check("/retain/0/value/input".equals(error.path) && error.getMessage().contains("/colors/0"),"palette schema diagnostic");
        Object hugePath=map("kind","construct","operation","path.gradient-trace-2d","input",literal(map(
                "field",map("seed",0),"start",list(0,0),"steps",1073741823L,"stepDistance",0,
                "fieldScale",1,"fieldOffset",list(0,0),"angleBase",0,"angleScale",1)));
        failure(operationRecipe("path.gradient-trace-2d",hugePath),new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        Object gridOverflow=map("kind","construct","operation","layout.regular-grid","input",literal(map(
                "origin",list(0,0),"spacing",list(1,1),"columns",2147483647L,"rows",2147483647L)));
        error=failure(operationRecipe("layout.regular-grid",gridOverflow),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check("GRID_SIZE_OVERFLOW".equals(error.original),"native grid error changed");
        Object smallPath=map("kind","construct","operation","path.gradient-trace-2d","input",literal(map(
                "field",map("seed",0),"start",list(0,0),"steps",10,"stepDistance",0,
                "fieldScale",1,"fieldOffset",list(0,0),"angleBase",0,"angleScale",1)));
        RecipeEvaluator.Limits pathWork=new RecipeEvaluator.Limits();pathWork.work=1;
        failure(operationRecipe("path.gradient-trace-2d",smallPath),pathWork,"LIMIT_WORK");
        Object grid=map("kind","construct","operation","layout.regular-grid","input",literal(map(
                "origin",list(0,0),"spacing",list(1,1),"columns",1,"rows",1)));
        Object badPort=map("kind","query","instance",grid,"port","sample","input",division);
        Map<String,Object> portRecipe=operationRecipe("layout.regular-grid",badPort);
        ((List<Object>)portRecipe.get("operations")).add(map("id","field.gradient-noise-2d-01","version","0.1.0"));
        failure(portRecipe,new RecipeEvaluator.Limits(),"PORT");
        Object undeclared=map("kind","construct","operation","path.gradient-trace-2d","input",division);
        failure(recipe(binding(undeclared),list()),new RecipeEvaluator.Limits(),"UNDECLARED_CONSTRUCT");
        Map<String,Object> badOne=map("origin",list(0,0),"spacing",list(1,1),"columns",true,"rows",true);
        Map<String,Object> badTwo=map("rows",true,"columns",true,"spacing",list(1,1),"origin",list(0,0));
        error=failure(operationRecipe("layout.regular-grid",map("kind","construct","operation","layout.regular-grid","input",literal(badOne))),new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        RecipeEvaluator.RecipeFailure reordered=failure(operationRecipe("layout.regular-grid",map("kind","construct","operation","layout.regular-grid","input",literal(badTwo))),new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        check(error.path.equals(reordered.path) && error.getMessage().equals(reordered.getMessage()),"input order changed schema diagnostic");
        Object nonfinite=map("kind","construct","operation","color.cyclic-palette","input",literal(map("colors",list(Double.NaN))));
        failure(operationRecipe("color.cyclic-palette",nonfinite),new RecipeEvaluator.Limits(),"NONFINITE_NUMBER");
        Object nestedSchema=map("kind","map","items",literal(list(0)),"as","item","indexAs","index",
                "value",map("kind","construct","operation","color.cyclic-palette","input",literal(map("colors",list(true)))));
        error=failure(operationRecipe("color.cyclic-palette",nestedSchema),new RecipeEvaluator.Limits(),"INPUT_SCHEMA");
        check(error.iteration != null && error.path.endsWith("/input"),"nested schema diagnostic location");
        System.out.println("runtime-schema-admission passed");

        RecipeEvaluator.Limits visits=new RecipeEvaluator.Limits();visits.visits=1;
        failure(recipe(binding(literal(1)),list()),visits,"LIMIT_VISITS");
        RecipeEvaluator.Limits calls=new RecipeEvaluator.Limits();calls.calls=1;
        failure(gridValuesRecipe(),calls,"LIMIT_CALLS");
        Object negativeRemainder=map("kind","if","condition",arithmetic("eq",
                arithmetic("rem",literal(-3),literal(2)),literal(-1)),"then",literal(1),"else",division);
        RecipeEvaluator.evaluate(recipe(binding(negativeRemainder),list()),new RecipeEvaluator.Limits());
        Object emptyRange=map("kind","map","items",map("kind","range","start",literal(5),"stop",literal(0),"step",literal(1)),
                "as","item","indexAs","index","value",division);
        RecipeEvaluator.evaluate(recipe(binding(emptyRange),list()),new RecipeEvaluator.Limits());
        RecipeEvaluator.Limits rejectedWork=new RecipeEvaluator.Limits();rejectedWork.work=1;
        failure(operationRecipe("path.gradient-trace-2d",smallPath),rejectedWork,"LIMIT_WORK");
        RecipeEvaluator.evaluate(operationRecipe("path.gradient-trace-2d",smallPath),new RecipeEvaluator.Limits());
        System.out.println("visit-call-remainder-empty-and-operation-recovery passed");

        Map<String,Object> retainedCommand=map("kind","segment2","from",list(0,0),"to",list(1,1),
                "rgb",0,"opacity8",255,"width",1,"cap","round");
        Object retainedEmit=map("kind","emit","value",map("kind","ref","name","value"));
        Map<String,Object> retainedRecipe=recipe(binding(literal(retainedCommand)),list(retainedEmit));
        RecipeEvaluator.Session session=new RecipeEvaluator.Session();
        RecipeEvaluator.Result sessionCold=session.evaluate(retainedRecipe,new RecipeEvaluator.Limits());
        check(!sessionCold.retainedReused && sessionCold.retainedExecutedCalls==0
                && sessionCold.retainedReservedUnits==0,"cold retained diagnostics");
        RecipeEvaluator.Result sessionWarm=session.evaluate(retainedRecipe,new RecipeEvaluator.Limits());
        check(sessionWarm.retainedReused && sessionWarm.retainedExecutedCalls==0
                && sessionWarm.retainedReservedUnits>0,"warm retained diagnostics");
        check(sessionCold.commands.equals(sessionWarm.commands),"warm commands differ from cold");

        RecipeEvaluator.Limits warmValues=new RecipeEvaluator.Limits();warmValues.valueUnits=1;
        try {
            session.evaluate(retainedRecipe,warmValues);
            throw new AssertionError("warm retained value reservation did not reject");
        } catch (RecipeEvaluator.RecipeFailure expected) {
            check("LIMIT_VALUE_UNITS".equals(expected.code),"wrong warm value failure");
        }
        RecipeEvaluator.Limits warmArrays=new RecipeEvaluator.Limits();warmArrays.arrayLength=1;
        try {
            session.evaluate(retainedRecipe,warmArrays);
            throw new AssertionError("warm retained array reservation did not reject");
        } catch (RecipeEvaluator.RecipeFailure expected) {
            check("LIMIT_ARRAY_LENGTH".equals(expected.code),"wrong warm array failure");
        }

        retainedCommand.put("rgb",0xffffff);
        Map<String,Object> equivalentCommand=map("kind","segment2","from",list(0,0),"to",list(1,1),
                "rgb",0,"opacity8",255,"width",1,"cap","round");
        Map<String,Object> equivalentRecipe=recipe(binding(literal(equivalentCommand)),list(retainedEmit));
        RecipeEvaluator.Result detachedWarm=session.evaluate(equivalentRecipe,new RecipeEvaluator.Limits());
        check(detachedWarm.retainedReused,"equivalent detached literal should reuse cache");
        check(((Number)((Map<?,?>)detachedWarm.commands.get(0)).get("rgb")).intValue()==0,
                "cached retained literal changed after source mutation");

        Map<String,Object> failedFrame=recipe(binding(literal(equivalentCommand)),
                list(map("kind","emit","value",division)));
        try {
            session.evaluate(failedFrame,new RecipeEvaluator.Limits());
            throw new AssertionError("expected failed warm frame");
        } catch (RecipeEvaluator.RecipeFailure expected) {
            check("ARITHMETIC".equals(expected.code),"wrong warm frame failure");
        }
        check(session.evaluate(equivalentRecipe,new RecipeEvaluator.Limits()).retainedReused,
                "failed warm frame evicted cache");
        session.clear();
        check(!session.evaluate(equivalentRecipe,new RecipeEvaluator.Limits()).retainedReused,
                "clear did not evict cache");
        RecipeEvaluator.Session indirect=new RecipeEvaluator.Session();
        Map<String,Object> indirectRecipe=recipe(binding(map("kind","ref","name","params")),list());
        ((Map<String,Object>)indirectRecipe.get("parameters")).put("a",1);
        indirect.evaluate(indirectRecipe,new RecipeEvaluator.Limits());
        check(indirect.evaluate(indirectRecipe,new RecipeEvaluator.Limits()).retainedReused,"bare params warm miss");
        ((Map<String,Object>)indirectRecipe.get("parameters")).put("a",2);
        check(!indirect.evaluate(indirectRecipe,new RecipeEvaluator.Limits()).retainedReused,"bare params edit reused stale stage");
        RecipeEvaluator.Session recovery=new RecipeEvaluator.Session();
        Map<String,Object> pathRecipe=operationRecipe("path.gradient-trace-2d",smallPath);
        recovery.evaluate(pathRecipe,new RecipeEvaluator.Limits());
        RecipeEvaluator.Limits warmWork=new RecipeEvaluator.Limits();warmWork.work=1;
        check(recovery.evaluate(pathRecipe,warmWork).retainedReused,"warm cache charged skipped path work");
        try {
            recovery.evaluate(operationRecipe("path.gradient-trace-2d",division),new RecipeEvaluator.Limits());
            throw new AssertionError("failed cache miss unexpectedly succeeded");
        } catch(RecipeEvaluator.RecipeFailure expected) { check("ARITHMETIC".equals(expected.code),"failed miss code"); }
        check(!recovery.evaluate(pathRecipe,new RecipeEvaluator.Limits()).retainedReused,"failed miss did not evict old stage");
        Map<String,Object> failedCold=recipe(binding(literal(9)),list(map("kind","bind","name","bad","value",division)));
        try { recovery.evaluate(failedCold,new RecipeEvaluator.Limits()); throw new AssertionError("failed cold frame succeeded"); }
        catch(RecipeEvaluator.RecipeFailure expected) { check("ARITHMETIC".equals(expected.code),"cold frame failure code"); }
        failedCold.put("frame",list());
        check(!recovery.evaluate(failedCold,new RecipeEvaluator.Limits()).retainedReused,"failed frame published new cache");
        System.out.println("retained-session-cache-and-reservations passed");
        structuralAdmission();
        placementAdmission();
        partitionAdmission();
        triangleAdmission();
        frameContextAdmission();
        System.out.println("PROTOTYPE_FAILURE_CASES_PASSED");
    }
}
