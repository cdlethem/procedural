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
        return map("parameters",map(),"operations",list(),"retain",retain,"frame",frame,
                "environment",literal(map("width",64,"height",64,"density",1,"background",0)));
    }
    static Object binding(Object value) { return list(map("name","value","value",value)); }
    static void check(boolean yes,String message) { if(!yes)throw new AssertionError(message); }
    static RecipeEvaluator.RecipeFailure failure(Map<String,Object> recipe, RecipeEvaluator.Limits limits,String code) {
        try { RecipeEvaluator.evaluate(recipe,limits); throw new AssertionError("expected "+code); }
        catch(RecipeEvaluator.RecipeFailure error) { check(code.equals(error.code),"expected "+code+", got "+error.code); return error; }
    }
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
        System.out.println("PROTOTYPE_FAILURE_CASES_PASSED");
    }
}
