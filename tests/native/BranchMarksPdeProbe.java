import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.event.KeyEvent;
import org.procedurals.examples.branchmarks.BranchComposition;
import org.procedurals.topology.BranchTree2D;

/** Exercise the installed BranchMarks PDE through actual posted key events. */
public final class BranchMarksPdeProbe extends BranchMarks {
    private static final String[] IDS = {"initial", "extended", "extended-restored", "narrowing", "reset-1",
        "wide", "reset-2", "binary", "reset-3", "recolour", "thin", "forest", "forest-taper",
        "forest-palette", "forest-extended", "forest-seed", "final-reset"};
    private static final char[] NEXT = {'n','n','g','0','w','0','b','0','c','m','x','m','c','n','r','0','s'};
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private final StringBuilder states = new StringBuilder();
    private int draws;
    private int keys;
    private long generatedSegments;
    private long drawnLines;
    private long terminalScanVisits;
    private long actualTerminalDots;
    private BranchComposition base;
    private BranchComposition previous;
    private BranchComposition forestBase;
    private String baseGeometry;
    private String previousGeometry;
    private int[] basePixels;
    private int[] previousPixels;

    private static void require(boolean value, String why) { if (!value) throw new AssertionError(why); }
    private static void putLong(MessageDigest digest, long value) {
        for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
    }
    private static String geometryHash(BranchComposition composition) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            putLong(digest, composition.size());
            double[] segment = new double[4];
            for (int treeIndex = 0; treeIndex < composition.size(); treeIndex++) {
                BranchTree2D tree = composition.treeAt(treeIndex);
                putLong(digest, tree.size());
                for (int index = 0; index < tree.size(); index++) {
                    tree.segmentInto(index, segment, 0);
                    for (double value : segment) putLong(digest, Double.doubleToRawLongBits(value));
                    putLong(digest, Double.doubleToRawLongBits(tree.headingAt(index)));
                    putLong(digest, Double.doubleToRawLongBits(tree.lengthAt(index)));
                    putLong(digest, tree.parentAt(index));
                    putLong(digest, tree.generationAt(index));
                    putLong(digest, tree.childCountAt(index));
                }
            }
            StringBuilder result = new StringBuilder();
            for (byte value : digest.digest()) result.append(String.format("%02x", value & 255));
            return result.toString();
        } catch (Exception failure) { throw new RuntimeException(failure); }
    }
    private static void requireTopology(BranchComposition composition) {
        double[] segment = new double[4], parent = new double[4];
        for (int treeIndex = 0; treeIndex < composition.size(); treeIndex++) {
            BranchTree2D tree = composition.treeAt(treeIndex);
            int[] actualChildren = new int[tree.size()];
            for (int index = 0; index < tree.size(); index++) {
                tree.segmentInto(index, segment, 0);
                for (double value : segment) require(Double.isFinite(value), "finite segment");
                require(Double.isFinite(tree.headingAt(index)), "finite heading");
                require(Double.isFinite(tree.lengthAt(index)) && tree.lengthAt(index) >= 0.0d, "finite length");
                int parentIndex = tree.parentAt(index);
                if (index == 0) {
                    require(parentIndex == -1 && tree.generationAt(index) == 0, "root topology");
                } else {
                    require(parentIndex >= 0 && parentIndex < index, "parent order");
                    actualChildren[parentIndex]++;
                    tree.segmentInto(parentIndex, parent, 0);
                    require(Double.doubleToRawLongBits(segment[0]) == Double.doubleToRawLongBits(parent[2])
                        && Double.doubleToRawLongBits(segment[1]) == Double.doubleToRawLongBits(parent[3]), "attachment");
                    require(tree.generationAt(index) == tree.generationAt(parentIndex) + 1, "generation");
                }
            }
            for (int index = 0; index < tree.size(); index++)
                require(actualChildren[index] == tree.childCountAt(index), "child count");
        }
    }
    private static void requirePrefix(BranchComposition shorter, BranchComposition longer) {
        require(shorter.size() == longer.size(), "forest root count changed on appended rule");
        boolean grew = false;
        double[] left = new double[4], right = new double[4];
        for (int treeIndex = 0; treeIndex < shorter.size(); treeIndex++) {
            BranchTree2D a = shorter.treeAt(treeIndex), b = longer.treeAt(treeIndex);
            require(a.size() <= b.size(), "appended rule shrank tree");
            grew |= a.size() < b.size();
            for (int index = 0; index < a.size(); index++) {
                a.segmentInto(index, left, 0); b.segmentInto(index, right, 0);
                for (int axis = 0; axis < 4; axis++)
                    require(Double.doubleToRawLongBits(left[axis]) == Double.doubleToRawLongBits(right[axis]), "geometry prefix");
                require(Double.doubleToRawLongBits(a.headingAt(index)) == Double.doubleToRawLongBits(b.headingAt(index)), "heading prefix");
                require(Double.doubleToRawLongBits(a.lengthAt(index)) == Double.doubleToRawLongBits(b.lengthAt(index)), "length prefix");
                require(a.parentAt(index) == b.parentAt(index) && a.generationAt(index) == b.generationAt(index), "topology prefix");
            }
        }
        require(grew, "appended rule did not extend any tree");
    }
    private static boolean sameTrees(BranchComposition left, BranchComposition right) {
        if (left.size() != right.size()) return false;
        for (int index = 0; index < left.size(); index++) if (left.treeAt(index) != right.treeAt(index)) return false;
        return true;
    }
    private static int terminalDots(BranchComposition composition) {
        int count = 0;
        for (int treeIndex = 0; treeIndex < composition.size(); treeIndex++) {
            BranchTree2D tree = composition.treeAt(treeIndex);
            for (int index = 0; index < tree.size(); index++) if (tree.childCountAt(index) == 0) count++;
        }
        return count;
    }
    private void post(char keyValue) {
        events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(), KeyEvent.PRESS, 0, keyValue, 0)),
            150, TimeUnit.MILLISECONDS);
    }
    private void requireState(int state) {
        require(SEED == (state == 15 ? 43 : 42), "seed");
        require(MORE == (state == 1 || state == 14 || state == 15), "more-generations");
        require(NARROWING == (state == 3), "narrowing");
        require(WIDER == (state == 5), "wider");
        require(BINARY == (state == 7), "binary");
        require(FOREST == (state >= 11 && state <= 15), "forest");
        require(TAPER == !(state == 10 || state == 11), "taper");
        require(ALTERNATE == (state >= 9 && state <= 12), "palette");
        require(composition.totalSegments() <= 20000, "per-state segment guard");
    }
    @Override public void draw() {
        int state = draws;
        require(state < IDS.length, "unexpected draw");
        require(width == 640 && height == 640 && pixelDensity == 1 && g instanceof PGraphicsJava2D, "environment");
        requireState(state);
        requireTopology(composition);
        String geometry = geometryHash(composition);
        if (state == 0) { base = composition; baseGeometry = geometry; }
        if (state == 1) requirePrefix(base, composition);
        if (state == 14) requirePrefix(forestBase, composition);
        if (state == 9 || state == 10 || state == 12 || state == 13)
            require(composition == previous && sameTrees(composition, previous), "style edit rebuilt composition/tree");
        if (state == 2 || state == 4 || state == 6 || state == 8 || state == 16)
            require(geometry.equals(baseGeometry), "reset/restore did not replay base geometry");
        if (state == 11) forestBase = composition;
        if (state > 0 && !(state == 9 || state == 10 || state == 12 || state == 13))
            require(composition != previous, "geometry edit did not rebuild composition");
        super.draw();
        int segmentCount = composition.totalSegments();
        int scanVisits = TAPER ? segmentCount : 0;
        int dots = TAPER ? terminalDots(composition) : 0;
        int newlyGenerated = composition == previous ? 0 : segmentCount;
        generatedSegments += newlyGenerated;
        drawnLines += segmentCount;
        terminalScanVisits += scanVisits;
        actualTerminalDots += dots;
        draws++;
        loadPixels();
        int[] shown = pixels.clone();
        if (state == 0) basePixels = shown.clone();
        if (state == 9 || state == 10 || state == 12 || state == 13)
            require(!Arrays.equals(shown, previousPixels), "style edit did not visibly change pixels");
        if (state == 2 || state == 4 || state == 6 || state == 8 || state == 16)
            require(Arrays.equals(basePixels, shown), "reset/restore pixel replay");
        save(sketchPath(IDS[state] + ".png"));
        if (state == 16) save(sketchPath("displayed-final.png"));
        if (states.length() > 0) states.append(',');
        states.append("{\"id\":\"").append(IDS[state]).append("\",\"trees\":").append(composition.size())
            .append(",\"segments\":").append(segmentCount)
            .append(",\"generated_segments\":").append(newlyGenerated).append(",\"drawn_lines\":").append(segmentCount)
            .append(",\"terminal_scan_visits\":").append(scanVisits).append(",\"terminal_dots\":").append(dots).append(",\"geometry_sha256\":\"").append(geometry)
            .append("\",\"same_composition_as_previous\":").append(composition == previous).append('}');
        try {
            Files.write(Paths.get(sketchPath("progress.json")), ("{\"completed_compositions\":" + draws
                + ",\"generated_segments\":" + generatedSegments + ",\"drawn_lines\":" + drawnLines
                + ",\"terminal_scan_visits\":" + terminalScanVisits + "}").getBytes(StandardCharsets.UTF_8));
        } catch (Exception failure) { throw new RuntimeException(failure); }
        previous = composition; previousGeometry = geometry; previousPixels = shown;
        post(NEXT[state]);
    }
    @Override public void keyPressed() {
        require(keys < NEXT.length && key == NEXT[keys], "key sequence");
        BranchComposition before = composition;
        super.keyPressed(); keys++;
        if (key == 's') {
            require(composition == before, "save rebuilt composition");
            long savedAt = System.nanoTime();
            events.schedule(() -> {
                try {
                    long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
                    require(quiet >= 300 && draws == IDS.length && keys == NEXT.length, "save was not quiet");
                    try (java.util.stream.Stream<Path> files = Files.list(Paths.get(sketchPath()))) {
                        require(files.filter(path -> path.getFileName().toString().startsWith("branch-marks-")
                            && path.toString().endsWith(".png")).count() == 1, "actual save count");
                    }
                    String report = "{\"status\":\"passed\",\"compositions\":17,\"key_events\":17,"
                        + "\"style_reuses_composition\":true,\"append_rule_prefix\":true,\"topology_checked\":true,"
                        + "\"reset_pixel_replay\":true,\"generated_segments\":" + generatedSegments
                        + ",\"drawn_lines\":" + drawnLines + ",\"terminal_scan_visits\":" + terminalScanVisits
                        + ",\"actual_terminal_dots\":" + actualTerminalDots + ",\"save_quiet_ms\":" + quiet
                        + ",\"states\":[" + states + "]}";
                    Files.write(Paths.get(sketchPath("native.json")), report.getBytes(StandardCharsets.UTF_8));
                    events.shutdown(); exit();
                } catch (Throwable failure) { failure.printStackTrace(); System.exit(1); }
            }, 300, TimeUnit.MILLISECONDS);
        }
    }
    public static void main(String[] args) {
        if (args.length != 1) throw new IllegalArgumentException("output path required");
        try {
            Path expected = Paths.get(System.getProperty("procedurals.expectedCore")).toRealPath();
            Path actual = Paths.get(BranchTree2D.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath();
            require(actual.equals(expected), "BranchTree2D did not load from installed JAR");
        } catch (Exception failure) { throw new RuntimeException(failure); }
        Thread.setDefaultUncaughtExceptionHandler((thread, failure) -> { failure.printStackTrace(); System.exit(1); });
        PApplet.runSketch(new String[] {"--sketch-path=" + args[0], "BranchMarksPdeProbe"}, new BranchMarksPdeProbe());
    }
}
