package org.procedurals.layout;

import java.util.Arrays;

/** Private experiment checks; not release conformance or target support evidence. */
public final class BinaryPartitionCheck {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void vector(long seed, String policy, int[][] expected) {
        BinaryPartitionProbe.Layout layout = BinaryPartitionProbe.generate(seed, 8, 6, 5, policy);
        require(layout.size() == expected.length, "golden count");
        for (int i = 0; i < expected.length; i++)
            require(Arrays.equals(layout.boundsAt(i), expected[i]), "golden bounds seed=" + seed + " policy=" + policy + " index=" + i);
    }
    private static void invalid(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("invalid input accepted");
    }
    private static void geometry(long seed, int columns, int rows, int attempts, String policy) {
        BinaryPartitionProbe.Layout layout = BinaryPartitionProbe.generate(seed, columns, rows, attempts, policy);
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
        invalid(() -> BinaryPartitionProbe.generate(-1, 1, 1, 0, "RANDOM"));
        invalid(() -> BinaryPartitionProbe.generate(4294967296L, 1, 1, 0, "RANDOM"));
        invalid(() -> BinaryPartitionProbe.generate(0, 0, 1, 0, "RANDOM"));
        invalid(() -> BinaryPartitionProbe.generate(0, 1, 1, -1, "RANDOM"));
        invalid(() -> BinaryPartitionProbe.generate(0, 1, 1, 0, null));
        BinaryPartitionProbe.Layout one = BinaryPartitionProbe.generate(0, 1, 1, 0, "LONGEST");
        int[] buffer = {9,9,9,9};
        try { one.boundsInto(-1, buffer); throw new AssertionError("index accepted"); }
        catch (IndexOutOfBoundsException expected) { require(Arrays.equals(buffer, new int[]{9,9,9,9}), "atomic index failure"); }
        invalid(() -> one.boundsInto(0, new int[5]));
        System.out.println("PASS: 8 exact ordered vectors; 10 geometry/ownership scenarios; validation and atomic access checks");
    }
}
