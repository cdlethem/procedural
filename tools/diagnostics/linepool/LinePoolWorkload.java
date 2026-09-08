import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryPoolMXBean;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;
import org.procedurals.topology.LinePool2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.opengl.PGraphics2D;

/**
 * One retained, source-style workload frame for the accepted 30 by 90,000 pool case.
 * This is a native diagnostic, not a library API or a source-equivalence claim.
 */
public final class LinePoolWorkload extends PApplet {
    private static final int WIDTH = 1920;
    private static final int HEIGHT = 1920;
    private static final int POOL_COUNT = 30;
    private static final int ATTEMPTS_PER_POOL = 90000;
    private static final int MAX_SEGMENTS = 180001;
    private static final double ANGLE_SCALE = 1.4;
    private static final double MIN_CUT_LENGTH = 4.0;
    private static final long PAYLOAD_BYTES_PER_SEGMENT = 33L;
    private static final int[] TIP_COLORS = {0xeb4313, 0xe9ca54, 0x749ab2};

    private static Path output;
    private static File expectedCore;
    private final LinePool2D[] pools = new LinePool2D[POOL_COUNT];
    private final double[] segment = new double[4];
    private final MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
    private long generationChecksumConfigAccountingNanos;
    private long renderNanos;
    private long heapAfterBuild;
    private long heapAfterRender;
    private long peakHeapBytes;
    private long totalSegments;
    private long totalCuts;
    private long totalSkips;
    private String geometryChecksum;

    public void settings() {
        size(WIDTH, HEIGHT, P2D);
        pixelDensity(1);
        smooth(8);
    }

    public void setup() {
        try {
            require(source(LinePool2D.class).equals(expectedCore.getCanonicalPath()), "candidate core origin");
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
        require(width == WIDTH && height == HEIGHT && pixelDensity == 1 && g instanceof PGraphics2D,
                "renderer environment");
        for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) pool.resetPeakUsage();
    }

    public void draw() {
        try {
            long buildStarted = System.nanoTime();
            buildPools();
            generationChecksumConfigAccountingNanos = System.nanoTime() - buildStarted;
            heapAfterBuild = memory.getHeapMemoryUsage().getUsed();

            long renderStarted = System.nanoTime();
            drawPools();
            PImage image = get();
            image.save(output.resolve("line-pool-workload.png").toString());
            renderNanos = System.nanoTime() - renderStarted;
            heapAfterRender = memory.getHeapMemoryUsage().getUsed();
            peakHeapBytes = peakHeapBytes();
            writeReport();
            noLoop();
            exit();
        } catch (Throwable error) {
            error.printStackTrace();
            System.exit(1);
        }
    }

    private void buildPools() throws Exception {
        Random placement = new Random(42L);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long segments = 0;
        long cuts = 0;
        long skips = 0;
        for (int index = 0; index < POOL_COUNT; index++) {
            double x0 = placementCoordinate(placement, WIDTH);
            double y0 = placementCoordinate(placement, HEIGHT);
            double x1 = placementCoordinate(placement, WIDTH);
            double y1 = placementCoordinate(placement, HEIGHT);
            LinePool2D pool = LinePool2D.generate(config(42L + index, x0, y0, x1, y1));
            require(pool.attempts() == ATTEMPTS_PER_POOL, "attempt count");
            require(pool.successfulCuts() + pool.skips() == ATTEMPTS_PER_POOL, "attempt accounting");
            pools[index] = pool;
            segments += pool.size();
            cuts += pool.successfulCuts();
            skips += pool.skips();
            digestLong(digest, index);
            digestLong(digest, pool.size());
            digestLong(digest, pool.successfulCuts());
            digestLong(digest, pool.skips());
            for (int segmentIndex = 0; segmentIndex < pool.size(); segmentIndex++) {
                pool.segmentInto(segmentIndex, segment, 0);
                digestLong(digest, Double.doubleToRawLongBits(segment[0]));
                digestLong(digest, Double.doubleToRawLongBits(segment[1]));
                digestLong(digest, Double.doubleToRawLongBits(segment[2]));
                digestLong(digest, Double.doubleToRawLongBits(segment[3]));
                digest.update((byte) (pool.dividedAt(segmentIndex) ? 1 : 0));
            }
        }
        totalSegments = segments;
        totalCuts = cuts;
        totalSkips = skips;
        geometryChecksum = hex(digest.digest());
    }

    private void drawPools() {
        background(10, 10, 21);
        int[] lineColors = sourceStyleColors(new Random(0x6c696e65734cL));
        Random lineStyle = new Random(0x7374796c654cL);
        Random tipStyle = new Random(0x7469707354L);
        strokeWeight(1.4f);
        noFill();
        for (int poolIndex = 0; poolIndex < POOL_COUNT; poolIndex++) {
            LinePool2D pool = pools[poolIndex];
            for (int segmentIndex = 0; segmentIndex < pool.size(); segmentIndex++) {
                pool.segmentInto(segmentIndex, segment, 0);
                int rgb = lineColors[lineStyle.nextInt(lineColors.length)];
                blendMode(lineStyle.nextDouble() < 0.2 ? ADD : NORMAL);
                stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 60);
                line((float) segment[0], (float) segment[1], (float) segment[2], (float) segment[3]);
            }
        }
        blendMode(NORMAL);
        noStroke();
        for (int poolIndex = 0; poolIndex < POOL_COUNT; poolIndex++) {
            LinePool2D pool = pools[poolIndex];
            for (int segmentIndex = 0; segmentIndex < pool.size(); segmentIndex++) {
                if (pool.dividedAt(segmentIndex) || tipStyle.nextDouble() >= 0.05) continue;
                pool.segmentInto(segmentIndex, segment, 0);
                int rgb = TIP_COLORS[tipStyle.nextInt(TIP_COLORS.length)];
                fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
                float diameter = (float) (0.5 + tipStyle.nextDouble() * 4.5);
                ellipse((float) segment[2], (float) segment[3], diameter, diameter);
            }
        }
    }

    private void writeReport() throws Exception {
        StringBuilder poolsJson = new StringBuilder();
        for (int index = 0; index < POOL_COUNT; index++) {
            LinePool2D pool = pools[index];
            if (index > 0) poolsJson.append(',');
            poolsJson.append("{\"index\":").append(index)
                    .append(",\"seed\":").append(42L + index)
                    .append(",\"segments\":").append(pool.size())
                    .append(",\"successfulCuts\":").append(pool.successfulCuts())
                    .append(",\"skips\":").append(pool.skips()).append('}');
        }
        String report = "{\"status\":\"passed\",\"width\":" + WIDTH
                + ",\"height\":" + HEIGHT + ",\"renderer\":\"P2D\",\"density\":1"
                + ",\"pool_count\":" + POOL_COUNT + ",\"attempts_per_pool\":" + ATTEMPTS_PER_POOL
                + ",\"total_attempts\":" + (POOL_COUNT * (long) ATTEMPTS_PER_POOL)
                + ",\"generation_checksum_config_accounting_nanos\":" + generationChecksumConfigAccountingNanos
                + ",\"render_readback_png_save_nanos\":" + renderNanos
                + ",\"total_segments\":" + totalSegments + ",\"total_successful_cuts\":" + totalCuts
                + ",\"total_skips\":" + totalSkips + ",\"payload_estimate_bytes\":"
                + (totalSegments * PAYLOAD_BYTES_PER_SEGMENT) + ",\"geometry_sha256\":\"" + geometryChecksum
                + "\",\"heap_max_bytes\":" + memory.getHeapMemoryUsage().getMax()
                + ",\"heap_used_after_build_bytes\":" + heapAfterBuild
                + ",\"heap_used_after_render_bytes\":" + heapAfterRender
                + ",\"heap_peak_sum_pools_bytes\":" + peakHeapBytes
                + ",\"heap_peak_sum_pools_limitation\":\"sum of independently peaking heap pools; not a simultaneous JVM maximum\""
                + ",\"renderer_class\":\"" + g.getClass().getName() + "\""
                + ",\"drawing_scope\":\"diagnostic uses one shared 100-colour palette, single-colour alpha-60 lines, and uniform 0.5-5 terminal dots; it does not measure source per-pool palettes, endpoint interpolation, or nested tip diameters\""
                + ",\"core_code_source\":\"" + source(LinePool2D.class) + "\",\"pools\":["
                + poolsJson + "]}\n";
        Files.write(output.resolve("native.json"), report.getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, Object> config(long seed, double x0, double y0, double x1, double y1) {
        Map<String, Object> value = new LinkedHashMap<String, Object>();
        value.put("seed", Long.valueOf(seed));
        value.put("segment", Arrays.<Object>asList(Double.valueOf(x0), Double.valueOf(y0), Double.valueOf(x1), Double.valueOf(y1)));
        value.put("attempts", Integer.valueOf(ATTEMPTS_PER_POOL));
        value.put("firstCutAngleScale", Double.valueOf(ANGLE_SCALE));
        value.put("minCutLength", Double.valueOf(MIN_CUT_LENGTH));
        value.put("maxSegments", Integer.valueOf(MAX_SEGMENTS));
        return value;
    }

    private static double placementCoordinate(Random random, int dimension) {
        return dimension * 0.5 + ((random.nextDouble() * 2.0 - 1.0) * dimension * 0.65);
    }

    private static int[] sourceStyleColors(Random random) {
        int[] colors = new int[100];
        for (int index = 0; index < colors.length; index++)
            colors[index] = (random.nextInt(256) << 16) | (random.nextInt(256) << 8) | random.nextInt(256);
        return colors;
    }

    private static long peakHeapBytes() {
        long used = 0;
        for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) {
            if (pool.getType() == java.lang.management.MemoryType.HEAP)
                used += pool.getPeakUsage().getUsed();
        }
        return used;
    }

    private static void digestLong(MessageDigest digest, long value) {
        for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
    }

    private static String hex(byte[] values) {
        StringBuilder text = new StringBuilder(values.length * 2);
        for (byte value : values) text.append(String.format("%02x", value & 255));
        return text.toString();
    }

    private static String source(Class<?> type) {
        try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] arguments) {
        if (arguments.length != 2) throw new IllegalArgumentException("usage: LinePoolWorkload <output-dir> <core-jar>");
        output = Paths.get(arguments[0]);
        expectedCore = new File(arguments[1]);
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> { error.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[] {"--sketch-path=" + output, "LinePoolWorkload"}, new LinePoolWorkload());
    }
}
