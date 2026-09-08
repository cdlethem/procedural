package org.procedurals.recipe;

import java.util.*;

/** Generated from design/recipes/execution-bindings.json and catalog contracts. */
final class RecipeSchemas {
    private RecipeSchemas() {
    }

    private static Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String)values[i], values[i + 1]);
        return result;
    }
    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }
    private static Object freeze(Object value) {
        if (value instanceof Map) {
            Map<String,Object> copy = new LinkedHashMap<String,Object>();
            for (Map.Entry<?,?> entry : ((Map<?,?>)value).entrySet()) copy.put((String)entry.getKey(), freeze(entry.getValue()));
            return Collections.unmodifiableMap(copy);
        }
        if (value instanceof List) {
            List<Object> copy = new ArrayList<Object>();
            for (Object item : (List<?>)value) copy.add(freeze(item));
            return Collections.unmodifiableList(copy);
        }
        return value;
    }

    // source: catalog/operations/regular-grid.json id=layout.regular-grid version=0.1.0 sha256=e9bf8725a7abcdb894586bb20cdc5ec2a56ec3e487e630f86ae62252d315f734
    private static final Object CONSTRUCT_0 = freeze(map("$schema","https://json-schema.org/draft/2020-12/schema","type","object","properties",map("origin",map("type","array","prefixItems",list(map("type","number"),map("type","number")),"items",Boolean.FALSE,"minItems",Double.valueOf("2"),"maxItems",Double.valueOf("2")),"spacing",map("type","array","prefixItems",list(map("type","number","exclusiveMinimum",Double.valueOf("0")),map("type","number","exclusiveMinimum",Double.valueOf("0"))),"items",Boolean.FALSE,"minItems",Double.valueOf("2"),"maxItems",Double.valueOf("2")),"columns",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("2147483647")),"rows",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("2147483647"))),"required",list("origin","spacing","columns","rows"),"additionalProperties",Boolean.FALSE));
    // source: catalog/operations/gradient-noise-2d-01.json id=field.gradient-noise-2d-01 version=0.1.0 sha256=54f0cdff32d3ff0311e2f75668c353980ccba97acb83b39e76efdc38f23e799c
    private static final Object CONSTRUCT_1 = freeze(map("type","object","additionalProperties",Boolean.FALSE,"required",list("seed"),"properties",map("seed",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("4294967295")))));
    // source: catalog/operations/cyclic-palette.json id=color.cyclic-palette version=0.1.0 sha256=d18e3894c7a5a725952bc03918c5ffe29266a9ba81dcd6813d30711646a991a9
    private static final Object CONSTRUCT_2 = freeze(map("type","object","additionalProperties",Boolean.FALSE,"required",list("colors"),"properties",map("colors",map("type","array","minItems",Double.valueOf("1"),"maxItems",Double.valueOf("2147483647"),"items",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("16777215"))))));
    // source: catalog/operations/gradient-path.json id=path.gradient-trace-2d version=0.1.0 sha256=139ba7609d3d28a6775cbcc228fa931d947f1fa32af73556c82cba423a2e661c
    private static final Object CONSTRUCT_3 = freeze(map("$schema","https://json-schema.org/draft/2020-12/schema","type","object","properties",map("field",map("type","object","properties",map("seed",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("4294967295"))),"required",list("seed"),"additionalProperties",Boolean.FALSE),"start",map("type","array","prefixItems",list(map("type","number"),map("type","number")),"items",Boolean.FALSE,"minItems",Double.valueOf("2"),"maxItems",Double.valueOf("2")),"steps",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("1073741822")),"stepDistance",map("type","number","minimum",Double.valueOf("0")),"fieldScale",map("type","number"),"fieldOffset",map("type","array","prefixItems",list(map("type","number"),map("type","number")),"items",Boolean.FALSE,"minItems",Double.valueOf("2"),"maxItems",Double.valueOf("2")),"angleBase",map("type","number"),"angleScale",map("type","number")),"required",list("field","start","steps","stepDistance","fieldScale","fieldOffset","angleBase","angleScale"),"additionalProperties",Boolean.FALSE));
    private static final Object QUERY_0 = freeze(map("$schema","https://json-schema.org/draft/2020-12/schema","type","object","properties",map("index",map("type","integer","minimum",Double.valueOf("0"),"maximum",Double.valueOf("9007199254740991"))),"required",list("index"),"additionalProperties",Boolean.FALSE));
    private static final Object QUERY_1 = freeze(map("type","array","prefixItems",list(map("type","number","minimum",Double.valueOf("-9007199254740991"),"exclusiveMaximum",Double.valueOf("9007199254740991")),map("type","number","minimum",Double.valueOf("-9007199254740991"),"exclusiveMaximum",Double.valueOf("9007199254740991"))),"minItems",Double.valueOf("2"),"maxItems",Double.valueOf("2"),"items",Boolean.FALSE));
    private static final Object QUERY_2 = freeze(map("type","number","minimum",Double.valueOf("-1.7976931348623157e+308"),"maximum",Double.valueOf("1.7976931348623157e+308")));


    static Object construct(String id) {
        if (id == null) return null;
        switch (id) {
            case "layout.regular-grid":
                return CONSTRUCT_0;
            case "field.gradient-noise-2d-01":
                return CONSTRUCT_1;
            case "color.cyclic-palette":
                return CONSTRUCT_2;
            case "path.gradient-trace-2d":
                return CONSTRUCT_3;
            default:
                return null;
        }
    }

    static Object query(String id, String port) {
        if (id == null || port == null) return null;
        if ("layout.regular-grid".equals(id) || "field.gradient-noise-2d-01".equals(id) || "color.cyclic-palette".equals(id) || "path.gradient-trace-2d".equals(id)) {
            String key = id + "\u0000" + port;
            switch (key) {
                case "layout.regular-grid\u0000point":
                    return QUERY_0;
                case "field.gradient-noise-2d-01\u0000sample":
                    return QUERY_1;
                case "color.cyclic-palette\u0000sample":
                    return QUERY_2;
                default:
                    return null;
            }
        }
        return null;
    }
}
