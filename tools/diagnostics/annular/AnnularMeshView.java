import java.io.File;
import processing.core.PApplet;
import processing.opengl.PGraphics3D;

/** Private native view of the annular study; not a shipped API or example. */
public final class AnnularMeshView extends PApplet {
  private final File output;
  private final AnnularMeshStudy.Mesh[] meshes = {
    AnnularMeshStudy.washer(150, 110, -15, 15, 48),
    AnnularMeshStudy.washer(150, 60, -15, 15, 48),
    AnnularMeshStudy.washer(150, 110, -45, 45, 48),
    AnnularMeshStudy.washer(150, 110, -15, 15, 12)
  };
  private static final String[] NAMES = {"baseline", "wide", "deep", "facets", "recolor", "arrangement"};
  private static final int[] COLORS = {0xff7597aa, 0xffb66d55, 0xffeac798, 0xff585e77};
  private static final int[] ALTERNATE = {0xffd386a2, 0xff51776c, 0xff9fc5ae, 0xff696482};
  private int view;

  private AnnularMeshView(File output) { this.output = output; }
  public void settings() { size(640, 640, P3D); pixelDensity(1); }
  public void setup() { }

  private void vertexAt(AnnularMeshStudy.Mesh mesh, int index) {
    int offset = index * 3;
    vertex((float)mesh.packedXYZ[offset], (float)mesh.packedXYZ[offset + 1],
      (float)mesh.packedXYZ[offset + 2]);
  }

  private void drawMesh(AnnularMeshStudy.Mesh mesh, boolean alternate) {
    int[] colors = alternate ? ALTERNATE : COLORS;
    beginShape(TRIANGLES);
    for (AnnularMeshStudy.Triangle triangle : mesh.triangles) {
      fill(colors[triangle.kind.ordinal()]);
      normal((float)triangle.normalX, (float)triangle.normalY, (float)triangle.normalZ);
      vertexAt(mesh, triangle.a);
      vertexAt(mesh, triangle.b);
      vertexAt(mesh, triangle.c);
    }
    endShape();
  }

  public void draw() {
    if (!(g instanceof PGraphics3D) || pixelDensity != 1) {
      throw new AssertionError("P3D density1 required");
    }
    background(24, 27, 34);
    ortho();
    lights();
    noStroke();
    if (view == 5) {
      for (int i = 0; i < 3; i++) {
        pushMatrix();
        translate(155 + 165 * i, 225 + 90 * (i % 2), 0);
        rotateX(0.9f); rotateY(0.3f + i * 0.25f); scale(0.62f);
        drawMesh(meshes[0], i == 1);
        popMatrix();
      }
    } else {
      pushMatrix();
      translate(320, 320, 0); rotateX(0.9f); rotateY(0.3f);
      drawMesh(meshes[view == 4 ? 0 : view], view == 4);
      popMatrix();
    }
    save(new File(output, NAMES[view] + ".png").getAbsolutePath());
    System.out.println("saved " + NAMES[view]);
    if (++view == NAMES.length) exit();
  }

  public static void main(String[] args) {
    if (args.length != 1 || !new File(args[0]).isDirectory()) {
      throw new IllegalArgumentException("existing output directory required");
    }
    PApplet.runSketch(new String[]{"AnnularMeshView"}, new AnnularMeshView(new File(args[0])));
  }
}
