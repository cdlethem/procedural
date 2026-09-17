import { prepareSurfaceAttributes3D } from "../../src/prepare-surface-attributes-3d.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const preview = document.querySelector("#texture-preview");
const defaults = { shaped: false, flat: false, alternateImage: false, ribbon: false };
const settings = { ...defaults };
let modelData, geometry, textureImage, revision = 0, allocations = 0, frees = 0, contextLost = false, pInstance;

function vesselSource() {
  const segments = 18;
  const levels = settings.shaped ? [[89,92],[92,42],[69,-21],[45,-91]] : [[83,92],[91,39],[72,-23],[54,-91]];
  const positions = [];
  for (const [radius,y] of levels) for (let i=0;i<segments;i++) {
    const theta=2*Math.PI*i/segments;
    positions.push([radius*Math.cos(theta),y,radius*Math.sin(theta)]);
  }
  const topCenter=positions.length; positions.push([0,levels.at(-1)[1],0]);
  const triangles=[], smoothingGroups=[], cornerUVs=[];
  for(let band=0;band<levels.length-1;band++) for(let i=0;i<segments;i++) {
    const next=(i+1)%segments, lower=band*segments, upper=(band+1)*segments;
    const left=i/segments,right=(i+1)/segments,v0=1-band/(levels.length-1),v1=1-(band+1)/(levels.length-1);
    triangles.push([lower+i,lower+next,upper+i],[lower+next,upper+next,upper+i]);
    smoothingGroups.push(0,0);
    cornerUVs.push([[left,v0],[right,v0],[left,v1]],[[right,v0],[right,v1],[left,v1]]);
  }
  const top=(levels.length-1)*segments;
  for(let i=0;i<segments;i++) {
    const next=(i+1)%segments;
    triangles.push([topCenter,top+i,top+next]); smoothingGroups.push(1);
    const radial=(index)=>[0.5+0.45*Math.cos(2*Math.PI*index/segments),0.5+0.45*Math.sin(2*Math.PI*index/segments)];
    cornerUVs.push([[0.5,0.5],radial(i),radial(next)]);
  }
  return {positions,triangles,smoothingGroups,cornerUVs};
}

// Independent transported-band input: its supplied UVs are laid along length, not around a vessel.
function ribbonSource() {
  const segments=22,positions=[],triangles=[],smoothingGroups=[],cornerUVs=[];
  for(let i=0;i<=segments;i++) {
    const t=i/segments, x=-205+410*t, y=21*Math.sin(2*Math.PI*t), z=38*Math.sin(3*Math.PI*t);
    positions.push([x,y-48,z-21],[x,y+48,z+21]);
  }
  for(let i=0;i<segments;i++) {
    const a=2*i,b=a+1,c=a+2,d=a+3,u=i/segments,v=(i+1)/segments;
    triangles.push([a,b,c],[b,d,c]); smoothingGroups.push(0,0);
    cornerUVs.push([[u,0],[u,1],[v,0]],[[u,1],[v,1],[v,0]]);
  }
  return {positions,triangles,smoothingGroups,cornerUVs};
}

function source() { return settings.ribbon ? ribbonSource() : vesselSource(); }
function prepare() {
  const input=source();
  modelData=prepareSurfaceAttributes3D({...input,normalMode:settings.flat?"flat":"smooth",maxVertices:65536,maxWork:1000000});
}

function makeGeometry(p, data) {
  let maxIndex=-1;
  for(const face of data.triangles)for(const index of face)if(index>maxIndex)maxIndex=index;
  if(maxIndex>65535) {
    const gl=p._renderer.GL;
    if(!(gl instanceof WebGL2RenderingContext) && !gl.getExtension("OES_element_index_uint")) throw new Error("UNSUPPORTED_INDEX_WIDTH");
  }
  const next=new p5.Geometry();
  next.vertices=data.positions.map(([x,y,z])=>p.createVector(x,y,z));
  next.faces=data.triangles.map((face)=>face.slice());
  next.vertexNormals=data.normals.map(([x,y,z])=>p.createVector(x,y,z));
  next.uvs=data.uvs?.flat()??[];
  if(geometry){p.freeGeometry(geometry);frees+=1;}
  geometry=next; allocations+=1;
}

function makeImage(p) {
  const ctx=preview.getContext("2d");
  const palette=settings.alternateImage?[["#184d54","N"],["#e5b759","E"],["#d67056","S"],["#75a69b","W"]]:[["#d1573d","A"],["#f2c869","B"],["#2f6a78","C"],["#9cabc0","D"]];
  ctx.clearRect(0,0,256,256);
  for(let i=0;i<4;i++) {
    const x=(i%2)*128,y=Math.floor(i/2)*128;
    ctx.fillStyle=palette[i][0];ctx.fillRect(x,y,128,128);
    ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=4;ctx.strokeRect(x+10,y+10,108,108);
    ctx.fillStyle="#fffaf0";ctx.font="bold 60px Georgia";ctx.fillText(palette[i][1],x+37,y+86);
  }
  ctx.fillStyle="#142f39";ctx.fillRect(0,122,256,12);
  ctx.fillStyle="#f8f4e7";ctx.fillRect(122,0,12,256);
  const pixels=ctx.getImageData(0,0,256,256).data;
  textureImage=p.createImage(256,256);
  textureImage.loadPixels();
  textureImage.pixels.set(pixels);
  textureImage.updatePixels();
  draw();
}

function draw() {
  const p=pInstance;
  if(!p || !geometry || !textureImage || contextLost) return;
  p.background("#142d37");
  p.push();
  p.ambientLight(122,125,129);
  p.directionalLight(255,242,220,-0.35,0.65,-0.7);
  p.directionalLight(78,150,175,0.8,-0.2,0.5);
  p.camera(285,-215,385,0,0,0,0,1,0);
  p.noStroke();
  p.textureMode(p.NORMAL);
  p.texture(textureImage);
  if(settings.ribbon) { p.rotateY(-0.27); p.rotateX(-0.22); }
  else p.rotateY(-0.33);
  p.model(geometry);
  p.pop();
  revision+=1;art.dataset.renderStatus="ready";art.dataset.revision=String(revision);
  status.textContent=`${settings.ribbon?"Ribbon transfer":"Vessel"} · ${settings.flat?"flat":"smooth"} normals · ${modelData.positions.length} attributed vertices · ${modelData.triangles.length} triangles`;
  window.surfaceAttributeStudy={snapshot:()=>structuredClone({settings,model:modelData,allocations,frees,contextLost,styleRestored:p.textureMode()===p.IMAGE})};
}

new window.p5((p)=>{
  p.setup=()=>{
    pInstance=p;
    const canvas=p.createCanvas(760,560,p.WEBGL).parent(art);
    p.pixelDensity(1);p.noLoop();p.perspective(Math.PI/3,760/560,1,2000);
    canvas.elt.addEventListener("webglcontextlost",()=>{contextLost=true;art.dataset.renderStatus="context-lost";status.textContent="WebGL context lost. Reload this study to restore the view.";});
    prepare();makeGeometry(p,modelData);makeImage(p);
  };
  function action(key){
    if(key==="s"){p.saveCanvas("surface-attribute-vessel","png");return;}
    if(key==="0")Object.assign(settings,defaults);
    else if(key==="g")settings.shaped=!settings.shaped;
    else if(key==="n")settings.flat=!settings.flat;
    else if(key==="u")settings.alternateImage=!settings.alternateImage;
    else if(key==="t")settings.ribbon=!settings.ribbon;
    else return;
    if(key!=="u"){prepare();makeGeometry(p,modelData);}
    if(key==="u"||key==="0")makeImage(p);
    else draw();
  }
  document.addEventListener("click",(event)=>{const button=event.target.closest("button[data-action]");if(button)action(button.dataset.action);});
  p.keyPressed=()=>action(p.key.toLowerCase());
},art);
