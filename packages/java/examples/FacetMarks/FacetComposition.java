package org.procedurals.examples.facetmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.sampling.TrianglePoints2D;
import org.procedurals.topology.Delaunay2D;

/**
 * Editable FacetMarks composition using retained CP9 facets and CP5 triangle grain.
 *
 * <p>The disc site source is an authored Java {@link Random} example, while the cell
 * source transfers CP4 leaf centres. Both differ from the global streams, source-site
 * filters, halo styling, city construction, and rendering in
 * {@code survey/out/2018/Generativos/datata/notes.md} and
 * {@code survey/out/2019/generativos/lightcity/notes.md}. The fixed counts, canvas,
 * density, and budget are this example's choices, not operation defaults or artistic
 * ranges.</p>
 */
public final strictfp class FacetComposition {
    private static final long MAX_UNSIGNED32 = 0xffffffffL;
    private static final long TRIANGULATION_WORK = 50000000L;
    private static final int GRAIN_LIMIT = 20000;
    private static final double GRAIN_DENSITY = 0.06d;

    private final Delaunay2D mesh;
    private final TrianglePoints2D[] grain;
    private final int grainCount;

    private FacetComposition(Delaunay2D mesh, TrianglePoints2D[] grain, int grainCount) {
        this.mesh = mesh;
        this.grain = grain;
        this.grainCount = grainCount;
    }

    /**
     * Builds one retained facet mesh and a retained uniform grain batch for every face.
     * {@code fine} selects 512 rather than 128 disc sites, or 170 rather than 42 CP4
     * replacements; {@code cells} selects CP4 leaf centres rather than the disc source.
     */
    public static FacetComposition create(long seed, boolean fine, boolean cells) {
        if (seed < 0L || seed > MAX_UNSIGNED32) throw new IllegalArgumentException("seed must be uint32");
        List<Object> sites = cells ? cellSites(seed, fine) : discSites(seed, fine);
        Delaunay2D mesh = Delaunay2D.triangulate(record("points", sites, "maxWork", Long.valueOf(TRIANGULATION_WORK)));

        int faces = mesh.faceCount();
        int[] counts = new int[faces];
        long total = 0L;
        double[] a = new double[2], b = new double[2], c = new double[2];
        for (int face = 0; face < faces; face++) {
            int[] indices = mesh.triangleAt(face);
            mesh.pointInto(indices[0], a, 0);
            mesh.pointInto(indices[1], b, 0);
            mesh.pointInto(indices[2], c, 0);
            double twiceArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
            double requested = Math.floor(Math.abs(twiceArea) * 0.5d * GRAIN_DENSITY);
            if (!Double.isFinite(requested) || requested < 0.0d || requested > GRAIN_LIMIT - total)
                throw new IllegalArgumentException("example exceeds 20000-point grain budget");
            counts[face] = (int) requested;
            total += counts[face];
        }

        TrianglePoints2D[] grain = new TrianglePoints2D[faces];
        for (int face = 0; face < faces; face++) {
            int[] indices = mesh.triangleAt(face);
            mesh.pointInto(indices[0], a, 0);
            mesh.pointInto(indices[1], b, 0);
            mesh.pointInto(indices[2], c, 0);
            long faceSeed = (seed + face) & MAX_UNSIGNED32;
            grain[face] = TrianglePoints2D.seeded(record(
                    "seed", Long.valueOf(faceSeed), "count", Integer.valueOf(counts[face]),
                    "triangle", triangle(a, b, c)));
        }
        return new FacetComposition(mesh, grain, (int) total);
    }

    /** Returns the exact retained triangulation used by all style modes. */
    public Delaunay2D mesh() { return mesh; }

    /** Returns the retained grain batch aligned with one final mesh face. */
    public TrianglePoints2D grainAt(int face) {
        if (face < 0 || face >= grain.length) throw new IllegalArgumentException("face index");
        return grain[face];
    }

    /** Returns the total retained grain point count across every final face. */
    public int grainCount() { return grainCount; }

    private static List<Object> discSites(long seed, boolean fine) {
        int count = fine ? 512 : 128;
        Random random = new Random(seed);
        List<Object> sites = new ArrayList<Object>(count);
        for (int index = 0; index < count; index++) {
            double angle = random.nextDouble() * (2.0d * Math.PI);
            double radius = 240.0d * Math.sqrt(random.nextDouble());
            sites.add(point(320.0d + radius * Math.cos(angle), 320.0d + radius * Math.sin(angle)));
        }
        return sites;
    }

    private static List<Object> cellSites(long seed, boolean fine) {
        int replacements = fine ? 170 : 42;
        QuadrantPartition2D layout = QuadrantPartition2D.generate(record(
                "seed", Long.valueOf(seed), "replacements", Integer.valueOf(replacements),
                "origin", point(64.0d, 64.0d), "extent", point(512.0d, 512.0d),
                "selectionFraction", Double.valueOf(0.5d)));
        List<Object> sites = new ArrayList<Object>(layout.size());
        double[] bounds = new double[4];
        for (int index = 0; index < layout.size(); index++) {
            layout.boundsInto(index, bounds, 0);
            sites.add(point(bounds[0] + (bounds[2] - bounds[0]) * 0.5d,
                    bounds[1] + (bounds[3] - bounds[1]) * 0.5d));
        }
        return sites;
    }

    private static List<Object> triangle(double[] a, double[] b, double[] c) {
        return Arrays.<Object>asList(point(a[0], a[1]), point(b[0], b[1]), point(c[0], c[1]));
    }

    private static List<Object> point(double x, double y) {
        return Arrays.<Object>asList(Double.valueOf(x), Double.valueOf(y));
    }

    private static Map<String, Object> record(Object... entries) {
        Map<String, Object> value = new LinkedHashMap<String, Object>();
        for (int index = 0; index < entries.length; index += 2)
            value.put((String) entries[index], entries[index + 1]);
        return value;
    }
}
