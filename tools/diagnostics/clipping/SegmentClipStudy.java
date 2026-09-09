import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Private, preliminary double-arithmetic study for clipping finite line segments to a
 * supplied simple polygon. It is deliberately not a library API, contract, or robustness
 * claim. In particular, it uses no tolerance: near-coincident floating-point inputs can
 * therefore expose separate parameters or unstable topological classifications.
 */
public final class SegmentClipStudy {
  private static final int MAX_VERTICES = 256;
  private static final int MAX_SEGMENTS = 2048;

  static final class Point {
    final double x;
    final double y;

    Point(double x, double y) {
      this.x = x;
      this.y = y;
    }
  }

  static final class Segment {
    final Point a;
    final Point b;

    Segment(double ax, double ay, double bx, double by) {
      this.a = new Point(ax, ay);
      this.b = new Point(bx, by);
    }
  }

  static final class RetainedInterval {
    final int sourceIndex;
    final double t0;
    final double t1;
    final Point a;
    final Point b;

    RetainedInterval(int sourceIndex, double t0, double t1, Point a, Point b) {
      this.sourceIndex = sourceIndex;
      this.t0 = t0;
      this.t1 = t1;
      this.a = a;
      this.b = b;
    }
  }

  /** Clips source segments in source-array order; each output is ordered along its source. */
  static List<RetainedInterval> clip(Point[] polygon, Segment[] sources) {
    checkInputs(polygon, sources);
    List<RetainedInterval> output = new ArrayList<>();
    for (int sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      Segment source = sources[sourceIndex];
      if (same(source.a, source.b)) {
        continue; // A source point is not a retained stroke.
      }
      List<Double> cuts = new ArrayList<>();
      cuts.add(0.0);
      cuts.add(1.0);
      for (int edgeIndex = 0; edgeIndex < polygon.length; edgeIndex++) {
        addEdgeCuts(cuts, source, polygon[edgeIndex], polygon[(edgeIndex + 1) % polygon.length]);
      }
      cuts.sort(Comparator.naturalOrder());
      List<Double> uniqueCuts = unique(cuts);
      List<double[]> kept = new ArrayList<>();
      for (int i = 0; i + 1 < uniqueCuts.size(); i++) {
        double t0 = uniqueCuts.get(i);
        double t1 = uniqueCuts.get(i + 1);
        if (t0 == t1) {
          continue;
        }
        double middle = (t0 + t1) * 0.5;
        if (insideOrBoundary(at(source, middle), polygon)) {
          if (!kept.isEmpty() && kept.get(kept.size() - 1)[1] == t0) {
            kept.get(kept.size() - 1)[1] = t1;
          } else {
            kept.add(new double[] {t0, t1});
          }
        }
      }
      for (double[] interval : kept) {
        output.add(new RetainedInterval(sourceIndex, interval[0], interval[1],
            at(source, interval[0]), at(source, interval[1])));
      }
    }
    return output;
  }

  private static void checkInputs(Point[] polygon, Segment[] sources) {
    if (polygon == null || polygon.length < 3 || polygon.length > MAX_VERTICES) {
      throw new IllegalArgumentException("polygon must contain 3.." + MAX_VERTICES + " vertices");
    }
    if (sources == null || sources.length > MAX_SEGMENTS) {
      throw new IllegalArgumentException("sources must contain 0.." + MAX_SEGMENTS + " segments");
    }
    for (Point point : polygon) checkFinite(point);
    for (Segment segment : sources) {
      if (segment == null) throw new IllegalArgumentException("source segment must not be null");
      checkFinite(segment.a);
      checkFinite(segment.b);
    }
  }

  private static void checkFinite(Point point) {
    if (point == null || !Double.isFinite(point.x) || !Double.isFinite(point.y)) {
      throw new IllegalArgumentException("all coordinates must be finite");
    }
  }

  private static void addEdgeCuts(List<Double> cuts, Segment source, Point edgeA, Point edgeB) {
    double rx = source.b.x - source.a.x;
    double ry = source.b.y - source.a.y;
    double sx = edgeB.x - edgeA.x;
    double sy = edgeB.y - edgeA.y;
    double qpx = edgeA.x - source.a.x;
    double qpy = edgeA.y - source.a.y;
    double denominator = cross(rx, ry, sx, sy);
    if (denominator != 0.0) {
      double t = cross(qpx, qpy, sx, sy) / denominator;
      double u = cross(qpx, qpy, rx, ry) / denominator;
      if (inUnit(t) && inUnit(u)) cuts.add(t);
      return;
    }
    if (cross(qpx, qpy, rx, ry) == 0.0) {
      // A collinear edge contributes each overlap endpoint that lies on the source.
      double rr = rx * rx + ry * ry;
      double tA = ((edgeA.x - source.a.x) * rx + (edgeA.y - source.a.y) * ry) / rr;
      double tB = ((edgeB.x - source.a.x) * rx + (edgeB.y - source.a.y) * ry) / rr;
      if (inUnit(tA)) cuts.add(tA);
      if (inUnit(tB)) cuts.add(tB);
    }
  }

  private static List<Double> unique(List<Double> values) {
    List<Double> result = new ArrayList<>();
    for (double value : values) {
      if (result.isEmpty() || result.get(result.size() - 1) != value) result.add(value);
    }
    return result;
  }

  private static boolean insideOrBoundary(Point point, Point[] polygon) {
    boolean inside = false;
    for (int i = 0; i < polygon.length; i++) {
      Point a = polygon[i];
      Point b = polygon[(i + 1) % polygon.length];
      if (onSegment(point, a, b)) return true;
      if ((a.y > point.y) != (b.y > point.y)) {
        double crossingX = a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y);
        if (crossingX > point.x) inside = !inside;
      }
    }
    return inside;
  }

  private static boolean onSegment(Point point, Point a, Point b) {
    return cross(point.x - a.x, point.y - a.y, b.x - a.x, b.y - a.y) == 0.0
        && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
        && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
  }

  private static Point at(Segment segment, double t) {
    return new Point(segment.a.x + (segment.b.x - segment.a.x) * t,
        segment.a.y + (segment.b.y - segment.a.y) * t);
  }

  private static boolean inUnit(double value) { return value >= 0.0 && value <= 1.0; }
  private static boolean same(Point a, Point b) { return a.x == b.x && a.y == b.y; }
  private static double cross(double ax, double ay, double bx, double by) { return ax * by - ay * bx; }

  private static void check(String name, Point[] polygon, Segment[] sources, int expectedCount,
      double... expectedIntervals) {
    List<RetainedInterval> actual = clip(polygon, sources);
    if (actual.size() != expectedCount || expectedIntervals.length != expectedCount * 2) {
      throw new AssertionError(name + " expected " + expectedCount + " intervals, got " + actual.size());
    }
    for (int i = 0; i < actual.size(); i++) {
      RetainedInterval interval = actual.get(i);
      if (interval.t0 != expectedIntervals[i * 2] || interval.t1 != expectedIntervals[i * 2 + 1]) {
        throw new AssertionError(name + " interval " + i + " expected "
            + expectedIntervals[i * 2] + "," + expectedIntervals[i * 2 + 1] + " got "
            + interval.t0 + "," + interval.t1);
      }
    }
    for (RetainedInterval interval : actual) {
      System.out.printf("RESULT\t%s\t%d\t%.17g\t%.17g\t%.17g\t%.17g\t%.17g\t%.17g%n",
          name, interval.sourceIndex, interval.t0, interval.t1,
          interval.a.x, interval.a.y, interval.b.x, interval.b.y);
    }
    System.out.println("CHECK\t" + name + "\tPASS");
  }

  public static void main(String[] args) {
    Point[] concave = {
        new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(6, 10),
        new Point(6, 4), new Point(4, 4), new Point(4, 10), new Point(0, 10)
    };
    check("concave-horizontal", concave, new Segment[] {new Segment(-2, 5, 12, 5)}, 2,
        1.0 / 7.0, 3.0 / 7.0, 4.0 / 7.0, 6.0 / 7.0);
    Point[] reversed = {
        new Point(0, 10), new Point(4, 10), new Point(4, 4), new Point(6, 4),
        new Point(6, 10), new Point(10, 10), new Point(10, 0), new Point(0, 0)
    };
    check("reversed-winding", reversed, new Segment[] {new Segment(-2, 5, 12, 5)}, 2,
        1.0 / 7.0, 3.0 / 7.0, 4.0 / 7.0, 6.0 / 7.0);
    check("reversed-source", concave, new Segment[] {new Segment(12, 5, -2, 5)}, 2,
        1.0 / 7.0, 3.0 / 7.0, 4.0 / 7.0, 6.0 / 7.0);
    Point[] square = {new Point(0, 0), new Point(10, 0), new Point(10, 10), new Point(0, 10)};
    check("inside-outside-vertical", square, new Segment[] {
        new Segment(2, 2, 8, 8), new Segment(-3, -3, -1, -1), new Segment(5, -2, 5, 12)
    }, 2, 0.0, 1.0, 1.0 / 7.0, 6.0 / 7.0);
    check("boundary-coincident", square, new Segment[] {new Segment(-2, 0, 12, 0)}, 1,
        1.0 / 7.0, 6.0 / 7.0);
    check("vertex-tangency-and-zero", square, new Segment[] {
        new Segment(-1, 1, 1, -1), new Segment(3, 3, 3, 3)
    }, 0);
  }
}
