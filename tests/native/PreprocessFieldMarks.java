import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.Writer;
import processing.mode.java.preproc.PdePreprocessor;
import processing.mode.java.preproc.PreprocessorResult;

/** Invoke the shipped Processing preprocessor; do not translate PDE in project code. */
public class PreprocessFieldMarks {
    public static void main(String[] args)throws Exception {
        String pde=new String(Files.readAllBytes(Paths.get(args[0])),StandardCharsets.UTF_8);
        try(Writer output=Files.newBufferedWriter(Paths.get(args[1]),StandardCharsets.UTF_8)) {
            PreprocessorResult result=PdePreprocessor.builderFor("FieldMarks")
                .setTabSize(2).setIsTesting(false).build().write(output,pde);
            if(!result.getPreprocessIssues().isEmpty())throw new AssertionError(result.getPreprocessIssues());
            if(!"FieldMarks".equals(result.getClassName()))throw new AssertionError(result.getClassName());
        }
        System.out.println("Official Processing preprocessor accepted FieldMarks.pde");
    }
}
