import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.*;
import org.procedurals.layout.RegularGrid;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.color.CyclicPalette;
import org.procedurals.processing.internal.Java2DFrame;

/** Pure command check against installed artifacts; never starts a renderer. */
public class InstalledFieldMarksCommands {
    static String hex(byte[] bytes) {
        StringBuilder out=new StringBuilder();
        for(byte b:bytes)out.append(String.format("%02x",b&255));
        return out.toString();
    }
    static String model(MarkField marks)throws Exception {
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        ByteBuffer bits=ByteBuffer.allocate(40);
        for(int i=0;i<marks.x.length;i++) {
            bits.clear(); bits.putDouble(marks.x[i]).putDouble(marks.y[i]).putDouble(marks.heading[i])
                .putDouble(marks.lengthFactor[i]).putDouble(marks.colourCycles[i]); hash.update(bits.array());
        }
        return hex(hash.digest());
    }
    @SuppressWarnings("unchecked")
    public static void main(String[] args)throws Exception {
        MarkField marks=MarkField.create(42,160,160,4);
        String before=model(marks);
        System.out.println("core="+RegularGrid.class.getProtectionDomain().getCodeSource().getLocation());
        System.out.println("noise="+GradientNoise2D01.class.getProtectionDomain().getCodeSource().getLocation());
        System.out.println("palette="+CyclicPalette.class.getProtectionDomain().getCodeSource().getLocation());
        System.out.println("adapter="+Java2DFrame.class.getProtectionDomain().getCodeSource().getLocation());
        for(int offset=0;offset<args.length;offset+=4) {
            String id=args[offset]; double length=Double.parseDouble(args[offset+1]);
            boolean bars=Boolean.parseBoolean(args[offset+2]);
            int[] colors=Arrays.stream(args[offset+3].split(",")).mapToInt(s->Integer.parseInt(s,16)).toArray();
            MessageDigest geometry=MessageDigest.getInstance("SHA-256"),color=MessageDigest.getInstance("SHA-256");
            long[] count={0}; ByteBuffer bits=ByteBuffer.allocate(4);
            MarkCommands.stream(marks,length,colors,bars,batch->{
                if(batch.size()>4096)throw new AssertionError("batch overflow");
                for(Object item:batch) {
                    Map<String,Object> command=(Map<String,Object>)item;
                    List<List<Double>> points="quad2".equals(command.get("kind"))
                        ? (List<List<Double>>)command.get("vertices")
                        : Arrays.asList((List<Double>)command.get("from"),(List<Double>)command.get("to"));
                    for(List<Double> point:points)for(double value:point) {
                        bits.clear();bits.putFloat((float)value);geometry.update(bits.array());
                    }
                    bits.clear();bits.putInt(((Integer)command.get("opacity8")<<24)|(Integer)command.get("rgb"));
                    color.update(bits.array()); count[0]++;
                }
            });
            if(!before.equals(model(marks)))throw new AssertionError("retained model changed");
            System.out.println(id+" "+before+" "+hex(geometry.digest())+" "+hex(color.digest())+" "+count[0]);
        }
    }
}
