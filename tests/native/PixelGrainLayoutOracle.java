import java.util.Random;

public final class PixelGrainLayoutOracle {
  private static void appendCase(StringBuilder output, long seed) {
    Random random = new Random(seed);
    int draws = 0;
    StringBuilder points = new StringBuilder();
    boolean first = true;
    for (int row = 0; row < 24; row++) {
      for (int column = 0; column < 7; column++) {
        for (int y = 0; y < 2; y++) {
          for (int x = 0; x < 8; x++) {
            float value;
            do {
              value = random.nextFloat() * 100.0f;
              draws++;
            } while (value == 100.0f);
            if (value < 30.0f) continue;
            if (!first) points.append(',');
            first = false;
            points.append('[')
                .append(30 + column * 80 + x * 9)
                .append(',')
                .append(40 + row * 30 + y * 9)
                .append(']');
          }
        }
      }
    }
    output.append("{\"seed\":").append(seed)
        .append(",\"points\":[").append(points)
        .append("],\"consumedDraws\":").append(draws)
        .append('}');
  }

  public static void main(String[] args) {
    StringBuilder output = new StringBuilder("{\"cases\":[");
    appendCase(output, 42L);
    output.append(',');
    appendCase(output, 0L);
    output.append("]}");
    System.out.println(output);
  }
}
