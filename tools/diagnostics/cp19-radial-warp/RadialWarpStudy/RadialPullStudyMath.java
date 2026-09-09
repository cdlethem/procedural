/** Private CP19 radial-pull arithmetic, independently authored from the study brief. */
final class RadialPullStudyMath {
  static final double[][] CENTERS = {{200.0, 240.0}, {350.0, 320.0}};

  static double[] warp(double x, double y, double radius, double power) {
    return warp(x, y, radius, power, CENTERS);
  }

  static double[] warp(double x, double y, double radius, double power,
      double[][] centers) {
    double warpedX = x;
    double warpedY = y;
    for (double[] center : centers) {
      double dx = center[0] - x;
      double dy = center[1] - y;
      double distance = Math.hypot(dx, dy);
      if (distance == 0.0 || distance >= radius || radius == 0.0) {
        continue;
      }
      double amount = radius * (1.0 - Math.pow(distance / radius, power));
      warpedX += (dx / distance) * amount;
      warpedY += (dy / distance) * amount;
    }
    return new double[] {warpedX, warpedY};
  }

  static double[] sequential(double x, double y, double radius, double power,
      double[][] centers) {
    double warpedX = x;
    double warpedY = y;
    for (double[] center : centers) {
      double[] next = warp(warpedX, warpedY, radius, power,
          new double[][] {center});
      warpedX = next[0];
      warpedY = next[1];
    }
    return new double[] {warpedX, warpedY};
  }

  static void assertions() {
    double[][] oneCenter = {{200.0, 240.0}};
    check(equalPoint(warp(20.0, 20.0, 1.0, 2.0, oneCenter), 20.0, 20.0),
        "empty influence identity");
    check(equalPoint(warp(200.0, 240.0, 120.0, 2.0, oneCenter), 200.0, 240.0),
        "exact center zero");
    check(equalPoint(warp(80.0, 240.0, 120.0, 2.0, oneCenter), 80.0, 240.0),
        "exact radius identity");
    double[] cardinal = warp(260.0, 240.0, 120.0, 2.0, oneCenter);
    check(cardinal[0] == 170.0 && cardinal[1] == 240.0,
        "cardinal pull points toward center");

    double[][] overlapCenters = {{0.0, 0.0}, {10.0, 0.0}};
    double[] summed = warp(5.0, 0.0, 10.0, 2.0, overlapCenters);
    double[] sequentialResult = sequential(5.0, 0.0, 10.0, 2.0, overlapCenters);
    check(equalPoint(summed, 5.0, 0.0), "summed overlap");
    check(equalPoint(sequentialResult, -2.5, 0.0), "sequential contrast");
  }

  public static void main(String[] args) {
    assertions();
    System.out.println("CP19 radial pull assertions passed");
  }

  static boolean equalPoint(double[] point, double x, double y) {
    return point[0] == x && point[1] == y;
  }

  static void check(boolean condition, String message) {
    if (!condition) {
      throw new AssertionError(message);
    }
  }
}
