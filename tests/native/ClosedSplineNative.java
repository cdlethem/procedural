package org.procedurals.paths;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.AbstractList;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused semantic adversaries and actual bounded workloads; no renderer claims. */
public final class ClosedSplineNative {
    private static int assertions;
    private interface Action { void run(); }
    private static void check(boolean value, String why) {
        assertions++;
        if (!value) throw new AssertionError(why);
    }
    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }
    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String)values[i], values[i + 1]);
        return result;
    }
    private static void error(String code, Action action) {
        try { action.run(); throw new AssertionError("missing " + code); }
        catch (ClosedSpline2D.SplineException e) { check(code.equals(e.code), "wrong error " + e.code); }
    }
    private static ClosedSpline2D curve() {
        return ClosedSpline2D.create(new double[][]{{0,0},{4,0},{8,0},{4,0}},2);
    }
    @SuppressWarnings("unchecked")
    private static void ownership() {
        double[][] points = {{0,0},{4,0},{8,0},{4,0}};
        ClosedSpline2D typed = ClosedSpline2D.create(points,2);
        points[0][0] = 99; points[1] = new double[]{99,99};
        check(typed.sampleParameter(0).x() == 0 && typed.sampleParameter(1).x() == 4, "typed snapshot");
        List<Object> first = list(0,0);
        List<Object> rows = list(first,list(4,0),list(8,0),list(4,0));
        Map<String,Object> input = map("controls",rows,"subdivisions",2);
        ClosedSpline2D object = ClosedSpline2D.create(input);
        first.set(0,99); rows.clear(); input.clear();
        check(object.serialize().equals(typed.serialize()), "object snapshot");
        Map<String,Object> serialized = object.serialize();
        ((List<Object>)((List<?>)serialized.get("controls")).get(0)).set(0,100.0);
        serialized.clear();
        check(object.sampleParameter(0).x() == 0, "export detached deeply");
        Map<String,Object> sample = object.sample(map("mode","parameter","value",0));
        ((List<Object>)sample.get("point")).set(0,100.0);
        check(object.sampleParameter(0).x() == 0, "sample export detached");
    }
    private static void carriersAndBounds() {
        Object[] allowed = {(byte)2,(short)2,2,2L,2.0f,2.0};
        for (Object value : allowed) {
            ClosedSpline2D s = ClosedSpline2D.create(map("controls",list(list(value,0),list(4,0),list(8,0)),"subdivisions",value));
            check(s.sampleParameter(0).x() == 2 && s.subdivisions() == 2,"approved numeric carrier");
        }
        Number custom = new Number() {
            public int intValue(){return 2;} public long longValue(){return 2;}
            public float floatValue(){return 2;} public double doubleValue(){return 2;}
        };
        Object[] rejected = {null,true,"2",BigInteger.valueOf(2),BigDecimal.valueOf(2),custom,Double.NaN,Double.POSITIVE_INFINITY};
        for (final Object value : rejected) {
            error("INVALID_INPUT", () -> ClosedSpline2D.create(map("controls",list(list(value,0),list(4,0),list(8,0)),"subdivisions",2)));
            error("INVALID_QUERY", () -> curve().sample(map("mode","distance","value",value)));
        }
        List<Object> excessive = new AbstractList<Object>() {
            public int size(){return 268435456;}
            public Object get(int index){throw new AssertionError("visited oversized controls");}
        };
        error("INVALID_INPUT", () -> ClosedSpline2D.create(map("controls",excessive,"subdivisions",1)));
        error("INVALID_INPUT", () -> ClosedSpline2D.create(new double[][]{{0,0},{1,0},{2,0}},Integer.MAX_VALUE));
        error("INVALID_INPUT", () -> ClosedSpline2D.create(map("controls",new double[][]{{0,0},{1,0},{2,0}},"subdivisions",1)));
    }
    private static void atomicityAndWrap() {
        ClosedSpline2D s = curve();
        final double[] out = {7,7,7,7};
        error("INVALID_QUERY", () -> s.sampleDistance(Double.NaN,out));
        check(Arrays.equals(out,new double[]{7,7,7,7}),"invalid scalar touched target");
        error("INVALID_QUERY", () -> s.sampleParameter(0,new double[5]));
        error("INVALID_QUERY", () -> s.sampleParameter(0,new double[3]));
        error("INVALID_QUERY", () -> s.sampleDistance(0,null));
        // Coarse endpoint-only construction is finite; an interior derivative overflows.
        ClosedSpline2D large = ClosedSpline2D.create(new double[][]{{-1e307,0},{3e307,0},{0,0}},1);
        error("NUMERIC_OVERFLOW", () -> large.sampleParameter(.5,out));
        check(Arrays.equals(out,new double[]{7,7,7,7}),"numeric overflow partly wrote target");
        error("NUMERIC_OVERFLOW", () -> ClosedSpline2D.create(new double[][]{{1e308,0},{1e308,0},{1e308,0}},1));
        s.sampleParameter(-Double.MIN_VALUE,out);
        check(out[0] == 0 && out[1] == 0,"rounded negative seam");
        ClosedSpline2D zero = ClosedSpline2D.create(new double[][]{{-0.0,0},{0,-0.0},{0,0}},2);
        zero.sampleDistance(-1e308,out);
        for (double value : out) check(Double.doubleToRawLongBits(value) == 0,"noncanonical output zero");
        error("INVALID_QUERY", () -> zero.sampleDistance(Double.NEGATIVE_INFINITY,out));
    }
    private static String workload(int curves, int controls, int resolution, int queries) {
        long checksum = 0;
        long start = System.nanoTime();
        double[] sample = new double[4];
        for (int i = 0; i < curves; i++) {
            double[][] points = new double[controls][2];
            for (int j = 0; j < controls; j++) {
                double angle = 2 * StrictMath.PI * j / controls;
                points[j][0] = (60 + i % 17) * StrictMath.cos(angle);
                points[j][1] = (40 + j % 7) * StrictMath.sin(angle);
            }
            ClosedSpline2D s = ClosedSpline2D.create(points,resolution);
            checksum = checksum * 31 + Double.doubleToRawLongBits(s.length());
            for (int j = 0; j < queries; j++) {
                s.sampleDistance(j * s.length() / queries,sample);
                for (double value : sample) checksum = checksum * 31 + Double.doubleToRawLongBits(value);
            }
        }
        long elapsed = System.nanoTime() - start;
        return "{\"curves\":"+curves+",\"controls_per_curve\":"+controls
                +",\"subdivisions\":"+resolution+",\"distance_queries_per_curve\":"+queries
                +",\"elapsed_ns_setup_queries_checksum\":"+elapsed+",\"checksum_unsigned64\":\""
                +Long.toUnsignedString(checksum)+"\",\"numeric_payload_bytes_per_curve\":"
                +(8L * (10L * controls + (long) controls * resolution + 1))+"}";
    }
    public static void main(String[] args) {
        ownership(); carriersAndBounds(); atomicityAndWrap();
        for (int i = 0; i < 4; i++) workload(32,6,32,256);
        String tiny = workload(1,3,10,32);
        String sourceLike = workload(400,3,32,256);
        String stress = workload(1000,20,128,256);
        System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions
                +",\"warmup\":\"4 batches of32 curves,6 controls,32 chords/span,256queries\","
                +"\"memory_scope\":\"numeric retained payload per curve; excludes array/object headers and temporary input/sample objects; curves constructed and traversed sequentially\","
                +"\"benchmarks\":["+tiny+","+sourceLike+","+stress+"]}");
    }
}
