package org.procedurals.recipe;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Detached, bounded structural key for the prototype retain stage. */
final class RecipeRetainedKey {
    private static final int MAX_DEPTH = 64;
    private static final long MAX_VALUES = 20000L;

    interface Visitor {
        void visit();
    }

    static final class BoundsException extends IllegalArgumentException {
        BoundsException(String message) {
            super(message);
        }
    }

    private RecipeRetainedKey() {
    }

    static Object create(Map<String,Object> recipe, Visitor visitor) {
        if (recipe == null) {
            throw new IllegalArgumentException("recipe required");
        }
        Context context = new Context(visitor);
        Map<String,Object> key = new LinkedHashMap<String,Object>();
        key.put("retain", context.copyAst(recipe.get("retain"), 0));
        key.put("operations", context.copyData(recipe.get("operations"), 0));
        Map<String,Object> parameters = new LinkedHashMap<String,Object>();
        Object rawParameters = recipe.get("parameters");
        if (context.wholeParameters) {
            parameters.put("whole", Boolean.TRUE);
            parameters.put("values", context.copyData(rawParameters, 0));
        } else {
            parameters.put("whole", Boolean.FALSE);
            Map<String,Object> selected = new LinkedHashMap<String,Object>();
            Map<?,?> source = rawParameters instanceof Map ? (Map<?,?>)rawParameters : null;
            for (String name : context.parameterNames) {
                Map<String,Object> entry = new LinkedHashMap<String,Object>();
                boolean present = source != null && source.containsKey(name);
                entry.put("present", Boolean.valueOf(present));
                entry.put("value", context.copyData(present ? source.get(name) : null, 0));
                selected.put(name, Collections.unmodifiableMap(entry));
            }
            parameters.put("values", Collections.unmodifiableMap(selected));
        }
        key.put("parameters", Collections.unmodifiableMap(parameters));
        return Collections.unmodifiableMap(key);
    }

    private static final class Context {
        final Visitor visitor;
        final List<String> parameterNames = new ArrayList<String>();
        long values;
        boolean wholeParameters;

        Context(Visitor visitor) {
            this.visitor = visitor;
        }

        private void visit(Object value, int depth) {
            if (depth > MAX_DEPTH) {
                throw new BoundsException("retained key depth limit");
            }
            if (++values > MAX_VALUES) {
                throw new BoundsException("retained key value limit");
            }
            if (visitor != null) {
                visitor.visit();
            }
        }

        Object copyAst(Object value, int depth) {
            visit(value, depth);
            if (value instanceof Map) {
                Map<?,?> source = (Map<?,?>)value;
                Object kind = source.get("kind");
                if ("literal".equals(kind)) {
                    return copyMap(source, depth, true);
                }
                if ("get".equals(kind) && isParameterRef(source.get("value"))
                        && source.get("key") instanceof String) {
                    String name = (String)source.get("key");
                    if (!parameterNames.contains(name)) {
                        parameterNames.add(name);
                    }
                    return copyMap(source, depth, true);
                }
                if ("ref".equals(kind) && "params".equals(source.get("name"))) {
                    wholeParameters = true;
                }
                return copyMap(source, depth, false);
            }
            if (value instanceof List) {
                List<Object> result = new ArrayList<Object>();
                for (Object item : (List<?>)value) {
                    result.add(copyAst(item, depth + 1));
                }
                return Collections.unmodifiableList(result);
            }
            return value;
        }

        Object copyData(Object value, int depth) {
            visit(value, depth);
            if (value instanceof Map) {
                return copyMap((Map<?,?>)value, depth, true);
            }
            if (value instanceof List) {
                List<Object> result = new ArrayList<Object>();
                for (Object item : (List<?>)value) {
                    result.add(copyData(item, depth + 1));
                }
                return Collections.unmodifiableList(result);
            }
            return value;
        }

        private Map<String,Object> copyMap(Map<?,?> source, int depth, boolean dataOnly) {
            Map<String,Object> result = new LinkedHashMap<String,Object>();
            for (Map.Entry<?,?> entry : source.entrySet()) {
                String name = String.valueOf(entry.getKey());
                Object item = "literal".equals(source.get("kind")) && "value".equals(name)
                        ? copyData(entry.getValue(), depth + 1)
                        : dataOnly ? copyData(entry.getValue(), depth + 1)
                        : copyAst(entry.getValue(), depth + 1);
                result.put(name, item);
            }
            return Collections.unmodifiableMap(result);
        }

        private boolean isParameterRef(Object value) {
            if (!(value instanceof Map)) {
                return false;
            }
            Map<?,?> ref = (Map<?,?>)value;
            return "ref".equals(ref.get("kind")) && "params".equals(ref.get("name"));
        }
    }
}
