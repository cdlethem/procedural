import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Private, pure-Java comparison study for a closed annular mesh.
 *
 * <p>This deliberately models one washer: two circular radii at two Z levels. A broader
 * closed-meridian surface would revolve an ordered closed (radius, Z) contour around the
 * axis. It would require rules for arbitrary edge directions, concavity and self-intersection
 * validation, orientation, and same-Z segments. This study does not implement that
 * unassessed abstraction.</p>
 */
public final class AnnularMeshStudy {
  private static final double OUTER_RADIUS = 150.0;
  private static final double INNER_RADIUS = 110.0;
  private static final double BOTTOM_Z = -15.0;
  private static final double TOP_Z = 15.0;
  private static final int SLICES = 48;
  private static final int MAX_TRIANGLES = 10_000;

  private AnnularMeshStudy() { }

  enum FaceKind { OUTER_WALL, INNER_WALL, TOP_ANNULUS, BOTTOM_ANNULUS }

  /** Package-visible indexed triangle, including its retained unit flat normal. */
  static final class Triangle {
    final int a;
    final int b;
    final int c;
    final FaceKind kind;
    final double normalX;
    final double normalY;
    final double normalZ;

    Triangle(int a, int b, int c, FaceKind kind, double normalX, double normalY, double normalZ) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.kind = kind;
      this.normalX = normalX;
      this.normalY = normalY;
      this.normalZ = normalZ;
    }
  }

  /** Package-visible retained mesh; {@code packedXYZ} is x,y,z triples. */
  static final class Mesh {
    final double[] packedXYZ;
    final List<Triangle> triangles;
    final int slices;

    Mesh(double[] packedXYZ, List<Triangle> triangles, int slices) {
      this.packedXYZ = packedXYZ;
      this.triangles = Collections.unmodifiableList(triangles);
      this.slices = slices;
    }

    int vertexCount() { return packedXYZ.length / 3; }
  }

  /** Builds a closed washer with four shared vertex rings and indexed triangle faces. */
  static Mesh washer(double outerRadius, double innerRadius,
      double bottomZ, double topZ, int slices) {
    require(Double.isFinite(outerRadius) && Double.isFinite(innerRadius), "finite radii");
    require(Double.isFinite(bottomZ) && Double.isFinite(topZ), "finite Z values");
    require(outerRadius > innerRadius && innerRadius > 0.0, "outerRadius > innerRadius > 0");
    require(topZ > bottomZ, "topZ > bottomZ");
    require(slices >= 3, "slices >= 3");
    require(8L * slices <= MAX_TRIANGLES, "private triangle work limit");

    // Ring order is outer-bottom, outer-top, inner-bottom, inner-top.
    double[] positions = new double[4 * slices * 3];
    putRing(positions, 0, outerRadius, bottomZ, slices);
    putRing(positions, 1, outerRadius, topZ, slices);
    putRing(positions, 2, innerRadius, bottomZ, slices);
    putRing(positions, 3, innerRadius, topZ, slices);

    List<Triangle> faces = new ArrayList<Triangle>(8 * slices);
    for (int cell = 0; cell < slices; cell++) {
      int next = (cell + 1) % slices;
      int outerBottom = index(0, cell, slices);
      int outerBottomNext = index(0, next, slices);
      int outerTop = index(1, cell, slices);
      int outerTopNext = index(1, next, slices);
      int innerBottom = index(2, cell, slices);
      int innerBottomNext = index(2, next, slices);
      int innerTop = index(3, cell, slices);
      int innerTopNext = index(3, next, slices);

      // Each pair uses outward winding: away from the solid on both radial walls,
      // +Z on the top annulus, and -Z on the bottom annulus.
      addQuad(positions, faces, outerBottom, outerBottomNext, outerTopNext, outerTop, FaceKind.OUTER_WALL);
      addQuad(positions, faces, innerBottom, innerTop, innerTopNext, innerBottomNext, FaceKind.INNER_WALL);
      addQuad(positions, faces, outerTop, outerTopNext, innerTopNext, innerTop, FaceKind.TOP_ANNULUS);
      addQuad(positions, faces, outerBottom, innerBottom, innerBottomNext, outerBottomNext, FaceKind.BOTTOM_ANNULUS);
    }
    return new Mesh(positions, faces, slices);
  }

  private static void addQuad(double[] positions, List<Triangle> faces,
      int a, int b, int c, int d, FaceKind kind) {
    faces.add(triangle(positions, a, b, c, kind));
    faces.add(triangle(positions, a, c, d, kind));
  }

  private static Triangle triangle(double[] positions, int a, int b, int c, FaceKind kind) {
    double ux = positions[b * 3] - positions[a * 3];
    double uy = positions[b * 3 + 1] - positions[a * 3 + 1];
    double uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    double vx = positions[c * 3] - positions[a * 3];
    double vy = positions[c * 3 + 1] - positions[a * 3 + 1];
    double vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    double nx = uy * vz - uz * vy;
    double ny = uz * vx - ux * vz;
    double nz = ux * vy - uy * vx;
    double length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    require(length > 0.0 && Double.isFinite(length), "nonzero triangle");
    return new Triangle(a, b, c, kind, nx / length, ny / length, nz / length);
  }

  private static void putRing(double[] positions, int ring, double radius, double z, int slices) {
    for (int cell = 0; cell < slices; cell++) {
      double angle = 2.0 * Math.PI * cell / slices;
      int offset = index(ring, cell, slices) * 3;
      positions[offset] = radius * Math.cos(angle);
      positions[offset + 1] = radius * Math.sin(angle);
      positions[offset + 2] = z;
    }
  }

  private static int index(int ring, int cell, int slices) { return ring * slices + cell; }

  private static void validate(Mesh mesh) {
    require(mesh.vertexCount() == 4 * mesh.slices, "four shared rings");
    require(mesh.triangles.size() == 8 * mesh.slices, "eight triangles per slice");
    Map<String, Integer> directedEdges = new HashMap<String, Integer>();
    Map<String, Integer> undirectedEdges = new HashMap<String, Integer>();
    for (Triangle face : mesh.triangles) {
      require(face.a != face.b && face.b != face.c && face.c != face.a, "distinct face indices");
      require(face.a >= 0 && face.b >= 0 && face.c >= 0
          && face.a < mesh.vertexCount() && face.b < mesh.vertexCount() && face.c < mesh.vertexCount(),
          "face index range");
      require(lengthSquared(face.normalX, face.normalY, face.normalZ) > 0.0, "nonzero triangle");
      require(normalPointsOutward(mesh, face), "outward normal for " + face.kind);
      addEdge(directedEdges, undirectedEdges, face.a, face.b);
      addEdge(directedEdges, undirectedEdges, face.b, face.c);
      addEdge(directedEdges, undirectedEdges, face.c, face.a);
    }
    for (Map.Entry<String, Integer> edge : undirectedEdges.entrySet()) {
      require(edge.getValue() == 2, "closed edge count: " + edge.getKey());
      int[] pair = parseEdge(edge.getKey());
      require(count(directedEdges, pair[0], pair[1]) == 1 && count(directedEdges, pair[1], pair[0]) == 1,
          "opposite edge directions: " + edge.getKey());
    }
    int edges = undirectedEdges.size();
    require(mesh.vertexCount() - edges + mesh.triangles.size() == 0, "Euler characteristic zero");
  }

  private static boolean normalPointsOutward(Mesh mesh, Triangle face) {
    double cx = (x(mesh, face.a) + x(mesh, face.b) + x(mesh, face.c)) / 3.0;
    double cy = (y(mesh, face.a) + y(mesh, face.b) + y(mesh, face.c)) / 3.0;
    switch (face.kind) {
      case OUTER_WALL: return face.normalX * cx + face.normalY * cy > 0.0;
      case INNER_WALL: return face.normalX * cx + face.normalY * cy < 0.0;
      case TOP_ANNULUS: return face.normalZ > 0.0;
      case BOTTOM_ANNULUS: return face.normalZ < 0.0;
      default: throw new AssertionError(face.kind);
    }
  }

  private static void addEdge(Map<String, Integer> directed, Map<String, Integer> undirected, int a, int b) {
    String directedKey = a + ":" + b;
    directed.put(directedKey, count(directed, a, b) + 1);
    String undirectedKey = a < b ? a + ":" + b : b + ":" + a;
    undirected.put(undirectedKey, undirected.containsKey(undirectedKey) ? undirected.get(undirectedKey) + 1 : 1);
  }

  private static int count(Map<String, Integer> values, int a, int b) {
    Integer value = values.get(a + ":" + b);
    return value == null ? 0 : value;
  }

  private static int[] parseEdge(String key) {
    int split = key.indexOf(':');
    return new int[] { Integer.parseInt(key.substring(0, split)), Integer.parseInt(key.substring(split + 1)) };
  }

  private static double x(Mesh mesh, int vertex) { return mesh.packedXYZ[vertex * 3]; }
  private static double y(Mesh mesh, int vertex) { return mesh.packedXYZ[vertex * 3 + 1]; }
  private static double z(Mesh mesh, int vertex) { return mesh.packedXYZ[vertex * 3 + 2]; }
  private static double lengthSquared(double x, double y, double z) {
    return x * x + y * y + z * z;
  }
  private static void require(boolean condition, String message) {
    if (!condition) throw new IllegalStateException(message);
  }

  private static String caseJson(String id, Mesh mesh) {
    int edges = mesh.triangles.size() * 3 / 2;
    return String.format(Locale.ROOT,
        "{\"id\":\"%s\",\"vertices\":%d,\"triangles\":%d,\"edges\":%d,\"euler\":0}",
        id, mesh.vertexCount(), mesh.triangles.size(), edges);
  }

  public static void main(String[] args) {
    require(args.length == 0, "usage: AnnularMeshStudy");
    Mesh baseline = washer(OUTER_RADIUS, INNER_RADIUS, BOTTOM_Z, TOP_Z, SLICES);
    Mesh widerHole = washer(OUTER_RADIUS, 60.0, BOTTOM_Z, TOP_Z, SLICES);
    Mesh deeper = washer(OUTER_RADIUS, INNER_RADIUS, -45.0, 45.0, SLICES);
    Mesh faceted = washer(OUTER_RADIUS, INNER_RADIUS, BOTTOM_Z, TOP_Z, 12);
    validate(baseline);
    validate(widerHole);
    validate(deeper);
    validate(faceted);
    System.out.println("{\"status\":\"passed\",\"flatNormals\":true,\"retainedGeometry\":true,"
        + "\"consumers\":{\"color\":\"face-kind palette\",\"arrangement\":\"reuse one indexed mesh at multiple transforms\"},"
        + "\"cases\":[" + caseJson("baseline", baseline) + "," + caseJson("innerRadius60", widerHole)
        + "," + caseJson("depthPlusMinus45", deeper) + "," + caseJson("slices12", faceted) + "]}");
  }
}
