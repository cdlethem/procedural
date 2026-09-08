package org.procedurals.examples.glyphmarks;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.paths.GradientPath2D;

/**
 * Editable Java-only mark metadata and retained paths for the CP8 GlyphMarks example.
 *
 * <p>The motivating source is {@code 2018/Generativos/numbers}; the selected example
 * boundary and its intentional differences from that source are recorded in
 * {@code design/capabilities/cp8-glyph-marks.md}. Text and font drawing belong to the
 * PDE. This fixed 48-by-160 construction is an example composition, not a reusable
 * operation, default, or recommended range.</p>
 *
 * <p>For each path, Java {@link Random} samples integer-valued pixel coordinates and
 * size values, then a symbol index. Those integer-valued samples are deliberate example
 * choices, not inferred artistic ranges.</p>
 */
public final class GlyphComposition {
    private static final int PATHS = 48;
    private static final int STEPS = 160;

    private final GradientPath2D[] paths;
    private final double[] sizes;
    private final int[] symbols;

    private GlyphComposition(GradientPath2D[] paths, double[] sizes, int[] symbols) {
        this.paths = paths;
        this.sizes = sizes;
        this.symbols = symbols;
    }

    /**
     * Creates retained paths using Java {@code Random(seed)} in x, y, size, symbol order
     * for each path. Coordinates and sizes are integer-valued example samples.
     */
    public static GlyphComposition create(long seed, double distance, double fieldScale) {
        if (seed < 0L || seed > 4294967295L || !Double.isFinite(distance) || distance <= 0.0
                || !Double.isFinite(fieldScale) || fieldScale <= 0.0) {
            throw new IllegalArgumentException("invalid GlyphComposition input");
        }

        GradientPath2D[] paths = new GradientPath2D[PATHS];
        double[] sizes = new double[PATHS];
        int[] symbols = new int[PATHS];
        Random random = new Random(seed);
        for (int index = 0; index < PATHS; index++) {
            double x = 40.0 + random.nextInt(560);
            double y = 40.0 + random.nextInt(560);
            sizes[index] = 16.0 + random.nextInt(24);
            symbols[index] = random.nextInt(10);
            paths[index] = GradientPath2D.trace(pathConfig(seed, x, y, distance, fieldScale));
        }
        return new GlyphComposition(paths, sizes, symbols);
    }

    /** Returns the fixed retained path count for this example composition. */
    public int pathCount() {
        return paths.length;
    }

    /** Returns a retained public path; point reads have the core operation's ownership rules. */
    public GradientPath2D pathAt(int index) {
        return paths[checked(index)];
    }

    /** Returns the retained integer-valued example size selected before path integration. */
    public double sizeAt(int index) {
        return sizes[checked(index)];
    }

    /** Returns the retained digit or letter index selected before path integration. */
    public int symbolIndexAt(int index) {
        return symbols[checked(index)];
    }

    private static Map<String, Object> pathConfig(
            long seed, double x, double y, double distance, double fieldScale) {
        Map<String, Object> field = new LinkedHashMap<String, Object>();
        field.put("seed", seed);

        List<Object> start = new ArrayList<Object>(2);
        start.add(x);
        start.add(y);
        List<Object> offset = new ArrayList<Object>(2);
        offset.add(0.0);
        offset.add(0.0);

        Map<String, Object> config = new LinkedHashMap<String, Object>();
        config.put("field", field);
        config.put("start", start);
        config.put("steps", STEPS);
        config.put("stepDistance", distance);
        config.put("fieldScale", fieldScale);
        config.put("fieldOffset", offset);
        config.put("angleBase", 0.0);
        config.put("angleScale", 6.283185307179586);
        return config;
    }

    private static int checked(int index) {
        if (index < 0 || index >= PATHS) {
            throw new IndexOutOfBoundsException("path index");
        }
        return index;
    }
}
