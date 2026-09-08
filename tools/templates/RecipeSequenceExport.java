import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
import org.procedurals.recipe.RecipeSequence;

/** Standalone prototype: evaluate all commands, then save a bounded ordered image sequence. */
public final class RecipeSequenceExport {
    public static void main(String[] arguments) throws Throwable {
        if(arguments.length!=1)throw new IllegalArgumentException("provide fresh sequence directory");
        Path output=Paths.get(arguments[0]).toAbsolutePath();
        if(Files.exists(output))throw new IllegalArgumentException("sequence directory exists");
        Map<String,Object> schedule=RecipeExportData.readSequence(RecipeDataIdentity.SEQUENCE_SHA256);
        if(schedule.size()!=1||!(schedule.get("contexts") instanceof List))
            throw new IllegalArgumentException("sequence data requires only contexts array");
        RecipeEvaluator.Limits total=new RecipeEvaluator.Limits();total.work=2000000;
        RecipeSequence.Result sequence=RecipeSequence.evaluate(RecipeExport.recipe(),
                (List<?>)schedule.get("contexts"),new RecipeEvaluator.Limits(),total,32);
        write(sequence,output);
    }

    static void write(RecipeSequence.Result sequence,Path output) throws Throwable {
        Files.createDirectory(output);
        List<String> completed=new ArrayList<String>();
        manifest(output,sequence,completed,false);
        for(int i=0;i<sequence.frames.size();i++) {
            String name=String.format(Locale.ROOT,"frame-%06d.png",i);
            Path png=output.resolve(name);
            RecipeEvaluator.Result frame=sequence.frames.get(i);
            RecipeExport.render(frame,png);
            String row="{\"ordinal\":"+i+",\"file\":\""+name+"\",\"context\":"+
                    context(sequence.contexts.get(i))+",\"commands\":"+frame.commands.size()+
                    ",\"retainedReused\":"+frame.retainedReused+",\"png_sha256\":\""+digest(png)+"\"}";
            completed.add(row);
            manifest(output,sequence,completed,false);
        }
        manifest(output,sequence,completed,true);
    }

    private static String context(Object value) {
        Map<?,?> context=(Map<?,?>)value;
        return "{\"index\":"+context.get("index")+",\"timeSeconds\":"+context.get("timeSeconds")+"}";
    }
    private static void manifest(Path output,RecipeSequence.Result sequence,List<String> completed,boolean complete) throws IOException {
        StringBuilder json=new StringBuilder("{\"status\":\"").append(complete?"complete":"incomplete")
            .append("\",\"scope\":\"prototype Java JAVA2D sequence\",\"recipe_data_sha256\":\"")
            .append(RecipeDataIdentity.SHA256).append("\",\"sequence_data_sha256\":\"")
            .append(RecipeDataIdentity.SEQUENCE_SHA256).append("\",\"frame_count\":").append(sequence.frames.size())
            .append(",\"max_frames\":32,\"aggregate_work_limit\":2000000,\"contexts\":[");
        for(int i=0;i<sequence.contexts.size();i++){if(i>0)json.append(',');json.append(context(sequence.contexts.get(i)));}
        json.append("],\"counters\":{");boolean first=true;
        for(Map.Entry<String,Long> entry:sequence.counters.entrySet()) {
            if(!first)json.append(',');first=false;
            json.append('"').append(entry.getKey()).append("\":").append(entry.getValue());
        }
        json.append("},\"frames\":[");
        for(int i=0;i<completed.size();i++){if(i>0)json.append(',');json.append(completed.get(i));}
        json.append("]}\n");
        Path temporary=output.resolve("manifest.json.tmp");
        Files.write(temporary,json.toString().getBytes(StandardCharsets.UTF_8));
        Files.move(temporary,output.resolve("manifest.json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
    }
    private static String digest(Path path) throws IOException,GeneralSecurityException {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream input=Files.newInputStream(path)) {
            byte[] buffer=new byte[8192];int size;
            while((size=input.read(buffer))!=-1)digest.update(buffer,0,size);
        }
        StringBuilder result=new StringBuilder();for(byte value:digest.digest())result.append(String.format(Locale.ROOT,"%02x",value&255));
        return result.toString();
    }
}
