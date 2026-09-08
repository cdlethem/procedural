package org.procedurals.diagnostics.cp6;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Random;

/**
 * Private, breadth-first CP6 growth-order comparison. This does not implement a public
 * operation, Processing adapter, upstream stream, or renderer.
 */
public final class BranchGrowthPrefix {
    private static final long SEED = 42L;
    private static final int LIMIT = 10000;
    private static final double ROOT_X = 320.0;
    private static final double ROOT_Y = 590.0;
    private static final double ROOT_HEADING = -Math.PI / 2.0;
    private static final double ROOT_LENGTH = 100.0;
    private static final double[] BASE_CHANCES = {0.7, 0.7, 0.4};

    private static final class Segment {
        final double startX, startY, endX, endY, heading, length;
        final int parentIndex, generation;
        int childCount;
        Segment(double startX, double startY, double heading, double length, int parentIndex, int generation) {
            this.startX = startX; this.startY = startY; this.heading = heading; this.length = length;
            this.endX = startX + Math.cos(heading) * length;
            this.endY = startY + Math.sin(heading) * length;
            this.parentIndex = parentIndex; this.generation = generation;
        }
    }

    private static final class Tree {
        final String id;
        final ArrayList<Segment> segments = new ArrayList<Segment>();
        final int transitionCount;
        int randomDraws;
        Tree(String id, int transitionCount) { this.id = id; this.transitionCount = transitionCount; }
    }

    private static final class Budget {
        int totalNodes;
        void reserve() {
            if (totalNodes >= LIMIT) throw new LimitExceeded();
            totalNodes++;
        }
    }
    private static final class LimitExceeded extends IllegalStateException {
        LimitExceeded() { super("private node budget exceeded before append"); }
    }

    private static float unit(Random random, Tree tree) { tree.randomDraws++; return random.nextFloat(); }

    private static double childAngle(int slot, double heading, double spread, Random random, Tree tree) {
        double u = unit(random, tree);
        if (slot == 0) return heading - spread + u * (0.5 * spread);
        if (slot == 1) return heading + 0.5 * spread + u * (0.5 * spread);
        return heading - 0.2 * spread + u * (0.4 * spread);
    }

    /**
     * Appends roots then visits retained parents in increasing index order. A parent can
     * transition exactly when its generation indexes a table row. Terminal nodes consume
     * no random values. Child geometry is appended immediately in fixed slot order, but
     * those children are not themselves expanded until their earlier retained peers have
     * been visited.
     */
    private static Tree grow(String id, double[] transitionSpreads, Budget budget) {
        Tree tree = new Tree(id, transitionSpreads.length);
        Random random = new Random(SEED);
        budget.reserve();
        tree.segments.add(new Segment(ROOT_X, ROOT_Y, ROOT_HEADING, ROOT_LENGTH, -1, 0));
        for (int parentIndex = 0; parentIndex < tree.segments.size(); parentIndex++) {
            Segment parent = tree.segments.get(parentIndex);
            if (parent.generation >= transitionSpreads.length) continue;
            double childLength = parent.length * (0.65 + unit(random, tree) * 0.20);
            double spread = transitionSpreads[parent.generation];
            for (int slot = 0; slot < BASE_CHANCES.length; slot++) {
                if (unit(random, tree) < BASE_CHANCES[slot]) {
                    budget.reserve();
                    parent.childCount++;
                    tree.segments.add(new Segment(parent.endX, parent.endY,
                            childAngle(slot, parent.heading, spread, random, tree),
                            childLength, parentIndex, parent.generation + 1));
                }
            }
        }
        return tree;
    }

    private static double[] spreads(int length, double last) {
        double[] value = new double[length];
        for (int index = 0; index < length; index++) value[index] = index == length - 1 ? last : 0.5;
        return value;
    }

    private static boolean sameGeometry(Segment left, Segment right) {
        return Double.doubleToRawLongBits(left.startX) == Double.doubleToRawLongBits(right.startX)
                && Double.doubleToRawLongBits(left.startY) == Double.doubleToRawLongBits(right.startY)
                && Double.doubleToRawLongBits(left.endX) == Double.doubleToRawLongBits(right.endX)
                && Double.doubleToRawLongBits(left.endY) == Double.doubleToRawLongBits(right.endY)
                && Double.doubleToRawLongBits(left.heading) == Double.doubleToRawLongBits(right.heading)
                && Double.doubleToRawLongBits(left.length) == Double.doubleToRawLongBits(right.length)
                && left.parentIndex == right.parentIndex && left.generation == right.generation;
    }

    private static boolean rawPrefix(Tree prefix, Tree extended) {
        if (prefix.segments.size() > extended.segments.size()) return false;
        for (int index = 0; index < prefix.segments.size(); index++)
            if (!sameGeometry(prefix.segments.get(index), extended.segments.get(index))) return false;
        return true;
    }

    private static boolean rawThroughGeneration(Tree first, Tree second, int generation) {
        if (first.segments.size() != second.segments.size()) return false;
        for (int index = 0; index < first.segments.size(); index++) {
            Segment left = first.segments.get(index), right = second.segments.get(index);
            if (left.generation <= generation && !sameGeometry(left, right)) return false;
        }
        return true;
    }

    private static boolean changesAtGeneration(Tree first, Tree second, int generation) {
        if (first.segments.size() != second.segments.size()) return false;
        for (int index = 0; index < first.segments.size(); index++) {
            Segment left = first.segments.get(index), right = second.segments.get(index);
            if (left.generation == generation && !sameGeometry(left, right)) return true;
        }
        return false;
    }

    private static int childCountChanges(Tree before, Tree after) {
        int changes = 0;
        for (int index = 0; index < before.segments.size(); index++)
            if (before.segments.get(index).childCount != after.segments.get(index).childCount) changes++;
        return changes;
    }

    private static int oldTerminalsExpanded(Tree before, Tree after) {
        int count = 0;
        for (int index = 0; index < before.segments.size(); index++)
            if (before.segments.get(index).childCount == 0 && after.segments.get(index).childCount > 0) count++;
        return count;
    }

    private static int earlyTerminalCount(Tree tree) {
        int count = 0;
        for (Segment segment : tree.segments)
            if (segment.childCount == 0 && segment.generation < tree.transitionCount) count++;
        return count;
    }

    private static boolean validTopology(Tree tree) {
        int roots = 0;
        int[] direct = new int[tree.segments.size()];
        for (int index = 0; index < tree.segments.size(); index++) {
            Segment segment = tree.segments.get(index);
            if (!Double.isFinite(segment.startX) || !Double.isFinite(segment.startY)
                    || !Double.isFinite(segment.endX) || !Double.isFinite(segment.endY)) return false;
            if (segment.parentIndex == -1) { if (segment.generation != 0) return false; roots++; }
            else {
                if (segment.parentIndex < 0 || segment.parentIndex >= index) return false;
                Segment parent = tree.segments.get(segment.parentIndex);
                if (segment.generation != parent.generation + 1
                        || Double.doubleToRawLongBits(segment.startX) != Double.doubleToRawLongBits(parent.endX)
                        || Double.doubleToRawLongBits(segment.startY) != Double.doubleToRawLongBits(parent.endY)) return false;
                direct[segment.parentIndex]++;
            }
        }
        if (roots != 1) return false;
        for (int index = 0; index < direct.length; index++)
            if (tree.segments.get(index).childCount != direct[index]) return false;
        return true;
    }

    private static void digestLong(MessageDigest digest, long value) {
        for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
    }
    private static String hash(Tree tree, boolean includeChildren) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Segment s : tree.segments) {
                digestLong(digest, Double.doubleToRawLongBits(s.startX)); digestLong(digest, Double.doubleToRawLongBits(s.startY));
                digestLong(digest, Double.doubleToRawLongBits(s.endX)); digestLong(digest, Double.doubleToRawLongBits(s.endY));
                digestLong(digest, Double.doubleToRawLongBits(s.heading)); digestLong(digest, Double.doubleToRawLongBits(s.length));
                digestLong(digest, s.parentIndex); digestLong(digest, s.generation);
                if (includeChildren) digestLong(digest, s.childCount);
            }
            StringBuilder hex = new StringBuilder(64);
            for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) { throw new AssertionError(impossible); }
    }

    private static String summary(Tree tree) {
        return "{\"id\":\"" + tree.id + "\",\"transition_table_length\":" + tree.transitionCount
                + ",\"emitted_generations\":" + (tree.transitionCount + 1) + ",\"node_count\":" + tree.segments.size()
                + ",\"geometry_sha256\":\"" + hash(tree, false) + "\",\"topology_sha256\":\"" + hash(tree, true)
                + "\",\"random_draws\":" + tree.randomDraws + ",\"early_terminal_count\":" + earlyTerminalCount(tree) + "}";
    }

    private static String report() {
        Budget budget = new Budget();
        Tree length5 = grow("table-5", spreads(5, 0.5), budget);
        Tree length7 = grow("table-7", spreads(7, 0.5), budget);
        Tree length8 = grow("table-8", spreads(8, 0.5), budget);
        Tree laterSpread = grow("table-8-later-spread-0.9", spreads(8, 0.9), budget);
        Tree replay = grow("table-8-replay", spreads(8, 0.5), budget);
        boolean budgetFailure = false;
        Budget failingBudget = new Budget();
        try { grow("must-fail-without-return", spreads(30, 0.5), failingBudget); }
        catch (LimitExceeded expected) { budgetFailure = true; }

        boolean prefix5to7 = rawPrefix(length5, length7);
        boolean prefix7to8 = rawPrefix(length7, length8);
        boolean laterLevelPreservesEarlier = rawThroughGeneration(length8, laterSpread, 7);
        boolean laterLevelChangesGeneration8 = changesAtGeneration(length8, laterSpread, 8);
        boolean replayExact = rawPrefix(length8, replay) && rawPrefix(replay, length8)
                && hash(length8, true).equals(hash(replay, true));
        boolean topology = validTopology(length5) && validTopology(length7) && validTopology(length8)
                && validTopology(laterSpread) && validTopology(replay);
        boolean earlyTerminal = earlyTerminalCount(length8) > 0;
        int changedChildren5to7 = childCountChanges(length5, length7);
        int expandedTerminals5to7 = oldTerminalsExpanded(length5, length7);
        if (!prefix5to7 || !prefix7to8 || !laterLevelPreservesEarlier || !laterLevelChangesGeneration8 || !replayExact || !budgetFailure
                || !topology || !earlyTerminal || changedChildren5to7 <= 0 || expandedTerminals5to7 <= 0
                || budget.totalNodes > LIMIT || failingBudget.totalNodes != LIMIT) throw new AssertionError("growth-prefix preflight failed");
        return "{\"status\":\"passed\",\"scope\":\"private breadth-first branching-order investigation; no public operation, renderer, runtime, or source-compatibility claim\""
                + ",\"private_rng\":\"fresh java.util.Random(42) per comparison tree\",\"node_budget\":" + LIMIT
                + ",\"actual_total_nodes_successful_profiles\":" + budget.totalNodes
                + ",\"failed_budget_test_nodes_before_throw\":" + failingBudget.totalNodes + ",\"profiles\":[" + summary(length5) + "," + summary(length7)
                + "," + summary(length8) + "," + summary(laterSpread) + "," + summary(replay) + "]"
                + ",\"checks\":{\"table5_to_table7_raw_coordinate_parent_generation_prefix\":true"
                + ",\"table7_to_table8_raw_coordinate_parent_generation_prefix\":true"
                + ",\"existing_node_childcounts_change_table5_to_table7\":" + changedChildren5to7
                + ",\"old_terminals_expanded_table5_to_table7\":" + expandedTerminals5to7
                + ",\"later_level_spread_keeps_geometry_through_generation7\":true"
                + ",\"later_level_spread_changes_at_least_one_generation8_coordinate\":true"
                + ",\"deterministic_replay\":true,\"early_terminal_case_present\":true"
                + ",\"node_budget_failure_without_success\":true,\"retained_topology_valid\":true}}";
    }

    public static void main(String[] args) {
        if (args.length == 1 && "--check".equals(args[0])) { System.out.println(report()); return; }
        throw new IllegalArgumentException("usage: BranchGrowthPrefix --check");
    }
}
