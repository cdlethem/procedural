package org.procedurals.recipe;

import java.util.List;
import java.util.Map;

/** Closed interpreter for the generated constructor and query schema subset. */
final class RecipeInputValidation {
    interface Visitor { void visit(String path); }
    private RecipeInputValidation() {
    }

    static void construct(String operation, Object value, String path, String iteration, Visitor visitor) {
        Object schema = RecipeSchemas.construct(operation);
        if (schema == null) failure(operation, path, iteration, "missing constructor schema");
        validateRoot(schema, value, path, operation, iteration, visitor);
    }

    static void query(String operation, String port, Object value, String path, String iteration, Visitor visitor) {
        Object schema = RecipeSchemas.query(operation, port);
        if (schema == null) failure(operation, path, iteration, "missing query schema");
        validateRoot(schema, value, path, operation, iteration, visitor);
    }

    private static void validateRoot(Object schema, Object value, String path, String operation,
                                     String iteration, Visitor visitor) {
        try {
            validate(schema, value, path, operation, iteration, visitor);
        } catch (RecipeEvaluator.RecipeFailure error) {
            if ("INPUT_SCHEMA".equals(error.code) && !path.equals(error.path)
                    && error.path.startsWith(path)) {
                throw new RecipeEvaluator.RecipeFailure(error.code, path,
                        "value " + error.path.substring(path.length()) + ": " + error.getMessage(),
                        error.iteration, error.operation, error.original);
            }
            throw error;
        }
    }

    @SuppressWarnings("unchecked")
    private static void validate(Object raw, Object value, String path, String operation, String iteration, Visitor visitor) {
        visitor.visit(path);
        if (!(raw instanceof Map)) failure(operation, path, iteration, "invalid generated schema");
        Map<String,Object> schema = (Map<String,Object>)raw;
        Object type = schema.get("type");
        if ("object".equals(type)) object(schema, value, path, operation, iteration, visitor);
        else if ("array".equals(type)) array(schema, value, path, operation, iteration, visitor);
        else if ("number".equals(type)) number(schema, value, path, operation, iteration, false);
        else if ("integer".equals(type)) number(schema, value, path, operation, iteration, true);
        else failure(operation, path, iteration, "unsupported generated schema type");
    }

    @SuppressWarnings("unchecked")
    private static void object(Map<String,Object> schema, Object value, String path, String operation,
                               String iteration, Visitor visitor) {
        if (!(value instanceof Map)) failure(operation, path, iteration, "expected object");
        Map<?,?> input = (Map<?,?>)value;
        Object propertiesRaw = schema.get("properties");
        if (!(propertiesRaw instanceof Map)) failure(operation, path, iteration, "invalid generated properties");
        Map<String,Object> properties = (Map<String,Object>)propertiesRaw;
        Object requiredRaw = schema.get("required");
        if (requiredRaw instanceof List) {
            for (Object key : (List<?>)requiredRaw) {
                if (!(key instanceof String) || !input.containsKey(key)) {
                    failure(operation, path, iteration, "missing required property");
                }
            }
        }
        boolean additional = !Boolean.FALSE.equals(schema.get("additionalProperties"));
        String firstUnknown = null;
        for (Object key : input.keySet()) {
            if (!(key instanceof String)) failure(operation, path, iteration, "object key must be string");
            visitor.visit(pointer(path, key));
            String text = (String)key;
            if (!additional && !properties.containsKey(text)
                    && (firstUnknown == null || text.compareTo(firstUnknown) < 0)) firstUnknown = text;
        }
        // The generated LinkedHashMap preserves contract property order, independent of input order.
        for (Map.Entry<String,Object> property : properties.entrySet()) {
            if (input.containsKey(property.getKey())) {
                validate(property.getValue(), input.get(property.getKey()), pointer(path, property.getKey()),
                        operation, iteration, visitor);
            }
        }
        if (firstUnknown != null) {
            failure(operation, pointer(path, firstUnknown), iteration, "unknown property");
        }
    }

    private static void array(Map<String,Object> schema, Object value, String path, String operation,
                              String iteration, Visitor visitor) {
        if (!(value instanceof List)) failure(operation, path, iteration, "expected array");
        List<?> input = (List<?>)value;
        bounds(schema, input.size(), path, operation, iteration);
        Object prefix = schema.get("prefixItems");
        int prefixSize = 0;
        if (prefix instanceof List) {
            List<?> items = (List<?>)prefix;
            prefixSize = items.size();
            for (int i = 0; i < Math.min(input.size(), items.size()); i++) {
                validate(items.get(i), input.get(i), pointer(path, i), operation, iteration, visitor);
            }
        }
        Object items = schema.get("items");
        if (Boolean.FALSE.equals(items)) {
            if (input.size() > prefixSize) failure(operation, path, iteration, "tuple has extra items");
        } else if (items instanceof Map) {
            for (int i = prefixSize; i < input.size(); i++) {
                validate(items, input.get(i), pointer(path, i), operation, iteration, visitor);
            }
        }
    }

    private static void number(Map<String,Object> schema, Object value, String path, String operation,
                               String iteration, boolean integer) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long
                || value instanceof Float || value instanceof Double)) {
            failure(operation, path, iteration, integer ? "expected integer" : "expected number");
        }
        double number = ((Number)value).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number)
                || (integer && number != Math.floor(number))) {
            failure(operation, path, iteration, integer ? "expected finite integer" : "expected finite number");
        }
        numberBounds(schema, number, path, operation, iteration);
    }

    private static void bounds(Map<String,Object> schema, long size, String path, String operation,
                               String iteration) {
        Number minimum = number(schema.get("minItems"));
        Number maximum = number(schema.get("maxItems"));
        if ((minimum != null && size < minimum.longValue()) || (maximum != null && size > maximum.longValue())) {
            failure(operation, path, iteration, "array length outside schema bounds");
        }
    }

    private static void numberBounds(Map<String,Object> schema, double value, String path, String operation,
                                     String iteration) {
        Number minimum = number(schema.get("minimum"));
        Number maximum = number(schema.get("maximum"));
        Number exclusiveMinimum = number(schema.get("exclusiveMinimum"));
        Number exclusiveMaximum = number(schema.get("exclusiveMaximum"));
        if ((minimum != null && value < minimum.doubleValue()) || (maximum != null && value > maximum.doubleValue())
                || (exclusiveMinimum != null && value <= exclusiveMinimum.doubleValue())
                || (exclusiveMaximum != null && value >= exclusiveMaximum.doubleValue())) {
            failure(operation, path, iteration, "number outside schema bounds");
        }
    }

    private static Number number(Object value) {
        return value instanceof Number ? (Number)value : null;
    }

    private static String pointer(String path, Object part) {
        return path + "/" + String.valueOf(part).replace("~", "~0").replace("/", "~1");
    }

    private static void failure(String operation, String path, String iteration, String message) {
        throw new RecipeEvaluator.RecipeFailure("INPUT_SCHEMA", path, message, iteration, operation, null);
    }
}
