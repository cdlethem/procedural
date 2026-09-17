import { gradientNoise2D01, fieldDisplace2D } from '../../src/index.js';
// Independently composed grid/rim study; source helpers motivate the transform,
// while their noise algorithms, random composition and renderers are not replayed.
const art=document.querySelector('#art'),status=document.querySelector('#status');
const fieldA=gradientNoise2D01({seed:42}),fieldB=gradientNoise2D01({seed:314});
const curves=[];
for(let line=0;line<17;line++){
 const a=[],b=[];for(let j=0;j<=96;j++){const v=64+j*512/96,f=64+line*32;a.push([f,v]);b.push([v,f]);}curves.push(a,b);
}
for(const radius of [90,145,210]){const ring=[];for(let i=0;i<=180;i++){const a=i*Math.PI*2/180;ring.push([320+radius*Math.cos(a),320+radius*Math.sin(a)]);}curves.push(ring);}
const points=curves.flat();
const samples=points.map(([x,y])=>[fieldA.sample(x*.007+10,y*.007),fieldB.sample(x*.005,y*.005+20)]);
let strong=false,polar=true,dots=false,revision=0;
const sketch=new window.p5(p=>{
 p.setup=()=>{p.createCanvas(640,640,p.P2D).parent(art);p.pixelDensity(1);p.noLoop();};
 p.draw=()=>{try{
  const amplitude=strong?90:35;
  const result=fieldDisplace2D({points,samples,mode:polar?'POLAR':'CARTESIAN',bias:polar?[0,-amplitude]:[-amplitude,-amplitude],gain:polar?[Math.PI*4,amplitude*2]:[amplitude*2,amplitude*2],maxWork:points.length});
  p.background('#f3efe6');p.noFill();let offset=0;
  for(let i=0;i<curves.length;i++){
   p.stroke(i<34?'#73678e':'#c94342');p.strokeWeight(i<34?.7:2);
   if(!dots)p.beginShape();for(let j=0;j<curves[i].length;j++){const [x,y]=result.points[offset++];if(dots)p.point(x,y);else p.vertex(x,y);}if(!dots)p.endShape();
  }
  art.dataset.geometry=JSON.stringify(result.points);art.dataset.sourceCount=String(points.length);
  art.dataset.revision=String(++revision);art.dataset.renderStatus='ready';
  status.textContent=`${polar?'Polar':'Cartesian'} · distance scale ${amplitude} · ${dots?'dots':'lines'} · ${points.length} retained points`;
 }catch(error){art.dataset.renderStatus='error';status.textContent=`Could not draw: ${error.message}`;}};
});
function action(key){if(key==='s'){sketch.saveCanvas('field-displacement','png');return;}if(key==='t')strong=!strong;else if(key==='m')polar=!polar;else if(key==='c')dots=!dots;else if(key==='0'){strong=false;polar=true;dots=false;}else return;sketch.redraw();}
document.querySelector('#controls').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(button)action(button.dataset.action);});
window.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;const key=event.key.toLowerCase();if(['t','m','c','0','s'].includes(key)){event.preventDefault();action(key);}});
