/** Catch Processing's implicit float literals before any native rendering. */
public final class PathMarksPdeConfiguration {
    static void exact(double actual,double expected) {
        if(Double.doubleToRawLongBits(actual)!=Double.doubleToRawLongBits(expected))
            throw new AssertionError("PDE binary64 input differs: "+actual+" versus "+expected);
    }
    public static void main(String[] args) {
        PathMarks sketch=new PathMarks();
        exact(sketch.DISTANCE,0.4d);
        sketch.key='d';sketch.keyPressed();exact(sketch.DISTANCE,0.8d);
        exact(((Number)sketch.movement.pathAt(0).serialize().get("stepDistance")).doubleValue(),0.8d);
        sketch.keyPressed();exact(sketch.DISTANCE,0.4d);
        exact(((Number)sketch.movement.pathAt(0).serialize().get("stepDistance")).doubleValue(),0.4d);
    }
}
