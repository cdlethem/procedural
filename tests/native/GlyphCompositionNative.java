import org.procedurals.examples.glyphmarks.GlyphComposition;
import org.procedurals.paths.GradientPath2D;

/**
 * Pure no-render checks for the editable GlyphMarks helper.
 * PDE checks, rather than this helper check, establish stamp prefix and stride behavior.
 */
public final class GlyphCompositionNative {
    private static int checks;

    private static void require(boolean value, String message) {
        checks++;
        if (!value) {
            throw new AssertionError(message);
        }
    }

    private static void raw(double actual, double expected, String message) {
        require(Double.doubleToRawLongBits(actual) == Double.doubleToRawLongBits(expected), message);
    }

    private static void invalid(long seed, double distance, double scale) {
        try {
            GlyphComposition.create(seed, distance, scale);
            throw new AssertionError("expected invalid input");
        } catch (IllegalArgumentException expected) {
            checks++;
        }
    }

    private static void attributes(GlyphComposition first, GlyphComposition second) {
        require(first.pathCount() == 48 && second.pathCount() == 48, "path count");
        for (int index = 0; index < 48; index++) {
            raw(first.sizeAt(index), second.sizeAt(index), "size replay");
            require(first.symbolIndexAt(index) == second.symbolIndexAt(index), "symbol replay");
            double[] firstStart = first.pathAt(index).pointAt(0L);
            double[] secondStart = second.pathAt(index).pointAt(0L);
            raw(firstStart[0], secondStart[0], "start x replay");
            raw(firstStart[1], secondStart[1], "start y replay");
        }
    }

    private static void literalMetadata(
            GlyphComposition composition,
            int index,
            double x,
            double y,
            double size,
            int symbol) {
        double[] start = composition.pathAt(index).pointAt(0L);
        raw(start[0], x, "literal start x");
        raw(start[1], y, "literal start y");
        raw(composition.sizeAt(index), size, "literal size");
        require(composition.symbolIndexAt(index) == symbol, "literal symbol");
    }

    private static void reusablePointIntoTraversal(GlyphComposition composition, int pathIndex) {
        GradientPath2D path = composition.pathAt(pathIndex);
        double[] reusable = new double[2];
        for (int step = 0; step <= path.steps(); step++) {
            path.pointInto(step, reusable, 0);
            double[] owned = path.pointAt(step);
            raw(reusable[0], owned[0], "pointInto x");
            raw(reusable[1], owned[1], "pointInto y");
        }
    }

    public static void main(String[] args) {
        invalid(-1L, .75, .006);
        invalid(4294967296L, .75, .006);
        invalid(42L, 0.0, .006);
        invalid(42L, .75, Double.NaN);

        GlyphComposition baseline = GlyphComposition.create(42L, .75, .006);
        GlyphComposition replay = GlyphComposition.create(42L, .75, .006);
        attributes(baseline, replay);

        // Independently recorded Java Random(42L) x, y, size, symbol schedule anchors.
        literalMetadata(baseline, 0, 370.0, 563.0, 16.0, 4);
        literalMetadata(baseline, 47, 372.0, 451.0, 30.0, 3);

        for (int pathIndex = 0; pathIndex < 48; pathIndex++) {
            GradientPath2D baselinePath = baseline.pathAt(pathIndex);
            GradientPath2D replayPath = replay.pathAt(pathIndex);
            require(baselinePath.steps() == 160, "baseline total steps");
            require(replayPath.steps() == 160, "replay total steps");
            for (int step = 0; step <= 160; step++) {
                double[] baselinePoint = baselinePath.pointAt(step);
                double[] replayPoint = replayPath.pointAt(step);
                raw(baselinePoint[0], replayPoint[0], "path replay x");
                raw(baselinePoint[1], replayPoint[1], "path replay y");
            }
        }
        reusablePointIntoTraversal(baseline, 0);
        reusablePointIntoTraversal(baseline, 47);

        GlyphComposition changedDistance = GlyphComposition.create(42L, 2.0, .006);
        GlyphComposition changedScale = GlyphComposition.create(42L, .75, .03);
        attributes(baseline, changedDistance);
        attributes(baseline, changedScale);

        boolean distanceChanged = false;
        boolean scaleChanged = false;
        for (int pathIndex = 0; pathIndex < 48; pathIndex++) {
            double[] baseEnd = baseline.pathAt(pathIndex).pointAt(160L);
            double[] distanceEnd = changedDistance.pathAt(pathIndex).pointAt(160L);
            double[] scaleEnd = changedScale.pathAt(pathIndex).pointAt(160L);
            distanceChanged |= Double.doubleToRawLongBits(baseEnd[0])
                    != Double.doubleToRawLongBits(distanceEnd[0])
                    || Double.doubleToRawLongBits(baseEnd[1])
                    != Double.doubleToRawLongBits(distanceEnd[1]);
            scaleChanged |= Double.doubleToRawLongBits(baseEnd[0])
                    != Double.doubleToRawLongBits(scaleEnd[0])
                    || Double.doubleToRawLongBits(baseEnd[1])
                    != Double.doubleToRawLongBits(scaleEnd[1]);
        }
        require(distanceChanged, "distance changes geometry");
        require(scaleChanged, "scale changes geometry");

        GlyphComposition changedSeed = GlyphComposition.create(43L, .75, .006);
        boolean seedChangedMetadata = false;
        for (int pathIndex = 0; pathIndex < 48; pathIndex++) {
            double[] baselineStart = baseline.pathAt(pathIndex).pointAt(0L);
            double[] changedStart = changedSeed.pathAt(pathIndex).pointAt(0L);
            seedChangedMetadata |= Double.doubleToRawLongBits(baselineStart[0])
                    != Double.doubleToRawLongBits(changedStart[0])
                    || Double.doubleToRawLongBits(baselineStart[1])
                    != Double.doubleToRawLongBits(changedStart[1])
                    || Double.doubleToRawLongBits(baseline.sizeAt(pathIndex))
                    != Double.doubleToRawLongBits(changedSeed.sizeAt(pathIndex))
                    || baseline.symbolIndexAt(pathIndex) != changedSeed.symbolIndexAt(pathIndex);
        }
        require(seedChangedMetadata, "seed changes retained metadata");

        System.out.println(
                "{\"status\":\"passed\",\"checks\":" + checks
                        + ",\"paths\":48,\"steps_per_path\":160"
                        + ",\"retained_points_per_path\":161}");
    }
}
