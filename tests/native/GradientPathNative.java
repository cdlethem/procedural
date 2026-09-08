import com.sun.management.ThreadMXBean;
import java.lang.management.ManagementFactory;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.paths.GradientPath2D;

/** Native Java checks for path.gradient-trace-2d. Emits exactly one JSON result. */
public final class GradientPathNative {
    private static final int MAX_STEPS = 1073741822;
    private static volatile long benchmarkSink;
    private static int assertions;

    private GradientPathNative() { }

    private interface Action { void run(); }

    private static final class OddNumber extends Number {
        public int intValue() { return 1; }
        public long longValue() { return 1L; }
        public float floatValue() { return 1.0f; }
        public double doubleValue() { return 1.0; }
    }

    private static final class Benchmark {
        final int steps;
        final long[] elapsedNanos;
        final Long allocatedBytes;
        final long checksum;
        Benchmark(int steps, long[] elapsedNanos, Long allocatedBytes, long checksum) {
            this.steps = steps;
            this.elapsedNanos = elapsedNanos;
            this.allocatedBytes = allocatedBytes;
            this.checksum = checksum;
        }
        long rawPayloadBytes() { return 16L * (steps + 1L) + 8L * steps; }
        long elapsedTotal() {
            long total=0L;
            for(long elapsed : elapsedNanos) total+=elapsed;
            return total;
        }
        String elapsedJson() {
            StringBuilder result=new StringBuilder("[");
            for(int i=0;i<elapsedNanos.length;i++) {
                if(i!=0) result.append(',');
                result.append(elapsedNanos[i]);
            }
            return result.append(']').toString();
        }
        String json() {
            return "{\"steps\":" + steps
                + ",\"input\":{\"field\":{\"seed\":42},\"start\":[0.125,-0.25],"
                + "\"steps\":" + steps + ",\"stepDistance\":0.4,\"fieldScale\":0.002,\"fieldOffset\":[0.0,0.0],"
                + "\"angleBase\":0.0,\"angleScale\":40.0}"
                + ",\"warmup_reps\":3,\"timing_reps\":5"
                + ",\"timing_scope\":\"trace_plus_endpoint_pointAt\""
                + ",\"elapsed_nanos\":" + elapsedJson()
                + ",\"elapsed_nanos_total\":" + elapsedTotal()
                + ",\"average_nanos_per_rep\":" + (elapsedTotal() / 5L)
                + ",\"raw_payload_bytes_per_path\":" + rawPayloadBytes()
                + ",\"thread_allocated_bytes_total_reps\":"
                + (allocatedBytes == null ? "null" : allocatedBytes.toString())
                + ",\"thread_allocated_bytes_average_per_rep\":"
                + (allocatedBytes == null ? "null" : Long.toString(allocatedBytes.longValue() / 5L))
                + ",\"allocation_scope\":\"trace_plus_endpoint_pointAt\""
                + ",\"full_output_checksum\":\"" + Long.toUnsignedString(checksum,16) + "\""
                + "}";
        }
    }

    private static void check(boolean condition, String message) {
        assertions++;
        if (!condition) throw new AssertionError(message);
    }

    private static boolean raw(double left, double right) {
        return Double.doubleToRawLongBits(left) == Double.doubleToRawLongBits(right);
    }

    private static void point(double[] actual, double x, double y, String message) {
        check(actual.length == 2 && raw(actual[0], x) && raw(actual[1], y), message);
    }

    private static void expectPath(String code, Action action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (GradientPath2D.PathException error) {
            check(code.equals(error.code), "expected " + code + ", got " + error.code);
        }
    }

    private static void expectTrace(String code, int index, String stage, Action action) {
        try {
            action.run();
            throw new AssertionError("expected " + code);
        } catch (GradientPath2D.TraceException error) {
            check(code.equals(error.code), "wrong trace code");
            check(error.stepIndex == index, "wrong trace index");
            check(stage.equals(error.stage), "wrong trace stage");
        }
    }

    private static ArrayList<Object> pair(Object x, Object y) {
        return new ArrayList<Object>(Arrays.asList(x, y));
    }

    private static Map<String,Object> config(Object steps) {
        Map<String,Object> field = new LinkedHashMap<String,Object>();
        field.put("seed", Long.valueOf(42));
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        result.put("field", field);
        result.put("start", pair(Double.valueOf(0.0), Double.valueOf(0.0)));
        result.put("steps", steps);
        result.put("stepDistance", Double.valueOf(1.0));
        result.put("fieldScale", Double.valueOf(0.0));
        result.put("fieldOffset", pair(Double.valueOf(0.0), Double.valueOf(0.0)));
        result.put("angleBase", Double.valueOf(0.0));
        result.put("angleScale", Double.valueOf(0.0));
        return result;
    }

    @SuppressWarnings("unchecked")
    private static void ownershipAndAccess() {
        Map<String,Object> input = config(Integer.valueOf(2));
        Map<String,Object> field = (Map<String,Object>)input.get("field");
        List<Object> start = (List<Object>)input.get("start");
        List<Object> offset = (List<Object>)input.get("fieldOffset");
        GradientPath2D path = GradientPath2D.trace(input);
        check(path.steps() == 2, "steps");
        point(path.pointAt(0L), 0.0, 0.0, "point zero");
        point(path.pointAt(1L), 1.0, 0.0, "point one");
        point(path.pointAt(Double.valueOf(2.0)), 2.0, 0.0, "integral object index");
        check(raw(path.headingAt(Float.valueOf(1.0f)), 0.0), "heading");

        field.put("seed", Long.valueOf(99));
        start.set(0, Double.valueOf(88.0));
        offset.set(0, Double.valueOf(77.0));
        input.put("steps", Integer.valueOf(0));
        input.put("angleBase", Double.valueOf(4.0));
        point(path.pointAt(2L), 2.0, 0.0, "input detachment");

        double[] fresh = path.pointAt(1L);
        fresh[0] = 700.0; fresh[1] = 800.0;
        point(path.pointAt(1L), 1.0, 0.0, "pointAt detachment");

        Map<String,Object> serialized = path.serialize();
        ((Map<String,Object>)serialized.get("field")).put("seed", Long.valueOf(123));
        ((List<Object>)serialized.get("start")).set(0, Double.valueOf(123.0));
        ((List<Object>)serialized.get("fieldOffset")).set(1, Double.valueOf(123.0));
        serialized.put("steps", Integer.valueOf(0));
        Map<String,Object> serializedAgain = path.serialize();
        check(((Number)((Map<?,?>)serializedAgain.get("field")).get("seed")).longValue() == 42L,
              "field serialization detachment");
        check(((Number)((List<?>)serializedAgain.get("start")).get(0)).doubleValue() == 0.0,
              "start serialization detachment");
        check(((Number)serializedAgain.get("steps")).intValue() == 2,
              "scalar serialization detachment");

        Map<String,Object> values = path.toValues();
        List<Object> positions = (List<Object>)values.get("positions");
        List<Object> headings = (List<Object>)values.get("headings");
        ((List<Object>)positions.get(0)).set(0, Double.valueOf(456.0));
        positions.remove(positions.size()-1);
        headings.set(0, Double.valueOf(456.0));
        values.clear();
        point(path.pointAt(0L), 0.0, 0.0, "toValues point detachment");
        check(raw(path.headingAt(0L), 0.0), "toValues heading detachment");
        Map<String,Object> valuesAgain = path.toValues();
        check(((List<?>)valuesAgain.get("positions")).size() == 3, "toValues position count");
        check(((List<?>)valuesAgain.get("headings")).size() == 2, "toValues heading count");

        double[] output = {11.0, 12.0, 13.0, 14.0};
        path.pointInto(1L, output, 1);
        check(raw(output[0], 11.0) && raw(output[1], 1.0) && raw(output[2], 0.0)
              && raw(output[3], 14.0), "pointInto valid slots");
        double[] untouched = output.clone();
        expectPath("INVALID_INDEX", new Action() {
            public void run() { path.pointInto(Double.valueOf(Double.NaN), output, -1); }
        });
        check(Arrays.equals(output, untouched), "invalid index mutated output");
        expectPath("INDEX_OUT_OF_RANGE", new Action() {
            public void run() { path.pointInto(3L, null, -1); }
        });
        check(Arrays.equals(output, untouched), "out of range mutated output");
        expectPath("INVALID_OUTPUT", new Action() {
            public void run() { path.pointInto(0L, output, 3); }
        });
        check(Arrays.equals(output, untouched), "bad offset mutated output");
        expectPath("INVALID_OUTPUT", new Action() {
            public void run() { path.pointInto(0L, null, 0); }
        });
        expectPath("INVALID_OUTPUT", new Action() {
            public void run() { path.pointInto(0L, new double[1], 0); }
        });

        expectPath("INVALID_INDEX", new Action() {
            public void run() { path.pointAt(new BigInteger("1")); }
        });
        expectPath("INVALID_INDEX", new Action() {
            public void run() { path.pointAt(new OddNumber()); }
        });
        expectPath("INVALID_INDEX", new Action() {
            public void run() { path.pointAt(-1L); }
        });
        expectPath("INVALID_INDEX", new Action() {
            public void run() { path.pointAt(9007199254740992L); }
        });
        expectPath("INDEX_OUT_OF_RANGE", new Action() {
            public void run() { path.headingAt(2L); }
        });
    }

    private static void zeroAndCanonical() {
        Map<String,Object> zero = config(Integer.valueOf(0));
        zero.put("start", pair(Double.valueOf(1e308), Double.valueOf(-1e308)));
        zero.put("stepDistance", Double.valueOf(0.4));
        // These finite values would overflow the first query coordinate if N=0 queried.
        zero.put("fieldScale", Double.valueOf(1e308));
        zero.put("fieldOffset", pair(Double.valueOf(1e308), Double.valueOf(-1e308)));
        zero.put("angleBase", Double.valueOf(-0.0));
        zero.put("angleScale", Double.valueOf(-0.0));
        GradientPath2D empty = GradientPath2D.trace(zero);
        check(empty.steps() == 0, "zero steps");
        point(empty.pointAt(0L), 1e308, -1e308, "zero-count start");
        expectPath("INDEX_OUT_OF_RANGE", new Action() {
            public void run() { empty.headingAt(0L); }
        });
        check(Double.doubleToRawLongBits(((Number)empty.serialize().get("angleBase")).doubleValue()) == 0L,
              "serialized negative zero");

        Map<String,Object> signed = config(Integer.valueOf(1));
        signed.put("start", pair(Double.valueOf(-0.0), Double.valueOf(-0.0)));
        signed.put("stepDistance", Double.valueOf(-0.0));
        signed.put("fieldScale", Double.valueOf(-0.0));
        signed.put("fieldOffset", pair(Double.valueOf(-0.0), Double.valueOf(-0.0)));
        signed.put("angleBase", Double.valueOf(-0.0));
        signed.put("angleScale", Double.valueOf(-0.0));
        GradientPath2D canonical = GradientPath2D.trace(signed);
        point(canonical.pointAt(0L), 0.0, 0.0, "canonical initial zero");
        point(canonical.pointAt(1L), 0.0, 0.0, "canonical completed zero");
        check(Double.doubleToRawLongBits(canonical.headingAt(0L)) == 0L, "canonical heading zero");
    }

    private static void invalidInputs() {
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(null); } });
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(Arrays.asList(1,2)); } });

        Map<String,Object> missing = config(Integer.valueOf(1)); missing.remove("angleScale");
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(missing); } });
        Map<String,Object> extra = config(Integer.valueOf(1)); extra.put("extra", Integer.valueOf(1));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(extra); } });

        Object[] badSeeds = {new BigInteger("1"), new BigDecimal("1"), new OddNumber(),
                             Double.valueOf(Double.NaN), Double.valueOf(Double.POSITIVE_INFINITY),
                             Double.valueOf(-1.0), Double.valueOf(1.5), Long.valueOf(4294967296L)};
        for (final Object seed : badSeeds) {
            final Map<String,Object> bad = config(Integer.valueOf(1));
            Map<String,Object> field = new LinkedHashMap<String,Object>(); field.put("seed", seed); bad.put("field", field);
            expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(bad); } });
        }
        Map<String,Object> fieldExtra = config(Integer.valueOf(1));
        Map<String,Object> badField = new LinkedHashMap<String,Object>(); badField.put("seed", 42); badField.put("x", 1);
        fieldExtra.put("field", badField);
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(fieldExtra); } });

        Map<String,Object> arrayStart = config(Integer.valueOf(1)); arrayStart.put("start", new double[]{0,0});
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(arrayStart); } });
        Map<String,Object> shortStart = config(Integer.valueOf(1)); shortStart.put("start", Arrays.asList(0));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(shortStart); } });
        Map<String,Object> badStartNumber = config(Integer.valueOf(1)); badStartNumber.put("start", Arrays.asList(BigInteger.ZERO, 0));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badStartNumber); } });

        Object[] badCounts = {Boolean.TRUE, new BigInteger("1"), new BigDecimal("1"), new OddNumber(),
                              Double.valueOf(Double.NaN), Double.valueOf(Double.NEGATIVE_INFINITY),
                              Double.valueOf(-1.0), Double.valueOf(1.5), Long.valueOf(MAX_STEPS+1L)};
        for (final Object count : badCounts) {
            final Map<String,Object> bad = config(count);
            expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(bad); } });
        }
        Map<String,Object> badDistance = config(Integer.valueOf(1)); badDistance.put("stepDistance", Double.valueOf(-0.1));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badDistance); } });
        Map<String,Object> badScale = config(Integer.valueOf(1)); badScale.put("fieldScale", Double.valueOf(Double.NaN));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badScale); } });
        Map<String,Object> arrayOffset = config(Integer.valueOf(1)); arrayOffset.put("fieldOffset", new double[]{0,0});
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(arrayOffset); } });
        Map<String,Object> badOffset = config(Integer.valueOf(1)); badOffset.put("fieldOffset", Arrays.asList(0.0, Double.NaN));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badOffset); } });
        Map<String,Object> badBase = config(Integer.valueOf(1)); badBase.put("angleBase", Double.valueOf(Double.POSITIVE_INFINITY));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badBase); } });
        Map<String,Object> badAngle = config(Integer.valueOf(1)); badAngle.put("angleScale", new OddNumber());
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(badAngle); } });

        // All static fields, including the last one, are validated before giant allocation.
        Map<String,Object> lateInvalid = config(Long.valueOf(MAX_STEPS));
        lateInvalid.put("angleScale", Double.valueOf(Double.NaN));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(lateInvalid); } });
    }

    private static void dynamicErrors() {
        Map<String,Object> lateQuery = config(Integer.valueOf(2));
        lateQuery.put("start", pair(Double.valueOf(9007199254740990.0), Double.valueOf(0.0)));
        lateQuery.put("fieldScale", Double.valueOf(1.0));
        expectTrace("TRACE_QUERY_INVALID", 1, "query_x", new Action() {
            public void run() { GradientPath2D.trace(lateQuery); }
        });

        Map<String,Object> queryY = config(Integer.valueOf(1));
        queryY.put("start", pair(Double.valueOf(0.0), Double.valueOf(9007199254740991.0)));
        queryY.put("fieldScale", Double.valueOf(1.0));
        expectTrace("TRACE_QUERY_INVALID", 0, "query_y", new Action() {
            public void run() { GradientPath2D.trace(queryY); }
        });

        Map<String,Object> heading = config(Integer.valueOf(1));
        heading.put("start", pair(Double.valueOf(0.25), Double.valueOf(0.75)));
        heading.put("fieldScale", Double.valueOf(1.0));
        heading.put("angleBase", Double.valueOf(1.7e308));
        heading.put("angleScale", Double.valueOf(1e308));
        expectTrace("TRACE_ARITHMETIC_INVALID", 0, "heading", new Action() {
            public void run() { GradientPath2D.trace(heading); }
        });

        Map<String,Object> endpointY = config(Integer.valueOf(1));
        endpointY.put("start", pair(Double.valueOf(0.0), Double.valueOf(1e308)));
        endpointY.put("stepDistance", Double.valueOf(1e308));
        endpointY.put("angleBase", Double.valueOf(Math.PI/2.0));
        expectTrace("TRACE_ARITHMETIC_INVALID", 0, "position_y", new Action() {
            public void run() { GradientPath2D.trace(endpointY); }
        });
    }

    private static Benchmark benchmark(int steps) {
        final Map<String,Object> input = config(Integer.valueOf(steps));
        input.put("start", pair(Double.valueOf(0.125), Double.valueOf(-0.25)));
        input.put("stepDistance", Double.valueOf(0.4));
        input.put("fieldScale", Double.valueOf(0.002));
        input.put("angleScale", Double.valueOf(40.0));
        for (int i=0;i<3;i++) {
            GradientPath2D path=GradientPath2D.trace(input);
            double[] end=path.pointAt((long)steps);
            benchmarkSink ^= Double.doubleToRawLongBits(end[0]) ^ Double.doubleToRawLongBits(end[1]);
        }
        GradientPath2D[] paths=new GradientPath2D[5];
        long[] elapsed=new long[5];
        ThreadMXBean bean = null; Long before = null;
        try {
            java.lang.management.ThreadMXBean candidate = ManagementFactory.getThreadMXBean();
            if (candidate instanceof ThreadMXBean) {
                bean = (ThreadMXBean)candidate;
                if (bean.isThreadAllocatedMemorySupported()) {
                    if (!bean.isThreadAllocatedMemoryEnabled()) bean.setThreadAllocatedMemoryEnabled(true);
                    before = Long.valueOf(bean.getThreadAllocatedBytes(Thread.currentThread().getId()));
                }
            }
        } catch (RuntimeException ignored) { bean=null; before=null; }
        for (int i=0;i<5;i++) {
            long started=System.nanoTime();
            GradientPath2D path=GradientPath2D.trace(input);
            double[] end=path.pointAt((long)steps);
            elapsed[i]=System.nanoTime()-started;
            paths[i]=path;
            benchmarkSink ^= Double.doubleToRawLongBits(end[0]) ^ Double.doubleToRawLongBits(end[1]);
            check(path.steps()==steps && Double.isFinite(end[0]) && Double.isFinite(end[1]), "benchmark result");
        }
        Long allocated=null;
        if (bean!=null && before!=null) {
            long after=bean.getThreadAllocatedBytes(Thread.currentThread().getId());
            if (after>=before.longValue()) allocated=Long.valueOf(after-before.longValue());
        }
        long expectedChecksum=outputChecksum(paths[0]);
        for(int i=1;i<paths.length;i++)
            check(outputChecksum(paths[i])==expectedChecksum,"benchmark outputs differ between repetitions");
        benchmarkSink ^= expectedChecksum;
        return new Benchmark(steps,elapsed,allocated,expectedChecksum);
    }

    private static long outputChecksum(GradientPath2D path) {
        long hash=0xcbf29ce484222325L;
        double[] point=new double[2];
        for(long i=0;i<=path.steps();i++) {
            path.pointInto(i,point,0);
            hash=(hash^Double.doubleToRawLongBits(point[0]))*0x100000001b3L;
            hash=(hash^Double.doubleToRawLongBits(point[1]))*0x100000001b3L;
        }
        for(long i=0;i<path.steps();i++)
            hash=(hash^Double.doubleToRawLongBits(path.headingAt(i)))*0x100000001b3L;
        return hash;
    }

    private static String normal() {
        ownershipAndAccess();
        zeroAndCanonical();
        invalidInputs();
        dynamicErrors();
        Benchmark tiny=benchmark(1), medium=benchmark(2000), longRun=benchmark(16000);
        return "{\"status\":\"passed\",\"mode\":\"normal\",\"assertions\":"+assertions
            +",\"groups\":{\"ownership_access\":true,\"zero_canonical\":true,"
            +"\"invalid_inputs\":true,\"dynamic_errors\":true,\"performance_observed\":true},"
            +"\"benchmarks\":["+tiny.json()+","+medium.json()+","+longRun.json()+"]"
            +",\"benchmark_sink\":\""+Long.toHexString(benchmarkSink)+"\"}";
    }

    private static String resource() {
        long heap=Runtime.getRuntime().maxMemory();
        check(heap<=40L*1024L*1024L, "resource mode requires -Xmx32m-class heap");

        // A later invalid static value must win before a layout-valid giant allocation.
        Map<String,Object> lateInvalid=config(Long.valueOf(MAX_STEPS));
        lateInvalid.put("angleScale", Double.valueOf(Double.NaN));
        expectPath("INVALID_INPUT", new Action() { public void run() { GradientPath2D.trace(lateInvalid); } });

        Map<String,Object> retainedConfig=config(Integer.valueOf(450000));
        retainedConfig.put("stepDistance", Double.valueOf(0.0));
        GradientPath2D retained=GradientPath2D.trace(retainedConfig);
        boolean exportFailed=false;
        Map<String,Object> unexpected=null;
        try {
            unexpected=retained.toValues();
        } catch (OutOfMemoryError expected) {
            exportFailed=true;
        }
        if (unexpected != null) unexpected.clear();
        unexpected=null;
        System.gc();
        check(exportFailed, "toValues did not exercise allocation failure");
        check(retained.steps()==450000, "export failure changed steps");
        point(retained.pointAt(0L),0.0,0.0,"export failure changed initial point");
        point(retained.pointAt(450000L),0.0,0.0,"export failure changed final point");
        check(raw(retained.headingAt(449999L),0.0),"export failure changed heading");
        check(((Number)retained.serialize().get("steps")).intValue()==450000,
              "export failure invalidated serialization");

        boolean maximumResourceFailure=false;
        try {
            GradientPath2D.trace(config(Long.valueOf(MAX_STEPS)));
        } catch (OutOfMemoryError expected) {
            maximumResourceFailure=true;
        }
        check(maximumResourceFailure,"valid maximum count was not a host resource failure");
        return "{\"status\":\"passed\",\"mode\":\"resource\",\"assertions\":"+assertions
            +",\"heap_max_bytes\":"+heap
            +",\"valid_maximum_resource_failure\":true"
            +",\"to_values_resource_failure\":true"
            +",\"retained_path_usable_after_export_failure\":true}";
    }

    private static String escape(String value) {
        StringBuilder result=new StringBuilder();
        for(int i=0;i<value.length();i++) {
            char c=value.charAt(i);
            if(c=='\\' || c=='\"') result.append('\\').append(c);
            else if(c=='\n') result.append("\\n");
            else if(c=='\r') result.append("\\r");
            else if(c=='\t') result.append("\\t");
            else if(c<32) result.append(String.format("\\u%04x",(int)c));
            else result.append(c);
        }
        return result.toString();
    }

    public static void main(String[] args) {
        String mode=args.length==1 && "--resource".equals(args[0]) ? "resource" : "normal";
        try {
            if(args.length>1 || (args.length==1 && !"--resource".equals(args[0])))
                throw new IllegalArgumentException("usage: GradientPathNative [--resource]");
            System.out.println("resource".equals(mode) ? resource() : normal());
        } catch(Throwable error) {
            String message=error.getClass().getName()+": "+String.valueOf(error.getMessage());
            System.out.println("{\"status\":\"failed\",\"mode\":\""+mode+"\",\"assertions\":"+assertions
                +",\"error\":\""+escape(message)+"\"}");
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }
}
