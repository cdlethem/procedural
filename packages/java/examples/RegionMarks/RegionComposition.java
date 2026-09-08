package org.procedurals.examples.regionmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.layout.RegularGrid;

/** Editable cell composition motivated by mosaic02 and chinasseForms.
 * Canvas, palette and content settings describe this example, not library defaults.
 * The seeded layout uses the public operation; the authored grid stays ordinary code.
 */
public strictfp final class RegionComposition {
    private final QuadrantPartition2D partition;
    private final List<double[]> authored;
    private final RegularGrid marks;

    private RegionComposition(QuadrantPartition2D partition, List<double[]> authored) {
        this.partition = partition;
        this.authored = authored;
        marks = RegularGrid.create(map("origin", pair(1.0 / 6, 1.0 / 6),
            "spacing", pair(1.0 / 3, 1.0 / 3), "columns", 3, "rows", 3));
    }

    public static RegionComposition seeded(long seed, int replacements, double fraction) {
        return new RegionComposition(QuadrantPartition2D.generate(map("seed", seed,
            "replacements", replacements, "origin", pair(0, 0), "extent", pair(640, 640),
            "selectionFraction", fraction)), null);
    }

    /** Two explicit grid replacements, independent of the seeded generator.
     * Each record is [left,top,right,bottom,creationId]. Edit this ordinary list freely.
     */
    public static RegionComposition authored() {
        List<double[]> cells = new ArrayList<double[]>();
        cells.add(new double[] {0, 0, 640, 640, 0});
        replaceGrid(cells, 0, 2, 3, 1);
        replaceGrid(cells, 3, 2, 3, 7);
        return new RegionComposition(null, cells);
    }

    private static void replaceGrid(List<double[]> cells, int id, int columns, int rows, int nextId) {
        if (columns <= 0 || rows <= 0) throw new IllegalArgumentException("positive grid divisions required");
        int selected = -1;
        for (int i = 0; i < cells.size(); i++) if ((int) cells.get(i)[4] == id) selected = i;
        if (selected < 0) throw new IllegalArgumentException("missing authored cell");
        double[] parent = cells.remove(selected);
        double w = parent[2] - parent[0], h = parent[3] - parent[1];
        for (int row = 0; row < rows; row++) for (int column = 0; column < columns; column++) {
            cells.add(new double[] {parent[0] + w * column / columns,
                parent[1] + h * row / rows, column + 1 == columns ? parent[2] : parent[0] + w * (column + 1) / columns,
                row + 1 == rows ? parent[3] : parent[1] + h * (row + 1) / rows, nextId++});
        }
    }

    public int size() { return partition == null ? authored.size() : partition.size(); }
    public int idAt(int index) { return partition == null ? (int) authored.get(index)[4] : partition.idAt(index); }
    public void boundsInto(int index, double[] out) {
        if (partition != null) partition.boundsInto(index, out, 0);
        else System.arraycopy(authored.get(index), 0, out, 0, 4);
    }

    /** Reuse the same normalized grid in every cell, without allocating per mark. */
    public void markInto(int index, double[] bounds, double[] out) {
        marks.pointInto(index, out, 0);
        out[0] = bounds[0] + (bounds[2] - bounds[0]) * out[0];
        out[1] = bounds[1] + (bounds[3] - bounds[1]) * out[1];
    }

    private static List<Double> pair(double x, double y) { return Arrays.asList(x, y); }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String)pairs[i], pairs[i + 1]);
        return result;
    }
}
