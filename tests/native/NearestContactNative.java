import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.geometry.NearestSegmentContact2D;

/** Java carrier, ownership and error-surface checks beyond shared geometry vectors. */
public final class NearestContactNative {
    private static int checks;
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        checks++;
    }
    private static List<Object> row(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String,Object> config(Object queries, Object obstacles, Object work) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        result.put("queries",queries); result.put("obstacles",obstacles); result.put("maxWork",work);
        return result;
    }
    private static Map<String,Object> normal() {
        return config(row(row(0,0,10,0)),row(row(3,-1,3,1)),1);
    }
    private static void fails(String code, Runnable action) {
        try { action.run(); throw new AssertionError("expected "+code); }
        catch (NearestSegmentContact2D.ContactException error) {
            require(code.equals(error.code),"error code");
            require(error.queryIndex==-1 && error.stage==null,"static error detail");
        }
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        Map<String,Object> input=normal();
        NearestSegmentContact2D result=NearestSegmentContact2D.find(input);
        NearestSegmentContact2D.Contact contact=result.hitAt(0);
        List<Object> queries=(List<Object>)input.get("queries");
        ((List<Object>)queries.get(0)).set(2,100);
        ((List<Object>)input.get("obstacles")).clear(); input.clear();
        require(contact.obstacleIndex==0 && contact.x==3 && contact.y==0 && contact.t==0.3,"captured input");
        Map<String,Object> first=result.toValues();
        List<Object> hits=(List<Object>)first.get("hits");
        Map<String,Object> exported=(Map<String,Object>)hits.get(0);
        ((List<Object>)exported.get("point")).set(0,999);
        exported.put("t",99);hits.clear();first.clear();
        require(result.hitAt(0).x==3 && result.hitAt(0).t==0.3,"detached export");
        Map<String,Object> again=result.toValues();
        require(((List<?>)again.get("hits")).size()==1,"fresh export");
        fails("INVALID_INDEX",()->result.hitAt(-1));
        fails("INDEX_OUT_OF_RANGE",()->result.hitAt(1));
        fails("INDEX_OUT_OF_RANGE",()->result.hitAt(Long.MAX_VALUE));
        Number[] accepted={(byte)3,(short)3,3,3L,3f,3d};
        for (Number carrier:accepted) {
            NearestSegmentContact2D r=NearestSegmentContact2D.find(config(row(row(0,0,10,0)),row(row(carrier,-1,carrier,1)),1));
            require(r.hitAt(0).x==3,"numeric carrier");
        }
        Object[] rejected={true,"3",new BigDecimal("3"),Double.NaN,Double.POSITIVE_INFINITY,null};
        for (Object carrier:rejected) fails("INVALID_INPUT",()->NearestSegmentContact2D.find(config(row(row(0,0,10,0)),row(row(carrier,-1,3,1)),0)));
        for (Object work:new Object[]{true,"1",1.5,-1,9007199254740992L,Double.NaN,null})
            fails("INVALID_INPUT",()->NearestSegmentContact2D.find(config(row(),row(),work)));
        fails("INVALID_INPUT",()->NearestSegmentContact2D.find(config(row(),row(row(1,2,3)),0)));
        fails("INVALID_INPUT",()->NearestSegmentContact2D.find(config(row(row(1,2,3)),row(),0)));
        Map<String,Object> extra=normal();extra.put("unused",1);
        fails("INVALID_INPUT",()->NearestSegmentContact2D.find(extra));
        Map<String,Object> missing=normal();missing.remove("maxWork");
        fails("INVALID_INPUT",()->NearestSegmentContact2D.find(missing));
        fails("INVALID_INPUT",()->NearestSegmentContact2D.find(null));
        NearestSegmentContact2D empty=NearestSegmentContact2D.find(config(row(),row(),0));
        require(empty.size()==0,"empty size");
        fails("INDEX_OUT_OF_RANGE",()->empty.hitAt(0));
        List<Object> batch=row(row(0,0,10,0),row(1e16,0,1e16+2,0));
        try {
            NearestSegmentContact2D.find(config(batch,row(row(3,-1,3,1),row(1e16,-1,1e16+2,1)),4));
            throw new AssertionError("expected late collapse");
        } catch (NearestSegmentContact2D.ContactException error) {
            require(error.code.equals("REPRESENTATION_COLLAPSE") && error.queryIndex==1 && "point".equals(error.stage),"late collapse provenance");
        }
        require(((List<?>)batch.get(0)).get(2).equals(10),"failure input unchanged");
        require(NearestSegmentContact2D.find(normal()).hitAt(0).x==3,"recovery");
        System.out.println("{\"status\":\"passed\",\"checks\":"+checks+"}");
    }
}
