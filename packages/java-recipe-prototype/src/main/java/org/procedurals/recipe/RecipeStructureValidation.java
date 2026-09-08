package org.procedurals.recipe;

import java.util.*;

/** Bounded static admission for the draft recipe grammar. */
final class RecipeStructureValidation {
    private static final int MAX_DEPTH=64, MAX_VALUES=20000;
    private RecipeStructureValidation() { }
    static Map<String,Object> admit(Map<String,Object> input) {
        Copy c=new Copy();
        Object value=c.copy(input,"",0);
        if (!(value instanceof Map)) fail("SCHEMA_INVALID","","recipe must be an object");
        @SuppressWarnings("unchecked") Map<String,Object> recipe=(Map<String,Object>)value;
        @SuppressWarnings("unchecked") Map<String,Object> schema=(Map<String,Object>)RecipeGrammar.schema();
        new Schema(schema).validate(recipe, schema, "", 0);
        declarations(recipe); lexical(recipe);
        return recipe;
    }
    static void fail(String code,String path,String message) { throw new RecipeEvaluator.RecipeFailure(code,path,message); }
    private static String path(String p,Object token) { String s=String.valueOf(token).replace("~","~0").replace("/","~1"); return p+"/"+s; }
    private static final class Copy {
        int count;
        Object copy(Object value,String p,int depth) {
            if(depth>MAX_DEPTH) fail("AST_DEPTH_LIMIT",p,"JSON depth exceeds 64");
            if(++count>MAX_VALUES) fail("AST_SIZE_LIMIT",p,"JSON value count exceeds 20000");
            if(value==null||value instanceof String||value instanceof Boolean) return value;
            if(value instanceof Byte||value instanceof Short||value instanceof Integer||value instanceof Long||value instanceof Float||value instanceof Double) { double n=((Number)value).doubleValue(); if(!Double.isFinite(n)) fail("NONFINITE_NUMBER",p,"JSON numbers must be finite binary64"); return Double.valueOf(n); }
            if(value instanceof Map) { Map<String,Object> out=new LinkedHashMap<String,Object>(); for(Map.Entry<?,?> e:((Map<?,?>)value).entrySet()) { if(!(e.getKey() instanceof String)) fail("SCHEMA_INVALID",p,"JSON object key must be a string"); out.put((String)e.getKey(),copy(e.getValue(),path(p,e.getKey()),depth+1)); } return Collections.unmodifiableMap(out); }
            if(value instanceof List) { List<Object> out=new ArrayList<Object>(); int i=0; for(Object x:(List<?>)value) out.add(copy(x,path(p,i++),depth+1)); return Collections.unmodifiableList(out); }
            fail("SCHEMA_INVALID",p,"value is not JSON"); return null;
        }
    }
    private static final class Schema {
        final Map<String,Object> root;
        final Map<String,java.util.regex.Pattern> patterns=new HashMap<>();
        int visits;
        Schema(Map<String,Object> root) { this.root=root; }
        void validate(Object value,Object schema,String p,int depth) {
            if (++visits>1000000 || depth>512)
                fail("SCHEMA_WORK_LIMIT",p,"static schema traversal limit");
            Map<?,?> s=(Map<?,?>)schema;
            if (s.containsKey("$ref")) validate(value,resolve((String)s.get("$ref")),p,depth+1);
            if (s.containsKey("const")&&!eq(value,s.get("const"))) fail("SCHEMA_INVALID",p,"const differs");
            if (s.containsKey("enum")) {
                boolean found=false;
                for(Object item:(List<?>)s.get("enum")) if(eq(value,item)) found=true;
                if(!found) fail("SCHEMA_INVALID",p,"enum differs");
            }
            if(s.containsKey("type")&&!type(value,(String)s.get("type"))) fail("SCHEMA_INVALID",p,"type differs");
            if(value instanceof String) {
                String text=(String)value;
                if(s.containsKey("minLength")&&text.codePointCount(0,text.length())<((Number)s.get("minLength")).intValue())
                    fail("SCHEMA_INVALID",p,"string too short");
                if(s.containsKey("pattern")) {
                    String regex=(String)s.get("pattern");
                    java.util.regex.Pattern pattern=patterns.get(regex);
                    if(pattern==null){pattern=java.util.regex.Pattern.compile(regex);patterns.put(regex,pattern);}
                    if(!pattern.matcher(text).find()) fail("SCHEMA_INVALID",p,"pattern differs");
                }
            }
            if(value instanceof List) {
                List<?> array=(List<?>)value;
                if(s.containsKey("minItems")&&array.size()<((Number)s.get("minItems")).intValue()) fail("SCHEMA_INVALID",p,"array too short");
                if(s.containsKey("maxItems")&&array.size()>((Number)s.get("maxItems")).intValue()) fail("SCHEMA_INVALID",p,"array too long");
                Object items=s.get("items");
                if(Boolean.FALSE.equals(items)&&!array.isEmpty()) fail("SCHEMA_INVALID",p,"items forbidden");
                if(items instanceof Map) for(int i=0;i<array.size();i++) validate(array.get(i),items,path(p,i),depth+1);
            }
            if(value instanceof Map) {
                Map<?,?> object=(Map<?,?>)value;
                if(s.get("required") instanceof List) for(Object key:(List<?>)s.get("required"))
                    if(!object.containsKey(key)) fail("SCHEMA_INVALID",p,"required property missing: "+key);
                Map<?,?> properties=s.get("properties") instanceof Map?(Map<?,?>)s.get("properties"):Collections.emptyMap();
                for(Object key:properties.keySet()) if(object.containsKey(key)) validate(object.get(key),properties.get(key),path(p,key),depth+1);
                for(Object key:object.keySet()) if(!properties.containsKey(key)) {
                    Object extra=s.get("additionalProperties");
                    if(Boolean.FALSE.equals(extra)) fail("SCHEMA_INVALID",path(p,key),"unknown property");
                    if(extra instanceof Map) validate(object.get(key),extra,path(p,key),depth+1);
                }
            }
            if(s.containsKey("allOf")) for(Object child:(List<?>)s.get("allOf")) validate(value,child,p,depth+1);
            if(s.containsKey("oneOf")) {
                int matches=0;
                for(Object child:(List<?>)s.get("oneOf")) {
                    try { validate(value,child,p,depth+1); matches++; }
                    catch(RecipeEvaluator.RecipeFailure error) {
                        if(!"SCHEMA_INVALID".equals(error.code)) throw error;
                    }
                }
                if(matches!=1) fail("SCHEMA_INVALID",p,"oneOf mismatch");
            }
        }
        Object resolve(String ref) {
            Object current=root;
            for(String token:ref.substring(2).split("/",-1))
                current=((Map<?,?>)current).get(token.replace("~1","/").replace("~0","~"));
            return current;
        }
        static boolean type(Object value,String type) {
            switch(type) {
                case "object": return value instanceof Map;
                case "array": return value instanceof List;
                case "string": return value instanceof String;
                case "boolean": return value instanceof Boolean;
                case "null": return value==null;
                case "number": return value instanceof Number;
                case "integer": return value instanceof Number&&Math.rint(((Number)value).doubleValue())==((Number)value).doubleValue();
                default: throw new IllegalStateException("unsupported generated schema type");
            }
        }
        static boolean eq(Object a,Object b) {
            if(a instanceof Number&&b instanceof Number) return ((Number)a).doubleValue()==((Number)b).doubleValue();
            if(a instanceof List&&b instanceof List) {
                List<?> x=(List<?>)a,y=(List<?>)b;
                if(x.size()!=y.size())return false;
                for(int i=0;i<x.size();i++)if(!eq(x.get(i),y.get(i)))return false;
                return true;
            }
            if(a instanceof Map&&b instanceof Map) {
                Map<?,?> x=(Map<?,?>)a,y=(Map<?,?>)b;
                if(!x.keySet().equals(y.keySet()))return false;
                for(Object key:x.keySet())if(!eq(x.get(key),y.get(key)))return false;
                return true;
            }
            return Objects.equals(a,b);
        }
    }
    private static void declarations(Map<String,Object> r) {
        Map<String,String> known=RecipeGrammar.declarations(); Set<String> declared=new HashSet<String>();
        List<?> operations=(List<?>)r.get("operations");
        for(int i=0;i<operations.size();i++){ Map<?,?> d=(Map<?,?>)operations.get(i); String id=(String)d.get("id");
            if(!declared.add(id)) fail("DUPLICATE_OPERATION","/operations/"+i+"/id","operation IDs must be unique");
            if(!known.containsKey(id)) fail("UNKNOWN_OPERATION","/operations/"+i+"/id","operation has no draft execution binding");
            if(!known.get(id).equals(d.get("version"))) fail("OPERATION_VERSION","/operations/"+i+"/version","operation version differs from draft binding"); }
        Map<?,?> d=(Map<?,?>)r.get("drawing"); if(!"drawing.fresh-raster-2d".equals(d.get("id"))) fail("UNKNOWN_DRAWING","/drawing/id","drawing declaration is unknown"); if(!"0.1.0".equals(d.get("version"))) fail("DRAWING_VERSION","/drawing/version","drawing version differs from catalog");
    }
    private static void lexical(Map<String,Object> r) {
        Set<String> scope=new HashSet<String>(); scope.add("params"); Set<String> declared=new HashSet<String>(); for(Object x:(List<?>)r.get("operations"))declared.add((String)((Map<?,?>)x).get("id"));
        List<?> retain=(List<?>)r.get("retain"); for(int i=0;i<retain.size();i++){Map<?,?> b=(Map<?,?>)retain.get(i);String q="/retain/"+i; expr(b.get("value"),scope,q+"/value",declared); add((String)b.get("name"),scope,q+"/name","SHADOWED_NAME");}
        expr(r.get("environment"),scope,"/environment",declared); statements((List<?>)r.get("frame"),scope,"/frame",declared);
    }
    private static void add(String n,Set<String>s,String p,String code){if(!s.add(n))fail(code,p,"binding name is already visible: "+n);}
    private static void expr(Object x,Set<String> scope,String p,Set<String> declared) {
        Map<?,?> node=(Map<?,?>)x;
        String kind=(String)node.get("kind");
        switch(kind) {
            case "literal": return;
            case "ref":
                if(!scope.contains(node.get("name")))fail("UNBOUND_NAME",p+"/name","name is not visible: "+node.get("name"));
                return;
            case "record": {
                Set<String> names=new HashSet<>(); List<?> fields=(List<?>)node.get("fields");
                for(int i=0;i<fields.size();i++) {
                    Map<?,?> field=(Map<?,?>)fields.get(i); String q=p+"/fields/"+i;
                    if(!names.add((String)field.get("name")))fail("DUPLICATE_FIELD",q+"/name","record field is duplicated");
                    expr(field.get("value"),scope,q+"/value",declared);
                }
                return;
            }
            case "array": case "math": {
                String key=kind.equals("array")?"items":"args";List<?> items=(List<?>)node.get(key);
                for(int i=0;i<items.size();i++)expr(items.get(i),scope,p+"/"+key+"/"+i,declared);
                return;
            }
            case "map": {
                expr(node.get("items"),scope,p+"/items",declared);
                String a=(String)node.get("as"),index=(String)node.get("indexAs");
                if(a.equals(index))fail("DUPLICATE_LOCAL",p+"/indexAs","map locals must differ");
                Set<String> child=new HashSet<>(scope);
                add(a,child,p+"/as","SHADOWED_NAME");add(index,child,p+"/indexAs","SHADOWED_NAME");
                expr(node.get("value"),child,p+"/value",declared);return;
            }
            case "construct":
                if(!declared.contains(node.get("operation")))fail("UNDECLARED_CONSTRUCT",p+"/operation","construct operation is not declared");
                expr(node.get("input"),scope,p+"/input",declared);return;
            case "query": {
                boolean known=false;
                for(String id:declared)if(RecipeGrammar.ports(id).contains(node.get("port")))known=true;
                if(!known)fail("UNKNOWN_PORT",p+"/port","query port has no draft binding");
                expr(node.get("instance"),scope,p+"/instance",declared);
                expr(node.get("input"),scope,p+"/input",declared);return;
            }
            case "get": expr(node.get("value"),scope,p+"/value",declared);return;
            case "values": expr(node.get("instance"),scope,p+"/instance",declared);return;
            case "index":
                expr(node.get("value"),scope,p+"/value",declared);
                expr(node.get("index"),scope,p+"/index",declared);return;
            case "if":
                for(String key:new String[]{"condition","then","else"})expr(node.get(key),scope,p+"/"+key,declared);
                return;
            case "range":
                for(String key:new String[]{"start","stop","step"})expr(node.get(key),scope,p+"/"+key,declared);
                return;
            default: throw new IllegalStateException("unknown admitted expression");
        }
    }
    private static void statements(List<?> xs,Set<String>s,String p,Set<String>d){Set<String> local=new HashSet<String>(s);for(int i=0;i<xs.size();i++){Map<?,?> n=(Map<?,?>)xs.get(i);String q=p+"/"+i,k=(String)n.get("kind");if("bind".equals(k)){expr(n.get("value"),local,q+"/value",d);add((String)n.get("name"),local,q+"/name","SHADOWED_NAME");}else if("emit".equals(k))expr(n.get("value"),local,q+"/value",d);else if("when".equals(k)){expr(n.get("condition"),local,q+"/condition",d);statements((List<?>)n.get("body"),local,q+"/body",d);}else if("for".equals(k)){expr(n.get("items"),local,q+"/items",d);String a=(String)n.get("as"),z=(String)n.get("indexAs");if(a.equals(z))fail("DUPLICATE_LOCAL",q+"/indexAs","for locals must differ");if(local.contains(a))fail("SHADOWED_NAME",q+"/as","binding name is already visible: "+a);if(local.contains(z))fail("SHADOWED_NAME",q+"/indexAs","binding name is already visible: "+z);Set<String> c=new HashSet<String>(local);c.add(a);c.add(z);statements((List<?>)n.get("body"),c,q+"/body",d);}}}

}