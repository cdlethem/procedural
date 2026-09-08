import {P5Frame} from '../../src/internal/p5-frame.js';
import {createMarkField,markCommands} from './mark-field.js';

const palettes={original:[0x31a151,0xffa71e,0x05084c,0xde4638,0x3dbdb7],
  neon:[0x2e0551,0xff00c7,0x01afc2,0xfdbe03,0xf4f9fd]};
const marks=createMarkField(42,160,160,4);
const status=document.querySelector('#status');
const controls=document.querySelector('#controls');
let revision=0;
new window.p5(p=>{
  p.setup=()=>{
    p.createCanvas(640,640,p.P2D).parent('art');p.pixelDensity(1);p.noLoop();
    paint();
  };
  function paint() {
    const frame=new P5Frame(p);let completed=null;
    try {
      status.textContent='Drawing…';
      frame.begin({width:640,height:640,density:1,background:0xece7da});
      let batch=[];
      for(const command of markCommands(marks,Number(controls.querySelector('#length').value),
        palettes[controls.querySelector('#palette').value],controls.querySelector('#mark').value==='bar')) {
        batch.push(command);if(batch.length===4096){frame.batch(batch);batch=[];}
      }
      frame.batch(batch);completed=frame.end();
      p.image(completed,0,0);
      revision++;status.textContent='25,600 marks · seed 42';
      document.querySelector('#art').dataset.revision=String(revision);
    } catch(error) {
      status.textContent=`Could not draw: ${error.code??error.message}`;
      throw error;
    } finally {
      if(completed)P5Frame.releaseCompleted(completed);
      else if(frame.state!=='completed')frame.abort();
    }
  }
  controls.addEventListener('submit',event=>event.preventDefault());
  controls.addEventListener('change',paint);
  document.querySelector('#save').addEventListener('click',()=>p.saveCanvas('field-marks','png'));
},document.querySelector('#art'));
