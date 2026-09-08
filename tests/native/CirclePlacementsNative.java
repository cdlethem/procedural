package org.procedurals.sampling;

import com.sun.management.ThreadMXBean;
import java.lang.management.ManagementFactory;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Native Java ownership, accessor and bounded-work checks for CP3 circle placements. */
public final class CirclePlacementsNative {
    private static int assertions;
    private static volatile long sink;
    private CirclePlacementsNative() { }
    private interface Action { void run(); }
    private static final class OddNumber extends Number {
        public int intValue() { return 1; } public long longValue() { return 1L; }
        public float floatValue() { return 1.0f; } public double doubleValue() { return 1.0; }
    }
    private static void check(boolean condition, String detail) { assertions++; if (!condition) throw new AssertionError(detail); }
    private static boolean raw(double a, double b) { return Double.doubleToRawLongBits(a) == Double.doubleToRawLongBits(b); }
    private static List<Object> pair(Object x, Object y) { return new ArrayList<Object>(Arrays.asList(x, y)); }
    private static Map<String,Object> seeded(Object attempts) {
        Map<String,Object> m = new LinkedHashMap<String,Object>();
        m.put("seed", Long.valueOf(42)); m.put("attempts", attempts);
        m.put("origin", pair(Double.valueOf(0.0), Double.valueOf(0.0)));
        m.put("extent", pair(Double.valueOf(512.0), Double.valueOf(512.0)));
        m.put("radiusRange", pair(Double.valueOf(4.0), Double.valueOf(64.0)));
        m.put("separationScale", Double.valueOf(1.0)); return m;
    }
    private static Map<String,Object> filter() {
        Map<String,Object> m = new LinkedHashMap<String,Object>();
        m.put("centres", new ArrayList<Object>(Arrays.asList(pair(Double.valueOf(-0.0), Double.valueOf(0.0)), pair(Double.valueOf(4.0), Double.valueOf(-0.0)))));
        m.put("radii", new ArrayList<Object>(Arrays.asList(Double.valueOf(1.0), Double.valueOf(1.0))));
        m.put("separationScale", Double.valueOf(1.0)); return m;
    }
    private static void expect(String code, Action action) {
        try { action.run(); throw new AssertionError("expected " + code); }
        catch (CirclePlacements2D.PlacementException error) { check(code.equals(error.code), "wrong code " + error.code); }
    }
    private static void ownershipAndAccess() {
        Map<String,Object> input = filter(); CirclePlacements2D result = CirclePlacements2D.filter(input);
        check(result.size() == 2 && result.attempts() == 2, "size/attempts");
        check(Double.doubleToRawLongBits(result.pointAt(0L)[0]) == 0L, "positive zero output");
        @SuppressWarnings("unchecked") List<Object> centres = (List<Object>) input.get("centres");
        @SuppressWarnings("unchecked") List<Object> radii = (List<Object>) input.get("radii");
        @SuppressWarnings("unchecked") List<Object> firstCentre = (List<Object>) centres.get(0);
        firstCentre.set(0, Double.valueOf(77.0)); centres.set(1, pair(Double.valueOf(99.0), Double.valueOf(99.0)));
        radii.set(0, Double.valueOf(99.0)); input.put("separationScale", Double.valueOf(2.0));
        check(raw(result.pointAt(0L)[0], 0.0) && raw(result.radiusAt(0L), 1.0), "input detachment");
        Map<String,Object> seededInput=seeded(Integer.valueOf(2)); CirclePlacements2D seededResult=CirclePlacements2D.seeded(seededInput);
        @SuppressWarnings("unchecked") List<Object> seededOrigin=(List<Object>)seededInput.get("origin");
        @SuppressWarnings("unchecked") List<Object> seededExtent=(List<Object>)seededInput.get("extent");
        @SuppressWarnings("unchecked") List<Object> seededRange=(List<Object>)seededInput.get("radiusRange");
        seededOrigin.set(0,Double.valueOf(900.0)); seededExtent.set(0,Double.valueOf(900.0)); seededRange.set(0,Double.valueOf(900.0));
        check(raw(seededResult.pointAt(0L)[0],211.8152515888214),"seeded nested input detachment");
        double[] fresh = result.pointAt(1L); fresh[0] = 19.0; check(raw(result.pointAt(1L)[0], 4.0), "point detachment");
        Map<String,Object> values = result.toValues();
        @SuppressWarnings("unchecked") List<Object> outputCentres = (List<Object>) values.get("centres");
        @SuppressWarnings("unchecked") List<Object> outputRadii = (List<Object>) values.get("radii");
        @SuppressWarnings("unchecked") List<Object> outputIndices = (List<Object>) values.get("sourceIndices");
        ((List<Object>) outputCentres.get(0)).set(0, Double.valueOf(88.0)); outputCentres.remove(1); outputRadii.set(0, Double.valueOf(88.0)); outputIndices.set(0,Integer.valueOf(88)); values.clear();
        check(raw(result.pointAt(0L)[0], 0.0) && raw(result.radiusAt(0L), 1.0) && result.sourceIndexAt(0L)==0, "toValues detachment");
        double[] out = {9.0, 9.0, 9.0, 9.0}; result.pointInto(Long.valueOf(1), out, 1);
        check(raw(out[0],9.0)&&raw(out[1],4.0)&&raw(out[2],0.0)&&raw(out[3],9.0), "pointInto slots");
        double[] unchanged = out.clone();
        expect("INVALID_INDEX", new Action() { public void run() { result.pointInto(Double.valueOf(Double.NaN), out, -1); }});
        check(Arrays.equals(out, unchanged), "index failure output mutation");
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { result.pointInto(Long.valueOf(2), null, -1); }});
        check(Arrays.equals(out, unchanged), "bound failure output mutation");
        expect("INVALID_OUTPUT", new Action() { public void run() { result.pointInto(Long.valueOf(0), out, 3); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { result.pointInto(Long.valueOf(0), null, 0); }});
        expect("INVALID_OUTPUT", new Action() { public void run() { result.pointInto(Long.valueOf(0), out, -1); }});
        check(Arrays.equals(out, unchanged), "output failure mutation");
        check(raw(result.radiusAt(Float.valueOf(1.0f)),1.0),"valid integral float accessor");
        expect("INVALID_INDEX", new Action() { public void run() { result.pointAt(new BigInteger("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.radiusAt(new BigDecimal("1")); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.sourceIndexAt(new OddNumber()); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.pointAt(Boolean.TRUE); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.pointAt(Double.valueOf(0.5)); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.pointAt(Long.valueOf(9007199254740992L)); }});
        expect("INVALID_INDEX", new Action() { public void run() { result.pointAt(Double.valueOf(-1.0)); }});
        expect("INDEX_OUT_OF_RANGE", new Action() { public void run() { result.radiusAt(Float.valueOf(2.0f)); }});
        for (Object carrier : new Object[] {Byte.valueOf((byte)2),Short.valueOf((short)2),Integer.valueOf(2),Long.valueOf(2),Float.valueOf(2.0f),Double.valueOf(2.0)}) {
            Map<String,Object> c=seeded(carrier); c.put("seed", Long.valueOf(42)); CirclePlacements2D.seeded(c);
        }
        Map<String,Object> bad=seeded(Integer.valueOf(1)); bad.put("seed", new BigInteger("1")); expect("INVALID_INPUT", new Action(){public void run(){CirclePlacements2D.seeded(bad);}});
        Map<String,Object> badPair=seeded(Integer.valueOf(1)); badPair.put("origin", new double[] {0.0,0.0}); expect("INVALID_INPUT", new Action(){public void run(){CirclePlacements2D.seeded(badPair);}});
        Map<String,Object> nan=seeded(Integer.valueOf(1)); nan.put("separationScale",Double.valueOf(Double.NaN)); expect("INVALID_INPUT",new Action(){public void run(){CirclePlacements2D.seeded(nan);}});
        Map<String,Object> infinity=filter(); ((List<Object>)((List<Object>)infinity.get("centres")).get(0)).set(1,Double.valueOf(Double.POSITIVE_INFINITY)); expect("INVALID_INPUT",new Action(){public void run(){CirclePlacements2D.filter(infinity);}});
    }
    private static String benchmark(int attempts, int warmups, int reps) {
        Map<String,Object> input=seeded(Integer.valueOf(attempts));
        for(int i=0;i<warmups;i++) sink ^= CirclePlacements2D.seeded(input).size();
        long[] samples=new long[reps]; long allocated=-1L;
        ThreadMXBean bean=null;
        try { bean=(ThreadMXBean)ManagementFactory.getThreadMXBean(); if(!bean.isThreadAllocatedMemorySupported()) bean=null; else { if(!bean.isThreadAllocatedMemoryEnabled()) bean.setThreadAllocatedMemoryEnabled(true); } } catch (SecurityException ignored) { bean=null; }
        if (bean != null) allocated=0L;
        long checksum=0xcbf29ce484222325L;
        long checksumAllocated=bean==null ? -1L : 0L;
        int retained=0;
        for(int i=0;i<reps;i++) { long allocationBefore=bean==null ? 0L : bean.getThreadAllocatedBytes(Thread.currentThread().getId()); long start=System.nanoTime(); CirclePlacements2D r=CirclePlacements2D.seeded(input); samples[i]=System.nanoTime()-start; if(bean!=null) allocated+=bean.getThreadAllocatedBytes(Thread.currentThread().getId())-allocationBefore; allocationBefore=bean==null ? 0L : bean.getThreadAllocatedBytes(Thread.currentThread().getId()); retained=r.size(); checksum=(checksum ^ r.attempts()) * 0x100000001b3L; checksum=(checksum ^ retained) * 0x100000001b3L; for(int j=0;j<retained;j++){double[] point=r.pointAt((long)j);checksum=(checksum^Double.doubleToRawLongBits(point[0]))*0x100000001b3L;checksum=(checksum^Double.doubleToRawLongBits(point[1]))*0x100000001b3L;checksum=(checksum^Double.doubleToRawLongBits(r.radiusAt((long)j)))*0x100000001b3L;checksum=(checksum^r.sourceIndexAt((long)j))*0x100000001b3L;} if(bean!=null) checksumAllocated+=bean.getThreadAllocatedBytes(Thread.currentThread().getId())-allocationBefore; sink^=checksum; }
        StringBuilder a=new StringBuilder("["); long total=0; for(int i=0;i<samples.length;i++){if(i>0)a.append(',');a.append(samples[i]);total+=samples[i];}a.append(']');
        return "{\"attempts\":"+attempts+",\"warmup_reps\":"+warmups+",\"timing_reps\":"+reps+",\"timing_scope\":\"seeded_retained_kernel\",\"elapsed_nanos\":"+a+",\"average_nanos\":"+(total/reps)+",\"retained_count_last_rep\":"+retained+",\"retained_raw_payload_bytes_last_rep\":"+(28L*retained)+",\"retained_payload_scope\":\"final packed 2*N binary64 coordinates, N binary64 radii, N int source indices; excludes array headers and temporary growth arrays\",\"thread_allocated_bytes_kernel_total\":"+(allocated<0?"null":Long.toString(allocated))+",\"thread_allocated_bytes_checksum_total\":"+(checksumAllocated<0?"null":Long.toString(checksumAllocated))+",\"allocation_scope\":\"kernel total excludes post-timing full-geometry checksum; checksum total includes fresh pointAt pairs\",\"geometry_checksum\":\""+Long.toUnsignedString(checksum,16)+"\"}";
    }
    public static void main(String[] args) {
        try {
            if(args.length!=0) throw new IllegalArgumentException("usage");
            ownershipAndAccess();
            String performance="["+benchmark(0,2,3)+","+benchmark(1,2,3)+","+benchmark(5000,3,5)+","+benchmark(10000,3,5)+","+benchmark(200000,1,2)+"]";
            System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+",\"native_ownership_access\":true,\"resource_failure_mechanism\":\"not executed; host allocation failure remains a host exception\",\"performance\":"+performance+"}");
        } catch(Throwable error) { System.out.println("{\"status\":\"failed\",\"assertions\":"+assertions+",\"error\":\""+escape(error.toString())+"\"}"); error.printStackTrace(System.err); System.exit(1); }
    }
    private static String escape(String s){return s.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n");}
}
