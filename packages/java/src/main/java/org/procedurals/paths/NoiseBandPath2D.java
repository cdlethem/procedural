package org.procedurals.paths;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.fields.GradientNoise2D01;

/**
 * Attempt-bounded scalar-band walk, independently specified from
 * {@code survey/out/2018/Generativos/venas/notes.md}.
 * Contract: path.noise-band-trace-2d 0.1.0. No defaults or measured recommended
 * ranges are established. The source's .002/.008 tolerance experiments and
 * independent CP15 prototype motivate a control, not a recommended interval.
 *
 * <p>Attempts include rejected proposals. Retain the starting vertex plus each
 * accepted move; style and mark placement remain external. A vertex cap raises
 * an explicit error rather than returning partial geometry. Work is O(attempts),
 * retained storage O(accepted), and scalar access allocates nothing.</p>
 */
public strictfp final class NoiseBandPath2D {
    public static class PathException extends IllegalArgumentException { public final String code; PathException(String c){super(c);code=c;} }
    public static final class TraceException extends PathException { public final int attemptIndex; public final String stage; TraceException(String c,int i,String s){super(c);attemptIndex=i;stage=s;} }
    public static final class VertexLimitException extends PathException { public final int attemptIndex; public final String stage; VertexLimitException(int i){super("VERTEX_LIMIT_EXCEEDED");attemptIndex=i;stage="append";} }
    private final double[] positions, headings; private final int attempts, accepted, rejected; private final Map<String,Object> config;
    private NoiseBandPath2D(double[] p,double[] h,int a,int ok,int no,Map<String,Object> c){positions=p;headings=h;attempts=a;accepted=ok;rejected=no;config=c;}

    /** Validate the exact configuration, then generate privately; failures return no path. */
    public static NoiseBandPath2D trace(Object input) {
        if (!(input instanceof Map)) invalid();
        Map<?, ?> parameters = (Map<?, ?>) input;
        exact(parameters, "field", "start", "heading", "seed", "attempts",
              "stepDistance", "fieldScale", "fieldOffset", "tolerance", "maxVertices");
        Object fieldValue = parameters.get("field");
        if (!(fieldValue instanceof Map)) invalid();
        Map<?, ?> fieldConfig = (Map<?, ?>) fieldValue;
        exact(fieldConfig, "seed");
        long fieldSeed = uint(fieldConfig.get("seed"));
        List<?> start = pair(parameters.get("start"));
        double startX = zero(num(start.get(0)));
        double startY = zero(num(start.get(1)));
        double heading = zero(num(parameters.get("heading")));
        long seed = uint(parameters.get("seed"));
        int tries = integer(parameters.get("attempts"), 0, Integer.MAX_VALUE);
        double distance = zero(nonnegative(parameters.get("stepDistance")));
        double scale = zero(num(parameters.get("fieldScale")));
        List<?> offset = pair(parameters.get("fieldOffset"));
        double offsetX = zero(num(offset.get(0)));
        double offsetY = zero(num(offset.get(1)));
        double tolerance = zero(nonnegative(parameters.get("tolerance")));
        int maximum = integer(parameters.get("maxVertices"), 1, 1073741823);
        GradientNoise2D01 field = GradientNoise2D01.create(map("seed", fieldSeed));
        Map<String, Object> configuration = config(field, startX, startY, heading,
                seed, tries, distance, scale, offsetX, offsetY, tolerance, maximum);
        double[] points = {startX, startY};
        double[] directions = new double[0];
        if (tries == 0) return new NoiseBandPath2D(points, directions, 0, 0, 0, configuration);

        double level = query(field, startX, startY, scale, offsetX, offsetY, -1, "start_query");
        Xoshiro random = new Xoshiro(seed);
        double x = startX, y = startY;
        int accepted = 0, rejected = 0;
        for (int attempt = 0; attempt < tries; attempt++) {
            double low = (-0x1.921fb54442d18p0) * random.unit();
            double high = 0x1.921fb54442d18p0 * random.unit();
            double span = high - low;
            double delta = span * random.unit();
            double turn = low + delta;
            double proposal = arith(heading + turn, attempt, "proposal_heading");
            double dx = arith(distance * StrictMath.cos(proposal), attempt, "delta_x");
            double nextX = arith(x + dx, attempt, "position_x");
            double dy = arith(distance * StrictMath.sin(proposal), attempt, "delta_y");
            double nextY = arith(y + dy, attempt, "position_y");
            double value = query(field, nextX, nextY, scale, offsetX, offsetY,
                                 attempt, "candidate_query");
            double driftProduct = .2 * random.unit();
            double drift = -.1 + driftProduct;
            double rejectionHeading = arith(heading + drift, attempt, "rejection_heading");
            double difference = value - level;
            double bandError = StrictMath.abs(difference);
            if (bandError < tolerance) {
                if (accepted + 1 == maximum) throw new VertexLimitException(attempt);
                nextX = zero(nextX);
                nextY = zero(nextY);
                proposal = zero(proposal);
                points = grow(points, 2 * (accepted + 2), 2L * maximum);
                directions = grow(directions, accepted + 1, maximum - 1L);
                points[2 * (accepted + 1)] = nextX;
                points[2 * (accepted + 1) + 1] = nextY;
                directions[accepted] = proposal;
                x = nextX;
                y = nextY;
                heading = proposal;
                accepted++;
            } else {
                heading = zero(rejectionHeading);
                rejected++;
            }
        }
        return new NoiseBandPath2D(Arrays.copyOf(points, 2 * (accepted + 1)),
                Arrays.copyOf(directions, accepted), tries, accepted, rejected, configuration);
    }

    private static double[] grow(double[] values, int needed, long limit) {
        if (values.length >= needed) return values;
        long doubled = Math.max(2L, 2L * values.length);
        int capacity = (int) Math.min(limit, Math.max((long) needed, doubled));
        return Arrays.copyOf(values, capacity);
    }

    private static double query(GradientNoise2D01 field, double x, double y,
            double scale, double offsetX, double offsetY, int attempt, String prefix) {
        double qx = x * scale;
        if (!finite(qx)) throw new TraceException("TRACE_QUERY_INVALID", attempt, prefix + "_x");
        qx = qx + offsetX;
        if (!finite(qx) || qx < -9007199254740991L || qx >= 9007199254740991L)
            throw new TraceException("TRACE_QUERY_INVALID", attempt, prefix + "_x");
        double qy = y * scale;
        if (!finite(qy)) throw new TraceException("TRACE_QUERY_INVALID", attempt, prefix + "_y");
        qy = qy + offsetY;
        if (!finite(qy) || qy < -9007199254740991L || qy >= 9007199254740991L)
            throw new TraceException("TRACE_QUERY_INVALID", attempt, prefix + "_y");
        return field.sample(qx, qy);
    }

    private static double arith(double v,int i,String s){if(!finite(v))throw new TraceException("TRACE_ARITHMETIC_INVALID",i,s);return v;}
    /** Point count including start; see class provenance (venas) and evidence limits. */
    public int size() { return positions.length / 2; }
    /** Attempted work, including rejection; no default or recommended count. */
    public int attempts() { return attempts; }
    /** Accepted moves, including accepted stationary proposals. */
    public int accepted() { return accepted; }
    /** Rejected moves; no vertex is appended for these attempts. */
    public int rejected() { return rejected; }

    /** Detached coordinate pair; index is a representation bound, not an artistic range. */
    public double[] pointAt(long index) {
        int i = checked(index, false);
        return new double[]{positions[2 * i], positions[2 * i + 1]};
    }
    /** Interchange index route for the same retained point. */
    public double[] pointAt(Object index) { return pointAt(index(index)); }

    /** Allocation-free point access; validate index and destination before either write. */
    public void pointInto(long index, double[] output, int offset) {
        int i = checked(index, false);
        if (output == null || offset < 0 || offset > output.length - 2)
            throw new PathException("INVALID_OUTPUT");
        output[offset] = positions[2 * i];
        output[offset + 1] = positions[2 * i + 1];
    }
    /** Interchange index route for the same atomic write. */
    public void pointInto(Object index, double[] output, int offset) {
        pointInto(index(index), output, offset);
    }
    /** Heading of accepted segment i from point i to i+1, useful for attached marks. */
    public double headingAt(long index) { return headings[checked(index, true)]; }
    /** Interchange index route for the same accepted heading. */
    public double headingAt(Object index) { return headingAt(index(index)); }

    /** Detached input descriptor for replay; no source host RNG/noise compatibility. */
    public Map<String, Object> serialize() { return detached(config); }

    /** Detached retained geometry and counters; caller owns all exported containers. */
    public Map<String, Object> toValues() {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        List<Object> points = new ArrayList<Object>(size());
        for (int i = 0; i < size(); i++)
            points.add(Arrays.asList(positions[2 * i], positions[2 * i + 1]));
        List<Object> angles = new ArrayList<Object>(accepted);
        for (double value : headings) angles.add(value);
        result.put("positions", points);
        result.put("headings", angles);
        result.put("attempts", attempts);
        result.put("accepted", accepted);
        result.put("rejected", rejected);
        return result;
    }

    private int checked(long i,boolean head){if(i<0||i>9007199254740991L)throw new PathException("INVALID_INDEX");if(i>=(head?accepted:size()))throw new PathException("INDEX_OUT_OF_RANGE");return (int)i;}
    private static long index(Object v){if(!(v instanceof Byte||v instanceof Short||v instanceof Integer||v instanceof Long||v instanceof Float||v instanceof Double))throw new PathException("INVALID_INDEX");double n=((Number)v).doubleValue();if(!finite(n)||n<0||n>9007199254740991L||n!=StrictMath.floor(n))throw new PathException("INVALID_INDEX");return (long)n;}
    private static List<?> pair(Object v){if(!(v instanceof List)||((List<?>)v).size()!=2)invalid();return (List<?>)v;}
    private static double num(Object v){if(!(v instanceof Byte||v instanceof Short||v instanceof Integer||v instanceof Long||v instanceof Float||v instanceof Double))invalid();double n=((Number)v).doubleValue();if(!finite(n))invalid();return n;}
    private static long uint(Object v){double n=num(v);if(n<0||n>4294967295L||n!=StrictMath.floor(n))invalid();return (long)n;}
    private static int integer(Object v,int lo,int hi){double n=num(v);if(n<lo||n>hi||n!=StrictMath.floor(n))invalid();return (int)n;}
    private static double nonnegative(Object v){double n=num(v);if(n<0)invalid();return n;}
    private static boolean finite(double n){return !Double.isNaN(n)&&!Double.isInfinite(n);} private static double zero(double n){return n==0?0.0:n;} private static void invalid(){throw new PathException("INVALID_INPUT");}
    private static void exact(Map<?,?> m,String...keys){if(m.size()!=keys.length)invalid();for(String k:keys)if(!m.containsKey(k))invalid();}
    private static Map<String,Object> map(Object...a){Map<String,Object>m=new LinkedHashMap<String,Object>();for(int i=0;i<a.length;i+=2)m.put((String)a[i],a[i+1]);return m;}
    private static Map<String,Object> config(GradientNoise2D01 f,double x,double y,double head,long seed,int tries,double dist,double scale,double ox,double oy,double tol,int max){Map<String,Object>m=new LinkedHashMap<String,Object>();m.put("field",f.serialize());m.put("start",Arrays.asList(x,y));m.put("heading",head);m.put("seed",seed);m.put("attempts",tries);m.put("stepDistance",dist);m.put("fieldScale",scale);m.put("fieldOffset",Arrays.asList(ox,oy));m.put("tolerance",tol);m.put("maxVertices",max);return m;}
    private static Map<String,Object> detached(Map<String,Object> src){Map<String,Object>m=new LinkedHashMap<String,Object>();for(Map.Entry<String,Object>e:src.entrySet()){Object v=e.getValue();if(v instanceof Map)m.put(e.getKey(),detached((Map<String,Object>)v));else if(v instanceof List){List<Object> copy=new ArrayList<Object>();for(Object item:(List<?>)v){if(item instanceof Map)copy.add(detached((Map<String,Object>)item));else if(item instanceof List)copy.add(detachedList((List<?>)item));else copy.add(item);}m.put(e.getKey(),copy);}else m.put(e.getKey(),v);}return m;}
    private static List<Object> detachedList(List<?> src){List<Object>copy=new ArrayList<Object>();for(Object v:src){if(v instanceof List)copy.add(detachedList((List<?>)v));else if(v instanceof Map)copy.add(detached((Map<String,Object>)v));else copy.add(v);}return copy;}
    private static final class Xoshiro {
        private int s0, s1, s2, s3;

        Xoshiro(long seed) {
            long state = seed & 0xffffffffL;
            state += 0x9e3779b97f4a7c15L;
            long first = splitmixOutput(state);
            state += 0x9e3779b97f4a7c15L;
            long second = splitmixOutput(state);
            s0 = (int) first;
            s1 = (int) (first >>> 32);
            s2 = (int) second;
            s3 = (int) (second >>> 32);
            if ((s0 | s1 | s2 | s3) == 0) throw new AssertionError("all-zero xoshiro state");
        }

        double unit() { return ((double) Integer.toUnsignedLong(nextU32())) / 4294967296.0; }

        private int nextU32() {
            int output = Integer.rotateLeft(s1 * 5, 7) * 9;
            int temporary = s1 << 9;
            s2 ^= s0;
            s3 ^= s1;
            s1 ^= s2;
            s0 ^= s3;
            s2 ^= temporary;
            s3 = Integer.rotateLeft(s3, 11);
            return output;
        }

        private static long splitmixOutput(long state) {
            long mixed = state;
            mixed = (mixed ^ (mixed >>> 30)) * 0xbf58476d1ce4e5b9L;
            mixed = (mixed ^ (mixed >>> 27)) * 0x94d049bb133111ebL;
            return mixed ^ (mixed >>> 31);
        }
    }

}
