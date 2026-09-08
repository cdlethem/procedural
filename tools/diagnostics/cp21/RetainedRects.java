import java.util.ArrayList;
import java.util.List;

/** Private CP21 retained rectangle model; independently authored from the frozen prototype spec. */
public final class RetainedRects {
    private static final int MAX_LIVE = 10000;
    private final ArrayList<Leaf> live = new ArrayList<Leaf>();
    private long nextId = 1;

    /** Immutable rectangle record with a stable identity. */
    public static final class Leaf {
        public final long id;
        public final double left, top, right, bottom;
        private Leaf(long id, double left, double top, double right, double bottom) {
            this.id=id; this.left=left; this.top=top; this.right=right; this.bottom=bottom;
        }
    }

    public RetainedRects(double left, double top, double right, double bottom) {
        finiteBounds(left, top, right, bottom);
        live.add(new Leaf(0, zero(left), zero(top), zero(right), zero(bottom)));
    }

    /** Returns a detached mutable ordered list of current leaves. */
    public List<Leaf> leaves() { return new ArrayList<Leaf>(live); }
    public int size() { return live.size(); }
    public Leaf leaf(long id) { return find(id); }

    /** Splits one live leaf and appends lower then upper children in live order. */
    public long[] cut(long id, char axis, double coordinate) {
        Leaf parent = find(id);
        if (axis != 'X' && axis != 'Y') invalid("axis");
        if (!Double.isFinite(coordinate)) invalid("coordinate");
        if (live.size() > MAX_LIVE - 1) invalid("capacity");
        if (nextId > Long.MAX_VALUE - 2) invalid("id");
        boolean x = axis == 'X';
        if (x ? !(coordinate > parent.left && coordinate < parent.right)
              : !(coordinate > parent.top && coordinate < parent.bottom)) invalid("interior");
        coordinate = zero(coordinate);
        Leaf first = x ? new Leaf(nextId, parent.left, parent.top, coordinate, parent.bottom)
                       : new Leaf(nextId, parent.left, parent.top, parent.right, coordinate);
        Leaf second = x ? new Leaf(nextId + 1, coordinate, parent.top, parent.right, parent.bottom)
                        : new Leaf(nextId + 1, parent.left, coordinate, parent.right, parent.bottom);
        int position = live.indexOf(parent);
        live.remove(position);
        live.add(first); live.add(second);
        long[] ids = {nextId, nextId + 1};
        nextId += 2;
        return ids;
    }

    /** Removes one live leaf; explicit holes are allowed. */
    public void remove(long id) { live.remove(indexOf(id)); }

    private Leaf find(long id) { return live.get(indexOf(id)); }
    private int indexOf(long id) {
        for (int i=0; i<live.size(); i++) if (live.get(i).id == id) return i;
        invalid("unknown id"); return -1;
    }
    private static void finiteBounds(double left,double top,double right,double bottom) {
        if (!Double.isFinite(left)||!Double.isFinite(top)||!Double.isFinite(right)||!Double.isFinite(bottom)||!(left<right)||!(top<bottom)||!Double.isFinite(right-left)||!Double.isFinite(bottom-top)) invalid("bounds");
    }
    private static double zero(double value) { return value == 0.0 ? 0.0 : value; }
    private static void invalid(String message) { throw new IllegalArgumentException(message); }

    private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    private static void checks(){
        try { new RetainedRects(-Double.MAX_VALUE,0,Double.MAX_VALUE,1); throw new AssertionError("overflow extent"); } catch(IllegalArgumentException expected) {}
        RetainedRects z=new RetainedRects(-1,-0.0,1,1);
        check(Double.doubleToRawLongBits(z.leaf(0).top)==0,"root zero");
        long[] zi=z.cut(0,'X',-0.0);
        check(Double.doubleToRawLongBits(z.leaf(zi[0]).right)==0 && Double.doubleToRawLongBits(z.leaf(zi[1]).left)==0,"cut zero");
        Leaf survivor=z.leaf(zi[1]); z.cut(zi[0],'Y',0.5);
        check(z.leaf(zi[1])==survivor,"unrelated identity");
        for(Leaf leaf:z.leaves()) z.remove(leaf.id);
        check(z.size()==0,"remove last");

        RetainedRects r=new RetainedRects(0,0,10,10); long[] x=r.cut(0,'X',3); check(x[0]==1&&x[1]==2&&r.leaf(1).right==3,"x order"); long[] y=r.cut(1,'Y',4); check(y[0]==3&&r.leaf(3).bottom==4,"y bounds"); int before=r.size(); try{r.cut(2,'X',10);throw new AssertionError();}catch(IllegalArgumentException e){} check(r.size()==before,"atomic endpoint"); long[] afterFailure=r.cut(2,'X',6); check(afterFailure[0]==5&&afterFailure[1]==6,"failed edit consumed id"); r.remove(3); try{r.leaf(3);throw new AssertionError();}catch(IllegalArgumentException e){} check(r.size()==3,"remove"); List<Leaf> detached=r.leaves(); detached.clear(); check(r.size()==3,"list ownership");
        RetainedRects area=new RetainedRects(0,0,8,6);long[] a=area.cut(0,'X',2);area.cut(a[0],'Y',1);area.cut(a[1],'Y',5);double total=0;for(Leaf l:area.leaves())total+=(l.right-l.left)*(l.bottom-l.top);check(total==48,"area conservation");
        try{new RetainedRects(0,0,0,1);throw new AssertionError();}catch(IllegalArgumentException e){} try{area.cut(5,'Z',3);throw new AssertionError();}catch(IllegalArgumentException e){} try{area.cut(5,'X',Double.NaN);throw new AssertionError();}catch(IllegalArgumentException e){}
    }
    public static void main(String[] args){checks();System.out.println("CP21 RetainedRects checks passed");}
}
