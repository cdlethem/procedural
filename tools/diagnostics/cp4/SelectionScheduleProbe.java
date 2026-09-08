import java.util.ArrayList;
import java.util.Map;
import java.util.TreeMap;
import processing.core.PApplet;

/**
 * Headless Processing-core probe for the mosaic02 scheduler diagnostic.
 *
 * <p>This intentionally uses PApplet.randomSeed/random, while retaining only integer
 * leaf depths. It neither initializes a renderer nor opens a Processing session.</p>
 */
public final class SelectionScheduleProbe {
  private static final int[] SEEDS = {0, 1, 42, 123456, 999998};
  private static final float[] FRACTIONS = {0.5f, 1.0f};
  private static final int SPLIT_COUNT = 100;

  private SelectionScheduleProbe() {}

  private static String indices(ArrayList<Integer> values) {
    StringBuilder output = new StringBuilder();
    for (int index = 0; index < values.size(); index++) {
      if (index > 0) output.append(',');
      output.append(values.get(index));
    }
    return output.toString();
  }

  private static String histogram(ArrayList<Integer> leaves) {
    TreeMap<Integer, Integer> counts = new TreeMap<Integer, Integer>();
    for (int depth : leaves) {
      Integer count = counts.get(depth);
      counts.put(depth, count == null ? 1 : count + 1);
    }
    StringBuilder output = new StringBuilder();
    boolean first = true;
    for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
      if (!first) output.append(',');
      output.append(entry.getKey()).append(':').append(entry.getValue());
      first = false;
    }
    return output.toString();
  }

  private static void runCase(int seed, float fraction) {
    PApplet applet = new PApplet();
    applet.randomSeed(seed);
    // This is the source's background(rcol()) prelude: colors.length is four.
    int backgroundPaletteIndex = (int) applet.random(4.0f);
    ArrayList<Integer> leaves = new ArrayList<Integer>();
    ArrayList<Integer> selected = new ArrayList<Integer>();
    leaves.add(0);
    for (int split = 0; split < SPLIT_COUNT; split++) {
      int index = (int) applet.random(leaves.size() * fraction);
      if (index < 0 || index >= leaves.size()) {
        throw new AssertionError("selection outside live leaves: " + index);
      }
      selected.add(index);
      int parentDepth = leaves.get(index);
      // The depth-only form preserves equal quadrant area and the source's append order.
      leaves.add(parentDepth + 1);
      leaves.add(parentDepth + 1);
      leaves.add(parentDepth + 1);
      leaves.add(parentDepth + 1);
      leaves.remove(index);
    }
    if (leaves.size() != 1 + 3 * SPLIT_COUNT) {
      throw new AssertionError("unexpected retained leaf count: " + leaves.size());
    }
    System.out.println(
        seed
            + "\t"
            + Float.toString(fraction)
            + "\t"
            + backgroundPaletteIndex
            + "\t"
            + indices(selected)
            + "\t"
            + histogram(leaves));
  }

  public static void main(String[] args) {
    if (args.length != 0) {
      throw new IllegalArgumentException("no arguments; cases are bound to the CP4 numeric report");
    }
    for (int seed : SEEDS) {
      for (float fraction : FRACTIONS) {
        runCase(seed, fraction);
      }
    }
  }
}
