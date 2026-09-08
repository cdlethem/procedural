package org.procedurals.color;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable noncyclic positioned RGB24 color stops, motivated by
 * {@code survey/out/2016/Generativos/boxDepth/notes.md},
 * {@code survey/out/2016/Generativos/celular/notes.md},
 * {@code survey/out/2016/Generativos/colorRamp/notes.md}, and
 * {@code survey/out/2016/Generativos/triangleRamp/notes.md}.
 * Contract: color.stop-ramp 0.1.0.
 *
 * <p>Positions are normalized binary64 values in strictly increasing order.
 * Sampling holds endpoint colors outside the first and last stops, and
 * interpolates opaque encoded-sRGB8 channels between stops. This class is
 * independently specified; it does not reproduce the source sketches' mutable
 * insertion helpers or Processing color interpolation.</p>
 *
 * <p>There are no defaults or measured encouraged stop positions, palette sizes,
 * or colors: callers supply their own artwork data. Strict ordering, positive-zero
 * normalization, and endpoint holds are portable policies of this operation.</p>
 */
public strictfp final class StopRamp {
    /** Stable interchange error for malformed construction data or queries. */
    public static final class StopRampException extends IllegalArgumentException {
        public final String code;

        public StopRampException(String code) {
            super(code);
            this.code = code;
        }
    }

    private final double[] positions;
    private final int[] colors;

    private StopRamp(double[] positions, int[] colors) {
        this.positions = positions;
        this.colors = colors;
    }

    /** Creates a ramp from exactly {@code {stops: [{position, color}, ...]}}. */
    public static StopRamp create(Object input) {
        if (!(input instanceof Map)) {
            throw invalidInput();
        }
        Map<?, ?> parameters = (Map<?, ?>) input;
        if (parameters.size() != 1 || !parameters.containsKey("stops")
                || !(parameters.get("stops") instanceof List)) {
            throw invalidInput();
        }

        List<?> stopValues = (List<?>) parameters.get("stops");
        if (stopValues.isEmpty()) {
            throw invalidInput();
        }

        double[] positions = new double[stopValues.size()];
        int[] colors = new int[stopValues.size()];
        int index = 0;
        for (Object stopValue : stopValues) {
            if (!(stopValue instanceof Map)) {
                throw invalidInput();
            }
            Map<?, ?> stop = (Map<?, ?>) stopValue;
            if (stop.size() != 2 || !stop.containsKey("position") || !stop.containsKey("color")) {
                throw invalidInput();
            }
            double position = checkedPosition(stop.get("position"));
            if (index > 0 && !(position > positions[index - 1])) {
                throw invalidInput();
            }
            positions[index] = position;
            colors[index] = checkedColor(stop.get("color"));
            index++;
        }
        return new StopRamp(positions, colors);
    }

    /** Creates a ramp from parallel position and RGB24 buffers. */
    public static StopRamp create(double[] inputPositions, int[] inputColors) {
        if (inputPositions == null || inputColors == null || inputPositions.length == 0
                || inputPositions.length != inputColors.length) {
            throw invalidInput();
        }
        double[] positions = inputPositions.clone();
        int[] colors = inputColors.clone();
        for (int index = 0; index < positions.length; index++) {
            positions[index] = checkedPosition(positions[index]);
            if (index > 0 && !(positions[index] > positions[index - 1])) {
                throw invalidInput();
            }
            if (colors[index] < 0 || colors[index] > 0xFFFFFF) {
                throw invalidInput();
            }
        }
        return new StopRamp(positions, colors);
    }

    /** Returns a fresh plain Java representation of this ramp's owned stops. */
    public Map<String, Object> serialize() {
        List<Map<String, Object>> stopValues = new ArrayList<Map<String, Object>>(positions.length);
        for (int index = 0; index < positions.length; index++) {
            Map<String, Object> stop = new LinkedHashMap<String, Object>();
            stop.put("position", Double.valueOf(positions[index]));
            stop.put("color", Integer.valueOf(colors[index]));
            stopValues.add(stop);
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("stops", stopValues);
        return result;
    }

    /** Validates a permitted boxed numeric query before sampling. */
    public int sample(Object query) {
        return sample(number(query, "INVALID_QUERY"));
    }

    /**
     * Samples in O(log n) time without per-query allocation.
     * Arithmetic statements deliberately remain separate binary64 operations.
     */
    public int sample(double query) {
        if (!Double.isFinite(query)) {
            throw new StopRampException("INVALID_QUERY");
        }
        if (query <= positions[0]) {
            return colors[0];
        }
        int last = positions.length - 1;
        if (query >= positions[last]) {
            return colors[last];
        }

        int left = 0;
        int right = last;
        while (right - left > 1) {
            int middle = left + (right - left) / 2;
            if (query < positions[middle]) {
                right = middle;
            } else {
                left = middle;
            }
        }
        if (query == positions[left]) {
            return colors[left];
        }
        if (query == positions[right]) {
            return colors[right];
        }

        double numerator = query - positions[left];
        double denominator = positions[right] - positions[left];
        double t = numerator / denominator;
        int a = colors[left];
        int b = colors[right];
        int red = channel((a >>> 16) & 255, (b >>> 16) & 255, t);
        int green = channel((a >>> 8) & 255, (b >>> 8) & 255, t);
        int blue = channel(a & 255, b & 255, t);
        return red * 65536 + green * 256 + blue;
    }

    private static int channel(int a, int b, double t) {
        double difference = b - a;
        double product = difference * t;
        double value = a + product;
        return (int) Math.floor(value + 0.5);
    }

    private static double checkedPosition(Object value) {
        double position = number(value, "INVALID_INPUT");
        if (position < 0.0 || position > 1.0) {
            throw invalidInput();
        }
        return position == 0.0 ? 0.0 : position;
    }

    private static int checkedColor(Object value) {
        double color = number(value, "INVALID_INPUT");
        if (color < 0.0 || color > 16777215.0 || color != Math.floor(color)) {
            throw invalidInput();
        }
        return (int) color;
    }

    private static double number(Object value, String code) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) {
            throw new StopRampException(code);
        }
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) {
            throw new StopRampException(code);
        }
        return number;
    }

    private static StopRampException invalidInput() {
        return new StopRampException("INVALID_INPUT");
    }
}
