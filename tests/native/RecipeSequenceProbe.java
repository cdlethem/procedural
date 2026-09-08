import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
import org.procedurals.recipe.RecipeSequence;

/** Sequence orchestration checks against independently evaluated, already-oracled snapshots. */
public final class RecipeSequenceProbe {
    static Map<String,Object> map(Object... x){return RecipePrototypeComparison.map(x);}
    static List<Object> list(Object... x){return RecipePrototypeComparison.list(x);}
    static Map<String,Object> obj(Object x){return RecipePrototypeComparison.obj(x);}
    static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    static RecipeSequence.SequenceFailure failure(Map<String,Object> recipe,List<?> contexts,
            RecipeEvaluator.Limits perFrame,RecipeEvaluator.Limits total,int max,String code,int position){
        try{RecipeSequence.evaluate(recipe,contexts,perFrame,total,max);throw new AssertionError("expected "+code);}
        catch(RecipeSequence.SequenceFailure error){
            check(error.position==position,"sequence failure position: "+error.position);
            check(error.getCause() instanceof RecipeEvaluator.RecipeFailure,"missing recipe failure cause");
            check(((RecipeEvaluator.RecipeFailure)error.getCause()).code.equals(code),"wrong cause: "+error.getCause());
            return error;
        }
    }
    public static void main(String[] args){
        Map<String,Object> recipe=RecipePrototypeComparison.timedRecipe();
        List<Object> contexts=list(map("index",0,"timeSeconds",0),map("index",30,"timeSeconds",0.5),
                map("index",30,"timeSeconds",0.5),map("index",7,"timeSeconds",0.125));
        RecipeSequence.Result result=RecipeSequence.evaluate(recipe,contexts,new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),8);
        check(result.frames.size()==4,"frame count");
        Map<String,Long> sums=new LinkedHashMap<>();
        for(int i=0;i<4;i++){
            Map<String,Object> snapshot=new LinkedHashMap<>(recipe);snapshot.put("frameContext",contexts.get(i));
            RecipeEvaluator.Result expected=RecipeEvaluator.evaluate(snapshot,new RecipeEvaluator.Limits());
            RecipePrototypeComparison.same(expected.commands,result.frames.get(i).commands,"sequence/"+i);
            RecipePrototypeComparison.same(expected.environment,result.frames.get(i).environment,"sequence-env/"+i);
            RecipePrototypeComparison.same(contexts.get(i),result.contexts.get(i),"sequence-context/"+i);
            check(result.frames.get(i).retainedReused==(i>0),"sequence retain reuse");
            if(i>0)check(result.frames.get(i).retainedExecutedCalls==0,"warm sequence reconstructed");
            for(Map.Entry<String,Long> counter:result.frames.get(i).counters.entrySet())
                sums.put(counter.getKey(),sums.getOrDefault(counter.getKey(),0L)+counter.getValue());
        }
        sums.put("valueUnits",sums.get("valueUnits")+8*4+16);
        check(sums.equals(result.counters),"aggregate counters differ from completed frame sums and overhead");
        obj(contexts.get(0)).put("timeSeconds",99);
        check(((Number)obj(result.contexts.get(0)).get("timeSeconds")).doubleValue()==0,"context alias");
        try{result.contexts.clear();throw new AssertionError("mutable contexts");}catch(UnsupportedOperationException expected){}
        try{result.frames.clear();throw new AssertionError("mutable frames");}catch(UnsupportedOperationException expected){}
        RecipeSequence.Result empty=RecipeSequence.evaluate(recipe,list(),new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),8);
        check(empty.frames.isEmpty()&&empty.contexts.isEmpty(),"empty sequence");
        failure(recipe,contexts,new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),3,"LIMIT_FRAMES",-1);
        List<Object> guarded=new AbstractList<Object>() {
            public int size(){return 4;}
            public Object get(int index){throw new AssertionError("copied contexts before count admission");}
        };
        failure(recipe,guarded,new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),3,"LIMIT_FRAMES",-1);
        failure(recipe,contexts,null,new RecipeEvaluator.Limits(),8,"INVALID_LIMITS",-1);
        RecipeEvaluator.Limits array=new RecipeEvaluator.Limits();array.arrayLength=3;
        failure(recipe,contexts,array,new RecipeEvaluator.Limits(),8,"LIMIT_ARRAY_LENGTH",-1);
        RecipeEvaluator.Limits commands=new RecipeEvaluator.Limits();commands.commands=2400;
        failure(recipe,contexts,new RecipeEvaluator.Limits(),commands,8,"LIMIT_COMMANDS",1);
        List<Object> invalid=list(map("index",0,"timeSeconds",0),map("index",1,"timeSeconds",-1));
        failure(recipe,invalid,new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),8,"SCHEMA_INVALID",-1);
        Map<String,Object> noContext=new LinkedHashMap<>(recipe);noContext.remove("frameContext");
        failure(noContext,list(),new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),8,"SEQUENCE_CONTEXT_REQUIRED",-1);
        Map<String,Object> errorRecipe=new LinkedHashMap<>(recipe);
        errorRecipe.put("frame",list(map("kind","bind","name","value","value",map("kind","if",
                "condition",map("kind","math","op","lt","args",list(map("kind","get","value",map("kind","ref","name","clock"),"key","timeSeconds"),map("kind","literal","value",0.25))),
                "then",map("kind","literal","value",1),"else",map("kind","math","op","div","args",list(map("kind","literal","value",1),map("kind","literal","value",0)))))));
        RecipeSequence.SequenceFailure error=failure(errorRecipe,list(map("index",0,"timeSeconds",0),map("index",0,"timeSeconds",0.5)),new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),8,"ARITHMETIC",1);
        check(((RecipeEvaluator.RecipeFailure)error.getCause()).path.equals("/frame/0/value/else"),"underlying expression path lost");
        System.out.println("SEQUENCE_PROBES_PASSED four ordered snapshots, repeated/backward time, aggregate limits, empty input, ownership and failure metadata");
    }
}
