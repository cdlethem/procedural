import {P5Frame} from '/packages/javascript/src/internal/p5-frame.js';
import {createMarkField,markCommands} from '/packages/javascript/examples/field-marks/mark-field.js';

const check=(value,message)=>{if(!value)throw new Error(message);};
async function sha(buffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function modelHash(marks) {
  const bytes=new ArrayBuffer(marks.x.length*40),view=new DataView(bytes);
  for(let i=0;i<marks.x.length;i++)for(const [j,key] of ['x','y','heading','lengthFactor','colourCycles'].entries())view.setFloat64(i*40+j*8,marks[key][i]);
  return sha(bytes);
}

export async function runCP1(p,plan,expected) {
  const marks=createMarkField(),snapshot=await modelHash(marks),images=[],cases=[],edits={};
  let basePixels;
  for(const spec of plan.cases) {
    const bars=spec.mark==='bar',coordinateBytes=new ArrayBuffer(marks.x.length*(bars?8:4)*4);
    const colorBytes=new ArrayBuffer(marks.x.length*4),geometry=new DataView(coordinateBytes),colors=new DataView(colorBytes);
    const frame=new P5Frame(p);let completed=null,count=0,offset=0;
    try {
      frame.begin({width:640,height:640,density:1,background:0xece7da});
      let batch=[];
      for(const command of markCommands(marks,spec.maxLength,spec.colors.map(value=>parseInt(value,16)),bars)) {
        for(const point of command.vertices??[command.from,command.to])for(const coordinate of point){geometry.setFloat32(offset,coordinate);offset+=4;}
        colors.setUint32(count*4,((180<<24)|command.rgb)>>>0);count++;
        batch.push(command);
        if(batch.length===4096){frame.batch(batch);batch=[];}
      }
      frame.batch(batch);completed=frame.end();
      check(count===25600&&frame.count===count,'CP1 count');
      check(await modelHash(marks)===snapshot,'retained field mutated');
      const entry={id:spec.id,model_sha256:snapshot,geometry_sha256:await sha(coordinateBytes),color_sha256:await sha(colorBytes),commands:count};
      const prior=expected.find(value=>value.id===spec.id);
      for(const key of ['model_sha256','geometry_sha256','color_sha256','commands'])check(entry[key]===prior[key],`${spec.id}: ${key} differs from Java fixture`);
      const pixels=completed.drawingContext.getImageData(0,0,640,640).data;
      let coverage=0,changed=0;
      for(let i=0;i<pixels.length;i+=4){
        check(pixels[i+3]===255,'nonopaque CP1 pixel');
        if(pixels[i]!==236||pixels[i+1]!==231||pixels[i+2]!==218)coverage++;
        if(basePixels&&(pixels[i]!==basePixels[i]||pixels[i+1]!==basePixels[i+1]||pixels[i+2]!==basePixels[i+2]))changed++;
      }
      check(coverage>0,'empty CP1 image');
      if(spec.id==='base')basePixels=pixels;
      else {check(changed>0,'invisible CP1 edit');edits[spec.id]=changed;}
      entry.nonbackground_pixels=coverage;entry.rgba_sha256=await sha(pixels);cases.push(entry);
      images.push({name:'cp1-'+spec.id,png:completed.elt.toDataURL('image/png')});
    } finally {
      if(completed)P5Frame.releaseCompleted(completed);
      else if(frame.state!=='completed')frame.abort();
    }
  }
  return {passed:true,scope:'p5 Canvas2D CP1 edit-transfer; no cross-host pixel identity claim',cases,edit_changed_pixels:edits,images};
}
