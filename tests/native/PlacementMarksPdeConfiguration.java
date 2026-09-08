import org.procedurals.examples.placementmarks.PlacementComposition;
import org.procedurals.sampling.CirclePlacements2D;
import java.io.File;

/** Compile-only/core configuration guard for the actual official-preprocessed PDE. */
public final class PlacementMarksPdeConfiguration {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private static void exact(double actual, double expected, String message) {
        require(Double.doubleToRawLongBits(actual) == Double.doubleToRawLongBits(expected), message);
    }
    private static CirclePlacements2D seeded(long seed, int attempts, double minimum, double maximum, double separation) {
        return PlacementComposition.seeded(seed, attempts, minimum, maximum, separation).placements();
    }
    public static void main(String[] args) {
        require(args.length <= 1, "optional installed JAR argument only");
        if (args.length == 1) {
            String actual = CirclePlacements2D.class.getProtectionDomain().getCodeSource().getLocation().toString();
            try {
                String expected = new File(args[0]).getCanonicalFile().toURI().toURL().toString();
                require(actual.equals(expected), "CirclePlacements2D did not resolve from installed JAR: " + actual);
            } catch (java.io.IOException failure) {
                throw new RuntimeException(failure);
            }
        }
        PlacementMarks sketch = new PlacementMarks();
        require(sketch.SEED == 42L && sketch.ATTEMPTS == 5000, "PDE seeded defaults");
        exact(sketch.MINIMUM, 4.0d, "PDE minimum literal");
        exact(sketch.MAXIMUM, 64.0d, "PDE maximum literal");
        exact(sketch.SEPARATION, 1.0d, "PDE separation literal");
        require(seeded(42L, 5000, 4.0d, 64.0d, 1.0d).size() == 424, "baseline count");
        require(seeded(42L, 5000, 4.0d, 64.0d, 1.2d).size() == 353, "separation count");
        require(seeded(42L, 5000, 8.0d, 64.0d, 1.0d).size() == 239, "minimum count");
        require(seeded(42L, 5000, 4.0d, 32.0d, 1.0d).size() == 613, "maximum count");
        CirclePlacements2D base = seeded(42L, 5000, 4.0d, 64.0d, 1.0d);
        CirclePlacements2D extended = seeded(42L, 10000, 4.0d, 64.0d, 1.0d);
        require(extended.size() == 517, "budget count");
        for (int i = 0; i < base.size(); i++) {
            double[] left = base.pointAt(i), right = extended.pointAt(i);
            exact(left[0], right[0], "budget prefix x " + i);
            exact(left[1], right[1], "budget prefix y " + i);
            exact(base.radiusAt(i), extended.radiusAt(i), "budget prefix radius " + i);
            require(base.sourceIndexAt(i) == extended.sourceIndexAt(i), "budget prefix index " + i);
        }
        require(PlacementComposition.radial(1.0d).placements().size() == 111, "radial count");
    }
}
