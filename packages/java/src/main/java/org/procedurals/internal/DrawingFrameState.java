package org.procedurals.internal;

import java.util.*;

/** Internal synchronous two-phase lifecycle for drawing.fresh-raster-2d v0.1.0.
 * Owns portable values only. Native adapters own and release surfaces separately.
 * Motivated by pelines/ciserp ordered marks; no renderer or callback retained.
 */
public final class DrawingFrameState {
    public static final class FrameError extends IllegalStateException {
        public final String code;
        public final Long commandIndex;
        FrameError(String code,Long index) { super(code);this.code=code;this.commandIndex=index; }
    }
    private enum State { NEW,ACTIVE,COMPLETED,ABORTED }
    private enum Kind { BEGIN,BATCH,END }
    private static abstract class Plan {
        final Kind kind;
        private Plan(Kind kind) { this.kind=kind; }
    }
    public static final class BeginPlan extends Plan {
        public final Map<String,Object> environment;
        private BeginPlan(Map<String,Object> env) { super(Kind.BEGIN);environment=env; }
    }
    public static final class Slot {
        public final int sourceOffset;
        public final Map<String,Object> command;
        private Slot(int offset,Map<String,Object> command) { sourceOffset=offset;this.command=command; }
    }
    public static final class BatchPlan extends Plan {
        public final long baseIndex;
        public final int inputCount;
        public final List<Slot> slots;
        private BatchPlan(long base,List<Slot> values) {
            super(Kind.BATCH);baseIndex=base;inputCount=values.size();
            slots=Collections.unmodifiableList(values);
        }
    }
    public static final class EndPlan extends Plan { private EndPlan() { super(Kind.END); } }
    private State state=State.NEW;
    private long count=0;
    private Map<String,Object> environment;
    private Object pending;

    public String state() { return state.name().toLowerCase(Locale.ROOT); }
    public long count() { return count; }
    private FrameError fail(String code,Long index) {
        if(state!=State.COMPLETED) { state=State.ABORTED;pending=null;environment=null; }
        return new FrameError(code,index);
    }
    private Object reserve(State required) {
        if(state!=required || pending!=null) throw fail("INVALID_STATE",null);
        Object reservation=new Object();pending=reservation;return reservation;
    }
    private void publish(Object reservation,Plan plan,State required) {
        if(state!=required || pending!=reservation) throw fail("INVALID_STATE",null);
        pending=plan;
    }
    private void match(Plan plan,Kind kind,State required) {
        if(state!=required || plan==null || pending!=plan || plan.kind!=kind) throw fail("INVALID_STATE",null);
    }
    @SuppressWarnings("unchecked")
    private static Object immutable(Object value) {
        if(value instanceof Map) {
            Map<String,Object> copy=new LinkedHashMap<String,Object>();
            for(Map.Entry<String,Object> e:((Map<String,Object>)value).entrySet()) copy.put(e.getKey(),immutable(e.getValue()));
            return Collections.unmodifiableMap(copy);
        }
        if(value instanceof List) {
            List<Object> copy=new ArrayList<Object>();
            for(Object item:(List<?>)value) copy.add(immutable(item));
            return Collections.unmodifiableList(copy);
        }
        return value;
    }
    @SuppressWarnings("unchecked")
    public BeginPlan prepareBegin(Object input) {
        Object reservation=reserve(State.NEW);
        Map<String,Object> env;
        try { env=(Map<String,Object>)immutable(DrawingValues.validateEnvironment(input)); }
        catch(FrameError error) { throw fail("INVALID_STATE",null); }
        catch(DrawingValues.DrawingError error) { throw fail("INVALID_ENVIRONMENT",null); }
        catch(RuntimeException | Error error) { abort();throw error; }
        BeginPlan plan=new BeginPlan(env);publish(reservation,plan,State.NEW);return plan;
    }
    public void activate(BeginPlan plan) {
        match(plan,Kind.BEGIN,State.NEW);
        environment=plan.environment;count=0;pending=null;state=State.ACTIVE;
    }
    public void failBegin(BeginPlan plan,String code) {
        match(plan,Kind.BEGIN,State.NEW);
        if(!"UNSUPPORTED_CAPABILITY".equals(code) && !"RESOURCE_FAILURE".equals(code) && !"RENDER_FAILURE".equals(code)) throw fail("INVALID_STATE",null);
        throw fail(code,null);
    }
    @SuppressWarnings("unchecked")
    public BatchPlan prepareBatch(Object input) {
        Object reservation=reserve(State.ACTIVE);
        try {
            if(!(input instanceof List)) throw fail("INVALID_BATCH",null);
            List<?> inputList=(List<?>)input;
            int size=inputList.size();
            if(size<0 || size>4096 || count>9007199254740991L-size) throw fail("INVALID_BATCH",null);
            List<Object> commands=new ArrayList<Object>(size);
            for(int i=0;i<size;i++) commands.add(inputList.get(i));
            List<Slot> slots=new ArrayList<Slot>(size);
            for(int i=0;i<size;i++) {
                try { slots.add(new Slot(i,(Map<String,Object>)immutable(DrawingValues.normalizeCommand(commands.get(i),environment)))); }
                catch(DrawingValues.DrawingError error) { throw fail("INVALID_COMMAND",Long.valueOf(count+i)); }
            }
            BatchPlan plan=new BatchPlan(count,slots);publish(reservation,plan,State.ACTIVE);return plan;
        } catch(FrameError error) {
            if(state!=State.ABORTED && state!=State.COMPLETED) throw fail("INVALID_STATE",null);
            throw error;
        }
        catch(RuntimeException | Error error) { abort();throw error; }
    }

    public void commitBatch(BatchPlan plan) {
        match(plan,Kind.BATCH,State.ACTIVE);count=plan.baseIndex+plan.inputCount;pending=null;
    }
    public void failBatch(BatchPlan plan,Long sourceOffset) {
        match(plan,Kind.BATCH,State.ACTIVE);
        if(sourceOffset!=null && (sourceOffset<0 || sourceOffset>=plan.inputCount)) throw fail("INVALID_STATE",null);
        if(sourceOffset!=null && "noop".equals(plan.slots.get(sourceOffset.intValue()).command.get("outcome"))) throw fail("INVALID_STATE",null);
        throw fail("RENDER_FAILURE",sourceOffset==null ? null : Long.valueOf(plan.baseIndex+sourceOffset));
    }
    public EndPlan prepareEnd() {
        Object reservation=reserve(State.ACTIVE);EndPlan plan=new EndPlan();publish(reservation,plan,State.ACTIVE);return plan;
    }
    public void completeEnd(EndPlan plan) {
        match(plan,Kind.END,State.ACTIVE);state=State.COMPLETED;pending=null;environment=null;
    }
    public void failEnd(EndPlan plan) { match(plan,Kind.END,State.ACTIVE);throw fail("RENDER_FAILURE",null); }
    public void abort() {
        if(state==State.COMPLETED) throw fail("INVALID_STATE",null);
        state=State.ABORTED;pending=null;environment=null;
    }
}
