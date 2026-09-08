package org.procedurals.examples.branchmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.sampling.CirclePlacements2D;
import org.procedurals.topology.BranchTree2D;

/**
 * Editable endpoint-branch composition motivated by
 * survey/out/2018/Generativos/arbolito3/notes.md and arbolito4/notes.md.
 * Root placement, rule schedules, palette and marks are example choices. This is
 * independently composed with public operations, not Processing source-stream replay.
 */
public strictfp final class BranchComposition {
    private final List<BranchTree2D> trees;
    private final int total;

    private BranchComposition(List<BranchTree2D> trees, int total) {
        this.trees = trees;
        this.total = total;
    }

    /** Build a single tree or use CP3 circles as explicit forest root poses and sizes.
     * No example setting is a library default or a measured encouraged range.
     */
    public static BranchComposition create(long seed, boolean moreGenerations,
            boolean narrowing, boolean binary, boolean wider, boolean forest) {
        if (seed < 0 || seed > 0xffffffffL)
            throw new IllegalArgumentException("example seed must be uint32");
        int transitions = (forest ? 5 : 7) + (moreGenerations ? 1 : 0);
        int slots = binary ? 2 : 3;
        int perTreeBound = 1, generationBound = 1;
        for (int generation = 0; generation < transitions; generation++) {
            generationBound *= slots;
            perTreeBound += generationBound;
        }
        // Fixed example choices bound even all-success expansion before generating trees.
        int maximumRoots = forest ? 10 : 1;
        if (perTreeBound * maximumRoots > 20000)
            throw new IllegalArgumentException("example exceeds 20000-segment work budget");

        List<Object> rules = rules(transitions, narrowing, binary, wider);
        List<BranchTree2D> trees = new ArrayList<BranchTree2D>();
        int total = 0;
        if (forest) {
            CirclePlacements2D roots = CirclePlacements2D.seeded(record(
                "seed", seed, "attempts", maximumRoots,
                "origin", pair(70, 220), "extent", pair(500, 320),
                "radiusRange", pair(30, 50), "separationScale", 1.0d));
            double[] origin = new double[2];
            for (int i = 0; i < roots.size(); i++) {
                roots.pointInto(i, origin, 0);
                // Circle exclusion reserves root space; it does not separate canopies.
                BranchTree2D tree = generate((seed + i) & 0xffffffffL, origin[0], origin[1],
                    roots.radiusAt(i), rules, perTreeBound);
                trees.add(tree);
                total += tree.size();
            }
        } else {
            BranchTree2D tree = generate(seed, 320, 590, 100, rules, perTreeBound);
            trees.add(tree);
            total = tree.size();
        }
        return new BranchComposition(trees, total);
    }

    private static BranchTree2D generate(long seed, double x, double y, double length,
            List<Object> rules, int maximum) {
        return BranchTree2D.generate(record("seed", seed,
            "root", record("origin", pair(x, y), "heading", -Math.PI / 2.0d, "length", length),
            "rules", rules, "maxSegments", maximum));
    }

    private static List<Object> rules(int transitions, boolean narrowing, boolean binary, boolean wider) {
        List<Object> rules = new ArrayList<Object>();
        for (int generation = 0; generation < transitions; generation++) {
            double spread = binary ? (wider ? 0.18d : 0.09d) : (wider ? 0.9d : 0.5d);
            // Depend on the absolute generation, never on transitions: appending a rule
            // must leave existing rules unchanged for the geometry-prefix guarantee.
            if (narrowing) spread *= 1.0d - 0.08d * generation;
            List<Object> slots = new ArrayList<Object>();
            double chance = binary ? 0.8d : 0.7d;
            slots.add(record("probability", chance, "turn", pair(-spread, -0.5d * spread)));
            slots.add(record("probability", chance, "turn", pair(0.5d * spread, spread)));
            if (!binary)
                slots.add(record("probability", 0.4d, "turn", pair(-0.2d * spread, 0.2d * spread)));
            rules.add(record("lengthScale", pair(0.65d, 0.85d), "slots", slots));
        }
        return rules;
    }

    public int size() { return trees.size(); }
    public int totalSegments() { return total; }
    public BranchTree2D treeAt(int index) { return trees.get(index); }

    private static List<Double> pair(double x, double y) { return Arrays.asList(x, y); }
    private static Map<String, Object> record(Object... fields) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < fields.length; i += 2) result.put((String) fields[i], fields[i + 1]);
        return result;
    }
}
