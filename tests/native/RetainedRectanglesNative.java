import java.util.*;
import java.lang.reflect.Field;
import org.procedurals.layout.RetainedRectangles2D;
public final class RetainedRectanglesNative {
 static void check(boolean b){if(!b)throw new AssertionError();}
 static void error(String code,Runnable r){try{r.run();throw new AssertionError("missing "+code);}catch(RetainedRectangles2D.EditException e){check(e.code.equals(code));}}
 static Object config(Object a){return Collections.singletonMap("bounds",Arrays.asList(a,0,10,10));}
 public static void main(String[]args)throws Exception{
  for(Object n:new Object[]{(byte)0,(short)0,0,0L,0f,0d})check(RetainedRectangles2D.create(config(n)).size()==1);
  for(Object n:new Object[]{null,true,"0",new java.math.BigInteger("0"),new java.math.BigDecimal("0"),Double.NaN,Double.POSITIVE_INFINITY})error("INVALID_INPUT",()->RetainedRectangles2D.create(config(n)));
  error("INVALID_INPUT",()->RetainedRectangles2D.create(Collections.singletonMap("bounds",new double[]{0,0,1,1})));
  RetainedRectangles2D m=RetainedRectangles2D.create(-1,-0.0,1,1);
  check(Double.doubleToRawLongBits(m.leaf(0).top)==0);
  long[] ids=m.cut(0,"X",-0.0);check(ids[0]==1&&ids[1]==2);check(Double.doubleToRawLongBits(m.leaf(1).right)==0);
  RetainedRectangles2D.Leaf survivor=m.leaf(2);m.cut(1,"Y",0.5);check(m.leaf(2)==survivor);
  m.leaves().clear();check(m.size()==3);
  Map<String,Object> snapshot=m.toValues();List leaves=(List)snapshot.get("leaves");Map leaf=(Map)leaves.get(0);((List)leaf.get("bounds")).set(0,100);leaf.clear();leaves.clear();snapshot.clear();check(m.leaf(2)==survivor&&m.size()==3);
  error("INVALID_ID",()->m.cut(-1,null,Double.NaN));error("UNKNOWN_ID",()->m.cut(0,null,Double.NaN));error("INVALID_INPUT",()->m.cut(2,null,Double.NaN));error("INVALID_INPUT",()->m.cut(2,"X",Double.NaN));
  error("INVALID_ID",()->m.remove(Long.MAX_VALUE));error("INVALID_ID",()->m.leaf(9007199254740991L));
  RetainedRectangles2D adjacent=RetainedRectangles2D.create(1,0,Math.nextUp(1.0),1);error("INVALID_CUT",()->adjacent.cut(0,"X",1));
  Field next=RetainedRectangles2D.class.getDeclaredField("nextId");next.setAccessible(true);next.setLong(adjacent,9007199254740989L);
  long[] last=adjacent.cut(0,"Y",0.5);check(last[0]==9007199254740989L&&last[1]==9007199254740990L);
  Object prior=adjacent.toValues();error("LIMIT_EXCEEDED",()->adjacent.cut(last[0],"Y",0.25));check(prior.equals(adjacent.toValues()));
  for(int warm=0;warm<3;warm++){RetainedRectangles2D w=RetainedRectangles2D.create(0,0,501,1);long id=0;for(int i=1;i<=500;i++)id=w.cut(id,"X",i)[1];check(w.size()==501);}
  for(int n:new int[]{1200,10000}){
   RetainedRectangles2D r=RetainedRectangles2D.create(0,0,n+1,1);long live=0;long start=System.nanoTime();
   for(int i=1;i<=n;i++){long[] pair=r.cut(live,"X",i);r.remove(pair[0]);live=pair[1];}
   check(r.size()==1&&r.leaf(live).left==n&&live==2L*n);
   System.out.println("edits="+n+" elapsed_ns="+(System.nanoTime()-start)+" checksum="+(live+r.leaf(live).left));
  }
  RetainedRectangles2D growing=RetainedRectangles2D.create(0,0,10001,1);long id=0;long started=System.nanoTime();
  for(int i=1;i<=10000;i++)id=growing.cut(id,"X",i)[1];
  check(growing.size()==10001);double area=0;for(RetainedRectangles2D.Leaf l:growing.leaves())area+=(l.right-l.left)*(l.bottom-l.top);check(area==10001);
  System.out.println("retained_leaves="+growing.size()+" elapsed_ns="+(System.nanoTime()-started)+" area="+area);
  System.out.println("native ownership/carriers/precedence/identity limits passed");
 }
}
