import {P5Frame} from '/packages/javascript/src/internal/p5-frame.js';

export async function runTransfer(p) {
  const frame=new P5Frame(p);let output=null,removeCalls=0;
  const check=(value,message)=>{if(!value)throw new Error(message);};
  try {
    frame.begin({width:32,height:24,density:1,background:0x123456});
    output=frame.end();const canvas=output.elt,remove=output.remove;
    output.remove=function(){removeCalls++;return remove.call(this);};
    check(canvas.width===32&&canvas.height===24&&removeCalls===0,'live output before misuse');
    const pixels=()=>Array.from(output.drawingContext.getImageData(0,0,1,1).data);
    check(pixels().join(',')==='18,52,86,255','live output pixels');
    for(const method of ['end','abort']) {
      let error;try{frame[method]();}catch(value){error=value;}
      check(error?.code==='INVALID_STATE'&&error.commandIndex===null,'completed misuse error');
      check(frame.state==='completed'&&canvas.width===32&&canvas.height===24&&removeCalls===0,'misuse preserved live output');
      check(pixels().join(',')==='18,52,86,255','misuse preserved pixels');
    }
    P5Frame.releaseCompleted(output);P5Frame.releaseCompleted(output);
    check(canvas.width===0&&canvas.height===0&&removeCalls===1,'idempotent final release');
    return {passed:true,checks:1,scope:'live completed output survives end/abort misuse before explicit release'};
  } finally {
    if(output)P5Frame.releaseCompleted(output);
    else if(frame.state!=='completed')frame.abort();
  }
}
