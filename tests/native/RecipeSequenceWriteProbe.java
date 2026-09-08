import java.nio.file.*;
import java.io.IOException;
import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
import org.procedurals.recipe.RecipeSequence;

/** Failure-publication probe using a deliberately failing sink; this is not a native render. */
public final class RecipeSequenceWriteProbe {
    public static void main(String[] args) throws Throwable {
        Path base=Paths.get(args[0]);
        RecipeSequence.Result empty=RecipeSequence.evaluate(RecipeExport.recipe(),new ArrayList<Object>(),
                new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),32);
        Path emptyOut=base.resolve("empty");RecipeSequenceExport.write(empty,emptyOut);
        String emptyManifest=new String(Files.readAllBytes(emptyOut.resolve("manifest.json")),"UTF-8");
        if(!emptyManifest.contains("\"status\":\"complete\"")||!emptyManifest.contains("\"frame_count\":0"))
            throw new AssertionError("empty sequence did not complete honestly");
        List<Object> contexts=Arrays.<Object>asList(RecipeExport.map("index",0,"timeSeconds",0),RecipeExport.map("index",0,"timeSeconds",1));
        RecipeSequence.Result two=RecipeSequence.evaluate(RecipeExport.recipe(),contexts,
                new RecipeEvaluator.Limits(),new RecipeEvaluator.Limits(),32);
        Path failOut=base.resolve("failed");
        try{RecipeSequenceExport.write(two,failOut);throw new AssertionError("expected late sink failure");}
        catch(IOException expected){if(!expected.getMessage().equals("injected second frame failure"))throw expected;}
        String incomplete=new String(Files.readAllBytes(failOut.resolve("manifest.json")),"UTF-8");
        if(!incomplete.contains("\"status\":\"incomplete\"")||!incomplete.contains("frame-000000.png")||incomplete.contains("frame-000001.png"))
            throw new AssertionError("late failure claimed completion or lost first frame");
        try{RecipeSequenceExport.write(empty,failOut);throw new AssertionError("existing directory replaced");}
        catch(FileAlreadyExistsException expected){}
        if(!incomplete.equals(new String(Files.readAllBytes(failOut.resolve("manifest.json")),"UTF-8")))throw new AssertionError("existing manifest changed");
        System.out.println("SEQUENCE_WRITE_PROBES_PASSED empty completion, late sink failure, existing-output preservation (stub sink)");
    }
}
/** Test-only sink shadows the real exported renderer on the probe classpath. */
class RecipeExport {
    static int calls;
    static Map<String,Object> map(Object... items){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<items.length;i+=2)m.put((String)items[i],items[i+1]);return m;}
    static Map<String,Object> recipe(){return map("format","procedurals.recipe","version","0.1.0","status","draft",
        "parameters",map(),"operations",new ArrayList<Object>(),"drawing",map("id","drawing.fresh-raster-2d","version","0.1.0"),
        "environment",map("kind","literal","value",map("width",32,"height",32,"density",1,"background",0)),
        "frameContext",map("index",0,"timeSeconds",0),"retain",new ArrayList<Object>(),"frame",new ArrayList<Object>());}
    static void render(RecipeEvaluator.Result result,Path output) throws IOException {
        if(++calls==2)throw new IOException("injected second frame failure");
        Files.write(output,new byte[]{1,2,3},StandardOpenOption.CREATE_NEW);
    }
}
