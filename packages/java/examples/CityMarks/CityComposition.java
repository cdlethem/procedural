package org.procedurals.examples.citymarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.layout.RegularGrid;
import org.procedurals.topology.Delaunay2D;

/**
 * Retained editable policies for the ciscis002 city composition.
 * Partitioning, triangulation, and window coordinates remain library operations.
 */
public final class CityComposition {
    private static final int WALLS_PER_FACE = 3;

    private final Delaunay2D mesh;
    private final int leafCount;
    private final double[] heights;
    private final double[] phases;
    private final boolean[] groundVisible;
    private final int[] groundGrays;
    private final int[] verticalCounts;
    private final int[] horizontalCounts;
    private final RegularGrid[] windowGrids;
    private final double[] wallWidths;
    private final double[] wallHeights;
    private final int[] wallOffsets;
    private final boolean[] litWindows;

    private CityComposition(Delaunay2D mesh, int leafCount, double[] heights, double[] phases,
                            boolean[] groundVisible, int[] groundGrays,
                            int[] verticalCounts, int[] horizontalCounts,
                            RegularGrid[] windowGrids, double[] wallWidths,
                            double[] wallHeights, int[] wallOffsets,
                            boolean[] litWindows) {
        this.mesh = mesh;
        this.leafCount = leafCount;
        this.heights = heights;
        this.phases = phases;
        this.groundVisible = groundVisible;
        this.groundGrays = groundGrays;
        this.verticalCounts = verticalCounts;
        this.horizontalCounts = horizontalCounts;
        this.windowGrids = windowGrids;
        this.wallWidths = wallWidths;
        this.wallHeights = wallHeights;
        this.wallOffsets = wallOffsets;
        this.litWindows = litWindows;
    }

    public static CityComposition create(long seed) {
        QuadrantPartition2D partition = QuadrantPartition2D.generate(map(
            "seed", seed, "replacements", 100,
            "origin", pair(-480d, -480d), "extent", pair(960d, 960d),
            "selectionFraction", .5d));
        List<Object> sites = new ArrayList<Object>();
        double[] bounds = new double[4];
        for (int face = 0; face < partition.size(); face++) {
            partition.boundsInto(face, bounds, 0);
            sites.add(pair((bounds[0] + bounds[2]) * .5, (bounds[1] + bounds[3]) * .5));
        }
        Delaunay2D mesh = Delaunay2D.triangulate(map("points", sites, "maxWork", 50000000L));
        int faces = mesh.faceCount();
        double[] heights = new double[faces];
        double[] phases = new double[faces];
        boolean[] groundVisible = new boolean[faces];
        int[] groundGrays = new int[faces];
        int[] verticalCounts = new int[faces];
        int[] horizontalCounts = new int[faces];
        RegularGrid[] windowGrids = new RegularGrid[faces];
        double[] wallWidths = new double[faces * WALLS_PER_FACE];
        double[] wallHeights = new double[faces * WALLS_PER_FACE];
        int[] wallOffsets = new int[wallWidths.length + 1];
        // 22 by 22 is the frozen maximum grid; trim after the source-order traversal.
        boolean[] retainedLit = new boolean[faces * WALLS_PER_FACE * 22 * 22];

        Random policy = new Random(seed); // Separate from the partition's layout RNG.
        for (int face = 0; face < faces; face++) {
            heights[face] = policy.nextDouble() * policy.nextDouble();
            phases[face] = policy.nextDouble();
            groundVisible[face] = policy.nextDouble() >= .2d;
            groundGrays[face] = (int) (200d * policy.nextDouble());
            verticalCounts[face] = 16 + policy.nextInt(7);
            horizontalCounts[face] = 16 + policy.nextInt(7);
            int vertical = verticalCounts[face];
            int horizontal = horizontalCounts[face];
            windowGrids[face] = RegularGrid.create(map(
                "origin", pair(.5d / vertical, .5d / horizontal),
                "spacing", pair(1d / vertical, 1d / horizontal),
                "columns", vertical, "rows", horizontal));
            for (int wall = 0; wall < WALLS_PER_FACE; wall++) {
                int wallIndex = face * WALLS_PER_FACE + wall;
                double litProbability = (.2d + .6d * policy.nextDouble()) * policy.nextDouble();
                wallWidths[wallIndex] = .2d + .7d * policy.nextDouble();
                wallHeights[wallIndex] = .2d + .7d * policy.nextDouble();
                // The source traverses rows (j) before columns (i).
                int start = wallOffsets[wallIndex];
                for (int j = 0; j < horizontal; j++) {
                    for (int i = 0; i < vertical; i++) {
                        retainedLit[start + j * vertical + i] = policy.nextDouble() < litProbability;
                    }
                }
                wallOffsets[wallIndex + 1] = start + vertical * horizontal;
            }
        }
        boolean[] litWindows = Arrays.copyOf(retainedLit, wallOffsets[wallOffsets.length - 1]);
        return new CityComposition(mesh, partition.size(), heights, phases, groundVisible, groundGrays,
            verticalCounts, horizontalCounts, windowGrids, wallWidths, wallHeights,
            wallOffsets, litWindows);
    }

    public Delaunay2D mesh() { return mesh; }
    public int leafCount() { return leafCount; }
    public double heightUnit(int face) { return heights[face]; }
    public double palettePhase(int face) { return phases[face]; }
    public boolean groundVisible(int face) { return groundVisible[face]; }
    public int groundGray(int face) { return groundGrays[face]; }
    public int verticalCount(int face) { return verticalCounts[face]; }
    public int horizontalCount(int face) { return horizontalCounts[face]; }
    public int windowCount() { return litWindows.length; }
    public double wallWidthFraction(int face, int wall) { return wallWidths[wallIndex(face, wall)]; }
    public double wallHeightFraction(int face, int wall) { return wallHeights[wallIndex(face, wall)]; }
    public boolean windowLit(int face, int wall, int index) {
        int wallIndex = wallIndex(face, wall);
        int count = verticalCounts[face] * horizontalCounts[face];
        if (index < 0 || index >= count) throw new IndexOutOfBoundsException("window index");
        return litWindows[wallOffsets[wallIndex] + index];
    }
    public RegularGrid windowGrid(int face) { return windowGrids[face]; }

    private int wallIndex(int face, int wall) {
        if (wall < 0 || wall >= WALLS_PER_FACE) throw new IndexOutOfBoundsException("wall");
        if (face < 0 || face >= heights.length) throw new IndexOutOfBoundsException("face");
        return face * WALLS_PER_FACE + wall;
    }
    private static List<Double> pair(double x, double y) { return Arrays.asList(x, y); }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }
}
