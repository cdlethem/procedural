import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.fields.GradientNoise2D01;

public strictfp final class Cp2Numerics {
    private static String bits(double value) {
        String text = Long.toUnsignedString(Double.doubleToRawLongBits(value), 16);
        StringBuilder result = new StringBuilder();
        for (int i=text.length(); i<16; i++) result.append('0');
        return result.append(text).toString();
    }
    public static void main(String[] args) {
        String mode=args[0]; long seed=Long.parseLong(args[1]);
        double x=Double.parseDouble(args[2]), y=Double.parseDouble(args[3]);
        double coordinateScale=Double.parseDouble(args[4]), base=Double.parseDouble(args[5]);
        double angleScaleOrHeading=Double.parseDouble(args[6]), step=Double.parseDouble(args[7]);
        int count=Integer.parseInt(args[8]);
        GradientNoise2D01 field=null;
        if ("field".equals(mode)) {
            Map<String,Object> parameters=new LinkedHashMap<String,Object>();
            parameters.put("seed", Long.valueOf(seed));
            field=GradientNoise2D01.create(parameters);
        }
        for (int index=0; index<count; index++) {
            double sample=0.0, heading;
            if (field != null) {
                double queryX=x*coordinateScale;
                double queryY=y*coordinateScale;
                sample=field.sample(queryX,queryY);
                double mapped=angleScaleOrHeading*sample;
                heading=base+mapped;
            } else heading=angleScaleOrHeading;
            double dx=step*Math.cos(heading);
            double dy=step*Math.sin(heading);
            double nextX=x+dx;
            double nextY=y+dy;
            System.out.println(index+"\t"+bits(sample)+"\t"+bits(heading)+"\t"+bits(dx)+"\t"+bits(dy)+"\t"+bits(nextX)+"\t"+bits(nextY));
            x=nextX; y=nextY;
        }
    }
}
