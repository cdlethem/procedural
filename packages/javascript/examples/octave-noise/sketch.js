import { octaveGradientNoise } from '../../src/index.js';
// Independent dot study of an octave field dependency; no source packing or
// Processing-noise compatibility implied. Geometry remains ordinary drawing.
const art=document.querySelector('#art'),status=document.querySelector('#status');
const positions=[];for(let y=0;y<32;y++)for(let x=0;x<32;x++)positions.push([25+x*19,25+y*19]);
const queries=positions.map(([x,y])=>[x*.012+10,y*.012+20]);
let detail=false,persistent=false,normalized=true,revision=0;
const sketch=new window.p5(p=>{
 p.setup=()=>{p.createCanvas(640,640,p.P2D).parent(art);p.pixelDensity(1);p.noLoop();};
 p.draw=()=>{try{
  const octaves=detail?5:1,persistence=persistent?.8:.45;
  const result=octaveGradientNoise({dimension:2,points:queries,seed:42,octaves,frequency:1,lacunarity:2,amplitude:.5,persistence,normalization:normalized?'WEIGHT_SUM':'NONE',maxWork:(queries.length+1)*octaves});
  p.background('#f9f4eb');p.noStroke();
  for(let i=0;i<positions.length;i++){
   const value=result.values[i],[x,y]=positions[i];
   const t=Math.max(0,Math.min(1,value));p.fill(220-170*t,80+60*t,95-20*t,230);p.circle(x,y,2+20*t*t);
  }
  art.dataset.geometry='fixed-grid32x32-pitch19-seed42';art.dataset.sourceCount=String(queries.length);
  art.dataset.revision=String(++revision);art.dataset.renderStatus='ready';
  status.textContent=`${octaves} octave${octaves===1?'':'s'} · persistence ${persistence} · ${normalized?'weight normalized':'raw sum'} · amplitude sum ${result.amplitudeSum.toFixed(4)}`;
 }catch(error){art.dataset.renderStatus='error';status.textContent=`Could not draw: ${error.message}`;}};
});
function action(key){if(key==='s'){sketch.saveCanvas('octave-noise','png');return;}if(key==='t')detail=!detail;else if(key==='p')persistent=!persistent;else if(key==='n')normalized=!normalized;else if(key==='0'){detail=false;persistent=false;normalized=true;}else return;sketch.redraw();}
document.querySelector('#controls').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(button)action(button.dataset.action);});
window.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;const key=event.key.toLowerCase();if(['t','p','n','0','s'].includes(key)){event.preventDefault();action(key);}});
