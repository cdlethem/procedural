package org.procedurals.recipe;

import java.util.*;

/** Bounded eager sequence prototype. See design/recipes/bounded-sequences.md. */
public final class RecipeSequence {
    private RecipeSequence() { }

    public static final class Result {
        public final List<RecipeEvaluator.Result> frames;
        public final List<Object> contexts;
        public final Map<String,Long> counters;
        private Result(List<RecipeEvaluator.Result> frames, List<Object> contexts, Map<String,Long> counters) {
            this.frames=Collections.unmodifiableList(new ArrayList<RecipeEvaluator.Result>(frames));
            this.contexts=Collections.unmodifiableList(new ArrayList<Object>(contexts));
            this.counters=Collections.unmodifiableMap(new LinkedHashMap<String,Long>(counters));
        }
    }

    /** Position is a list ordinal, independently of the caller's possibly repeated index. */
    public static final class SequenceFailure extends IllegalArgumentException {
        public final int position;
        private SequenceFailure(int position, RecipeEvaluator.RecipeFailure cause) {
            super(cause.getMessage(),cause);
            this.position=position;
        }
    }

    /** All contexts and the base recipe are admitted before any frame is evaluated. */
    public static Result evaluate(Map<String,Object> recipe, List<?> contexts,
            RecipeEvaluator.Limits perFrame, RecipeEvaluator.Limits total, int maxFrames) {
        long started=System.nanoTime();
        int position=-1;
        RecipeEvaluator.Session session=new RecipeEvaluator.Session();
        try {
            RecipeEvaluator.Limits per=copy(perFrame), remaining=copy(total);
            positive(per); positive(remaining);
            if(maxFrames<=0)fail("INVALID_LIMITS","","maxFrames must be positive");
            if(contexts==null)fail("SCHEMA_INVALID","/contexts","contexts must be an array");
            int count=contexts.size();
            if(count>maxFrames)fail("LIMIT_FRAMES","/contexts","sequence frame count exceeds limit");
            if(count>per.arrayLength||count>remaining.arrayLength)
                fail("LIMIT_ARRAY_LENGTH","/contexts","sequence array exceeds limit");
            long overhead=8L*count+16;
            if(overhead>remaining.valueUnits)fail("LIMIT_VALUE_UNITS","/contexts","sequence overhead exceeds limit");
            remaining.valueUnits-=overhead;
            if(recipe==null||!recipe.containsKey("frameContext"))
                fail("SEQUENCE_CONTEXT_REQUIRED","/frameContext","sequence recipe must declare frameContext");
            Map<String,Object> admitted=RecipeStructureValidation.admit(recipe);
            List<Object> clocks=RecipeStructureValidation.admitContexts(contexts);
            long duration=remaining.millis;
            remainingMillis(started,duration);
            Map<String,Long> counters=new LinkedHashMap<String,Long>();
            for(String key:new String[]{"visits","calls","work","iterations","valueUnits","commands"})
                counters.put(key,"valueUnits".equals(key)?overhead:0L);
            List<RecipeEvaluator.Result> frames=new ArrayList<RecipeEvaluator.Result>(count);
            for(position=0;position<count;position++) {
                RecipeEvaluator.Limits effective=minimum(per,remaining,remainingMillis(started,duration));
                Map<String,Object> snapshot=new LinkedHashMap<String,Object>(admitted);
                snapshot.put("frameContext",clocks.get(position));
                RecipeEvaluator.Result frame=session.evaluate(snapshot,effective);
                for(Map.Entry<String,Long> entry:frame.counters.entrySet()) {
                    String key=entry.getKey(); long value=entry.getValue();
                    long available=get(remaining,key);
                    if(value<0||value>available)fail(code(key),"","frame counter exceeds remaining budget");
                    long previous=counters.get(key);
                    if(previous>Long.MAX_VALUE-value)fail(code(key),"","aggregate counter overflow");
                    set(remaining,key,available-value); counters.put(key,previous+value);
                }
                remainingMillis(started,duration);
                frames.add(frame);
            }
            // Empty requests still undergo the elapsed check; no prefix is returned on failure.
            position=count==0?-1:count-1;
            remainingMillis(started,duration);
            return new Result(frames,clocks,counters);
        } catch(RecipeEvaluator.RecipeFailure failure) {
            throw new SequenceFailure(position,failure);
        } finally {
            session.clear();
        }
    }

    private static long remainingMillis(long started,long limit) {
        long elapsed=(System.nanoTime()-started)/1000000L;
        if(elapsed>=limit)fail("LIMIT_MILLIS","","sequence elapsed limit");
        return limit-elapsed;
    }
    private static RecipeEvaluator.Limits minimum(RecipeEvaluator.Limits per,
            RecipeEvaluator.Limits remaining,long millis) {
        RecipeEvaluator.Limits result=copy(per);
        for(String key:new String[]{"visits","calls","work","iterations","valueUnits","commands"}) {
            long available=get(remaining,key);
            if(available<=0)fail(code(key),"","aggregate budget depleted before next frame");
            set(result,key,Math.min(get(per,key),available));
        }
        result.arrayLength=Math.min(per.arrayLength,remaining.arrayLength);
        result.millis=Math.min(per.millis,millis);
        return result;
    }
    private static void positive(RecipeEvaluator.Limits l) {
        if(l.visits<=0||l.calls<=0||l.work<=0||l.iterations<=0||l.arrayLength<=0
                ||l.valueUnits<=0||l.commands<=0||l.millis<=0)
            fail("INVALID_LIMITS","","limits must be positive");
    }
    private static RecipeEvaluator.Limits copy(RecipeEvaluator.Limits source) {
        if(source==null)fail("INVALID_LIMITS","","limits are required");
        RecipeEvaluator.Limits result=new RecipeEvaluator.Limits();
        result.visits=source.visits;result.calls=source.calls;result.work=source.work;
        result.iterations=source.iterations;result.valueUnits=source.valueUnits;
        result.arrayLength=source.arrayLength;result.commands=source.commands;result.millis=source.millis;
        return result;
    }
    private static long get(RecipeEvaluator.Limits limits,String key) {
        switch(key) {
            case "visits":return limits.visits;case "calls":return limits.calls;
            case "work":return limits.work;case "iterations":return limits.iterations;
            case "valueUnits":return limits.valueUnits;case "commands":return limits.commands;
            default:throw new IllegalStateException("unknown evaluator counter: "+key);
        }
    }
    private static void set(RecipeEvaluator.Limits limits,String key,long value) {
        switch(key) {
            case "visits":limits.visits=value;break;case "calls":limits.calls=value;break;
            case "work":limits.work=value;break;case "iterations":limits.iterations=value;break;
            case "valueUnits":limits.valueUnits=value;break;case "commands":limits.commands=value;break;
            default:throw new IllegalStateException("unknown evaluator counter: "+key);
        }
    }
    private static String code(String key) {
        return "valueUnits".equals(key)?"LIMIT_VALUE_UNITS":"LIMIT_"+key.toUpperCase(Locale.ROOT);
    }
    private static void fail(String code,String path,String message) {
        throw new RecipeEvaluator.RecipeFailure(code,path,message);
    }
}
