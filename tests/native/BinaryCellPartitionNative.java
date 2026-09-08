package org.procedurals.layout;

import java.util.Arrays;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.List;
import java.math.BigInteger;

/** Focused Java core invariants, ownership, carriers and actual bounded workloads. */
public final class BinaryCellPartitionNative {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void vector(long seed, String policy, int[][] expected) {
        BinaryCellPartition2D layout = BinaryCellPartition2D.generate(seed, 8, 6, 5, policy);
        require(layout.size() == expected.length, "golden count");
        for (int i = 0; i < expected.length; i++)
            require(Arrays.equals(layout.boundsAt(i), expected[i]), "golden bounds seed=" + seed + " policy=" + policy + " index=" + i);
    }
    private static void invalid(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("invalid input accepted");
    }
    private static void geometry(long seed, int columns, int rows, int attempts, String policy) {
        BinaryCellPartition2D layout = BinaryCellPartition2D.generate(seed, columns, rows, attempts, policy);
        require(layout.size() == layout.splits() + 1 && layout.splits() <= attempts, "split accounting");
        long area = 0;
        for (int i = 0; i < layout.size(); i++) {
            int[] a = layout.boundsAt(i);
            require(a[0] >= 0 && a[1] >= 0 && a[2] <= columns && a[3] <= rows
                    && a[2] > a[0] && a[3] > a[1], "positive contained bounds");
            area += (long)(a[2] - a[0]) * (a[3] - a[1]);
            for (int j = 0; j < i; j++) {
                int[] b = layout.boundsAt(j);
                require(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], "overlap");
            }
            int[] copied = a.clone();
            a[0] = -99;
            require(Arrays.equals(copied, layout.boundsAt(i)), "detached accessor");
            layout.boundsInto(i, a);
            require(Arrays.equals(copied, a), "buffer accessor");
        }
        require(area == (long)columns * rows, "area conservation");
    }
    private static Map<String,Object> config(Object value) {
        Map<String,Object> map = new LinkedHashMap<String,Object>();
        map.put("seed", value); map.put("columns", value); map.put("rows", value);
        map.put("attempts", value); map.put("axisPolicy", "LONGEST");
        return map;
    }
    @SuppressWarnings("unchecked")
    private static void carriers() {
        for (Object v : new Object[]{(byte)2,(short)2,2,2L,2.0f,2.0})
            require(BinaryCellPartition2D.generate(config(v)).size() == 3, "valid boxed carrier");
        Number custom = new Number() {
            public int intValue(){return 2;} public long longValue(){return 2;}
            public float floatValue(){return 2;} public double doubleValue(){return 2;}
        };
        for (Object v : new Object[]{null,true,"2",BigInteger.valueOf(2),custom,Double.NaN,
                Double.POSITIVE_INFINITY,2.5,Long.MAX_VALUE}) {
            try { BinaryCellPartition2D.generate(config(v)); throw new AssertionError("carrier accepted"); }
            catch (BinaryCellPartition2D.PartitionException e) { require(e.code.equals("INVALID_INPUT"), "carrier code"); }
        }
        Map<String,Object> input = config(2);
        BinaryCellPartition2D layout = BinaryCellPartition2D.generate(input);
        Map<String,Object> saved = layout.toValues();
        input.clear();
        Map<String,Object> exported = layout.toValues();
        ((List<Object>)((List<?>)exported.get("bounds")).get(0)).set(0, -100);
        exported.clear();
        require(layout.toValues().equals(saved), "deep export and input ownership");
        for (long i : new long[]{layout.size(),9007199254740991L,9007199254740992L}) {
            int[] buffer={9,9,9,9};
            try { layout.boundsInto(i,buffer); throw new AssertionError("bad index accepted"); }
            catch (BinaryCellPartition2D.PartitionException e) {
                require(e.code.equals(i>9007199254740991L?"INVALID_INDEX":"INDEX_OUT_OF_RANGE"),"access error code");
                require(Arrays.equals(buffer,new int[]{9,9,9,9}),"atomic failed write");
            }
        }
        try { layout.boundsInto(0,new int[5]); throw new AssertionError("bad output accepted"); }
        catch (BinaryCellPartition2D.PartitionException e) { require(e.code.equals("INVALID_OUTPUT"),"output code"); }
    }
    private static String workloads() {
        StringBuilder out=new StringBuilder("[");
        int[][] work={{2,2,1},{160,160,400},{10000,10000,20000}};
        for(int k=0;k<work.length;k++) {
            int[] w=work[k];
            for(int repeat=0;repeat<5;repeat++) BinaryCellPartition2D.generate(42,w[0],w[1],w[2],"LONGEST");
            long start=System.nanoTime();
            BinaryCellPartition2D layout=BinaryCellPartition2D.generate(42,w[0],w[1],w[2],"LONGEST");
            long nanos=System.nanoTime()-start;
            long checksum=0; int[] b=new int[4];
            for(int i=0;i<layout.size();i++) {layout.boundsInto(i,b); for(int v:b)checksum=checksum*31+v;}
            if(k>0)out.append(',');
            out.append("{\"columns\":").append(w[0]).append(",\"rows\":").append(w[1])
                .append(",\"attempts\":").append(w[2]).append(",\"leaves\":").append(layout.size())
                .append(",\"warmup_runs\":5,\"measured_runs\":1,\"generation_ns\":").append(nanos)
                .append(",\"coordinate_payload_bytes\":").append(16L*layout.size())
                .append(",\"checksum\":\"").append(checksum).append("\"}");
        }
        return out.append(']').toString();
    }
    public static void main(String[] args) {
        // Independent Python integer-stream/reference-list calculation, not copied Java outputs.
        vector(0, "RANDOM", new int[][]{{0,4,3,6},{3,4,8,5},{3,5,8,6},{0,0,6,4},{6,0,8,4}});
        vector(0, "LONGEST", new int[][]{{0,0,5,6},{5,4,8,6},{5,0,8,2},{7,2,8,4},{5,2,7,3},{5,3,7,4}});
        vector(1, "RANDOM", new int[][]{{2,0,8,6},{0,0,1,6},{1,4,2,6},{1,0,2,3},{1,3,2,4}});
        vector(1, "LONGEST", new int[][]{{0,0,3,2},{0,2,3,6},{3,0,8,5},{6,5,8,6},{3,5,5,6},{5,5,6,6}});
        vector(42, "RANDOM", new int[][]{{0,0,8,1},{0,4,8,5},{0,5,8,6},{0,1,8,3},{0,3,8,4}});
        vector(42, "LONGEST", new int[][]{{7,0,8,6},{4,0,7,6},{0,3,4,6},{0,0,2,3},{2,0,4,2},{2,2,4,3}});
        vector(2147483648L, "RANDOM", new int[][]{{0,3,1,6},{1,0,8,2},{1,2,8,6},{0,0,1,2},{0,2,1,3}});
        vector(2147483648L, "LONGEST", new int[][]{{0,3,1,6},{1,0,4,6},{4,0,8,3},{4,3,8,6},{0,0,1,2},{0,2,1,3}});
        for (String policy : new String[]{"RANDOM", "LONGEST"}) {
            geometry(42, 60, 60, 240, policy);
            geometry(1, 1, 1, 100, policy);
            geometry(0, 1, 7, 100, policy);
            geometry(4294967295L, Integer.MAX_VALUE, Integer.MAX_VALUE, 8, policy);
            geometry(42, 8, 6, 0, policy);
        }
        invalid(() -> BinaryCellPartition2D.generate(-1, 1, 1, 0, "RANDOM"));
        invalid(() -> BinaryCellPartition2D.generate(4294967296L, 1, 1, 0, "RANDOM"));
        invalid(() -> BinaryCellPartition2D.generate(0, 0, 1, 0, "RANDOM"));
        invalid(() -> BinaryCellPartition2D.generate(0, 1, 1, -1, "RANDOM"));
        invalid(() -> BinaryCellPartition2D.generate(0, 1, 1, 0, null));
        BinaryCellPartition2D one = BinaryCellPartition2D.generate(0, 1, 1, 0, "LONGEST");
        int[] buffer = {9,9,9,9};
        try { one.boundsInto(-1, buffer); throw new AssertionError("index accepted"); }
        catch (BinaryCellPartition2D.PartitionException expected) { require(expected.code.equals("INVALID_INDEX"), "index code"); require(Arrays.equals(buffer, new int[]{9,9,9,9}), "atomic index failure"); }
        invalid(() -> one.boundsInto(0, new int[5]));
        carriers();
        System.out.println("{\"status\":\"passed\",\"ordered_vectors\":8,\"geometry_scenarios\":10,\"workloads\":" + workloads() + "}");
    }
}
