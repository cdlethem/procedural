import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import org.procedurals.fields.GradientNoise2D01;

/**
 * Private, independently specified inspection experiment for CP12.  This is not a
 * library operation or a Processing implementation.  Its explicit xorshift32 streams
 * intentionally differ from venas' unseeded host random()/noise() state.
 */
public final class BandPrototype {
    private static final int WIDTH = 640;
    private static final int HEIGHT = 640;
    private static final int STARTS = 96;
    private static final int ATTEMPTS = 2048;
    private static final int START_STYLE_SEED = 0x13579bdf;
    private static final int WALK_SEED = 0x2468ace1;
    private static final int[] PALETTE = {0xff224b63, 0xff3a7d7c, 0xff6b8e23, 0xffc17c3d, 0xff8b3d5c, 0xff4f5d95};

    @FunctionalInterface private interface ScalarField { double sample(double x, double y); }

    private static final class XorShift32 {
        private int state;
        XorShift32(int seed) { if (seed == 0) throw new IllegalArgumentException("zero xorshift seed"); state = seed; }
        int nextInt() { int x = state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return state = x; }
        double unit() { return ((nextInt() & 0xffffffffL) + 0.5) / 4294967296.0; }
    }

    private static final class PathData {
        final double[] xs;
        final double[] ys;
        final int color;
        final double startLevel;
        PathData(double[] xs, double[] ys, int color, double startLevel) { this.xs = xs; this.ys = ys; this.color = color; this.startLevel = startLevel; }
    }

    private static final class Result {
        final String name;
        final double tolerance;
        final PathData[] paths = new PathData[STARTS];
        int accepted;
        double maxBandError;
        long generationNanos;
        long checksum;
        long renderChecksum;
        Result(String name, double tolerance) { this.name = name; this.tolerance = tolerance; }
    }

    private static Result trace(String name, ScalarField field, double tolerance) {
        long began = System.nanoTime();
        XorShift32 startStyle = new XorShift32(START_STYLE_SEED);
        XorShift32 proposals = new XorShift32(WALK_SEED);
        Result result = new Result(name, tolerance);
        long hash = 0xcbf29ce484222325L;
        for (int pathIndex = 0; pathIndex < STARTS; pathIndex++) {
            double x = startStyle.unit() * WIDTH;
            double y = startStyle.unit() * HEIGHT;
            double startLevel = field.sample(x, y);
            double heading = startStyle.unit() * Math.PI * 2.0;
            int color = PALETTE[(int) (startStyle.unit() * PALETTE.length)];
            double[] scratchX = new double[ATTEMPTS];
            double[] scratchY = new double[ATTEMPTS];
            int acceptedForPath = 0;
            for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
                double low = -proposals.unit() * Math.PI / 2.0;
                double high = proposals.unit() * Math.PI / 2.0;
                double proposal = heading + low + (high - low) * proposals.unit();
                double candidateX = x + StrictMath.cos(proposal);
                double candidateY = y + StrictMath.sin(proposal);
                double rejectionHeading = heading + (-0.1 + 0.2 * proposals.unit());
                double error = Math.abs(field.sample(candidateX, candidateY) - startLevel);
                if (error < tolerance) {
                    x = candidateX;
                    y = candidateY;
                    heading = proposal;
                    scratchX[acceptedForPath] = x;
                    scratchY[acceptedForPath] = y;
                    acceptedForPath++;
                    result.accepted++;
                    if (error > result.maxBandError) result.maxBandError = error;
                    hash = fnv(hash, Double.doubleToLongBits(x));
                    hash = fnv(hash, Double.doubleToLongBits(y));
                } else {
                    heading = rejectionHeading;
                }
            }
            PathData path = new PathData(java.util.Arrays.copyOf(scratchX, acceptedForPath), java.util.Arrays.copyOf(scratchY, acceptedForPath), color, startLevel);
            result.paths[pathIndex] = path;
            hash = fnv(hash, path.color);
            hash = fnv(hash, path.xs.length);
        }
        result.generationNanos = System.nanoTime() - began;
        result.checksum = hash;
        assertInvariant(result, field);
        return result;
    }

    private static void assertInvariant(Result result, ScalarField field) {
        for (PathData path : result.paths) for (int i = 0; i < path.xs.length; i++) {
            if (!Double.isFinite(path.xs[i]) || !Double.isFinite(path.ys[i])) throw new AssertionError("non-finite retained vertex");
            if (!(Math.abs(field.sample(path.xs[i], path.ys[i]) - path.startLevel) < result.tolerance)) throw new AssertionError("band invariant");
        }
        if (!(result.maxBandError < result.tolerance || result.accepted == 0)) throw new AssertionError("band invariant");
    }

    private static long fnv(long h, long value) { return (h ^ value) * 0x100000001b3L; }

    private static long render(Result result, Path png) throws Exception {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(new Color(0xfff5f0e6));
        g.fillRect(0, 0, WIDTH, HEIGHT);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.52f));
        g.setStroke(new BasicStroke(0.78f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        for (PathData path : result.paths) {
            if (path.xs.length < 2) continue;
            g.setColor(new Color(path.color, true));
            for (int i = 1; i < path.xs.length; i++) g.drawLine((int)Math.round(path.xs[i - 1]), (int)Math.round(path.ys[i - 1]), (int)Math.round(path.xs[i]), (int)Math.round(path.ys[i]));
        }
        g.dispose();
        ImageIO.write(image, "png", png.toFile());
        long hash = 0xcbf29ce484222325L;
        for (int y = 0; y < HEIGHT; y++) for (int x = 0; x < WIDTH; x++) hash = fnv(hash, image.getRGB(x, y) & 0xffffffffL);
        return hash;
    }

    private static Map<String, Object> seed(long seed) { Map<String, Object> value = new LinkedHashMap<>(); value.put("seed", seed); return value; }

    public static void main(String[] args) throws Exception {
        Path output = Path.of(".work/cp15-band-prototype");
        Files.createDirectories(output);
        GradientNoise2D01 noise = GradientNoise2D01.create(seed(0x6a09e667L));
        ScalarField gradient = (x, y) -> noise.sample(x * .006 + 7.3, y * .006 + 11.7);
        ScalarField radial = (x, y) -> StrictMath.hypot(x - 320.0, y - 320.0) / 400.0;
        Result[] results = {
            trace("noise-narrow", gradient, .002),
            trace("noise-wide", gradient, .008),
            trace("radial", radial, .002)
        };
        StringBuilder report = new StringBuilder();
        report.append("# CP15 private band-tracer prototype\n\n")
              .append("This Java2D inspection experiment is independently specified and is not a public operation, catalog entry, acceptance record, or Processing validation.\n\n")
              .append("All states use 640x640, 96 starts, and 2,048 attempts per start (196,608 proposals/state). The start/style stream and proposal stream are explicit xorshift32 streams with different nonzero seeds. This deliberately diverges from `venas`, whose starts, colours and proposal draws share host RNG and whose host noise/RNG state is not seeded by its displayed seed variable.\n\n")
              .append("Each walk uses bounded primitive scratch space (at most 2,048 coordinate pairs) then compacts to accepted-only retained arrays. Rejections retain no vertex. Each retained vertex is rechecked against its path's initial scalar level; replay compares retained-geometry checksums before any render.\n\n")
              .append("| state | accepted vertices | accepted-only retained bytes | max accepted band error | generation ms | geometry checksum | image checksum | PNG |\n|---|---:|---:|---:|---:|---|---|---|\n");
        for (Result result : results) {
            Result replay = trace(result.name, result.name.startsWith("radial") ? radial : gradient, result.tolerance);
            if (replay.checksum != result.checksum || replay.accepted != result.accepted || Double.doubleToLongBits(replay.maxBandError) != Double.doubleToLongBits(result.maxBandError)) throw new AssertionError("non-deterministic replay: " + result.name);
            Path png = output.resolve(result.name + ".png");
            result.renderChecksum = render(result, png);
            report.append("| ").append(result.name).append(" | ").append(result.accepted).append(" | ").append(result.accepted * 16L).append(" | ").append(String.format("%.9f", result.maxBandError)).append(" | ").append(String.format("%.3f", result.generationNanos / 1_000_000.0)).append(" | `").append(Long.toUnsignedString(result.checksum, 16)).append("` | `").append(Long.toUnsignedString(result.renderChecksum, 16)).append("` | [").append(png.getFileName()).append("](").append(png.getFileName()).append(") |\n");
        }
        report.append("\nSemantic observations: increasing tolerance uses identical start/style and proposal seeds, but changes later heading state once an acceptance differs; it should therefore change geometry while preserving initial placement and palette. The radial field is a transfer design test: it exercises the same retained band rule against a simple analytic scalar field, without implying contour extraction, closed loops, boundary control, collision handling, source equivalence, or a callback API.\n");
        Files.writeString(output.resolve("report.md"), report.toString());
        System.out.print(report);
    }
}
