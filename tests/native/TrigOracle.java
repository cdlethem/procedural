import java.io.BufferedReader;
import java.io.InputStreamReader;

/** Runtime oracle only; no copied JDK implementation. Input/output are raw binary64 hex. */
public final class TrigOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        for (String line; (line = reader.readLine()) != null;) {
            String[] words = line.trim().split(" +");
            if (words.length != 2) throw new IllegalArgumentException("two bit patterns required");
            double x = Double.longBitsToDouble(Long.parseUnsignedLong(words[0], 16));
            double y = Double.longBitsToDouble(Long.parseUnsignedLong(words[1], 16));
            if (!Double.isFinite(x) || !Double.isFinite(y)) throw new IllegalArgumentException("finite inputs required");
            System.out.printf("%016x %016x %016x %016x%n", Double.doubleToRawLongBits(StrictMath.sin(x)), Double.doubleToRawLongBits(StrictMath.cos(x)), Double.doubleToRawLongBits(StrictMath.atan(x)), Double.doubleToRawLongBits(StrictMath.atan2(x, y)));
        }
    }
}
