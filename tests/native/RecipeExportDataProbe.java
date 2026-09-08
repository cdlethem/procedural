import java.util.*;
import org.procedurals.recipe.RecipeEvaluator;
public final class RecipeExportDataProbe {
  @SuppressWarnings("unchecked")
  public static void main(String[] args) {
    if(args[0].equals("reject")) {
      try { RecipeExportData.read(args[1]); throw new AssertionError("corrupt data accepted"); }
      catch(IllegalArgumentException error) {
        if(!error.getMessage().contains(args[2]))throw error;
        System.out.println("REJECTED "+args[2]); return;
      }
    }
    Map<String,Object> actual=RecipeExport.recipe();
    Map<String,Object> expected=args[0].equals("path")?RecipePrototypeComparison.pathRecipe():RecipePrototypeComparison.fieldRecipe();
    if(args[0].equals("large")) {
      Map<String,Object> parameters=new LinkedHashMap<>((Map<String,Object>)actual.get("parameters"));
      List<?> values=(List<?>)parameters.remove("customValues");
      if(values.size()!=12000)throw new AssertionError("large array size");
      for(int i=0;i<values.size();i++)if(((Number)values.get(i)).doubleValue()!=i)throw new AssertionError("large array value");
      String caption=(String)parameters.remove("caption");
      if(caption.length()!=70000||!caption.chars().allMatch(c->c=='é'))throw new AssertionError("large string");
      Map<String,Object> base=new LinkedHashMap<>(actual);base.put("parameters",parameters);
      RecipePrototypeComparison.same(base,expected,"decoded-large-base");
    } else RecipePrototypeComparison.same(actual,expected,"decoded-recipe");
    RecipeEvaluator.Result output=RecipeEvaluator.evaluate(actual,new RecipeEvaluator.Limits());
    RecipeEvaluator.Result reference=RecipeEvaluator.evaluate(expected,new RecipeEvaluator.Limits());
    RecipePrototypeComparison.same(output.commands,reference.commands,"decoded-commands");
    RecipePrototypeComparison.same(output.environment,reference.environment,"decoded-environment");
    System.out.println("EXACT "+args[0]+" commands="+output.commands.size());
  }
}
