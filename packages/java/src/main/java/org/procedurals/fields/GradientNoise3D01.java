package org.procedurals.fields;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable three-coordinate scalar field, {@code field.gradient-noise-3d-01} 0.1.0.
 *
 * <p>Motivated by {@code survey/out/2016/Generativos/pelosNoise2/notes.md} depth slices
 * and {@code survey/out/2018/Generativos/conitos/notes.md} volumetric samples. Independently
 * specified, not Processing noise or a matching z=0 slice of GradientNoise2D01. No artistic
 * defaults/ranges are established. The CP18 private study used depths0.25/0.5/1.25 as
 * example configurations only. Coordinate bounds ensure exact safe lattice corners.</p>
 * <p>Uses the existing lowbias32 mixer (Unlicense), attributed in THIRD_PARTY_NOTICES.md.</p>
 */
public final strictfp class GradientNoise3D01 {
    private static final int[][] GRADIENTS = {
        {1,1,0},{-1,1,0},{1,-1,0},{-1,-1,0},
        {1,0,1},{-1,0,1},{1,0,-1},{-1,0,-1},
        {0,1,1},{0,-1,1},{0,1,-1},{0,-1,-1}
    };
    private final int seed;

    /** Stable INVALID_INPUT or INVALID_QUERY failure; no partial result is returned. */
    public static final class NoiseException extends IllegalArgumentException {
        public final String code;
        /** Constructs a failure with its stable contract code. */
        public NoiseException(String code) { super(code); this.code = code; }
    }

    private GradientNoise3D01(int seed) { this.seed = seed; }

    /** Creates from exactly {seed}; finite integral boxed values in uint32 are accepted. */
    public static GradientNoise3D01 create(Object input) {
        if (!(input instanceof Map)) fail("INVALID_INPUT");
        Map<?, ?> map = (Map<?, ?>) input;
        if (map.size() != 1 || !map.containsKey("seed")) fail("INVALID_INPUT");
        double value = number(map.get("seed"), "INVALID_INPUT");
        if (value < 0 || value > 4294967295L || value != Math.floor(value)) fail("INVALID_INPUT");
        return create((long) value);
    }

    /** Creates an independent field from uint32 seed; no query state or host globals. */
    public static GradientNoise3D01 create(long seed) {
        if (seed < 0 || seed > 4294967295L) fail("INVALID_INPUT");
        return new GradientNoise3D01((int) seed);
    }

    /** Returns a fresh seed-only portable record, with unsigned seed represented exactly. */
    public Map<String, Object> serialize() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("seed", Integer.toUnsignedLong(seed));
        return result;
    }

    /** Samples an exact three-element List of finite supported numeric carriers. */
    public double sample(Object point) {
        if (!(point instanceof List) || ((List<?>) point).size() != 3) fail("INVALID_QUERY");
        List<?> values = (List<?>) point;
        return sample(values.get(0), values.get(1), values.get(2));
    }

    /** Samples boxed x/y/z in lattice units, validating coordinates in that order. */
    public double sample(Object x, Object y, Object z) {
        double a = number(x, "INVALID_QUERY"); validate(a);
        double b = number(y, "INVALID_QUERY"); validate(b);
        double c = number(z, "INVALID_QUERY"); validate(c);
        return sample(a, b, c);
    }

    /**
     * Allocation-free pure sample in[0,1]. Each coordinate must be at least
     * -9007199254740991 and strictly below9007199254740991. Scale/offset are caller arithmetic.
     */
    public double sample(double x, double y, double z) {
        validate(x); validate(y); validate(z);
        long i = (long) Math.floor(x), j = (long) Math.floor(y), k = (long) Math.floor(z);
        double u = x - (double) i, v = y - (double) j, w = z - (double) k;
        double um = u - 1, vm = v - 1, wm = w - 1;
        double fx = fade(u), fy = fade(v), fz = fade(w);
        double a = lerp(dot(i,j,k,u,v,w), dot(i+1,j,k,um,v,w), fx);
        double b = lerp(dot(i,j+1,k,u,vm,w), dot(i+1,j+1,k,um,vm,w), fx);
        double c = lerp(dot(i,j,k+1,u,v,wm), dot(i+1,j,k+1,um,v,wm), fx);
        double d = lerp(dot(i,j+1,k+1,u,vm,wm), dot(i+1,j+1,k+1,um,vm,wm), fx);
        double low = lerp(a,b,fy), high = lerp(c,d,fy);
        double raw = lerp(low,high,fz), scaled = 0.5 * raw, result = 0.5 + scaled;
        if (result <= 0) return 0.0;
        return result >= 1 ? 1.0 : result;
    }

    private double dot(long i, long j, long k, double x, double y, double z) {
        int hash = GradientNoise2D01.mix(GradientNoise2D01.corner(seed,i,j) ^ (int) k ^ 0xc2b2ae35);
        int[] g = GRADIENTS[(int) (Integer.toUnsignedLong(hash) % 12)];
        double px = g[0]*x, py = g[1]*y, pz = g[2]*z;
        double xy = px + py;
        return xy + pz;
    }

    private static double fade(double t) {
        double t2 = t*t, t3 = t2*t, a = 6*t - 15, b = t*a + 10;
        return t3*b;
    }

    private static double lerp(double a, double b, double t) {
        double delta = b-a, product = t*delta;
        return a+product;
    }

    private static void validate(double q) {
        if (!Double.isFinite(q) || q < -9007199254740991L || q >= 9007199254740991L)
            fail("INVALID_QUERY");
    }

    private static double number(Object value, String code) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer
                || value instanceof Long || value instanceof Float || value instanceof Double)) fail(code);
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number)) fail(code);
        return number;
    }

    private static void fail(String code) { throw new NoiseException(code); }
}
