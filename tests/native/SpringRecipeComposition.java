import java.util.*;
import org.procedurals.motion.TargetSprings2D;
import org.procedurals.color.CyclicPalette;

/** Direct repeated native stepping, independent of recipe scan and per-step reconstruction. */
public final class SpringRecipeComposition {
    static Map<String,Object> map(Object... x){Map<String,Object> r=new LinkedHashMap<>();for(int i=0;i<x.length;i+=2)r.put((String)x[i],x[i+1]);return r;}
    static double number(Object x){return ((Number)x).doubleValue();}
    public static List<Object> commands(Map<String,Object> parameters,int frame){
        List<?> homes=(List<?>)parameters.get("positions"), offset=(List<?>)parameters.get("displacement");
        List<Object> bodies=new ArrayList<>();
        for(Object home:homes)bodies.add(map("position",home,"velocity",Arrays.asList(0,0),"strength",parameters.get("strength"),"retention",parameters.get("retention")));
        TargetSprings2D state=TargetSprings2D.create(map("bodies",bodies));
        for(int tick=0;tick<=frame;tick++){
            List<Object> targets=new ArrayList<>();
            for(Object raw:homes){List<?> home=(List<?>)raw;targets.add(tick<number(parameters.get("releaseStep"))?
                Arrays.asList(number(home.get(0))+number(offset.get(0)),number(home.get(1))+number(offset.get(1))):home);}
            state.step(targets);
        }
        CyclicPalette palette=CyclicPalette.create(map("colors",parameters.get("colors")));
        double length=number(parameters.get("markLength")),scale=number(parameters.get("trailScale"));
        List<Object> result=new ArrayList<>();
        for(int i=0;i<state.size();i++){
            double[] point=state.positionAt((long)i),velocity=state.velocityAt((long)i);
            result.add(map("kind","segment2","from",Arrays.asList(point[0],point[1]),
                "to",Arrays.asList((point[0]+length)+velocity[0]*scale,point[1]+velocity[1]*scale),
                "rgb",palette.sample((double)i/state.size()),"opacity8",255,"width",parameters.get("strokeWidth"),"cap","round"));
        }
        return result;
    }
}
