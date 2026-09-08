package org.procedurals.examples.latticemarks;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.paths.OccupiedLatticePaths2D;

/** Authored LatticeMarks arrangement settings; they are not core defaults. */
public final class LatticeComposition {
  private final OccupiedLatticePaths2D paths;
  private LatticeComposition(OccupiedLatticePaths2D paths) { this.paths=paths; }
  public static LatticeComposition create(long seed, boolean many, boolean longPaths) {
    int count=many?36:12, steps=longPaths?36:12;
    List<Object> starts=new ArrayList<Object>(count);
    for (int i = 0; i < count; i++) {
      int source = (13 * i) % 36;
      starts.add(pair(2 + 4 * (source % 6), 2 + 4 * (source / 6)));
    }
    Map<String,Object> config=new LinkedHashMap<String,Object>();
    config.put("dimensions",pair(24,24));
    config.put("starts",starts);
    config.put("maxSteps",Integer.valueOf(steps));
    config.put("maxCells",Integer.valueOf(count*(steps+1)));
    config.put("random",record("seed",Long.valueOf(seed)));
    return new LatticeComposition(OccupiedLatticePaths2D.generate(config));
  }
  public OccupiedLatticePaths2D paths(){return paths;}
  public static float pixel(int index){return 44+24*index;}
  private static List<Object> pair(int x,int y){List<Object> p=new ArrayList<Object>(2);p.add(Integer.valueOf(x));p.add(Integer.valueOf(y));return p;}
  private static Map<String,Object> record(String k,Object v){Map<String,Object> r=new LinkedHashMap<String,Object>();r.put(k,v);return r;}
}
