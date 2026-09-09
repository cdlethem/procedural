import java.util.List;
/** Private callback-level edit checks; native framebuffer evidence is separate. */
public final class SelectedEditCheck {
  static void require(boolean value,String message){if(!value)throw new AssertionError(message);}
  public static void main(String[] args){
    CutStudy s=new CutStudy();s.rebuild();
    RetainedRects original=s.model;
    List<RetainedRects.Leaf> before=original.leaves();
    RetainedRects.Leaf chosen=before.get(0);
    s.mouseX=(int)((chosen.left+chosen.right)*0.5);
    s.mouseY=(int)((chosen.top+chosen.bottom)*0.5);
    s.mousePressed();require(s.selectedId==chosen.id,"mouse selection");
    s.key='x';s.keyPressed();require(s.model==original&&original.size()==before.size()+1,"local cut");
    for(int i=1;i<before.size();i++)require(original.leaf(before.get(i).id)==before.get(i),"unrelated leaf replaced");
    long lower=s.selectedId;require(original.leaf(lower).right==(chosen.left+chosen.right)*0.5,"midpoint");
    s.key='d';s.keyPressed();require(s.model==original&&s.selectedId==lower,"decoration rebuilt");
    s.key=(char)127;s.keyCode=127;s.keyPressed();require(s.selectedId==-1&&original.size()==before.size(),"delete");
    s.keyCode=0;s.initialEdit=true;s.key='0';s.keyPressed();require(!s.initialEdit&&s.selectedId==-1&&s.model.size()==37,"reset");
    System.out.println("Selected-cell callbacks: selection, local cut, unrelated identity, decoration, deletion and reset passed");
  }
}
