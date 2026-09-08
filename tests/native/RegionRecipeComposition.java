import java.util.*;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.color.CyclicPalette;

/** Direct core composition oracle for the region-panels recipe example. */
public final class RegionRecipeComposition {
    private static Map<String,Object> map(Object... entries) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<entries.length;i+=2)result.put((String)entries[i],entries[i+1]);
        return result;
    }
    public static List<Object> commands(Map<String,Object> parameters) {
        Map<String,Object> input=new LinkedHashMap<>();
        for(String key:new String[]{"seed","replacements","origin","extent","selectionFraction"})input.put(key,parameters.get(key));
        QuadrantPartition2D layout=QuadrantPartition2D.generate(input);
        CyclicPalette palette=CyclicPalette.create(map("colors",parameters.get("colors")));
        double fraction=((Number)parameters.get("insetFraction")).doubleValue();
        List<Object> commands=new ArrayList<>();
        for(int i=0;i<layout.size();i++) {
            double[] b=layout.boundsAt(i);
            double dx=(b[2]-b[0])*fraction,dy=(b[3]-b[1])*fraction;
            commands.add(map("kind","quad2","vertices",Arrays.asList(
                Arrays.asList(b[0]+dx,b[1]+dy),Arrays.asList(b[2]-dx,b[1]+dy),
                Arrays.asList(b[2]-dx,b[3]-dy),Arrays.asList(b[0]+dx,b[3]-dy)),
                "rgb",palette.sample((double)i/layout.size()),"opacity8",255));
        }
        return commands;
    }
}
