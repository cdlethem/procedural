package org.procedurals.examples.reliefmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.topology.Delaunay2D;

/** Momito composition glue; partitioning and triangulation stay in the library. */
public final class ReliefComposition {
    private final QuadrantPartition2D partition;
    private final Delaunay2D mesh;
    private final double[] spans;
    private final boolean[] spikes;

    private ReliefComposition(QuadrantPartition2D partition, Delaunay2D mesh,
                              double[] spans, boolean[] spikes) {
        this.partition = partition;
        this.mesh = mesh;
        this.spans = spans;
        this.spikes = spikes;
    }

    public static ReliefComposition create(long seed) {
        Map<String,Object> config = new LinkedHashMap<String,Object>();
        config.put("seed", seed);
        config.put("replacements", 290);
        config.put("origin", Arrays.<Object>asList(-480d, -480d));
        config.put("extent", Arrays.<Object>asList(960d, 960d));
        config.put("selectionFraction", .5d);
        QuadrantPartition2D partition = QuadrantPartition2D.generate(config);
        List<Object> sites = new ArrayList<Object>();
        double[] bounds = new double[4];
        double[] spans = new double[partition.size()];
        for (int i = 0; i < partition.size(); i++) {
            partition.boundsInto(i, bounds, 0);
            sites.add(Arrays.<Object>asList((bounds[0] + bounds[2]) * .5,
                                           (bounds[1] + bounds[3]) * .5));
            spans[i] = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
        }
        Map<String,Object> topology = new LinkedHashMap<String,Object>();
        topology.put("points", sites);
        topology.put("maxWork", 50000000L);
        Delaunay2D mesh = Delaunay2D.triangulate(topology);
        boolean[] spikes = new boolean[partition.size()];
        Random selection = new Random(seed); // Explicit example stream, separate from layout.
        for (int i = 0; i < spikes.length; i++) spikes[i] = selection.nextDouble() < .9;
        return new ReliefComposition(partition, mesh, spans, spikes);
    }

    public Delaunay2D mesh() { return mesh; }
    public int leafCount() { return partition.size(); }
    public boolean spikeAt(int leaf) { return spikes[leaf]; }
    public double spikeHeight(int leaf) { return spans[leaf] * .08 * 3.8; }
    public void centerInto(int leaf, double[] point) {
        mesh.pointInto(mesh.inputVertexAt(leaf), point, 0);
    }
}
