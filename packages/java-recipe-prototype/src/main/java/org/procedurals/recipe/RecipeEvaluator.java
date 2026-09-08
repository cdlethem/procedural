package org.procedurals.recipe;

import java.util.*;
import org.procedurals.color.CyclicPalette;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.internal.DrawingValues;
import org.procedurals.layout.RegularGrid;
import org.procedurals.paths.GradientPath2D;

/** Draft-only ordered evaluator for the four bindings in execution-bindings.json. */
public strictfp final class RecipeEvaluator {
    private RecipeEvaluator() {
    }

    public static final class Limits {
        public long visits = 10000000L;
        public long calls = 200000L;
        public long work = 500000L;
        public long iterations = 200000L;
        public long arrayLength = 100000L;
        public long valueUnits = 5000000L;
        public long commands = 100000L;
        public long millis = 30000L;
    }
    public static final class Result {
        public final Map<String,Object> environment;
        public final List<Object> commands;
        public final Map<String,Long> counters;
        public final boolean retainedReused;
        public final long retainedExecutedCalls;
        public final long retainedReservedUnits;
        Result(Map<String,Object> e, List<Object> c, Map<String,Long> n,
               boolean reused, long executedCalls, long reservedUnits) {
            environment = Collections.unmodifiableMap(new LinkedHashMap<String,Object>(e));
            commands = Collections.unmodifiableList(new ArrayList<Object>(c));
            counters = Collections.unmodifiableMap(new LinkedHashMap<String,Long>(n));
            retainedReused = reused;
            retainedExecutedCalls = executedCalls;
            retainedReservedUnits = reservedUnits;
        }
    }
    public static final class RecipeFailure extends IllegalArgumentException {
        public final String code, path, iteration, operation, original;
        RecipeFailure(String c, String p, String m) {
            this(c, p, m, null, null, null);
        }
        RecipeFailure(String c, String p, String m, String i, String o, String r) {
            super(m);
            code = c;
            path = p;
            iteration = i;
            operation = o;
            original = r;
        }
    }
    private static final class Instance {
        final String id;
        final Object value;
        final long size;
        Instance(String i, Object v) {
            this(i, v, 0);
        }
        Instance(String i, Object v, long n) {
            id = i;
            value = v;
            size = n;
        }
    }
    private static final class RetainStage {
        final Map<String,Object> scope;
        final long calls, units, copyUnits, maxArray;
        RetainStage(Map<String,Object> scope, long calls, long units, long copyUnits,
                    long maxArray) {
            this.scope = scope;
            this.calls = calls;
            this.units = units;
            this.copyUnits = copyUnits;
            this.maxArray = maxArray;
        }
    }
    private static final class State {
        final Limits l;
        final long started = System.nanoTime();
        long visits, calls, work, iterations, units, commands, maxArray;
        String iteration;
        State(Limits x) {
            l = x;
        }
        void clock(String p) {
            if ((System.nanoTime() - started) / 1000000L > l.millis) {
                fail("LIMIT_MILLIS", p, "elapsed execution limit");
            }
        }
        void visit(String p) {
            clock(p);
            if (++visits > l.visits) {
                fail("LIMIT_VISITS", p, "visit limit");
            }
        }
        void call(String p, long w) {
            clock(p);
            if (++calls > l.calls) {
                fail("LIMIT_CALLS", p, "operation call limit");
            }
            addWork(p, w);
        }
        void addWork(String p, long n) {
            if (n < 0 || work > l.work - n) {
                fail("LIMIT_WORK", p, "work limit");
            }
            work += n;
        }
        void iter(String p) {
            clock(p);
            if (++iterations > l.iterations) {
                fail("LIMIT_ITERATIONS", p, "iteration limit");
            }
        }
        void array(String p, long n) {
            checkArray(p, n);
            units(p, n + 1);
        }
        void checkArray(String p, long n) {
            if (n < 0 || n > Integer.MAX_VALUE || n > l.arrayLength) {
                fail("LIMIT_ARRAY_LENGTH", p, "array length limit");
            }
            if (n > maxArray) maxArray=n;
        }
        void units(String p, long n) {
            if (n < 0 || units > l.valueUnits - n) {
                fail("LIMIT_VALUE_UNITS", p, "value unit limit");
            }
            units += n;
        }
        void command(String p) {
            if (++commands > l.commands) {
                fail("LIMIT_COMMANDS", p, "command limit");
            }
        }
        Map<String,Long> counters() {
            Map<String,Long> r = new LinkedHashMap<String,Long>();
            r.put("visits", visits);
            r.put("calls", calls);
            r.put("work", work);
            r.put("iterations", iterations);
            r.put("valueUnits", units);
            r.put("commands", commands);
            return r;
        }
    }
    public static Result evaluate(Map<String,Object> recipe,Limits limits) {
        Limits frozen = snapshot(limits);
        checkLimits(frozen);
        State s = new State(frozen);
        Set<String> declared = declared(recipe);
        Map<String,Object> outer = new LinkedHashMap<String,Object>();
        outer.put("params", recipe.get("parameters"));
        RetainStage stage = retain(recipe, outer, s, declared);
        return frame(recipe, outer, s, declared, false, stage.calls, 0);
    }
    private static RetainStage retain(Map<String,Object> recipe, Map<String,Object> outer, State s, Set<String> declared) {
        long calls = s.calls;
        long units = s.units;
        List<?> retain = list(recipe.get("retain"), "/retain");
        for (int i = 0; i < retain.size(); i++) {
            Map<?,?> b = map(retain.get(i), path("/retain", i));
            String n = str(b.get("name"), path(path("/retain", i), "name"));
            Object v = expr(b.get("value"), outer,
                    path(path("/retain", i), "value"), s, declared);
            if (outer.containsKey(n)) {
                fail("SHADOWED_NAME", path(path("/retain", i), "name"), "binding visible");
            }
            outer.put(n, v);
        }
        Map<String,Object> retained = new LinkedHashMap<String,Object>(outer);
        retained.remove("params");
        return new RetainStage(retained, s.calls - calls, s.units - units, 0, s.maxArray);
    }
    private static Result frame(Map<String,Object> recipe, Map<String,Object> outer, State s, Set<String> declared,
                                boolean reused, long retainedCalls, long reserved) {
        Object envValue=expr(recipe.get("environment"),outer,"/environment",s,declared);
        Map<String,Object> env;
        try {
            s.units("/environment", 5);
            env = DrawingValues.validateEnvironment(envValue);
        } catch (RecipeFailure e) {
            throw e;
        } catch (IllegalArgumentException e) {
            throw nativeFail("DRAWING_FAILURE", "/environment", "drawing.fresh-raster-2d", e, s);
        }
        s.units("/frame", 1);
        List<Object> commands = new ArrayList<Object>();
        statements(list(recipe.get("frame"), "/frame"), outer, "/frame", s,
                declared, commands, env);
        s.units("", 2);
        return new Result(env, commands, s.counters(), reused, retainedCalls, reserved);
    }
    /** Single-threaded, one-entry coarse retain cache for the four immutable draft bindings. */
    public static final class Session {
        private Object key;
        private RetainStage cached;

        public void clear() {
            key = null;
            cached = null;
        }

        public Result evaluate(Map<String,Object> recipe, Limits limits) {
            Limits frozen = snapshot(limits);
            checkLimits(frozen);
            State state = new State(frozen);
            Set<String> declared = declared(recipe);
            Object next = retainedKey(recipe, state);
            Map<String,Object> outer = new LinkedHashMap<String,Object>();
            outer.put("params", recipe.get("parameters"));

            if (cached != null && next.equals(key)) {
                if (cached.maxArray > frozen.arrayLength) {
                    fail("LIMIT_ARRAY_LENGTH", "/retain", "cached retained array limit");
                }
                long reservation = addExactRetainedUnits(cached.units, cached.copyUnits);
                state.units("/retain", reservation);
                outer.putAll(cached.scope);
                outer.put("params", recipe.get("parameters"));
                return frame(recipe, outer, state, declared, true, 0, reservation);
            }

            clear();
            RetainStage stage = retain(recipe, outer, state, declared);
            RetainStage candidate = detachedRetainStage(stage, state);
            Result result = frame(recipe, outer, state, declared, false, stage.calls, 0);
            key = next;
            cached = candidate;
            return result;
        }
    }
    private static Object retainedKey(Map<String,Object> recipe, final State state) {
        try {
            return RecipeRetainedKey.create(recipe, new RecipeRetainedKey.Visitor() {
                public void visit() {
                    state.visit("/retain");
                }
            });
        } catch (RecipeFailure error) {
            throw error;
        } catch (RecipeRetainedKey.BoundsException error) {
            throw new RecipeFailure("RETAIN_KEY", "/retain", error.getMessage(),
                    state.iteration, null, null);
        } catch (IllegalArgumentException error) {
            throw new RecipeFailure("RETAIN_KEY", "/retain", error.getMessage(),
                    state.iteration, null, null);
        }
    }
    private static long addExactRetainedUnits(long stageUnits, long copyUnits) {
        if (stageUnits < 0 || copyUnits < 0 || stageUnits > Long.MAX_VALUE - copyUnits) {
            fail("LIMIT_VALUE_UNITS", "/retain", "retained value reservation");
        }
        return stageUnits + copyUnits;
    }
    private static RetainStage detachedRetainStage(RetainStage stage, State state) {
        long copyUnits = retainedCopyUnits(stage.scope, state, 0);
        state.units("/retain", copyUnits);
        @SuppressWarnings("unchecked")
        Map<String,Object> detached = (Map<String,Object>)freezeRetained(stage.scope, state, 0);
        return new RetainStage(Collections.unmodifiableMap(detached), stage.calls, stage.units,
                copyUnits, state.maxArray);
    }
    private static void checkLimits(Limits l) {
        if (l == null || l.visits <= 0 || l.calls <= 0 || l.work <= 0
                || l.iterations <= 0 || l.arrayLength <= 0 || l.valueUnits <= 0
                || l.commands <= 0 || l.millis <= 0) {
            fail("INVALID_LIMITS", "", "limits must be positive");
        }
    }
    private static Limits snapshot(Limits source) {
        if (source == null) return null;
        Limits copy = new Limits();
        copy.visits=source.visits; copy.calls=source.calls; copy.work=source.work;
        copy.iterations=source.iterations; copy.arrayLength=source.arrayLength;
        copy.valueUnits=source.valueUnits; copy.commands=source.commands; copy.millis=source.millis;
        return copy;
    }
    private static Set<String> declared(Map<String,Object> r) {
        Set<String> out = new HashSet<String>();
        for (Object x : list(r.get("operations"), "/operations")) {
            Map<?,?> d = map(x, "/operations");
            String id = str(d.get("id"), "/operations/id");
            String v = str(d.get("version"), "/operations/version");
            if (!out.add(id)) {
                fail("DUPLICATE_OPERATION", "/operations", "duplicate operation");
            }
            if (!"0.1.0".equals(v)
                    || !(id.equals("layout.regular-grid")
                    || id.equals("field.gradient-noise-2d-01")
                    || id.equals("color.cyclic-palette")
                    || id.equals("path.gradient-trace-2d"))) {
                fail("DECLARATION", "/operations", "unsupported draft binding");
            }
        }
        return out;
    }
    private static void statements(List<?> xs,Map<String,Object> scope,String p,State s,Set<String> declared,List<Object> commands,Map<String,Object> environment) {
        Map<String,Object> local=new LinkedHashMap<String,Object>(scope);
        for (int i = 0; i < xs.size(); i++) {
            String q = path(p, i);
            Map<?,?> st = map(xs.get(i), q);
            s.visit(q);
            String k = str(st.get("kind"), path(q, "kind"));
            if ("bind".equals(k)) {
                String n = str(st.get("name"), path(q, "name"));
                Object v = expr(st.get("value"), local, path(q, "value"), s, declared);
                if (local.containsKey(n)) {
                    fail("SHADOWED_NAME", path(q, "name"), "binding visible");
                }
                local.put(n, v);
            } else if ("emit".equals(k)) {
                Object raw = expr(st.get("value"), local, path(q, "value"), s, declared);
                s.command(q);
                s.units(q, normalizationTemporaryUnits(raw, q));
                s.units(q, units(raw));
                try {
                    DrawingValues.normalizeCommand(raw, environment);
                } catch (RecipeFailure e) {
                    throw e;
                } catch (IllegalArgumentException e) {
                    throw nativeFail("DRAWING_FAILURE", q, "drawing.fresh-raster-2d", e, s);
                }
                commands.add(freezeValue(raw));
            } else if ("when".equals(k)) {
                if (bool(expr(st.get("condition"), local, path(q, "condition"), s, declared),
                        path(q, "condition"))) {
                    statements(list(st.get("body"), path(q, "body")), local,
                            path(q, "body"), s, declared, commands, environment);
                }
            } else if ("for".equals(k)) {
                Object a = expr(st.get("items"), local, path(q, "items"), s, declared);
                List<?> values = list(a, path(q, "items"));
                String as = str(st.get("as"), path(q, "as"));
                String ix = str(st.get("indexAs"), path(q, "indexAs"));
                if (as.equals(ix) || local.containsKey(as) || local.containsKey(ix)) {
                    fail("SHADOWED_NAME", q, "iteration name visible");
                }
                for (int j = 0; j < values.size(); j++) {
                    String prior = s.iteration;
                    s.iteration = iterationContext(prior, q, j);
                    try {
                        s.iter(q);
                        s.units(q, 1);
                        Map<String,Object> child = new LinkedHashMap<String,Object>(local);
                        child.put(as, values.get(j));
                        child.put(ix, Double.valueOf(j));
                        statements(list(st.get("body"), path(q, "body")), child,
                                path(q, "body"), s, declared, commands, environment);
                    } catch (RecipeFailure error) {
                        throw withIteration(error, s.iteration);
                    } finally {
                        s.iteration = prior;
                    }
                }
            } else {
                fail("TYPE", path(q, "kind"), "unknown statement");
            }
        }
    }
    private static Object expr(Object node,Map<String,Object> scope,String p,State s,Set<String> declared) {
        s.visit(p);
        Map<?,?> n = map(node, p);
        String k = str(n.get("kind"), path(p, "kind"));
        if ("literal".equals(k)) {
            return n.get("value");
        }
        if ("ref".equals(k)) {
            String name = str(n.get("name"), path(p, "name"));
            if (!scope.containsKey(name)) {
                fail("UNBOUND_NAME", path(p, "name"), "name not visible");
            }
            return scope.get(name);
        }
        if ("array".equals(k)) {
            List<?> a = list(n.get("items"), path(p, "items"));
            s.checkArray(p, a.size());
            s.units(p, 1);
            List<Object> out = new ArrayList<Object>(a.size());
            for (int i = 0; i < a.size(); i++) {
                out.add(expr(a.get(i), scope, path(path(p, "items"), i), s, declared));
            }
            return out;
        }
        if ("record".equals(k)) {
            List<?> fs = list(n.get("fields"), path(p, "fields"));
            s.checkArray(p, fs.size());
            s.units(p, 1);
            Map<String,Object> out = new LinkedHashMap<String,Object>();
            for (int i = 0; i < fs.size(); i++) {
                Map<?,?> f = map(fs.get(i), path(path(p, "fields"), i));
                String name = str(f.get("name"), path(p, "fields"));
                if (out.containsKey(name)) {
                    fail("DUPLICATE_FIELD", p, "duplicate record field");
                }
                out.put(name, expr(f.get("value"), scope,
                        path(path(path(p, "fields"), i), "value"), s, declared));
            }
            return out;
        }
        if ("get".equals(k)) {
            Map<?,?> m = map(expr(n.get("value"), scope, path(p, "value"), s, declared),
                    path(p, "value"));
            String key = str(n.get("key"), path(p, "key"));
            if (!m.containsKey(key)) {
                fail("ACCESS", path(p, "key"), "record key absent");
            }
            return m.get(key);
        }
        if ("index".equals(k)) {
            List<?> a = list(expr(n.get("value"), scope, path(p, "value"), s, declared),
                    path(p, "value"));
            long i = index(expr(n.get("index"), scope, path(p, "index"), s, declared),
                    path(p, "index"));
            if (i >= a.size()) {
                fail("ACCESS", path(p, "index"), "index out of range");
            }
            return a.get((int)i);
        }
        if ("math".equals(k)) {
            return math(n, scope, p, s, declared);
        }
        if ("if".equals(k)) {
            boolean c = bool(expr(n.get("condition"), scope, path(p, "condition"), s, declared),
                    path(p, "condition"));
            return expr(n.get(c ? "then" : "else"), scope,
                    path(p, c ? "then" : "else"), s, declared);
        }
        if ("range".equals(k)) {
            long a = index(expr(n.get("start"), scope, path(p, "start"), s, declared), p);
            long b = index(expr(n.get("stop"), scope, path(p, "stop"), s, declared), p);
            long d = index(expr(n.get("step"), scope, path(p, "step"), s, declared), p);
            if (d == 0) {
                fail("ARITHMETIC", path(p, "step"), "zero step");
            }
            long count = b <= a ? 0 : 1 + (b - 1 - a) / d;
            s.array(p, count);
            List<Object> out = new ArrayList<Object>((int)count);
            for (long i = a; i < b; i += d) {
                out.add(Double.valueOf(i));
            }
            return out;
        }
        if ("map".equals(k)) {
            List<?> a = list(expr(n.get("items"), scope, path(p, "items"), s, declared),
                    path(p, "items"));
            String as = str(n.get("as"), path(p, "as"));
            String ix = str(n.get("indexAs"), path(p, "indexAs"));
            if (as.equals(ix) || scope.containsKey(as) || scope.containsKey(ix)) {
                fail("SHADOWED_NAME", p, "iteration name visible");
            }
            s.checkArray(p, a.size());
            s.units(p, 1);
            List<Object> out = new ArrayList<Object>(a.size());
            for (int i = 0; i < a.size(); i++) {
                String prior = s.iteration;
                s.iteration = iterationContext(prior, p, i);
                try {
                    s.iter(p);
                    s.units(p, 1);
                    Map<String,Object> child = new LinkedHashMap<String,Object>(scope);
                    child.put(as, a.get(i));
                    child.put(ix, Double.valueOf(i));
                    out.add(expr(n.get("value"), child, path(p, "value"), s, declared));
                } catch (RecipeFailure error) {
                    throw withIteration(error, s.iteration);
                } finally {
                    s.iteration = prior;
                }
            }
            return out;
        }
        if ("construct".equals(k)) {
            String operation = str(n.get("operation"), path(p, "operation"));
            if (!declared.contains(operation)) {
                fail("UNDECLARED_CONSTRUCT", path(p, "operation"), "operation not declared");
            }
            return construct(operation,
                    expr(n.get("input"), scope, path(p, "input"), s, declared), path(p, "input"), s, declared);
        }
        if ("query".equals(k)) {
            Object instance = expr(n.get("instance"), scope, path(p, "instance"), s, declared);
            String port = str(n.get("port"), path(p, "port"));
            checkPort(instance, port, p);
            Object input = expr(n.get("input"), scope, path(p, "input"), s, declared);
            return query(instance, port, input, path(p, "input"), s);
        }
        if ("values".equals(k)) {
            return values(expr(n.get("instance"), scope, path(p, "instance"), s, declared), p, s);
        }
        fail("TYPE", path(p, "kind"), "unknown expression");
        return null;
    }
    private static Object math(Map<?,?> n, Map<String,Object> scope, String p,
                               State s, Set<String> d) {
        List<?> a = list(n.get("args"), path(p, "args"));
        String op = str(n.get("op"), path(p, "op"));
        if ("length".equals(op)) {
            if (a.size() != 1) {
                fail("TYPE", p, "arity");
            }
            s.units(p, 1);
            return Double.valueOf(list(expr(a.get(0), scope, path(path(p, "args"), 0), s, d), p).size());
        }
        if ("neg".equals(op) || "sin".equals(op) || "cos".equals(op) || "floor".equals(op)) {
            if (a.size() != 1) {
                fail("TYPE", p, "arity");
            }
            double x = num(expr(a.get(0), scope, path(path(p, "args"), 0), s, d), p);
            double z = "neg".equals(op) ? -x : "sin".equals(op) ? Math.sin(x)
                    : "cos".equals(op) ? Math.cos(x) : Math.floor(x);
            s.units(p, 1);
            return finite(z, p);
        }
        if (a.size() != 2) {
            fail("TYPE", p, "arity");
        }
        double x = num(expr(a.get(0), scope, path(path(p, "args"), 0), s, d), p);
        double y = num(expr(a.get(1), scope, path(path(p, "args"), 1), s, d), p);
        if ("lt".equals(op)) {
            s.units(p, 1);
            return Boolean.valueOf(x < y);
        }
        if ("le".equals(op)) {
            s.units(p, 1);
            return Boolean.valueOf(x <= y);
        }
        if ("eq".equals(op)) {
            s.units(p, 1);
            return Boolean.valueOf(x == y);
        }
        if (("div".equals(op) || "rem".equals(op)) && y == 0) {
            fail("ARITHMETIC", p, "division by zero");
        }
        double z = "add".equals(op) ? x + y : "sub".equals(op) ? x - y
                : "mul".equals(op) ? x * y : "div".equals(op) ? x / y
                : "rem".equals(op) ? x % y : Double.NaN;
        s.units(p, 1);
        return finite(z, p);
    }
    private static Object construct(String id, Object input, String p, State s, Set<String> d) {
        if (!d.contains(id)) {
            fail("UNDECLARED_CONSTRUCT", p, "operation not declared");
        }
        try {
            RecipeInputValidation.construct(id, input, p, s.iteration, new RecipeInputValidation.Visitor() {
                public void visit(String ignored) { s.visit(p); }
            });
            if ("layout.regular-grid".equals(id)) {
                s.call(p, 1);
                return new Instance(id, RegularGrid.create(castMap(input, p)));
            }
            if ("field.gradient-noise-2d-01".equals(id)) {
                s.call(p, 1);
                return new Instance(id, GradientNoise2D01.create(input));
            }
            if ("color.cyclic-palette".equals(id)) {
                Map<?,?> m = map(input, p);
                Object c = m.get("colors");
                int z = list(c, p).size();
                s.array(p, z);
                s.call(p, 1 + z);
                return new Instance(id, CyclicPalette.create(input), z);
            }
            if ("path.gradient-trace-2d".equals(id)) {
                Map<?,?> m = map(input, p);
                long steps = index(m.get("steps"), p);
                if (steps > (Long.MAX_VALUE - 2) / 2) {
                    fail("LIMIT_ARRAY_LENGTH", p, "path positions overflow");
                }
                long coordinates = 2 * (steps + 1);
                s.array(p, coordinates);
                s.array(p, steps);
                s.call(p, 1 + steps);
                return new Instance(id, GradientPath2D.trace(input), steps);
            }
        } catch (RecipeFailure e) {
            throw e;
        } catch (GradientPath2D.TraceException e) {
            throw traceFail(p, id, e, s);
        } catch (IllegalArgumentException e) {
            throw nativeFail("OPERATION_FAILURE", p, id, e, s);
        }
        fail("DECLARATION", p, "unsupported operation");
        return null;
    }
    private static Object query(Object value, String port, Object input, String p, State s) {
        if (!(value instanceof Instance)) {
            fail("TYPE", p, "query requires instance");
        }
        Instance x = (Instance)value;
        try {
            RecipeInputValidation.query(x.id, port, input, p, s.iteration, new RecipeInputValidation.Visitor() {
                public void visit(String ignored) { s.visit(p); }
            });
            if ("layout.regular-grid".equals(x.id) && "point".equals(port)) {
                Map<?,?> in = map(input, p);
                if (in.size() != 1 || !in.containsKey("index")) {
                    fail("TYPE", p, "grid point input must be {index}");
                }
                // pointAt creates a native double[2], then this evaluator creates a detached List.
                s.array(p, 2);
                s.array(p, 2);
                s.call(p, 1);
                return point(((RegularGrid)x.value).pointAt(index(in.get("index"), p)));
            }
            if ("field.gradient-noise-2d-01".equals(x.id) && "sample".equals(port)) {
                List<?> q = list(input, p);
                if (q.size() != 2) {
                    fail("TYPE", p, "noise sample input must have two values");
                }
                s.units(p, 1);
                s.call(p, 1);
                return Double.valueOf(((GradientNoise2D01)x.value).sample(input));
            }
            if ("color.cyclic-palette".equals(x.id) && "sample".equals(port)) {
                s.units(p, 1);
                s.call(p, 1);
                return Double.valueOf(((CyclicPalette)x.value).sample(num(input, p)));
            }
        } catch (RecipeFailure e) {
            throw e;
        } catch (IllegalArgumentException e) {
            throw nativeFail("OPERATION_FAILURE", p, x.id, e, s);
        }
        fail("PORT", p, "port is not available on instance");
        return null;
    }
    private static void checkPort(Object value, String port, String path) {
        if (!(value instanceof Instance)) fail("TYPE", path, "query requires instance");
        String id = ((Instance)value).id;
        if (!("layout.regular-grid".equals(id) && "point".equals(port))
                && !("field.gradient-noise-2d-01".equals(id) && "sample".equals(port))
                && !("color.cyclic-palette".equals(id) && "sample".equals(port))) {
            fail("PORT", path, "port is not available on instance");
        }
    }
    private static Object values(Object value, String p, State s) {
        if (!(value instanceof Instance)) {
            fail("TYPE", p, "values requires instance");
        }
        Instance x = (Instance)value;
        try {
            if ("layout.regular-grid".equals(x.id)) {
                s.checkArray(p, 2);
                s.checkArray(p, 2);
                s.units(p, 9);
                s.call(p, 10);
                return ((RegularGrid)x.value).toMap();
            }
            if ("field.gradient-noise-2d-01".equals(x.id)) {
                s.units(p, 2);
                s.call(p, 3);
                return ((GradientNoise2D01)x.value).serialize();
            }
            if ("color.cyclic-palette".equals(x.id)) {
                s.checkArray(p, x.size);
                s.units(p, x.size + 2);
                s.call(p, x.size + 3);
                return ((CyclicPalette)x.value).serialize();
            }
            if ("path.gradient-trace-2d".equals(x.id)) {
                GradientPath2D path = (GradientPath2D)x.value;
                long n = path.steps();
                if (n > lmax(s) / 4) {
                    fail("LIMIT_VALUE_UNITS", p, "path output size");
                }
                s.checkArray(p, n + 1);
                s.checkArray(p, n);
                s.checkArray(p, 2);
                s.units(p, 4 * n + 6);
                s.call(p, 4 * n + 7);
                return path.toValues();
            }
        } catch (RecipeFailure e) {
            throw e;
        } catch (IllegalArgumentException e) {
            throw nativeFail("OPERATION_FAILURE", p, x.id, e, s);
        }
        fail("DECLARATION", p, "unsupported instance");
        return null;
    }
    // A result must not retain writable literal/parameter containers from its input recipe.
    // The caller reserves the complete value tree before this detached copy is allocated.
    private static Object freezeValue(Object value) {
        if (value instanceof Map) {
            Map<String,Object> copy = new LinkedHashMap<String,Object>();
            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) {
                copy.put((String)entry.getKey(), freezeValue(entry.getValue()));
            }
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List) {
            List<Object> copy = new ArrayList<Object>(((List<?>)value).size());
            for (Object item : (List<?>)value) copy.add(freezeValue(item));
            return Collections.unmodifiableList(copy);
        }
        return value; // Validated command scalars are immutable.
    }
    private static Object freezeRetained(Object value, State state, int depth) {
        if (depth > 64) {
            fail("RETAIN_COPY", "/retain", "retained value depth limit");
        }
        state.visit("/retain");
        if (value instanceof Map) {
            Map<String,Object> copy = new LinkedHashMap<String,Object>();
            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) {
                if (!(entry.getKey() instanceof String)) {
                    fail("RETAIN_COPY", "/retain", "retained map key must be a string");
                }
                copy.put((String)entry.getKey(), freezeRetained(entry.getValue(), state, depth + 1));
            }
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List) {
            List<?> source = (List<?>)value;
            state.checkArray("/retain", source.size());
            List<Object> copy = new ArrayList<Object>(source.size());
            for (Object item : source) {
                copy.add(freezeRetained(item, state, depth + 1));
            }
            return Collections.unmodifiableList(copy);
        }
        return value;
    }
    private static long retainedCopyUnits(Object value, State state, int depth) {
        if (depth > 64) {
            fail("RETAIN_COPY", "/retain", "retained value depth limit");
        }
        state.visit("/retain");
        if (value instanceof Map) {
            long total = 1;
            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) {
                if (!(entry.getKey() instanceof String)) {
                    fail("RETAIN_COPY", "/retain", "retained map key must be a string");
                }
                total = addRetainedCopyUnits(total,
                        retainedCopyUnits(entry.getValue(), state, depth + 1));
            }
            return total;
        }
        if (value instanceof List) {
            List<?> source = (List<?>)value;
            state.checkArray("/retain", source.size());
            long total = 1;
            for (Object item : source) {
                total = addRetainedCopyUnits(total,
                        retainedCopyUnits(item, state, depth + 1));
            }
            return total;
        }
        return 1;
    }
    private static long addRetainedCopyUnits(long left, long right) {
        if (right < 0 || left > Long.MAX_VALUE - right) {
            fail("LIMIT_VALUE_UNITS", "/retain", "retained copy size");
        }
        return left + right;
    }
    private static long units(Object o) {
        if (o instanceof Map) {
            long n = 1;
            for (Object v : ((Map<?,?>)o).values()) {
                n += units(v);
            }
            return n;
        }
        if (o instanceof List) {
            long n = 1;
            for (Object v : (List<?>)o) {
                n += units(v);
            }
            return n;
        }
        return 1;
    }
    /** Detached normalized command tree plus DrawingValues' temporary point buffers. */
    private static long normalizationTemporaryUnits(Object raw, String path) {
        if (!(raw instanceof Map)) return 36;
        Object kind = ((Map<?,?>)raw).get("kind");
        // segment: normalized tree 19, native double[][]/point buffers 7.
        if ("segment2".equals(kind)) return 26;
        // quad: normalized tree 23, native double[][]/point buffers 13.
        if ("quad2".equals(kind)) return 36;
        // Reserve the largest reviewed temporary before DrawingValues reports its precise error.
        return 36;
    }
    private static List<Double> point(double[] p) {
        return Arrays.asList(Double.valueOf(p[0]), Double.valueOf(p[1]));
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> castMap(Object x, String p) {
        return (Map<String,Object>)map(x, p);
    }
    private static Map<?,?> map(Object x, String p) {
        if (!(x instanceof Map)) {
            fail("TYPE", p, "record required");
        }
        return (Map<?,?>)x;
    }
    private static List<?> list(Object x, String p) {
        if (!(x instanceof List)) {
            fail("TYPE", p, "array required");
        }
        return (List<?>)x;
    }
    private static String str(Object x, String p) {
        if (!(x instanceof String)) {
            fail("TYPE", p, "string required");
        }
        return (String)x;
    }
    private static boolean bool(Object x, String p) {
        if (!(x instanceof Boolean)) {
            fail("TYPE", p, "boolean required");
        }
        return ((Boolean)x).booleanValue();
    }
    private static double num(Object x, String p) {
        if (!(x instanceof Number)) {
            fail("TYPE", p, "number required");
        }
        return finite(((Number)x).doubleValue(), p);
    }
    private static long index(Object x, String p) {
        double n = num(x, p);
        if (n < 0 || n > 9007199254740991L || n != Math.floor(n)) {
            fail("TYPE", p, "safe nonnegative integer required");
        }
        return (long)n;
    }
    private static Double finite(double x, String p) {
        if (Double.isNaN(x) || Double.isInfinite(x)) {
            fail("ARITHMETIC", p, "nonfinite result");
        }
        return Double.valueOf(x == 0 ? 0 : x);
    }
    private static String path(String p, Object part) {
        String s = String.valueOf(part).replace("~", "~0").replace("/", "~1");
        return p + "/" + s;
    }
    private static String iterationContext(String prior, String path, int index) {
        String current = path + "/" + index;
        return prior == null ? current : prior + " > " + current;
    }
    private static RecipeFailure withIteration(RecipeFailure error, String context) {
        if (error.iteration != null) return error;
        RecipeFailure enriched = new RecipeFailure(error.code, error.path, error.getMessage(),
                context, error.operation, error.original);
        enriched.initCause(error);
        return enriched;
    }
    private static void fail(String c, String p, String m) {
        throw new RecipeFailure(c, p, m);
    }
    private static long lmax(State s) {
        return s.l.valueUnits;
    }
    private static RecipeFailure nativeFail(String c, String p, String op,
                                            IllegalArgumentException e, State s) {
        String original = e instanceof RegularGrid.GridException
                ? ((RegularGrid.GridException)e).code
                : e instanceof GradientNoise2D01.NoiseException
                ? ((GradientNoise2D01.NoiseException)e).code
                : e instanceof CyclicPalette.PaletteException
                ? ((CyclicPalette.PaletteException)e).code
                : e.getMessage();
        return new RecipeFailure(c, p, e.getMessage(), s.iteration, op, original);
    }
    private static RecipeFailure traceFail(String p, String op,
                                           GradientPath2D.TraceException e, State s) {
        return new RecipeFailure("OPERATION_FAILURE", p, e.getMessage(), s.iteration,
                op, e.code + " step=" + e.stepIndex + " stage=" + e.stage);
    }
}
