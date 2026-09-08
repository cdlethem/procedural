package org.procedurals.examples.landscapemarks;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.sampling.CirclePlacements2D;
import org.procedurals.topology.Delaunay2D;

/**
 * Retained composition policies for the Parapara landscape recreation.
 *
 * <p>This is example glue: the noise field, ordered circle filter, and Delaunay mesh
 * are reusable operations, while the retained distributions and palette choices are
 * local to this editable scene.</p>
 */
public final class LandscapeComposition {
    private static final int HORIZON_LAYERS = 3;
    private static final int STRIPE_SIDES = 2;
    private static final int PROPOSAL_COUNT = 50;
    private static final long TRIANGULATION_WORK = 50000000L;

    private final double horizon;
    private final GradientNoise2D01 noise;
    private final double[] horizonFrequencies;
    private final int[] horizonColors;
    private final double[] stripeStarts;
    private final double[] stripeDrifts;
    private final CirclePlacements2D placements;
    private final Delaunay2D mesh;
    private final int[] diskColors;
    private final int[] haloColors;
    private final int[] innerColors;
    private final double[] speckSizes;
    private final double[] speckAngles;
    private final double[] speckStretches;
    private final int[] speckColors;

    private LandscapeComposition(double horizon, GradientNoise2D01 noise,
                                double[] horizonFrequencies, int[] horizonColors,
                                double[] stripeStarts, double[] stripeDrifts,
                                CirclePlacements2D placements, Delaunay2D mesh,
                                int[] diskColors, int[] haloColors, int[] innerColors,
                                double[] speckSizes, double[] speckAngles,
                                double[] speckStretches, int[] speckColors) {
        this.horizon = horizon;
        this.noise = noise;
        this.horizonFrequencies = horizonFrequencies;
        this.horizonColors = horizonColors;
        this.stripeStarts = stripeStarts;
        this.stripeDrifts = stripeDrifts;
        this.placements = placements;
        this.mesh = mesh;
        this.diskColors = diskColors;
        this.haloColors = haloColors;
        this.innerColors = innerColors;
        this.speckSizes = speckSizes;
        this.speckAngles = speckAngles;
        this.speckStretches = speckStretches;
        this.speckColors = speckColors;
    }

    /** Builds one retained scene from a Java policy stream and an explicit noise seed. */
    public static LandscapeComposition create(long seed) {
        Random policy = new Random(seed);
        double horizon = .15d + .15d * policy.nextDouble();
        GradientNoise2D01 noise = GradientNoise2D01.create(record("seed", Long.valueOf(seed)));

        double[] horizonFrequencies = new double[HORIZON_LAYERS];
        int[] horizonColors = new int[HORIZON_LAYERS];
        for (int layer = 0; layer < HORIZON_LAYERS; layer++) {
            horizonFrequencies[layer] = .01d * policy.nextDouble();
            horizonColors[layer] = policy.nextInt(9);
        }

        double[] stripeStarts = new double[4];
        double[] stripeDrifts = new double[4];
        for (int skyIndex = 0; skyIndex < 2; skyIndex++) {
            boolean sky = skyIndex != 0;
            for (int side = 0; side < STRIPE_SIDES; side++) {
                int index = stripeIndex(sky, side);
                stripeStarts[index] = 9d * policy.nextDouble();
                stripeDrifts[index] = .1d * policy.nextDouble() * (.4d + .6d * policy.nextDouble())
                    * horizon * (sky ? .1d : 1d);
            }
        }

        List<Object> centres = new ArrayList<Object>(PROPOSAL_COUNT);
        List<Object> radii = new ArrayList<Object>(PROPOSAL_COUNT);
        for (int proposal = 0; proposal < PROPOSAL_COUNT; proposal++) {
            double depth = .98d * policy.nextDouble() * policy.nextDouble();
            double x = 960d * policy.nextDouble();
            double y = 960d * (horizon + depth * (1d - horizon));
            double diameter = (.06d + Math.pow(depth, 1.4d)) * 120d;
            centres.add(point(x, y));
            radii.add(Double.valueOf(diameter * .5d));
        }
        CirclePlacements2D placements = CirclePlacements2D.filter(record(
            "centres", centres, "radii", radii, "separationScale", Double.valueOf(1.2d)));
        Delaunay2D mesh = Delaunay2D.triangulate(record(
            "points", acceptedCentres(placements), "maxWork", Long.valueOf(TRIANGULATION_WORK)));

        int accepted = placements.size();
        int[] diskColors = new int[accepted];
        int[] haloColors = new int[accepted];
        int[] innerColors = new int[accepted];
        for (int index = 0; index < accepted; index++) {
            diskColors[index] = policy.nextInt(9);
            haloColors[index] = policy.nextInt(9);
            innerColors[index] = policy.nextInt(9);
        }

        int faces = mesh.faceCount();
        double[] speckSizes = new double[faces];
        double[] speckAngles = new double[faces];
        double[] speckStretches = new double[faces];
        int[] speckColors = new int[faces];
        for (int face = 0; face < faces; face++) {
            speckSizes[face] = 3d * policy.nextDouble();
            speckAngles[face] = Math.PI * policy.nextDouble();
            speckStretches[face] = 200d * policy.nextDouble();
            speckColors[face] = policy.nextInt(9);
        }
        return new LandscapeComposition(horizon, noise, horizonFrequencies, horizonColors,
            stripeStarts, stripeDrifts, placements, mesh, diskColors, haloColors, innerColors,
            speckSizes, speckAngles, speckStretches, speckColors);
    }

    public double horizon() { return horizon; }
    public GradientNoise2D01 noise() { return noise; }
    public double horizonFrequency(int layer) { return horizonFrequencies[horizonLayer(layer)]; }
    public int horizonColor(int layer) { return horizonColors[horizonLayer(layer)]; }
    public double stripeStart(boolean sky, int side) { return stripeStarts[stripeIndex(sky, side)]; }
    public double stripeDrift(boolean sky, int side) { return stripeDrifts[stripeIndex(sky, side)]; }
    public CirclePlacements2D placements() { return placements; }
    public Delaunay2D mesh() { return mesh; }
    public int diskColor(int index) { return diskColors[circleIndex(index)]; }
    public int haloColor(int index) { return haloColors[circleIndex(index)]; }
    public int innerColor(int index) { return innerColors[circleIndex(index)]; }
    public double speckSize(int face) { return speckSizes[faceIndex(face)]; }
    public double speckAngle(int face) { return speckAngles[faceIndex(face)]; }
    public double speckStretch(int face) { return speckStretches[faceIndex(face)]; }
    public int speckColor(int face) { return speckColors[faceIndex(face)]; }

    private static List<Object> acceptedCentres(CirclePlacements2D placements) {
        List<Object> centres = new ArrayList<Object>(placements.size());
        double[] point = new double[2];
        for (int index = 0; index < placements.size(); index++) {
            placements.pointInto(index, point, 0);
            centres.add(point(point[0], point[1]));
        }
        return centres;
    }

    private static int stripeIndex(boolean sky, int side) {
        if (side < 0 || side >= STRIPE_SIDES) throw new IndexOutOfBoundsException("stripe side");
        return (sky ? 2 : 0) + side;
    }
    private static int horizonLayer(int layer) {
        if (layer < 0 || layer >= HORIZON_LAYERS) throw new IndexOutOfBoundsException("horizon layer");
        return layer;
    }
    private int circleIndex(int index) {
        if (index < 0 || index >= diskColors.length) throw new IndexOutOfBoundsException("circle index");
        return index;
    }
    private int faceIndex(int index) {
        if (index < 0 || index >= speckSizes.length) throw new IndexOutOfBoundsException("face index");
        return index;
    }
    private static List<Double> point(double x, double y) {
        List<Double> point = new ArrayList<Double>(2);
        point.add(Double.valueOf(x));
        point.add(Double.valueOf(y));
        return point;
    }
    private static Map<String, Object> record(Object... entries) {
        Map<String, Object> record = new LinkedHashMap<String, Object>();
        for (int index = 0; index < entries.length; index += 2)
            record.put((String) entries[index], entries[index + 1]);
        return record;
    }
}
