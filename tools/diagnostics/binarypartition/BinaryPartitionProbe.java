package org.procedurals.layout;

import java.util.ArrayList;
import java.util.List;

/** Private CP17 integer partition experiment; not public API or upstream source. */
public final class BinaryPartitionProbe {
    public static final class Layout {
        private final int[][] bounds;
        private final int splits;

        Layout(int[][] bounds, int splits) {
            this.bounds = bounds;
            this.splits = splits;
        }

        public int size() {
            return bounds.length;
        }

        public int splits() {
            return splits;
        }

        public int[] boundsAt(int index) {
            checkIndex(index);
            return bounds[index].clone();
        }

        public void boundsInto(int index, int[] output) {
            checkIndex(index);
            if (output == null || output.length != 4) {
                throw new IllegalArgumentException();
            }
            System.arraycopy(bounds[index], 0, output, 0, 4);
        }

        private void checkIndex(int index) {
            if (index < 0 || index >= bounds.length) {
                throw new IndexOutOfBoundsException();
            }
        }
    }

    public static Layout generate(long seed, int columns, int rows, int attempts, String policy) {
        if (seed < 0 || seed > 4294967295L || columns < 1 || rows < 1 || attempts < 0
                || attempts > 2147483646
                || !("RANDOM".equals(policy) || "LONGEST".equals(policy))) {
            throw new IllegalArgumentException();
        }

        List<int[]> leaves = new ArrayList<int[]>();
        leaves.add(new int[] {0, 0, columns, rows});
        QuadrantPartition2D.Xoshiro128StarStar11 stream =
                new QuadrantPartition2D.Xoshiro128StarStar11(seed);
        int splits = 0;
        for (int attempt = 0; attempt < attempts; attempt++) {
            int selected = (int) Math.floor(stream.unit() * leaves.size());
            int[] leaf = leaves.get(selected);
            int width = leaf[2] - leaf[0];
            int height = leaf[3] - leaf[1];
            boolean splitWidth = "RANDOM".equals(policy) ? stream.unit() < 0.5 : width > height;
            int extent = splitWidth ? width : height;
            if (extent == 1) {
                continue;
            }
            int cut = 1 + (int) Math.floor(stream.unit() * (extent - 1));
            leaves.remove(selected);
            if (splitWidth) {
                leaves.add(new int[] {leaf[0], leaf[1], leaf[0] + cut, leaf[3]});
                leaves.add(new int[] {leaf[0] + cut, leaf[1], leaf[2], leaf[3]});
            } else {
                leaves.add(new int[] {leaf[0], leaf[1], leaf[2], leaf[1] + cut});
                leaves.add(new int[] {leaf[0], leaf[1] + cut, leaf[2], leaf[3]});
            }
            splits++;
        }
        return new Layout(leaves.toArray(new int[leaves.size()][]), splits);
    }
}
