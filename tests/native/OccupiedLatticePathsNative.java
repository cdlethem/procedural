package org.procedurals.paths;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/** Focused Java ownership, access-precedence and sparse-lattice checks for CP11. */
public final class OccupiedLatticePathsNative {
  private static int assertions;
  private interface Action { void run(); }
  private static final class NoIndexedGetList extends LinkedList<Object> {
    public Object get(int index) { throw new AssertionError("indexed List traversal"); }
  }
  private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
  private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  private static Map<String,Object> map(Object... values) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]); return m; }
  private static Map<String,Object> cfg(Object dimensions,Object starts,Object steps,Object cells,Object random) { return map("dimensions",dimensions,"starts",starts,"maxSteps",steps,"maxCells",cells,"random",random); }
  private static void expect(String code, Action action) { Throwable t=null;try{action.run();}catch(Throwable e){t=e;}check(t instanceof OccupiedLatticePaths2D.LatticeException,"exception "+code);check(code.equals(((OccupiedLatticePaths2D.LatticeException)t).code),"code "+code); }
  @SuppressWarnings("unchecked") private static void basics() {
    OccupiedLatticePaths2D zero=OccupiedLatticePaths2D.generate(cfg(list(3,3),list(list(1,1)),0,1,map("seed",42)));
    check(zero.pathCount()==1&&zero.pathLengthAt(0L)==1,"zero start");check("step-limit".equals(zero.completionReasonAt(0L)),"zero reason");
    long[] initial=zero.randomState();check(initial[0]==803958421L&&initial[3]==686809907L,"zero state");
    OccupiedLatticePaths2D one=OccupiedLatticePaths2D.generate(cfg(list(2,1),list(list(0,0)),1,2,map("seed",1)));
    check(Arrays.equals(one.cellAt(0L,1L),new int[]{1,0}),"one candidate");check(one.randomState()[0]==2799959180L,"one consumes");
    OccupiedLatticePaths2D shared=OccupiedLatticePaths2D.generate(cfg(list(3,2),list(list(0,0),list(2,0),list(1,0)),2,9,map("seed",42)));
    check(shared.pathLengthAt(0L)==3&&shared.pathLengthAt(1L)==2&&shared.pathLengthAt(2L)==0,"shared lengths");check("blocked".equals(shared.completionReasonAt(1L))&&"occupied-start".equals(shared.completionReasonAt(2L)),"shared reasons");
    Map<String,Object> values=shared.toValues();((List<Object>)values.get("paths")).clear();check(shared.pathCount()==3,"export detached");
    int[] a=shared.cellAt(0L,0L),b=shared.cellAt(0L,0L);check(a!=b,"fresh cell");a[0]=77;check(shared.cellAt(0L,0L)[0]==0,"cell detached");
    long[] returned=shared.randomState();returned[0]=0;check(shared.randomState()[0]==1701425161L,"random state detached");
    Map<String,Object> nested=shared.toValues();((List<Object>)((List<Object>)nested.get("paths")).get(0)).get(0); ((List<Object>)((List<Object>)((List<Object>)nested.get("paths")).get(0)).get(0)).set(0,99);check(shared.cellAt(0L,0L)[0]==0,"nested export detached");
  }
  private static void inputOwnership() {
    List<Object> start = list(0, 0);
    List<Object> starts = list(start);
    List<Object> state = list(1, 2, 3, 4);
    Map<String,Object> input = cfg(list(3,3), starts, 2, 3, map("state",state));
    List<Object> originalStart = new ArrayList<Object>(start);
    List<Object> originalState = new ArrayList<Object>(state);
    OccupiedLatticePaths2D paths = OccupiedLatticePaths2D.generate(input);
    check(start.equals(originalStart) && state.equals(originalState), "generation preserves input");
    Map<String,Object> before = paths.toValues();
    start.set(0, 2); starts.clear(); state.set(0, 99); input.clear();
    check(paths.toValues().equals(before), "caller mutation cannot alter result");
  }
  private static void accessAndValidation() {
    final OccupiedLatticePaths2D paths=OccupiedLatticePaths2D.generate(cfg(list(2,1),list(list(0,0),list(0,0)),1,4,map("seed",1)));
    int[] out={7,8,9};expect("INDEX_OUT_OF_RANGE",()->paths.cellInto(5L,"bad",out,0));check(Arrays.equals(out,new int[]{7,8,9}),"path range before cell");
    expect("INVALID_INDEX",()->paths.cellInto(0L,"bad",out,0));expect("INDEX_OUT_OF_RANGE",()->paths.cellInto(1L,0L,out,0));expect("INVALID_OUTPUT",()->paths.cellInto(0L,0L,out,2));check(Arrays.equals(out,new int[]{7,8,9}),"atomic into");
    paths.cellInto(Integer.valueOf(0),Long.valueOf(1),out,1);check(out[1]==1&&out[2]==0,"object into");
    check(paths.pathLengthAt(Double.valueOf(0.0))==2&&Arrays.equals(paths.cellAt(Float.valueOf(0f),Short.valueOf((short)1)),new int[]{1,0}),"object scalar access");
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(list(0,0)),1073741822,0,map("state",list(0,0,0,0)))));
    expect("WORK_LIMIT_EXCEEDED",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(list(0,0)),1,1,map("seed",0))));
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(2,2),list(list(2,0)),0,1,map("seed",0))));
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(),0,0,map("seed",BigInteger.ONE))));
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(),Double.NaN,0,map("seed",0))));
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(),0.5,0,map("seed",0))));
    expect("INVALID_INPUT",()->OccupiedLatticePaths2D.generate(cfg(list(1,1),list(),0,0,map("seed",Boolean.TRUE))));
    expect("WORK_LIMIT_EXCEEDED",()->OccupiedLatticePaths2D.generate(cfg(list(2,1),list(list(0,0),list(1,0)),1073741822,1073741823,map("seed",0))));
  }
  private static void linkedAndSparse() {
    NoIndexedGetList starts=new NoIndexedGetList();starts.add(list(2147483646,2147483646));
    OccupiedLatticePaths2D large=OccupiedLatticePaths2D.generate(cfg(list(2147483647,2147483647),starts,0,1,map("seed",2147483648L)));
    check(Arrays.equals(large.cellAt(0L,0L),new int[]{2147483646,2147483646}),"sparse maximum dimensions");
    NoIndexedGetList ordered=new NoIndexedGetList();ordered.add(list(0,0));ordered.add(list(1,0));
    OccupiedLatticePaths2D linked=OccupiedLatticePaths2D.generate(cfg(list(2,1),ordered,0,2,map("seed",1)));
    check(linked.pathCount()==2&&linked.pathLengthAt(1L)==1,"iterator-only linked starts");
    List<Object> many=new ArrayList<Object>();for(int i=0;i<17;i++)many.add(list(i,0));
    OccupiedLatticePaths2D grown=OccupiedLatticePaths2D.generate(cfg(list(17,1),many,0,17,map("seed",1)));
    check(grown.pathCount()==17&&grown.pathLengthAt(16L)==1,"offset growth beyond sixteen paths");
  }
  public static void main(String[] args) { basics();inputOwnership();accessAndValidation();linkedAndSparse();System.out.println("{\"status\":\"passed\",\"assertions\":"+assertions+"}"); }
}
