package org.procedurals.diagnostics.cp6;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

import org.procedurals.sampling.CirclePlacements2D;
import processing.core.PApplet;

/**
 * Private CP6 comparison of retained, endpoint-attached branching directions.
 *
 * <p>This is independently specified diagnostic code, not an implementation of an
 * upstream sketch and not a public operation. Its {@link Random} policy, ordinary styles,
 * fixed profile values, and transfer choices are visual-investigation inputs only.</p>
 */
public final class BranchChoices extends PApplet {
    private static final int WIDTH = 640;
    private static final int HEIGHT = 640;
    private static final long PRIVATE_SEED = 42L;
    private static final int TREE_SEGMENT_LIMIT = 5000;
    private static final int WHOLE_SEGMENT_LIMIT = 30000;
    private static final double ROOT_X = 320.0;
    private static final double ROOT_Y = 590.0;
    private static final double ROOT_HEADING = -Math.PI / 2.0;
    private static final double ROOT_LENGTH = 100.0;
    private static final double TRANSFER_LENGTH_PER_RADIUS = 1.0;
    private static Path renderDirectory;

    private static final class Segment {
        final double startX;
        final double startY;
        final double endX;
        final double endY;
        final int parentIndex;
        final int generation;
        int childCount;

        Segment(double startX, double startY, double endX, double endY, int parentIndex, int generation) {
            this.startX = startX;
            this.startY = startY;
            this.endX = endX;
            this.endY = endY;
            this.parentIndex = parentIndex;
            this.generation = generation;
        }
    }

    private interface SpreadSchedule { double at(int generation); }

    private static final class Rules {
        final String id;
        final int generations;
        final SpreadSchedule spread;
        final double[] chances;
        final double rootLength;

        Rules(String id, int generations, SpreadSchedule spread, double[] chances, double rootLength) {
            this.id = id;
            this.generations = generations;
            this.spread = spread;
            this.chances = chances;
            this.rootLength = rootLength;
        }
    }

    private static final class Tree {
        final ArrayList<Segment> segments = new ArrayList<Segment>();
        int randomDraws;
        final int expectedMaxGeneration;
        final int rootCount;

        Tree(int expectedMaxGeneration, int rootCount) {
            this.expectedMaxGeneration = expectedMaxGeneration;
            this.rootCount = rootCount;
        }
    }

    private static final class Budget {
        int generated;
        void reserve(Tree tree) {
            if (tree.segments.size() >= TREE_SEGMENT_LIMIT)
                throw new IllegalStateException("tree segment limit exceeded before append");
            if (generated >= WHOLE_SEGMENT_LIMIT)
                throw new IllegalStateException("whole investigation segment limit exceeded before append");
            generated++;
        }
    }

    private static final class Profile {
        final String id;
        final Tree tree;
        final String style;
        final boolean reusesBaseObject;

        Profile(String id, Tree tree, String style, boolean reusesBaseObject) {
            this.id = id;
            this.tree = tree;
            this.style = style;
            this.reusesBaseObject = reusesBaseObject;
        }
    }

    private static double fixedSpread(final double spread, int ignoredGeneration) { return spread; }
    private static double narrowingSpread(int generation) { return 0.5 * (0.3 + 0.7 * (8 - generation) / 8.0); }

    private static float nextUnit(Random random, Tree tree) {
        tree.randomDraws++;
        return random.nextFloat();
    }

    private static double childAngle(int slot, double heading, double spread, Random random, Tree tree) {
        double unit = nextUnit(random, tree);
        if (slot == 0) return heading + (-spread + unit * (0.5 * spread));
        if (slot == 1) return heading + (0.5 * spread + unit * (0.5 * spread));
        return heading + (-0.2 * spread + unit * (0.4 * spread));
    }

    private static void grow(Tree tree, Rules rules, Random random, Budget budget,
                             double x, double y, double heading, double length,
                             int parentIndex, int generation) {
        budget.reserve(tree);
        double endX = x + Math.cos(heading) * length;
        double endY = y + Math.sin(heading) * length;
        int current = tree.segments.size();
        Segment segment = new Segment(x, y, endX, endY, parentIndex, generation);
        tree.segments.add(segment);

        // One shared scale is consumed per emitted segment, including terminal ones. The
        // terminal value is unused; this makes the private trace explicit rather than a
        // source-stream compatibility promise.
        double childLength = length * (0.65 + nextUnit(random, tree) * 0.20);
        if (generation + 1 >= rules.generations) return;
        double spread = rules.spread.at(generation);
        for (int slot = 0; slot < rules.chances.length; slot++) {
            if (nextUnit(random, tree) < rules.chances[slot]) {
                segment.childCount++;
                double angle = childAngle(slot, heading, spread, random, tree);
                // Deliberately depth-first: this complete subtree consumes its draws before
                // the parent evaluates the next slot gate.
                grow(tree, rules, random, budget, endX, endY, angle, childLength, current, generation + 1);
            }
        }
    }

    private static Tree singleRoot(Rules rules, Budget budget, long seed) {
        Tree tree = new Tree(rules.generations - 1, 1);
        grow(tree, rules, new Random(seed), budget, ROOT_X, ROOT_Y, ROOT_HEADING,
                rules.rootLength, -1, 0);
        return tree;
    }

    private static List<Object> pair(double x, double y) {
        ArrayList<Object> value = new ArrayList<Object>(2);
        value.add(Double.valueOf(x)); value.add(Double.valueOf(y));
        return value;
    }

    private static Map<String,Object> circleConfig() {
        Map<String,Object> value = new LinkedHashMap<String,Object>();
        value.put("seed", Long.valueOf(42));
        value.put("attempts", Integer.valueOf(10));
        value.put("origin", pair(70.0, 220.0));
        value.put("extent", pair(500.0, 320.0));
        value.put("radiusRange", pair(30.0, 50.0));
        value.put("separationScale", Double.valueOf(1.0));
        return value;
    }

    private static Tree transfer(Rules rules, Budget budget) {
        CirclePlacements2D placements = CirclePlacements2D.seeded(circleConfig());
        Tree tree = new Tree(rules.generations - 1, placements.size());
        for (int index = 0; index < placements.size(); index++) {
            double[] root = placements.pointAt((long) index);
            // This private derivation gives independent root structures while making the
            // placement ordinal dependency visible. It is not a portable/public RNG policy.
            Random random = new Random(PRIVATE_SEED + index);
            grow(tree, rules, random, budget, root[0], root[1], ROOT_HEADING,
                    placements.radiusAt((long) index) * TRANSFER_LENGTH_PER_RADIUS,
                    -1, 0);
        }
        return tree;
    }

    private static Rules rules(String id, int generations, SpreadSchedule schedule, double[] chances, double length) {
        return new Rules(id, generations, schedule, chances, length);
    }

    private static List<Profile> profiles(Budget budget) {
        Rules fixed = rules("base-fixed-spread", 8, new SpreadSchedule() {
            public double at(int generation) { return fixedSpread(0.5, generation); }
        }, new double[] {0.7, 0.7, 0.4}, ROOT_LENGTH);
        Tree base = singleRoot(fixed, budget, PRIVATE_SEED);
        ArrayList<Profile> result = new ArrayList<Profile>();
        result.add(new Profile("base-fixed-spread", base, "thin-dark-lines", false));
        result.add(new Profile("narrowing-spread", singleRoot(rules("narrowing-spread", 8, new SpreadSchedule() {
            public double at(int generation) { return narrowingSpread(generation); }
        }, new double[] {0.7, 0.7, 0.4}, ROOT_LENGTH), budget, PRIVATE_SEED), "thin-dark-lines", false));
        result.add(new Profile("depth-6", singleRoot(rules("depth-6", 6, new SpreadSchedule() {
            public double at(int generation) { return fixedSpread(0.5, generation); }
        }, new double[] {0.7, 0.7, 0.4}, ROOT_LENGTH), budget, PRIVATE_SEED), "thin-dark-lines", false));
        result.add(new Profile("wider-spread-0.9", singleRoot(rules("wider-spread-0.9", 8, new SpreadSchedule() {
            public double at(int generation) { return fixedSpread(0.9, generation); }
        }, new double[] {0.7, 0.7, 0.4}, ROOT_LENGTH), budget, PRIVATE_SEED), "thin-dark-lines", false));
        result.add(new Profile("recolour-base", base, "generation-colours", true));
        result.add(new Profile("tapered-terminal-base", base, "tapered-lines-terminal-dots", true));
        result.add(new Profile("binary-slots", singleRoot(rules("binary-slots", 8, new SpreadSchedule() {
            public double at(int generation) { return fixedSpread(0.09, generation); }
        }, new double[] {0.8, 0.8}, ROOT_LENGTH), budget, PRIVATE_SEED), "thin-dark-lines", false));
        Rules transferRules = rules("circle-transfer", 5, new SpreadSchedule() {
            public double at(int generation) { return fixedSpread(0.5, generation); }
        }, new double[] {0.7, 0.7, 0.4}, ROOT_LENGTH);
        result.add(new Profile("circle-transfer", transfer(transferRules, budget), "thin-dark-lines", false));
        return result;
    }

    private static void digestLong(MessageDigest digest, long value) {
        for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
    }
    private static String hex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        return result.toString();
    }
    private static String geometryHash(Tree tree) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Segment segment : tree.segments) {
                digestLong(digest, Double.doubleToRawLongBits(segment.startX));
                digestLong(digest, Double.doubleToRawLongBits(segment.startY));
                digestLong(digest, Double.doubleToRawLongBits(segment.endX));
                digestLong(digest, Double.doubleToRawLongBits(segment.endY));
                digestLong(digest, segment.parentIndex); digestLong(digest, segment.generation); digestLong(digest, segment.childCount);
            }
            return hex(digest.digest());
        } catch (NoSuchAlgorithmException impossible) { throw new AssertionError(impossible); }
    }
    private static final class TreeFacts {
        final boolean valid;
        final boolean finiteGeometry;
        final int rootCount;
        final int earlyTerminalCount;
        final double minX;
        final double minY;
        final double maxX;
        final double maxY;

        TreeFacts(boolean valid, boolean finiteGeometry, int rootCount, int earlyTerminalCount,
                  double minX, double minY, double maxX, double maxY) {
            this.valid = valid; this.finiteGeometry = finiteGeometry; this.rootCount = rootCount;
            this.earlyTerminalCount = earlyTerminalCount;
            this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
        }
    }

    private static TreeFacts inspectTree(Tree tree) {
        int[] directChildren = new int[tree.segments.size()];
        int roots = 0;
        boolean valid = true;
        boolean finite = true;
        double minX = Double.POSITIVE_INFINITY, minY = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY, maxY = Double.NEGATIVE_INFINITY;
        for (int index = 0; index < tree.segments.size(); index++) {
            Segment segment = tree.segments.get(index);
            if (!Double.isFinite(segment.startX) || !Double.isFinite(segment.startY)
                    || !Double.isFinite(segment.endX) || !Double.isFinite(segment.endY)) finite = false;
            minX = Math.min(minX, Math.min(segment.startX, segment.endX));
            minY = Math.min(minY, Math.min(segment.startY, segment.endY));
            maxX = Math.max(maxX, Math.max(segment.startX, segment.endX));
            maxY = Math.max(maxY, Math.max(segment.startY, segment.endY));
            if (segment.parentIndex < 0) {
                if (segment.parentIndex != -1 || segment.generation != 0) valid = false;
                roots++;
            } else {
                if (segment.parentIndex >= index) { valid = false; continue; }
                Segment parent = tree.segments.get(segment.parentIndex);
                if (segment.generation != parent.generation + 1
                        || Double.doubleToRawLongBits(segment.startX) != Double.doubleToRawLongBits(parent.endX)
                        || Double.doubleToRawLongBits(segment.startY) != Double.doubleToRawLongBits(parent.endY)) valid = false;
                directChildren[segment.parentIndex]++;
            }
        }
        int earlyTerminals = 0;
        for (int index = 0; index < tree.segments.size(); index++) {
            Segment segment = tree.segments.get(index);
            if (segment.childCount != directChildren[index] || segment.childCount < 0 || segment.childCount > 3) valid = false;
            if (segment.childCount == 0 && segment.generation < tree.expectedMaxGeneration) earlyTerminals++;
        }
        if (roots != tree.rootCount || roots == 0 || !finite) valid = false;
        return new TreeFacts(valid, finite, roots, earlyTerminals, minX, minY, maxX, maxY);
    }
    private static int maxGeneration(Tree tree) {
        int max = -1;
        for (Segment segment : tree.segments) if (segment.generation > max) max = segment.generation;
        return max;
    }
    private static String childHistogram(Tree tree) {
        int[] counts = new int[4];
        for (Segment segment : tree.segments) counts[segment.childCount]++;
        return "[" + counts[0] + "," + counts[1] + "," + counts[2] + "," + counts[3] + "]";
    }
    private static String profileJson(Profile profile) {
        Tree tree = profile.tree;
        TreeFacts facts = inspectTree(tree);
        if (!facts.valid || tree.segments.size() > TREE_SEGMENT_LIMIT || maxGeneration(tree) > tree.expectedMaxGeneration)
            throw new AssertionError("retained branching invariant failed for " + profile.id);
        return "{\"id\":\"" + profile.id + "\",\"segment_count\":" + tree.segments.size()
                + ",\"root_count\":" + facts.rootCount + ",\"geometry_sha256\":\"" + geometryHash(tree)
                + "\",\"parent_endpoint_identity\":true,\"finite_geometry\":true,\"bounds\":["
                + facts.minX + "," + facts.minY + "," + facts.maxX + "," + facts.maxY + "]"
                + ",\"child_count_histogram\":" + childHistogram(tree) + ",\"early_terminal_count\":" + facts.earlyTerminalCount
                + ",\"max_generation\":" + maxGeneration(tree) + ",\"expected_max_generation\":" + tree.expectedMaxGeneration
                + ",\"node_budget\":" + TREE_SEGMENT_LIMIT + ",\"random_draws\":" + tree.randomDraws
                + ",\"style\":\"" + profile.style + "\",\"style_reuses_exact_base_object\":" + profile.reusesBaseObject + "}";
    }
    private static String reportJson(String status, List<Profile> result, Budget budget, boolean rendered) {
        if (result.size() != 8 || result.get(0).tree != result.get(4).tree || result.get(0).tree != result.get(5).tree)
            throw new AssertionError("base style variants must reuse exactly one retained tree");
        StringBuilder profiles = new StringBuilder("[");
        for (int index = 0; index < result.size(); index++) { if (index > 0) profiles.append(','); profiles.append(profileJson(result.get(index))); }
        profiles.append(']');
        return "{\"status\":\"" + status + "\",\"profiles\":" + profiles + ",\"profile_count\":8,\"whole_generated_segments\":"
                + budget.generated + ",\"whole_segment_budget\":" + WHOLE_SEGMENT_LIMIT
                + ",\"private_rng\":\"java.util.Random; fresh seed42 per single-root profile and seed42+placement ordinal per transfer root; no source/portable compatibility claim\""
                + ",\"transfer_length\":\"placement radius multiplied by 1.0 (private comparison choice)\""
                + ",\"rendered\":" + rendered + "}";
    }
    private static String inspectJson() {
        Budget budget = new Budget();
        return reportJson("passed", profiles(budget), budget, false);
    }

    public void settings() { size(WIDTH, HEIGHT, JAVA2D); pixelDensity(1); }
    public void setup() { noLoop(); }
    public void draw() {
        try {
            Budget budget = new Budget();
            List<Profile> result = profiles(budget);
            for (Profile profile : result) {
                Path target = renderDirectory.resolve(profile.id + ".png");
                if (Files.exists(target)) throw new IllegalStateException("refusing to overwrite existing image " + target);
                background(250, 242, 224);
                drawProfile(profile);
                save(target.toString());
            }
            System.out.println(reportJson("rendered", result, budget, true));
        } finally { exit(); }
    }
    private void drawProfile(Profile profile) {
        for (Segment segment : profile.tree.segments) {
            if ("generation-colours".equals(profile.style)) stroke(40 + segment.generation * 22, 82, 90, 180);
            else stroke(24, 61, 55, 170);
            if ("tapered-lines-terminal-dots".equals(profile.style)) {
                double length = Math.hypot(segment.endX - segment.startX, segment.endY - segment.startY);
                strokeWeight((float) Math.max(0.5, length * 0.035));
            }
            else strokeWeight(1.2f);
            line((float) segment.startX, (float) segment.startY, (float) segment.endX, (float) segment.endY);
            if ("tapered-lines-terminal-dots".equals(profile.style) && segment.childCount == 0) {
                noStroke(); fill(229, 119, 86, 180); ellipse((float) segment.endX, (float) segment.endY, 3.0f, 3.0f);
            }
        }
    }
    public static void main(String[] args) {
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            public void uncaughtException(Thread thread, Throwable error) {
                error.printStackTrace(System.err);
                System.exit(1);
            }
        });
        try {
            if (args.length == 1 && "--inspect".equals(args[0])) { System.out.println(inspectJson()); return; }
            if (args.length == 2 && "--render".equals(args[0])) {
                Path directory = Paths.get(args[1]);
                if (!directory.isAbsolute()) throw new IllegalArgumentException("--render requires an absolute output directory");
                Files.createDirectories(directory);
                renderDirectory = directory;
                PApplet.main(BranchChoices.class.getName());
                return;
            }
            throw new IllegalArgumentException("usage: BranchChoices --inspect | --render ABSOLUTE_OUTPUT_DIRECTORY");
        } catch (Throwable error) {
            error.printStackTrace(System.err);
            System.exit(1);
        }
    }
}
