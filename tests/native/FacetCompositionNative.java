import java.util.Arrays;
import org.procedurals.examples.facetmarks.FacetComposition;
import org.procedurals.sampling.TrianglePoints2D;
import org.procedurals.topology.Delaunay2D;

/** Pure retained-composition checks; PDE mode/drawing acceptance is separate. */
public final class FacetCompositionNative {
  private static int checks;
  private static void check(boolean value, String label) { checks++; if (!value) throw new AssertionError(label); }
  private static void raw(double left, double right, String label) { check(Double.doubleToRawLongBits(left) == Double.doubleToRawLongBits(right), label); }
  private static double[] inputPoint(Delaunay2D mesh, int input) { return mesh.pointAt(mesh.inputVertexAt(input)); }

  private static long meshChecksum(Delaunay2D mesh) {
    long hash = 0xcbf29ce484222325L;
    for (int i = 0; i < mesh.inputCount(); i++) hash = (hash ^ mesh.inputVertexAt(i)) * 0x100000001b3L;
    for (int i = 0; i < mesh.vertexCount(); i++) for (double value : mesh.pointAt(i)) hash = (hash ^ Double.doubleToRawLongBits(value)) * 0x100000001b3L;
    for (int i = 0; i < mesh.faceCount(); i++) for (int value : mesh.triangleAt(i)) hash = (hash ^ value) * 0x100000001b3L;
    return hash;
  }

  private static void verifyComposition(FacetComposition composition, int inputCount, String label) {
    Delaunay2D mesh = composition.mesh();
    check(mesh.inputCount() == inputCount, label + " input count");
    check(mesh.vertexCount() > 2 && mesh.faceCount() > 0 && mesh.edgeCount() > 0, label + " facet topology");
    int total = 0;
    for (int face = 0; face < mesh.faceCount(); face++) {
      TrianglePoints2D first = composition.grainAt(face);
      check(first == composition.grainAt(face), label + " retained batch identity");
      total += first.size();
    }
    check(total == composition.grainCount(), label + " grain total");
    check(total <= 20000, label + " grain budget");
    try { composition.grainAt(-1); throw new AssertionError(label + " missing grain lower failure"); }
    catch (IllegalArgumentException expected) { checks++; }
    try { composition.grainAt(mesh.faceCount()); throw new AssertionError(label + " missing grain upper failure"); }
    catch (IllegalArgumentException expected) { checks++; }
  }

  private static void exactReplay(FacetComposition left, FacetComposition right, String label) {
    Delaunay2D a = left.mesh(), b = right.mesh();
    check(meshChecksum(a) == meshChecksum(b), label + " mesh replay");
    check(left.grainCount() == right.grainCount(), label + " grain count replay");
    check(a.faceCount() == b.faceCount(), label + " face count replay");
    for (int face = 0; face < a.faceCount(); face++) {
      TrianglePoints2D x = left.grainAt(face), y = right.grainAt(face);
      check(x.size() == y.size(), label + " grain batch size replay");
      for (int point = 0; point < x.size(); point++) {
        double[] xp = x.pointAt(point), yp = y.pointAt(point);
        raw(xp[0], yp[0], label + " grain x replay"); raw(xp[1], yp[1], label + " grain y replay");
      }
    }
  }

  public static void main(String[] args) {
    FacetComposition coarseDisc42 = FacetComposition.create(42L, false, false);
    FacetComposition fineDisc42 = FacetComposition.create(42L, true, false);
    FacetComposition coarseCell42 = FacetComposition.create(42L, false, true);
    FacetComposition fineCell42 = FacetComposition.create(42L, true, true);
    FacetComposition coarseDisc43 = FacetComposition.create(43L, false, false);
    FacetComposition fineDisc43 = FacetComposition.create(43L, true, false);
    FacetComposition coarseCell43 = FacetComposition.create(43L, false, true);
    FacetComposition fineCell43 = FacetComposition.create(43L, true, true);
    FacetComposition[] all = {coarseDisc42, fineDisc42, coarseCell42, fineCell42, coarseDisc43, fineDisc43, coarseCell43, fineCell43};
    int[] counts = {128, 512, 127, 511, 128, 512, 127, 511};
    for (int i = 0; i < all.length; i++) verifyComposition(all[i], counts[i], "config " + i);
    exactReplay(coarseDisc42, FacetComposition.create(42L, false, false), "coarse disc 42");
    exactReplay(fineCell43, FacetComposition.create(43L, true, true), "fine cells 43");
    for (int i = 0; i < 128; i++) {
      double[] coarse = inputPoint(coarseDisc42.mesh(), i), fine = inputPoint(fineDisc42.mesh(), i);
      raw(coarse[0], fine[0], "disc prefix x"); raw(coarse[1], fine[1], "disc prefix y");
    }
    check(meshChecksum(coarseDisc42.mesh()) != meshChecksum(coarseDisc43.mesh()), "seed changes disc geometry");
    check(meshChecksum(coarseDisc42.mesh()) != meshChecksum(coarseCell42.mesh()), "site-source transfer changes geometry");
    System.out.println("{\"status\":\"passed\",\"checks\":" + checks + ",\"configs\":8}");
  }
}
