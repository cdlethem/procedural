package examples.recreations.curvespace;

import java.util.Random;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.geometry.RadialPull2D;
import org.procedurals.layout.RegularGrid;

/**
 * Independent retained Curvespace composition. The source note is
 * survey/out/2018/Generativos/curvespace/notes.md; its scalar choices are
 * reproduced as caller composition, while RadialPull2D owns every deformation.
 */
public final class CurvespaceComposition {
    private static final int SIDE = 960;
    private static final int LINE_SAMPLES = 2880;
    private final long seed;
    private final double[][] dotInputs;
    private final RadialPull2D field;
    private final int[] dotColors;
    private final double[][] influenceCenters;
    private final double[] influenceRadii;
    private final int[] influenceColors;
    private final double[][][] verticalInputs, horizontalInputs;
    private final double[][][] verticalOutputs, horizontalOutputs;
    private final int[] verticalColors, horizontalColors;

    private CurvespaceComposition(long seed, double[][] dots, int[] dotColors,
            double[][] centers, double[] radii, int[] influenceColors,
            double[][][] vertical, double[][][] horizontal,
            int[] verticalColors, int[] horizontalColors, RadialPull2D field) {
        this.seed = seed;
        dotInputs = dots;
        this.dotColors = dotColors;
        influenceCenters = centers;
        influenceRadii = radii;
        this.influenceColors = influenceColors;
        verticalInputs = vertical;
        horizontalInputs = horizontal;
        this.verticalColors = verticalColors;
        this.horizontalColors = horizontalColors;
        this.field = field;
        verticalOutputs = transform(vertical, field);
        horizontalOutputs = transform(horizontal, field);
    }

    /** Builds an independent seeded composition; seed controls caller choices only. */
    public static CurvespaceComposition create(long seed) {
        Random random = new Random(seed);
        int count = 30 + random.nextInt(50);
        Map<String, Object> gridDescriptor = new LinkedHashMap<String, Object>();
        gridDescriptor.put("origin", Arrays.asList(480.0d / count, 480.0d / count));
        gridDescriptor.put("spacing", Arrays.asList(960.0d / count, 960.0d / count));
        gridDescriptor.put("columns", count);
        gridDescriptor.put("rows", count);
        RegularGrid grid = RegularGrid.create(gridDescriptor);
        double[][] dots = new double[(int) grid.size()][2];
        int[] dotColors = new int[dots.length];
        for (int i = 0; i < dots.length; i++) {
            grid.pointInto(i, dots[i], 0);
            dotColors[i] = random.nextInt(4);
        }
        int influenceCount = 4 + random.nextInt(6);
        double[][] centers = new double[influenceCount][2];
        double[] radii = new double[influenceCount];
        int[] influenceColors = new int[influenceCount];
        double[][] descriptor = new double[influenceCount][4];
        for (int i = 0; i < influenceCount; i++) {
            double diameter = 768.0d * (1.0d - random.nextDouble());
            double radius = diameter / 2.0d;
            radii[i] = radius;
            centers[i][0] = radius + random.nextDouble() * (SIDE - 2.0d * radius);
            centers[i][1] = radius + random.nextDouble() * (SIDE - 2.0d * radius);
            influenceColors[i] = random.nextInt(4);
            double rawPower = 1.0d + random.nextDouble() * 9.0d;
            double power = random.nextBoolean() ? rawPower : 1.0d / rawPower;
            descriptor[i] = new double[] {centers[i][0], centers[i][1], radius, power};
        }
        double[][][] vertical = lineFamily(count - 1, true);
        double[][][] horizontal = lineFamily(count - 1, false);
        int[] verticalColors = colors(random, vertical.length);
        int[] horizontalColors = colors(random, horizontal.length);
        return new CurvespaceComposition(seed, dots, dotColors, centers, radii,
            influenceColors, vertical, horizontal, verticalColors, horizontalColors,
            RadialPull2D.create(descriptor));
    }

    private static double[][][] lineFamily(int count, boolean vertical) {
        double[][][] family = new double[count][LINE_SAMPLES][2];
        for (int line = 0; line < count; line++) {
            double fixed = (line + 1) * SIDE / (double) (count + 1);
            for (int i = 0; i < LINE_SAMPLES; i++) {
                double varying = i * SIDE / (double) LINE_SAMPLES;
                family[line][i][0] = vertical ? fixed : varying;
                family[line][i][1] = vertical ? varying : fixed;
            }
        }
        return family;
    }

    private static int[] colors(Random random, int count) {
        int[] result = new int[count];
        for (int i = 0; i < count; i++) result[i] = random.nextInt(4);
        return result;
    }

    private static double[][] transform(double[][] input, RadialPull2D field) {
        double[][] result = new double[input.length][2];
        double[] target = new double[2];
        for (int i = 0; i < input.length; i++) {
            field.transform(input[i][0], input[i][1], target);
            result[i][0] = target[0]; result[i][1] = target[1];
        }
        return result;
    }

    private static double[][][] transform(double[][][] input, RadialPull2D field) {
        double[][][] result = new double[input.length][][];
        for (int i = 0; i < input.length; i++) result[i] = transform(input[i], field);
        return result;
    }

    public long seed() { return seed; }
    public double[][] dotInputs() { return dotInputs; }
    public RadialPull2D field() { return field; }
    public int[] dotColors() { return dotColors; }
    public double[][] influenceCenters() { return influenceCenters; }
    public double[] influenceRadii() { return influenceRadii; }
    public int[] influenceColors() { return influenceColors; }
    public double[][][] verticalInputs() { return verticalInputs; }
    public double[][][] horizontalInputs() { return horizontalInputs; }
    public double[][][] verticalOutputs() { return verticalOutputs; }
    public double[][][] horizontalOutputs() { return horizontalOutputs; }
    public int[] verticalColors() { return verticalColors; }
    public int[] horizontalColors() { return horizontalColors; }
}
