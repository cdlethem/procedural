import java.util.*;
import org.procedurals.sampling.TrianglePoints2D;
import org.procedurals.color.CyclicPalette;

/** Direct core composition oracle for the recipe triangle-grain example. */
public final class TriangleRecipeComposition {
    private static Map<String,Object> map(Object... entries) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<entries.length;i+=2)result.put((String)entries[i],entries[i+1]);
        return result;
    }
    public static List<Object> commands(Map<String,Object> parameters) {
        Map<String,Object> input=new LinkedHashMap<>();
        for(String key:new String[]{"seed","count","triangle"})
            input.put(key,parameters.get(key));
        TrianglePoints2D layout=TrianglePoints2D.seeded(input);
        CyclicPalette palette=CyclicPalette.create(map("colors",parameters.get("colors")));
        double scale=((Number)parameters.get("markLength")).doubleValue();
        List<Object> commands=new ArrayList<>();
        for(int i=0;i<layout.size();i++) {
            double[] centre=layout.pointAt(i);
            double half=scale*0.5;
            commands.add(map("kind","segment2","from",Arrays.asList(centre[0]-half,centre[1]),
                "to",Arrays.asList(centre[0]+half,centre[1]),"rgb",palette.sample((double)i/layout.size()),
                "opacity8",255,"width",parameters.get("strokeWidth"),"cap","round"));
        }
        return commands;
    }
}
