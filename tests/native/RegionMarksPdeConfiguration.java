import java.io.File;
import org.procedurals.examples.regionmarks.RegionComposition;
import org.procedurals.layout.QuadrantPartition2D;

/** Compile-only/core configuration guard for the official-preprocessed RegionMarks PDE. */
public final class RegionMarksPdeConfiguration {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void exact(double actual, double expected, String message) {
        require(Double.doubleToRawLongBits(actual) == Double.doubleToRawLongBits(expected), message);
    }
    private static boolean sameGeometry(RegionComposition left, RegionComposition right) {
        if (left.size() != right.size()) return false;
        double[] a = new double[4], b = new double[4];
        for (int index = 0; index < left.size(); index++) {
            left.boundsInto(index, a);
            right.boundsInto(index, b);
            if (left.idAt(index) != right.idAt(index)) return false;
            for (int coordinate = 0; coordinate < 4; coordinate++)
                if (Double.doubleToRawLongBits(a[coordinate]) != Double.doubleToRawLongBits(b[coordinate])) return false;
        }
        return true;
    }
    private static void requireGridMarksInside(RegionComposition composition) {
        double[] bounds = new double[4], point = new double[2];
        for (int cell = 0; cell < composition.size(); cell++) {
            composition.boundsInto(cell, bounds);
            for (int mark = 0; mark < 9; mark++) {
                composition.markInto(mark, bounds, point);
                require(bounds[0] < point[0] && point[0] < bounds[2]
                        && bounds[1] < point[1] && point[1] < bounds[3], "mark outside cell " + cell + "/" + mark);
            }
        }
    }
    public static void main(String[] args) {
        require(args.length <= 1, "optional installed JAR argument only");
        if (args.length == 1) {
            String actual = QuadrantPartition2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
            try {
                String expected = new File(args[0]).getCanonicalFile().toURI().toURL().toString();
                require(actual.equals(expected), "QuadrantPartition2D did not resolve from installed JAR: " + actual);
            } catch (java.io.IOException failure) {
                throw new RuntimeException(failure);
            }
        }
        RegionMarks sketch = new RegionMarks();
        require(sketch.SEED == 42L && sketch.REPLACEMENTS == 100, "PDE seeded defaults");
        exact(sketch.FRACTION, 0.5d, "PDE fraction literal");
        require(!sketch.GRID_MARKS && !sketch.ALTERNATE && !sketch.AUTHORED, "PDE style defaults");
        RegionComposition base = RegionComposition.seeded(42L, 100, 0.5d);
        RegionComposition replay = RegionComposition.seeded(42L, 100, 0.5d);
        RegionComposition count = RegionComposition.seeded(42L, 200, 0.5d);
        RegionComposition full = RegionComposition.seeded(42L, 100, 1.0d);
        RegionComposition seed = RegionComposition.seeded(43L, 100, 0.5d);
        RegionComposition authored = RegionComposition.authored();
        require(base.size() == 301 && count.size() == 601 && full.size() == 301 && seed.size() == 301,
                "seeded retained counts");
        require(sameGeometry(base, replay), "identical seeded replay geometry");
        require(!sameGeometry(base, full), "full selection changes geometry");
        require(!sameGeometry(base, seed), "seed changes geometry");
        require(authored.size() == 11, "two explicit 2x3 authored actions retain eleven cells");
        requireGridMarksInside(base);
        requireGridMarksInside(authored);
    }
}
