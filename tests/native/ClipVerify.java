import org.procedurals.geometry.SegmentClip2D;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

public class ClipVerify {
  static List<List<Double>> hatch(int spacing) {
    List<List<Double>> result = new ArrayList<List<Double>>();
    for (int y=-180; y<700; y+=spacing)
      result.add(Arrays.asList(40d, (double)y, 600d, (double)y+220d));
    return result;
  }
  static List<List<Double>> supplied() {
    List<List<Double>> out = new ArrayList<List<Double>>();
    double[][] points = {{40,150},{600,220},{40,290},{600,360},{40,430},{600,500}};
    for (int i=1; i<points.length; i++) out.add(Arrays.asList(
      points[i-1][0], points[i-1][1], points[i][0], points[i][1]));
    return out;
  }
  static void dump(String label, List<List<Double>> sources, boolean shallow) {
    double floor = shallow ? 430d : 270d;
    List<List<Double>> polygon = Arrays.asList(Arrays.asList(100d,100d), Arrays.asList(540d,100d),
      Arrays.asList(540d,540d), Arrays.asList(380d,540d), Arrays.asList(380d,floor),
      Arrays.asList(260d,floor), Arrays.asList(260d,540d), Arrays.asList(100d,540d));
    Map<String,Object> input = new LinkedHashMap<String,Object>();
    input.put("polygon", polygon);
    input.put("segments", sources);
    input.put("maxWork", 100000L);
    input.put("maxOutputSegments", 512);
    SegmentClip2D clipped = SegmentClip2D.clip(input);
    System.out.println(label + " size=" + clipped.size());
    double[] buf = new double[4];
    for (int i=0; i<clipped.size(); i++) {
      clipped.segmentInto(i, buf, 0);
      System.out.println("  " + i + " " + buf[0] + " " + buf[1] + " " + buf[2] + " " + buf[3] + " " + clipped.sourceIndexAt(i));
    }
  }
  public static void main(String[] args) {
    List<List<Double>> dense = hatch(12);
    List<List<Double>> sparse = hatch(28);
    List<List<Double>> supplied = supplied();
    dump("dense-normal", dense, false);
    dump("sparse-normal", sparse, false);
    dump("supplied-normal", supplied, false);
    dump("dense-shallow", dense, true);
    dump("sparse-shallow", sparse, true);
    dump("supplied-shallow", supplied, true);
  }
}
