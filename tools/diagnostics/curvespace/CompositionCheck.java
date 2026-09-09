import examples.recreations.curvespace.CurvespaceComposition;
import java.util.Arrays;
public class CompositionCheck {
 public static void main(String[]args) {
  CurvespaceComposition a=CurvespaceComposition.create(42),b=CurvespaceComposition.create(42),c=CurvespaceComposition.create(43);
  if(!a.field().serialize().equals(b.field().serialize()) || a.field().serialize().equals(c.field().serialize()))throw new AssertionError("seed replay");
  int count=(int)Math.sqrt(a.dotInputs().length);
  if(count<30||count>=80||count*count!=a.dotInputs().length)throw new AssertionError("grid count");
  if(a.verticalInputs().length!=count-1||a.horizontalInputs().length!=count-1)throw new AssertionError("line families");
  for(int i=0;i<a.dotInputs().length;i++){
   double x=480.0/count+(i%count)*(960.0/count),y=480.0/count+(i/count)*(960.0/count);
   if(a.dotInputs()[i][0]!=x||a.dotInputs()[i][1]!=y)throw new AssertionError("unwarped dots");
  }
  double[] q=new double[2];long samples=0;
  for(int axis=0;axis<2;axis++){
   double[][][] in=axis==0?a.verticalInputs():a.horizontalInputs(),out=axis==0?a.verticalOutputs():a.horizontalOutputs();
   for(int i=0;i<in.length;i++){
    if(in[i].length!=2880||out[i].length!=2880)throw new AssertionError("samples");
    for(int j=0;j<2880;j++){
     double fixed=(i+1)*960.0/count,varying=j*960.0/2880;
     if(in[i][j][axis]!=fixed||in[i][j][1-axis]!=varying)throw new AssertionError("input sampling");
     a.field().transform(in[i][j][0],in[i][j][1],q);
     if(!Arrays.equals(q,out[i][j]))throw new AssertionError("package deformation");samples++;
    }
   }
  }
  System.out.println("{\"status\":\"passed\",\"grid_count\":"+count+",\"dots\":"+a.dotInputs().length+",\"influences\":"+a.field().influenceCount()+",\"line_samples\":"+samples+"}");
 }
}
