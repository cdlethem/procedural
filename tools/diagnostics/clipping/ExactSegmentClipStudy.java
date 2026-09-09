import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Private exact-rational clipping diagnostic. This is deliberately not a public operation:
 * it establishes topology with exact binary64 inputs before converting retained endpoints
 * back to binary64 once.
 */
final class ExactSegmentClipStudy {
  private static final int MAX_VERTICES = 256;
  private static final int MAX_SEGMENTS = 2048;
  private static final RationalStudy TWO = RationalStudy.of(2.0);

  static final class Interval {
    final int sourceIndex;
    final RationalStudy t0;
    final RationalStudy t1;
    final double ax;
    final double ay;
    final double bx;
    final double by;

    Interval(int sourceIndex, RationalStudy t0, RationalStudy t1,
        double ax, double ay, double bx, double by) {
      this.sourceIndex = sourceIndex;
      this.t0 = t0;
      this.t1 = t1;
      this.ax = ax;
      this.ay = ay;
      this.bx = bx;
      this.by = by;
    }
  }

  /** Clips four-coordinate source segments in source order against an implicitly closed polygon. */
  static List<Interval> clip(double[][] polygon, double[][] segments) {
    RationalPoint[] region = checkedPolygon(polygon);
    checkSegments(segments);
    List<Interval> output = new ArrayList<Interval>();
    for (int sourceIndex = 0; sourceIndex < segments.length; sourceIndex++) {
      double[] raw = segments[sourceIndex];
      RationalPoint a = point(raw[0], raw[1]);
      RationalPoint b = point(raw[2], raw[3]);
      RationalPoint direction = subtract(b, a);
      if (same(a, b)) continue;

      List<RationalStudy> cuts = new ArrayList<RationalStudy>();
      cuts.add(RationalStudy.ZERO);
      cuts.add(RationalStudy.ONE);
      for (int edge = 0; edge < region.length; edge++) {
        addEdgeCuts(cuts, a, direction, region[edge], region[(edge + 1) % region.length]);
      }
      Collections.sort(cuts);
      List<RationalStudy> unique = unique(cuts);
      List<RationalStudy[]> retained = new ArrayList<RationalStudy[]>();
      for (int cut = 0; cut + 1 < unique.size(); cut++) {
        RationalStudy lo = unique.get(cut);
        RationalStudy hi = unique.get(cut + 1);
        if (lo.equals(hi)) continue;
        RationalStudy middle = lo.add(hi).divide(TWO);
        if (contains(region, at(a, direction, middle))) {
          if (!retained.isEmpty() && retained.get(retained.size() - 1)[1].equals(lo)) {
            retained.get(retained.size() - 1)[1] = hi;
          } else {
            retained.add(new RationalStudy[] {lo, hi});
          }
        }
      }
      Interval previous = null;
      for (RationalStudy[] interval : retained) {
        Interval rounded = roundInterval(sourceIndex, interval[0], interval[1], a, direction, raw);
        if (previous != null && previous.t1.doubleValue() >= rounded.t0.doubleValue()) {
          throw new IllegalArgumentException("retained exterior gap collapses in binary64 gap representation");
        }
        output.add(rounded);
        previous = rounded;
      }
    }
    return output;
  }

  private static Interval roundInterval(int sourceIndex, RationalStudy t0, RationalStudy t1,
      RationalPoint sourceA, RationalPoint direction, double[] raw) {
    if (t0.doubleValue() >= t1.doubleValue()) {
      throw new IllegalArgumentException("retained exact interval collapses in binary64 parameter representation");
    }
    RationalPoint exactA = at(sourceA, direction, t0);
    RationalPoint exactB = at(sourceA, direction, t1);
    double ax = canonicalZero(t0.equals(RationalStudy.ZERO) ? raw[0] : exactA.x.doubleValue());
    double ay = canonicalZero(t0.equals(RationalStudy.ZERO) ? raw[1] : exactA.y.doubleValue());
    double bx = canonicalZero(t1.equals(RationalStudy.ONE) ? raw[2] : exactB.x.doubleValue());
    double by = canonicalZero(t1.equals(RationalStudy.ONE) ? raw[3] : exactB.y.doubleValue());
    if (ax == bx && ay == by) {
      throw new IllegalArgumentException("retained exact interval collapses in binary64 endpoint representation");
    }
    return new Interval(sourceIndex, t0, t1, ax, ay, bx, by);
  }

  private static RationalPoint[] checkedPolygon(double[][] raw) {
    if (raw == null || raw.length < 3 || raw.length > MAX_VERTICES) {
      throw new IllegalArgumentException("polygon must contain 3.." + MAX_VERTICES + " vertices");
    }
    RationalPoint[] polygon = new RationalPoint[raw.length];
    for (int i = 0; i < raw.length; i++) {
      checkPoint(raw[i], "polygon vertex");
      polygon[i] = point(raw[i][0], raw[i][1]);
    }
    for (int i = 0; i < polygon.length; i++) {
      for (int j = i + 1; j < polygon.length; j++) {
        if (same(polygon[i], polygon[j])) throw new IllegalArgumentException("polygon vertices must be distinct");
      }
    }
    RationalStudy twiceArea = RationalStudy.ZERO;
    for (int i = 0; i < polygon.length; i++) {
      RationalPoint a = polygon[i];
      RationalPoint b = polygon[(i + 1) % polygon.length];
      twiceArea = twiceArea.add(cross(a, b));
      RationalPoint previous = polygon[(i + polygon.length - 1) % polygon.length];
      RationalPoint incoming = subtract(a, previous);
      RationalPoint outgoing = subtract(b, a);
      if (cross(incoming, outgoing).signum() == 0 && dot(incoming, outgoing).signum() <= 0) {
        throw new IllegalArgumentException("polygon has adjacent backtracking or overlap");
      }
    }
    if (twiceArea.signum() == 0) throw new IllegalArgumentException("polygon must have nonzero signed area");
    for (int i = 0; i < polygon.length; i++) {
      for (int j = i + 1; j < polygon.length; j++) {
        if (j == i + 1 || (i == 0 && j == polygon.length - 1)) continue;
        if (meet(polygon[i], polygon[(i + 1) % polygon.length], polygon[j], polygon[(j + 1) % polygon.length])) {
          throw new IllegalArgumentException("polygon has nonadjacent edge contact or crossing");
        }
      }
    }
    return polygon;
  }

  private static void checkSegments(double[][] segments) {
    if (segments == null || segments.length > MAX_SEGMENTS) {
      throw new IllegalArgumentException("segments must contain 0.." + MAX_SEGMENTS + " segments");
    }
    for (double[] segment : segments) {
      if (segment == null || segment.length != 4) {
        throw new IllegalArgumentException("each segment must have exactly four coordinates");
      }
      for (double coordinate : segment) {
        if (!Double.isFinite(coordinate)) throw new IllegalArgumentException("all coordinates must be finite");
      }
    }
  }

  private static void checkPoint(double[] point, String label) {
    if (point == null || point.length != 2 || !Double.isFinite(point[0]) || !Double.isFinite(point[1])) {
      throw new IllegalArgumentException(label + " must have exactly two finite coordinates");
    }
  }

  private static void addEdgeCuts(List<RationalStudy> cuts, RationalPoint a, RationalPoint direction,
      RationalPoint edgeA, RationalPoint edgeB) {
    RationalPoint edge = subtract(edgeB, edgeA);
    RationalPoint offset = subtract(edgeA, a);
    RationalStudy denominator = cross(direction, edge);
    if (denominator.signum() != 0) {
      RationalStudy t = cross(offset, edge).divide(denominator);
      RationalStudy u = cross(offset, direction).divide(denominator);
      if (unit(t) && unit(u)) cuts.add(t);
    } else if (cross(offset, direction).signum() == 0) {
      boolean xAxis = direction.x.signum() != 0;
      RationalStudy tA = coordinate(edgeA, xAxis).subtract(coordinate(a, xAxis)).divide(coordinate(direction, xAxis));
      RationalStudy tB = coordinate(edgeB, xAxis).subtract(coordinate(a, xAxis)).divide(coordinate(direction, xAxis));
      if (unit(tA)) cuts.add(tA);
      if (unit(tB)) cuts.add(tB);
    }
  }

  private static List<RationalStudy> unique(List<RationalStudy> cuts) {
    List<RationalStudy> unique = new ArrayList<RationalStudy>();
    for (RationalStudy cut : cuts) {
      if (unique.isEmpty() || !unique.get(unique.size() - 1).equals(cut)) unique.add(cut);
    }
    return unique;
  }

  private static boolean contains(RationalPoint[] polygon, RationalPoint point) {
    boolean inside = false;
    for (int i = 0; i < polygon.length; i++) {
      RationalPoint a = polygon[i];
      RationalPoint b = polygon[(i + 1) % polygon.length];
      if (on(a, b, point)) return true;
      if ((a.y.compareTo(point.y) > 0) != (b.y.compareTo(point.y) > 0)) {
        RationalStudy crossingX = a.x.add(point.y.subtract(a.y).multiply(b.x.subtract(a.x)).divide(b.y.subtract(a.y)));
        if (point.x.compareTo(crossingX) < 0) inside = !inside;
      }
    }
    return inside;
  }

  private static boolean meet(RationalPoint a, RationalPoint b, RationalPoint c, RationalPoint d) {
    return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b)
        || cross(subtract(b, a), subtract(c, a)).signum() * cross(subtract(b, a), subtract(d, a)).signum() < 0
        && cross(subtract(d, c), subtract(a, c)).signum() * cross(subtract(d, c), subtract(b, c)).signum() < 0;
  }

  private static boolean on(RationalPoint a, RationalPoint b, RationalPoint point) {
    return cross(subtract(b, a), subtract(point, a)).signum() == 0
        && between(point.x, a.x, b.x) && between(point.y, a.y, b.y);
  }

  private static boolean between(RationalStudy value, RationalStudy a, RationalStudy b) {
    return value.compareTo(a.compareTo(b) <= 0 ? a : b) >= 0 && value.compareTo(a.compareTo(b) <= 0 ? b : a) <= 0;
  }

  private static RationalPoint at(RationalPoint a, RationalPoint direction, RationalStudy t) {
    return new RationalPoint(a.x.add(direction.x.multiply(t)), a.y.add(direction.y.multiply(t)));
  }

  private static RationalPoint point(double x, double y) { return new RationalPoint(RationalStudy.of(x), RationalStudy.of(y)); }
  private static RationalPoint subtract(RationalPoint a, RationalPoint b) { return new RationalPoint(a.x.subtract(b.x), a.y.subtract(b.y)); }
  private static RationalStudy cross(RationalPoint a, RationalPoint b) { return a.x.multiply(b.y).subtract(a.y.multiply(b.x)); }
  private static RationalStudy dot(RationalPoint a, RationalPoint b) { return a.x.multiply(b.x).add(a.y.multiply(b.y)); }
  private static RationalStudy coordinate(RationalPoint p, boolean xAxis) { return xAxis ? p.x : p.y; }
  private static double canonicalZero(double value) { return value == 0.0 ? 0.0 : value; }
  private static boolean same(RationalPoint a, RationalPoint b) { return a.x.equals(b.x) && a.y.equals(b.y); }
  private static boolean unit(RationalStudy t) { return t.compareTo(RationalStudy.ZERO) >= 0 && t.compareTo(RationalStudy.ONE) <= 0; }

  private static final class RationalPoint {
    final RationalStudy x;
    final RationalStudy y;
    RationalPoint(RationalStudy x, RationalStudy y) { this.x = x; this.y = y; }
  }

  private static RationalStudy fraction(int numerator, int denominator) {
    return RationalStudy.of(numerator).divide(RationalStudy.of(denominator));
  }

  private static void expectIntervals(String name, double[][] polygon, double[][] segments, RationalStudy... expected) {
    List<Interval> actual = clip(polygon, segments);
    if (actual.size() * 2 != expected.length) throw new AssertionError(name + " interval count");
    for (int i = 0; i < actual.size(); i++) {
      if (!actual.get(i).t0.equals(expected[i * 2]) || !actual.get(i).t1.equals(expected[i * 2 + 1])) {
        throw new AssertionError(name + " interval " + i);
      }
    }
  }

  private static void expectValid(String name, boolean valid, double[][] polygon) {
    try {
      checkedPolygon(polygon);
      if (!valid) throw new AssertionError(name + " accepted invalid polygon");
    } catch (IllegalArgumentException expected) {
      if (valid) throw new AssertionError(name + " rejected valid polygon", expected);
    }
  }

  private static void expectGapRepresentationFailure(double[][] polygon, double[][] segments) {
    try {
      clip(polygon, segments);
      throw new AssertionError("collapsed exterior gap accepted");
    } catch (IllegalArgumentException expected) {
      if (!expected.getMessage().contains("gap representation")) throw expected;
    }
  }

  private static long checksum(List<Interval> intervals) {
    long result = intervals.size();
    for (Interval interval : intervals) {
      result = 31 * result + interval.sourceIndex;
      result = 31 * result + interval.t0.hashCode();
      result = 31 * result + interval.t1.hashCode();
      result = 31 * result + Double.doubleToLongBits(interval.ax);
      result = 31 * result + Double.doubleToLongBits(interval.ay);
      result = 31 * result + Double.doubleToLongBits(interval.bx);
      result = 31 * result + Double.doubleToLongBits(interval.by);
    }
    return result;
  }

  public static void main(String[] args) {
    double[][] square = {{0, 0}, {4, 0}, {4, 4}, {0, 4}};
    double[][] notch = {{0, 0}, {6, 0}, {6, 6}, {4, 6}, {4, 2}, {2, 2}, {2, 6}, {0, 6}};
    expectIntervals("horizontal", square, new double[][] {{-1, 2, 5, 2}}, fraction(1, 6), fraction(5, 6));
    expectIntervals("boundary", square, new double[][] {{-1, 0, 5, 0}}, fraction(1, 6), fraction(5, 6));
    expectIntervals("vertex-tangent", square, new double[][] {{-1, 1, 1, -1}});
    expectIntervals("concave-notch", notch, new double[][] {{-1, 4, 7, 4}},
        fraction(1, 8), fraction(3, 8), fraction(5, 8), fraction(7, 8));
    expectIntervals("reversed-winding", new double[][] {{0, 6}, {2, 6}, {2, 2}, {4, 2}, {4, 6}, {6, 6}, {6, 0}, {0, 0}},
        new double[][] {{-1, 4, 7, 4}}, fraction(1, 8), fraction(3, 8), fraction(5, 8), fraction(7, 8));
    expectValid("straight-vertex", true, new double[][] {{0, 0}, {2, 0}, {4, 0}, {4, 4}, {0, 4}});
    expectValid("repeated-closure", false, new double[][] {{0, 0}, {4, 0}, {4, 4}, {0, 4}, {0, 0}});
    expectValid("crossing", false, new double[][] {{0, 0}, {5, 4}, {0, 4}, {4, 0}});
    expectValid("edge-touch", false, new double[][] {{0, 0}, {4, 0}, {4, 4}, {2, 0}, {0, 4}});
    expectValid("backtrack", false, new double[][] {{0, 0}, {4, 0}, {2, 0}, {4, 4}, {0, 4}});
    expectGapRepresentationFailure(new double[][] {{-1, -1}, {1, -1}, {1, 1}, {Double.MIN_VALUE, 1},
        {Double.MIN_VALUE, 0}, {0, 0}, {0, 1}, {-1, 1}}, new double[][] {{-1, 0.5, 1, 0.5}});

    double[][] hatch = new double[100][4];
    for (int i = 0; i < hatch.length; i++) { hatch[i][0] = -2; hatch[i][1] = i * 0.08; hatch[i][2] = 8; hatch[i][3] = i * 0.08; }
    for (int i = 0; i < 2; i++) checksum(clip(notch, hatch));
    long expectedChecksum = checksum(clip(notch, hatch));
    long[] elapsed = new long[3];
    for (int i = 0; i < elapsed.length; i++) {
      long start = System.nanoTime();
      long actualChecksum = checksum(clip(notch, hatch));
      elapsed[i] = System.nanoTime() - start;
      if (actualChecksum != expectedChecksum) throw new AssertionError("benchmark checksum changed");
    }
    System.out.println("CHECK\texact-clipping-and-validation\tPASS");
    System.out.println("BENCH\t8-vertex-100-segment-hatch\twarmups=2\tmeasurements=3\tchecksum=" + expectedChecksum
        + "\tnanos=" + elapsed[0] + "," + elapsed[1] + "," + elapsed[2]);
  }
}
