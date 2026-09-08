import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;

/** Ordered recurrence and spring snapshot admission probes; no renderer claim. */
public final class RecipeScanProbe {
    static Map<String,Object> map(Object... x){return RecipePrototypeComparison.map(x);}
    static List<Object> list(Object... x){return RecipePrototypeComparison.list(x);}
    static Map<String,Object> lit(Object x){return map("kind","literal","value",x);}
    static Map<String,Object> ref(String x){return map("kind","ref","name",x);}
    static Map<String,Object> rec(Object... fields){List<Object> f=new ArrayList<>();for(int i=0;i<fields.length;i+=2)f.add(map("name",fields[i],"value",fields[i+1]));return map("kind","record","fields",f);}
    static Map<String,Object> scan(Object items,Object initial){return map("kind","scan","items",items,"initial",initial,"as","item","indexAs","index","stateAs","previous","value",map("kind","math","op","add","args",list(ref("previous"),ref("item"))));}
    static Map<String,Object> recipe(Object value){return RecipePrototypeFailures.recipe(RecipePrototypeFailures.binding(value),list());}
    static RecipeEvaluator.RecipeFailure fails(Map<String,Object> r,RecipeEvaluator.Limits l,String code){return RecipePrototypeFailures.failure(r,l,code);}
    static void check(boolean b,String text){if(!b)throw new AssertionError(text);}
    static Map<String,Object> springInput(Object position,Object target){return map("state",map("bodies",list(map("position",position,"velocity",list(0,0),"strength",0.025,"retention",0.7))),"targets",list(target));}
    static Map<String,Object> spring(Object input){return RecipePrototypeFailures.operationRecipe("motion.target-springs-2d",map("kind","construct","operation","motion.target-springs-2d","input",lit(input)));}
    public static void main(String[] args){
        Map<String,Object> s=scan(lit(list(1,2,3)),lit(10)),r=recipe(s);
        Object from=map("kind","array","items",list(ref("sum"),lit(0)));
        Object to=map("kind","array","items",list(ref("sum"),lit(1)));
        Object command=rec("kind",lit("segment2"),"from",from,"to",to,"rgb",lit(0),"opacity8",lit(255),"width",lit(1),"cap",lit("round"));
        r.put("frame",list(map("kind","for","items",ref("value"),"as","sum","indexAs","i","body",list(map("kind","emit","value",command)))));
        RecipeEvaluator.Result result=RecipeEvaluator.evaluate(r,new RecipeEvaluator.Limits());
        double[] sums={11,13,16};
        for(int i=0;i<3;i++)check(((Number)((List<?>)((Map<?,?>)result.commands.get(i)).get("from")).get(0)).doubleValue()==sums[i],"wrong scan prefix");
        Object division=map("kind","math","op","div","args",list(lit(1),lit(0)));
        RecipeEvaluator.RecipeFailure error=fails(recipe(scan(lit(list()),division)),new RecipeEvaluator.Limits(),"ARITHMETIC");
        check(error.path.equals("/retain/0/value/initial"),"empty scan skipped initial");
        fails(recipe(scan(lit(1),division)),new RecipeEvaluator.Limits(),"TYPE");
        RecipeEvaluator.Limits array=new RecipeEvaluator.Limits();array.arrayLength=2;fails(r,array,"LIMIT_ARRAY_LENGTH");
        RecipeEvaluator.Limits iterations=new RecipeEvaluator.Limits();iterations.iterations=1;
        error=fails(r,iterations,"LIMIT_ITERATIONS");check(error.iteration.contains("/retain/0/value/1"),"scan iteration lost");
        s.put("stateAs","index");fails(r,new RecipeEvaluator.Limits(),"DUPLICATE_LOCAL");
        RecipeEvaluator.evaluate(recipe(scan(lit(list()),lit(10))),new RecipeEvaluator.Limits());
        Map<String,Object> input=springInput(list(0,0),list(1,1));
        RecipeEvaluator.Limits packed=new RecipeEvaluator.Limits();packed.arrayLength=5;fails(spring(input),packed,"LIMIT_ARRAY_LENGTH");
        RecipeEvaluator.Limits work=new RecipeEvaluator.Limits();work.work=1;fails(spring(input),work,"LIMIT_WORK");
        input.put("targets",list());error=fails(spring(input),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check(error.original.equals("INVALID_INPUT"),"target cardinality code lost");
        error=fails(spring(springInput(list(-Double.MAX_VALUE,0),list(Double.MAX_VALUE,0))),new RecipeEvaluator.Limits(),"OPERATION_FAILURE");
        check(error.original.equals("SPRING_ARITHMETIC_INVALID body=0 axis=x stage=delta"),"spring arithmetic detail lost");
        check(error.operation.equals("motion.target-springs-2d"),"spring identity lost");
        System.out.println("SCAN_PROBES_PASSED prefix recurrence, empty/initial order, local scope, iteration/array budgets and spring admission/arithmetic");
    }
}
