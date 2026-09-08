import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.Writer;
import processing.mode.java.preproc.PdePreprocessor;
import processing.mode.java.preproc.PreprocessorResult;

/** Compile named PDE through the pinned official preprocessor. */
public final class PreprocessSketch {
    public static void main(String[] args) throws Exception {
        if(args.length!=3) throw new IllegalArgumentException("PDE, generated Java, sketch name required");
        String pde=new String(Files.readAllBytes(Paths.get(args[0])),StandardCharsets.UTF_8);
        try(Writer out=Files.newBufferedWriter(Paths.get(args[1]),StandardCharsets.UTF_8)) {
            PreprocessorResult result=PdePreprocessor.builderFor(args[2]).setTabSize(2)
                .setIsTesting(false).build().write(out,pde);
            if(!result.getPreprocessIssues().isEmpty()) throw new AssertionError(result.getPreprocessIssues());
            if(!args[2].equals(result.getClassName())) throw new AssertionError(result.getClassName());
        }
    }
}
