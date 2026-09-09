import java.io.BufferedReader;
import java.io.InputStreamReader;

/** Reads pairs of raw binary64 words and emits StrictMath.pow raw result words. */
public final class FdlibmPowOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            if (line.isEmpty()) continue;
            String[] words = line.split(" ");
            double x = Double.longBitsToDouble(Long.parseUnsignedLong(words[0], 16));
            double y = Double.longBitsToDouble(Long.parseUnsignedLong(words[1], 16));
            System.out.printf("%016x%n", Double.doubleToRawLongBits(StrictMath.pow(x, y)));
        }
    }
}
