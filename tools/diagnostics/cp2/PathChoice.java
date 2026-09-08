import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashMap;
import java.util.Map;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PConstants;
import org.procedurals.fields.GradientNoise2D01;

/**
 * Private CP2 design experiment only. It implements the predeclared configuration in
 * evidence/parameter-experiments/cp2-path-choice/experiment.json; it is not public API,
 * source reproduction, or portable validation.
 */
public strictfp final class PathChoice {
    private static final int WIDTH = 640, HEIGHT = 640, START_COLUMNS = 6, START_ROWS = 4;
    private static final int PATH_COUNT = START_COLUMNS * START_ROWS;
    private static final int STEPS = 2000;
    private static final double START_X = 60.0, START_Y = 80.0, PITCH_X = 104.0, PITCH_Y = 160.0;
    private static final double STEP_DISTANCE = 0.4, SCALE = 0.002, FINER_SCALE = 0.01;
    private static final double OFFSET_X = 0.0, OFFSET_Y = 0.0;
    private static final double ANGLE_BASE = -20.0, ANGLE_SCALE = 40.0;
    private static final int FIELD_SEED = 42, BACKGROUND = 0xECE7DA, ALPHA = 150;
    private static final int[] PALETTE = {0x31A151, 0xFFA71E, 0x05084C, 0xDE4638, 0x3DBDB7};
    private static final int[] RECOLOUR_PALETTE = {0x05084C, 0x3DBDB7, 0xDE4638, 0xFFA71E, 0x31A151};
    private static final int WARMUP_REPS = 3, TIMING_REPS = 5;
    private static volatile long timingSink;

    private PathChoice() { }

    /** Immutable packed N+1 position pairs and N sampled headings; indices are implicit. */
    private static final class Trace {
        final int steps;
        final double[] positions;
        final double[] headings;
        Trace(int steps) {
            this.steps = steps;
            this.positions = new double[(steps + 1) * 2];
            this.headings = new double[steps];
        }
        double x(int index) { return positions[index * 2]; }
        double y(int index) { return positions[index * 2 + 1]; }
        void position(int index, double x, double y) {
            positions[index * 2] = x;
            positions[index * 2 + 1] = y;
        }
    }

    private static final class Traces {
        final Trace[] values;
        Traces(Trace[] values) { this.values = values; }
    }

    /** Diagnostic-only counter shared with the exact field instance under test. */
    private static final class QueryCounter { long value; }

    private static final class Digest {
        private final MessageDigest value;
        Digest() {
            try { value = MessageDigest.getInstance("SHA-256"); }
            catch (NoSuchAlgorithmException error) { throw new AssertionError(error); }
        }
        void integer(int input) {
            value.update((byte)(input >>> 24)); value.update((byte)(input >>> 16));
            value.update((byte)(input >>> 8)); value.update((byte)input);
        }
        void bits(double input) { long value = Double.doubleToRawLongBits(input); longValue(value); }
        void longValue(long input) {
            for (int shift = 56; shift >= 0; shift -= 8) value.update((byte)(input >>> shift));
        }
        void text(String input) { value.update(input.getBytes(StandardCharsets.UTF_8)); value.update((byte)0); }
        String finish() {
            byte[] bytes = value.digest(); StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) result.append(String.format("%02x", item & 255));
            return result.toString();
        }
    }

    private interface SegmentSink {
        void line(int pathIndex, double x1, double y1, double x2, double y2, int rgb);
    }

    private static final class Hashes {
        final String model, movement, geometry, colour;
        final long commands;
        Hashes(String model, String movement, String geometry, String colour, long commands) {
            this.model = model; this.movement = movement; this.geometry = geometry;
            this.colour = colour; this.commands = commands;
        }
    }

    private static GradientNoise2D01 field() {
        Map<String,Object> input = new LinkedHashMap<String,Object>();
        input.put("seed", Long.valueOf(FIELD_SEED));
        return GradientNoise2D01.create(input);
    }

    /** Exact predeclared binary64 update order, with intermediate values kept separate. */
    private static Trace trace(GradientNoise2D01 field, double startX, double startY, int steps,
                               double scale, double stepDistance, double angleScale, QueryCounter queries) {
        Trace result = new Trace(steps);
        double currentX = startX;
        double currentY = startY;
        result.position(0, currentX, currentY);
        for (int index = 0; index < steps; index++) {
            double queryX = currentX * scale;
            queryX = queryX + OFFSET_X;
            double queryY = currentY * scale;
            queryY = queryY + OFFSET_Y;
            double sample = field.sample(queryX, queryY);
            queries.value++;
            double mapped = angleScale * sample;
            double heading = ANGLE_BASE + mapped;
            double cosine = Math.cos(heading);
            double sine = Math.sin(heading);
            double deltaX = stepDistance * cosine;
            double deltaY = stepDistance * sine;
            double nextX = currentX + deltaX;
            double nextY = currentY + deltaY;
            result.headings[index] = heading;
            result.position(index + 1, nextX, nextY);
            currentX = nextX;
            currentY = nextY;
        }
        return result;
    }

    private static Traces traces(GradientNoise2D01 gradient, int steps, double scale,
                                 double stepDistance, double angleScale, QueryCounter queries) {
        Trace[] result = new Trace[PATH_COUNT];
        for (int row = 0, index = 0; row < START_ROWS; row++) {
            for (int column = 0; column < START_COLUMNS; column++, index++) {
                double x = START_X + column * PITCH_X;
                double y = START_Y + row * PITCH_Y;
                result[index] = trace(gradient, x, y, steps, scale, stepDistance, angleScale, queries);
            }
        }
        return new Traces(result);
    }

    private static Traces traces(int steps, double scale, double stepDistance, double angleScale) {
        return traces(field(), steps, scale, stepDistance, angleScale, new QueryCounter());
    }

    private static void ensureFinite(Trace trace) {
        for (double value : trace.positions) if (!Double.isFinite(value)) throw new AssertionError("non-finite position");
        for (double value : trace.headings) if (!Double.isFinite(value)) throw new AssertionError("non-finite heading");
    }

    private static String movementHash(Trace[] traces) {
        Digest digest = new Digest();
        digest.text("cp2-packed-trace-v1"); digest.integer(traces.length);
        for (Trace trace : traces) {
            digest.integer(trace.steps);
            for (double value : trace.positions) digest.bits(value);
            for (double value : trace.headings) digest.bits(value);
        }
        return digest.finish();
    }

    private static String modelHash(String caseId, double scale, double markLength, Trace[] traces) {
        Digest digest = new Digest();
        digest.text("cp2-path-choice-model-v1"); digest.text(caseId); digest.integer(FIELD_SEED);
        digest.bits(STEP_DISTANCE); digest.bits(scale); digest.bits(OFFSET_X); digest.bits(OFFSET_Y);
        digest.bits(ANGLE_BASE); digest.bits(ANGLE_SCALE); digest.bits(markLength); digest.text(movementHash(traces));
        return digest.finish();
    }

    private static void visitTrace(Trace[] traces, SegmentSink sink) {
        for (int path = 0; path < traces.length; path++) {
            Trace trace = traces[path]; int rgb = PALETTE[path % PALETTE.length];
            for (int index = 0; index < trace.steps; index++)
                sink.line(path, trace.x(index), trace.y(index), trace.x(index + 1), trace.y(index + 1), rgb);
        }
    }

    private static void visitMarks(Trace[] traces, double totalLength, int[] palette, SegmentSink sink) {
        for (int path = 0; path < traces.length; path++) {
            Trace trace = traces[path]; int rgb = palette[path % palette.length];
            for (int index = 0; index < trace.steps; index += 4) {
                double endpointX = trace.x(index + 1), endpointY = trace.y(index + 1);
                double perpendicular = trace.headings[index] + Math.PI / 2.0;
                double halfLength = totalLength * 0.5;
                double deltaX = halfLength * Math.cos(perpendicular);
                double deltaY = halfLength * Math.sin(perpendicular);
                double x1 = endpointX - deltaX, y1 = endpointY - deltaY;
                double x2 = endpointX + deltaX, y2 = endpointY + deltaY;
                sink.line(path, x1, y1, x2, y2, rgb);
            }
        }
    }

    private static Hashes hashCase(String caseId, Trace[] traces, double scale, double markLength, boolean traceCase,
                                   int[] palette) {
        final Digest geometry = new Digest(), colour = new Digest();
        final long[] commands = {0L};
        SegmentSink sink = new SegmentSink() {
            public void line(int path, double x1, double y1, double x2, double y2, int rgb) {
                require(Double.isFinite(x1) && Double.isFinite(y1) && Double.isFinite(x2) && Double.isFinite(y2),
                        "non-finite emitted segment");
                geometry.integer(path); geometry.bits(x1); geometry.bits(y1); geometry.bits(x2); geometry.bits(y2);
                colour.integer(path); colour.integer(rgb); commands[0]++;
            }
        };
        if (traceCase) visitTrace(traces, sink); else visitMarks(traces, markLength, palette, sink);
        return new Hashes(modelHash(caseId, scale, markLength, traces), movementHash(traces),
                          geometry.finish(), colour.finish(), commands[0]);
    }

    private static void drawCase(PGraphicsJava2D graphics, Trace[] traces, boolean traceCase, double markLength) {
        graphics.strokeWeight(1.0f); graphics.strokeCap(PConstants.ROUND); graphics.noFill();
        SegmentSink sink = new SegmentSink() {
            public void line(int path, double x1, double y1, double x2, double y2, int rgb) {
                graphics.stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, ALPHA);
                graphics.line((float)x1, (float)y1, (float)x2, (float)y2);
            }
        };
        if (traceCase) visitTrace(traces, sink); else visitMarks(traces, markLength, PALETTE, sink);
    }

    private static boolean rawEqual(double a, double b) {
        return Double.doubleToRawLongBits(a) == Double.doubleToRawLongBits(b);
    }

    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static void assertPrefix() {
        GradientNoise2D01 gradient = field(); QueryCounter leftQueries = new QueryCounter(), rightQueries = new QueryCounter();
        Trace left = trace(gradient, START_X, START_Y, 2000, SCALE, STEP_DISTANCE, ANGLE_SCALE, leftQueries);
        Trace right = trace(gradient, START_X, START_Y, 2001, SCALE, STEP_DISTANCE, ANGLE_SCALE, rightQueries);
        for (int index = 0; index <= 2000; index++) {
            require(rawEqual(left.x(index), right.x(index)) && rawEqual(left.y(index), right.y(index)), "prefix position " + index);
            if (index < 2000) require(rawEqual(left.headings[index], right.headings[index]), "prefix heading " + index);
        }
    }

    private static void assertStepDistanceChangesQueries() {
        GradientNoise2D01 gradient = field(); QueryCounter aQueries = new QueryCounter(), bQueries = new QueryCounter();
        Trace a = trace(gradient, START_X, START_Y, 2, SCALE, 0.4, ANGLE_SCALE, aQueries);
        Trace b = trace(gradient, START_X, START_Y, 2, SCALE, 0.8, ANGLE_SCALE, bQueries);
        double aQueryX = a.x(1) * SCALE, aQueryY = a.y(1) * SCALE;
        double bQueryX = b.x(1) * SCALE, bQueryY = b.y(1) * SCALE;
        require(!rawEqual(aQueryX, bQueryX) || !rawEqual(aQueryY, bQueryY), "step distance must change next query position");
    }

    private static void assertConstantHeading() {
        GradientNoise2D01 gradient = field(); QueryCounter queries = new QueryCounter();
        Trace trace = trace(gradient, START_X, START_Y, 17, SCALE, STEP_DISTANCE, 0.0, queries);
        double dx = STEP_DISTANCE * Math.cos(ANGLE_BASE), dy = STEP_DISTANCE * Math.sin(ANGLE_BASE);
        double x = START_X, y = START_Y;
        for (int index = 0; index < trace.steps; index++) {
            require(rawEqual(trace.headings[index], ANGLE_BASE), "constant heading " + index);
            x = x + dx; y = y + dy;
            require(rawEqual(trace.x(index + 1), x) && rawEqual(trace.y(index + 1), y), "constant position " + index);
        }
    }

    private static long rawBytesPerPath(int steps) { return 16L * (steps + 1L) + 8L * steps; }

    private static String timingJson(int steps) {
        GradientNoise2D01 gradient = field();
        QueryCounter queries = new QueryCounter();
        for (int warmup = 0; warmup < WARMUP_REPS; warmup++)
            timingSink ^= Double.doubleToRawLongBits(trace(gradient, START_X, START_Y, steps, SCALE, STEP_DISTANCE, ANGLE_SCALE, queries).x(steps));
        com.sun.management.ThreadMXBean bean = (com.sun.management.ThreadMXBean)ManagementFactory.getThreadMXBean();
        require(bean.isThreadAllocatedMemorySupported(), "JDK allocated-byte counter unavailable");
        if (!bean.isThreadAllocatedMemoryEnabled()) bean.setThreadAllocatedMemoryEnabled(true);
        long thread = Thread.currentThread().getId();
        long allocatedBefore = bean.getThreadAllocatedBytes(thread);
        long started = System.nanoTime(); Trace last = null;
        for (int rep = 0; rep < TIMING_REPS; rep++)
            last = trace(gradient, START_X, START_Y, steps, SCALE, STEP_DISTANCE, ANGLE_SCALE, queries);
        long elapsed = System.nanoTime() - started;
        long allocated = bean.getThreadAllocatedBytes(thread) - allocatedBefore;
        timingSink ^= Double.doubleToRawLongBits(last.x(steps)) ^ Double.doubleToRawLongBits(last.y(steps));
        String label = steps == 1 ? "tiny" : Integer.toString(steps);
        return "{\"label\":\"" + label + "\",\"workload\":\"one eager packed trace; field setup and checksum outside timed interval\",\"steps\":" + steps + ",\"paths\":1,\"warmup_reps\":" + WARMUP_REPS
            + ",\"timing_reps\":" + TIMING_REPS + ",\"elapsed_nanos\":" + elapsed
            + ",\"average_nanos_per_rep\":" + (elapsed / TIMING_REPS) + ",\"raw_payload_bytes_per_path\":"
            + rawBytesPerPath(steps) + ",\"thread_allocated_bytes_total_reps\":" + allocated
            + ",\"thread_allocated_bytes_average_per_rep\":" + (allocated / TIMING_REPS) + "}";
    }

    private static String configurationJson() {
        return "{\"field\":{\"id\":\"field.gradient-noise-2d-01\",\"version\":\"0.1.0\",\"seed\":42},"
            + "\"movement\":{\"starts\":{\"columns\":6,\"rows\":4,\"first\":[60,80],\"pitch\":[104,160],\"order\":\"row-major\"},"
            + "\"steps\":2000,\"step_distance\":0.4,\"coordinate_scale\":[0.002,0.002],\"coordinate_offset\":[0,0],\"angle_base\":-20,\"angle_scale\":40,\"storage\":\"packed binary64 positions N+1 and headings N\"},"
            + "\"mark\":{\"anchor\":\"post-advance endpoint\",\"every_n_steps\":4,\"lengths\":[12,24],\"envelope\":\"1; no jitter\",\"palette_selection\":\"path index modulo 5\"},"
            + "\"render\":{\"renderer\":\"Processing 4.5.6 JAVA2D\",\"dimensions\":[640,640],\"pixel_density\":1,\"background_rgb\":\"ECE7DA\",\"alpha\":150,\"stroke_width\":1,\"stroke_cap\":\"round\",\"palette_rgb\":[\"31A151\",\"FFA71E\",\"05084C\",\"DE4638\",\"3DBDB7\"]}}";
    }

    private static String hashesJson(Hashes hashes) {
        return "{\"model_sha256\":\"" + hashes.model + "\",\"movement_sha256\":\"" + hashes.movement
            + "\",\"geometry_sha256\":\"" + hashes.geometry + "\",\"colour_sha256\":\"" + hashes.colour
            + "\",\"command_count\":" + hashes.commands + "}";
    }

    private static String actualCaseJson(boolean traceCase, double scale, double markLength) {
        return "{\"coordinate_scale\":[" + scale + "," + scale + "],\"mark_length\":" + markLength
            + ",\"mark_stride\":" + (traceCase ? 1 : 4) + "}";
    }

    private static void check() {
        Map<String,Object> input = new LinkedHashMap<String,Object>(); input.put("seed", Long.valueOf(FIELD_SEED));
        GradientNoise2D01 gradient = GradientNoise2D01.create(input);
        Map<String,Object> originalInput = new LinkedHashMap<String,Object>(input);
        Map<String,Object> before = gradient.serialize();
        QueryCounter counter = new QueryCounter();
        Traces base = traces(gradient, STEPS, SCALE, STEP_DISTANCE, ANGLE_SCALE, counter);
        long baseQueries = counter.value;
        require(baseQueries == (long)PATH_COUNT * STEPS, "base query count");
        for (Trace trace : base.values) ensureFinite(trace);
        String beforeTraversal = movementHash(base.values);
        Hashes trace = hashCase("trace", base.values, SCALE, 0.0, true, PALETTE);
        Hashes marks = hashCase("marks", base.values, SCALE, 12.0, false, PALETTE);
        Hashes longMarks = hashCase("long-marks", base.values, SCALE, 24.0, false, PALETTE);
        String afterTraversal = movementHash(base.values);
        require(beforeTraversal.equals(afterTraversal), "command traversal mutated retained movement");
        require(trace.movement.equals(marks.movement) && marks.movement.equals(longMarks.movement), "shared movement hash");
        require(marks.commands == (long)PATH_COUNT * (STEPS / 4), "mark command count");
        require(longMarks.commands == marks.commands && !longMarks.geometry.equals(marks.geometry), "long marks geometry only");
        long queriesBeforeRecolour = counter.value;
        Hashes recoloured = hashCase("marks", base.values, SCALE, 12.0, false, RECOLOUR_PALETTE);
        long recolourQueries = counter.value - queriesBeforeRecolour;
        require(marks.movement.equals(recoloured.movement) && marks.geometry.equals(recoloured.geometry), "recolour geometry");
        require(!marks.colour.equals(recoloured.colour), "recolour hash");
        require(recolourQueries == 0L, "recolour field queries");
        require(before.equals(gradient.serialize()) && originalInput.equals(input), "field configuration changed");
        assertPrefix(); assertStepDistanceChangesQueries(); assertConstantHeading();
        Traces finer = traces(gradient, STEPS, FINER_SCALE, STEP_DISTANCE, ANGLE_SCALE, counter);
        for (Trace finerTrace : finer.values) ensureFinite(finerTrace);
        Hashes finerMarks = hashCase("finer-field", finer.values, FINER_SCALE, 12.0, false, PALETTE);
        require(!marks.movement.equals(finerMarks.movement), "finer field must recompute movement");
        String json = "{\"status\":\"passed\",\"experiment\":\"cp2-path-choice\",\"case_id\":\"all-pure-cases\",\"steps\":2000,\"path_count\":24,\"configuration\":" + configurationJson() + ",\"pure_checks\":{"
            + "\"shared_retained_movement\":true,\"recolour_zero_field_queries\":true,\"prefix_2000_of_2001\":true,"
            + "\"step_distance_changes_query\":true,\"angle_scale_zero_constant\":true,\"finite\":true,\"field_unchanged\":true},"
            + "\"pure_measurements\":{\"base_field_queries\":" + baseQueries + ",\"recolour_field_queries\":" + recolourQueries + ",\"trace_command_count\":" + trace.commands + ",\"marks_command_count\":" + marks.commands + "},"
            + "\"hashes\":{\"trace\":" + hashesJson(trace) + ",\"marks\":" + hashesJson(marks) + ",\"long_marks\":" + hashesJson(longMarks) + ",\"finer_field\":" + hashesJson(finerMarks) + "},"
            + "\"memory_calculated\":{\"formula\":\"16*(steps+1)+8*steps bytes per path; raw arrays only\",\"steps_2000_per_path\":" + rawBytesPerPath(2000) + ",\"steps_16000_per_path\":" + rawBytesPerPath(16000) + ",\"paths_24_steps_2000\":" + (rawBytesPerPath(2000) * PATH_COUNT) + "},"
            + "\"timing_observations\":[" + timingJson(1) + "," + timingJson(2000) + "," + timingJson(16000) + "]}";
        System.out.println(json);
    }

    private static void render(String caseId, String output) {
        boolean traceCase = "trace".equals(caseId);
        double scale = "finer-field".equals(caseId) ? FINER_SCALE : SCALE;
        double markLength = traceCase ? 0.0 : ("long-marks".equals(caseId) ? 24.0 : 12.0);
        if (!traceCase && !"marks".equals(caseId) && !"long-marks".equals(caseId) && !"finer-field".equals(caseId))
            throw new IllegalArgumentException("case must be trace, marks, long-marks, or finer-field");
        Traces values = traces(STEPS, scale, STEP_DISTANCE, ANGLE_SCALE);
        Hashes beforeDraw = hashCase(caseId, values.values, scale, markLength, traceCase, PALETTE);
        PGraphicsJava2D graphics = new PGraphicsJava2D();
        graphics.setParent(new PApplet()); graphics.setPrimary(false); graphics.pixelDensity = 1; graphics.setSize(WIDTH, HEIGHT);
        try {
            graphics.beginDraw(); graphics.background((BACKGROUND >>> 16) & 255, (BACKGROUND >>> 8) & 255, BACKGROUND & 255);
            drawCase(graphics, values.values, traceCase, markLength); graphics.endDraw();
            if (!graphics.save(output)) throw new AssertionError("could not save " + output);
        } finally { graphics.dispose(); }
        Hashes afterDraw = hashCase(caseId, values.values, scale, markLength, traceCase, PALETTE);
        require(beforeDraw.movement.equals(afterDraw.movement) && beforeDraw.geometry.equals(afterDraw.geometry)
                && beforeDraw.colour.equals(afterDraw.colour), "actual draw mutated retained movement or commands");
        System.out.println("{\"status\":\"rendered\",\"experiment\":\"cp2-path-choice\",\"case_id\":\"" + caseId
            + "\",\"steps\":2000,\"path_count\":24,\"output_png\":\"" + output.replace("\\", "\\\\").replace("\"", "\\\"")
            + "\",\"configuration\":" + configurationJson() + ",\"actual_case\":" + actualCaseJson(traceCase, scale, markLength)
            + ",\"hashes\":" + hashesJson(beforeDraw) + ",\"pre_draw_hashes\":" + hashesJson(beforeDraw)
            + ",\"post_draw_hashes\":" + hashesJson(afterDraw) + "}");
    }

    public static void main(String[] args) {
        if (args.length == 1 && "--check".equals(args[0])) { check(); return; }
        if (args.length == 2) { render(args[0], args[1]); return; }
        throw new IllegalArgumentException("usage: PathChoice --check | PathChoice <case-id> <output.png>");
    }
}
