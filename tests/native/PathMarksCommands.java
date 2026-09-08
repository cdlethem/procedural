import org.procedurals.examples.pathmarks.PathMarkComposition;
import java.util.*;
import org.procedurals.internal.DrawingValues;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import org.procedurals.paths.GradientPath2D;

/** Public composition checks; private accepted experiment is compared by the executor. */
public final class PathMarksCommands {
    static final int[] COLORS={0x31a151,0xffa71e,0x05084c,0xde4638,0x3dbdb7};
    static final int[] OTHER={0x2e0551,0xff00c7,0x01afc2,0xfdbe03,0xf4f9fd};
    static final class Digest {
        final MessageDigest digest;
        Digest() throws Exception { digest=MessageDigest.getInstance("SHA-256"); }
        void integer(int n) { for(int shift=24;shift>=0;shift-=8) digest.update((byte)(n>>>shift)); }
        void bits(double n) { long bits=Double.doubleToRawLongBits(n); for(int shift=56;shift>=0;shift-=8) digest.update((byte)(bits>>>shift)); }
        String finish() { StringBuilder out=new StringBuilder(); for(byte b:digest.digest()) out.append(String.format("%02x",b&255)); return out.toString(); }
    }
    static void check(boolean c) { if(!c) throw new AssertionError(); }
    static void bits(double a,double b) { check(Double.doubleToRawLongBits(a)==Double.doubleToRawLongBits(b)); }
    static String movement(PathMarkComposition model) throws Exception {
        Digest d=new Digest(); d.digest.update("cp2-packed-trace-v1".getBytes(StandardCharsets.UTF_8)); d.digest.update((byte)0); d.integer(model.pathCount());
        double[] point=new double[2];
        for(int p=0;p<model.pathCount();p++) {
            GradientPath2D path=model.pathAt(p); d.integer(path.steps());
            for(int i=0;i<=path.steps();i++) { path.pointInto(i,point,0); d.bits(point[0]); d.bits(point[1]); }
            for(int i=0;i<path.steps();i++) d.bits(path.headingAt(i));
        }
        return d.finish();
    }
    static String commands(PathMarkComposition model,boolean trace,double length,int[] colors) throws Exception {
        Digest geometry=new Digest(),colour=new Digest(); long[] count={0};
        int perPath=trace?model.pathAt(0).steps():(model.pathAt(0).steps()+3)/4;
        model.stream(trace,length,colors,batch->{
            check(batch.size()>0 && batch.size()<=4096);
            for(Object value:batch) {
                Map<?,?> c=(Map<?,?>)value; int p=(int)(count[0]/perPath);
                check(c.get("kind").equals("segment2") && c.get("cap").equals("round"));
                check(((Number)c.get("width")).doubleValue()==1 && ((Number)c.get("opacity8")).intValue()==150);
                geometry.integer(p);
                for(String name:Arrays.asList("from","to")) for(Object n:(List<?>)c.get(name)) {
                    double v=((Number)n).doubleValue(); check(Double.isFinite(v)); geometry.bits(v);
                }
                colour.integer(p); colour.integer(((Number)c.get("rgb")).intValue()); count[0]++;
            }
        });
        check(count[0]==(long)model.pathCount()*perPath);
        return "{\"commands\":"+count[0]+",\"geometry_sha256\":\""+geometry.finish()+"\",\"colour_sha256\":\""+colour.finish()+"\"}";
    }
    static long validatedCommands(PathMarkComposition model,boolean trace,double length,int[] colors) {
        Map<String,Object> environment=new LinkedHashMap<String,Object>();
        environment.put("width",640);environment.put("height",640);environment.put("density",1);environment.put("background",0xece7da);
        Map<String,Object> valid=DrawingValues.validateEnvironment(environment);
        List<Object> submitted=new ArrayList<Object>();
        model.streamForCanvas(trace,length,colors,batch -> {
            check(batch.size()>0 && batch.size()<=4096);
            for(Object command:batch) { DrawingValues.normalizeCommand(command,valid); submitted.add(command); }
        });
        long[] raw={0},omitted={0};int[] cursor={0};
        model.stream(trace,length,colors,batch -> {
            for(Object value:batch) {
                raw[0]++;
                if(cursor[0]<submitted.size() && value.equals(submitted.get(cursor[0]))) { cursor[0]++;continue; }
                Map<?,?> command=(Map<?,?>)value;
                List<?> a=(List<?>)command.get("from"),b=(List<?>)command.get("to");
                double x1=((Number)a.get(0)).doubleValue(),x2=((Number)b.get(0)).doubleValue();
                double y1=((Number)a.get(1)).doubleValue(),y2=((Number)b.get(1)).doubleValue();
                check(Math.max(x1,x2)<-1 || Math.min(x1,x2)>641 || Math.max(y1,y2)<-1 || Math.min(y1,y2)>641);
                omitted[0]++;
            }
        });
        check(cursor[0]==submitted.size() && submitted.size()>0);
        long expected=(long)model.pathCount()*(trace?model.pathAt(0).steps():(model.pathAt(0).steps()+3)/4);
        check(raw[0]==expected && raw[0]==submitted.size()+omitted[0]);
        if(((Number)model.pathAt(0).serialize().get("stepDistance")).doubleValue()==.8) check(omitted[0]>0);
        return submitted.size();
    }
    public static void main(String[] args) throws Exception {
        PathMarkComposition base=PathMarkComposition.create(42,2000,.4),extended=PathMarkComposition.create(42,2001,.4),distance=PathMarkComposition.create(42,2000,.8);
        check(base.pathCount()==24); String before=movement(base); boolean changedHeading=false;
        for(int p=0;p<24;p++) {
            GradientPath2D a=base.pathAt(p),b=extended.pathAt(p),c=distance.pathAt(p);
            for(int i=0;i<=a.steps();i++) { bits(a.pointAt(i)[0],b.pointAt(i)[0]); bits(a.pointAt(i)[1],b.pointAt(i)[1]); if(i<a.steps()) bits(a.headingAt(i),b.headingAt(i)); }
            bits(a.headingAt(0),c.headingAt(0));
            if(a.headingAt(1)!=c.headingAt(1)) changedHeading=true;
        }
        check(changedHeading);
        String trace=commands(base,true,12,COLORS),marks=commands(base,false,12,COLORS),longMarks=commands(base,false,24,COLORS),recolour=commands(base,false,12,OTHER);
        check(before.equals(movement(base)));
        PathMarkComposition finalState=PathMarkComposition.create(42,2001,.8);
        long[] submitted={validatedCommands(base,false,12,COLORS),validatedCommands(base,true,12,COLORS),
            validatedCommands(base,false,12,COLORS),validatedCommands(base,false,24,COLORS),
            validatedCommands(base,false,24,OTHER),validatedCommands(extended,false,24,OTHER),
            validatedCommands(finalState,false,24,OTHER)};

        System.out.println("{\"submitted_commands_by_state\":"+Arrays.toString(submitted)+",\"movement_sha256\":\""+before+"\",\"prefix_passed\":true,\"distance_feedback_passed\":true,\"unchanged_movement_passed\":true,\"trace\":"+trace+",\"marks\":"+marks+",\"long-marks\":"+longMarks+",\"recolour\":"+recolour+"}");
    }
}
