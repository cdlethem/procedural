import { floydSteinbergDither } from "../src/floyd-steinberg-dither.js";
import { bayerDither } from "../src/bayer-dither.js";
import { convolve2DSigned } from "../src/convolve-2d-signed.js";
import { binaryMorphology2D } from "../src/binary-morphology-2d.js";
import { euclideanDistanceTransform2D } from "../src/euclidean-distance-transform-2d.js";
import { oklabRamp } from "../src/oklab-ramp.js";
import { medianCutQuantize } from "../src/median-cut-quantize.js";

export const materialsASettings={
 "diffusion-engraving":{defaults:{scale:9,threshold:.5},structuralEdit:{scale:15}},"dithered-ribbons":{defaults:{scale:10,threshold:.52},structuralEdit:{threshold:.36}},
 "ordered-halftone":{defaults:{scale:10,order:3},structuralEdit:{order:5}},"bayer-weave":{defaults:{scale:12,order:4},structuralEdit:{scale:19}},
 "embossed-field":{defaults:{scale:9,gain:1.2,source:"mounds",axis:"horizontal",treatment:"dots"},structuralEdit:{source:"waves",axis:"vertical",treatment:"tiles",gain:2.4}},"signed-edge-print":{defaults:{scale:10,cutoff:.16,source:"cutout",axis:"diagonal",treatment:"bars"},structuralEdit:{source:"waves",axis:"vertical",treatment:"tiles",cutoff:.12}},
 "distance-halos":{defaults:{scale:12,radius:6,weight:1},structuralEdit:{radius:13}},"nearest-feature-mosaic":{defaults:{scale:15,features:10,display:"regions",boundaryWidth:1.5,showSites:false,siteSize:5},structuralEdit:{display:"boundaries",showSites:true}},
 "eroded-lace":{defaults:{scale:10,passes:1},structuralEdit:{passes:3}},"dilated-stamps":{defaults:{scale:13,passes:1},structuralEdit:{passes:3}},
 "perceptual-bands":{defaults:{bands:18,phase:0,bandCoverage:1},structuralEdit:{bands:36,bandCoverage:.45}},"oklab-orbits":{defaults:{orbits:16,phase:0,weight:2},structuralEdit:{orbits:32}},
 "reduced-mosaic":{defaults:{scale:18,count:5,fieldMask:"all",maskThreshold:.5},structuralEdit:{fieldMask:"high"}},"quantized-stripes":{defaults:{stripes:26,count:4,bandCoverage:1},structuralEdit:{stripes:48,bandCoverage:.45}}
};
const q=(l,k)=>Number(l.params[k]); const rgb=(l,i)=>{const c=l.palette[i%l.palette.length]>>>0;return [(c>>>16)&255,(c>>>8)&255,c&255]}; const paint=(p,l,i,a=255)=>{const c=rgb(l,i);p.fill(c[0],c[1],c[2],a)};const grid=(n,seed,kind=0)=>Array.from({length:n*n},(_,i)=>{const x=i%n,y=(i/n)|0;return Math.max(0,Math.min(1,.5+.3*Math.sin(x*.29+seed*.02)+.22*Math.cos(y*.21+x*.07+kind)))});const raster=(scale,min=24)=>{const n=Math.max(min,Math.floor(600/scale));return [n,600/n];};const stops=l=>[0,1,2].map(i=>rgb(l,i).map(v=>v/255));
function cells(p,l,bits,n,scale){p.noStroke();for(let i=0;i<bits.length;i++)if(bits[i]){paint(p,l,i,210);p.rect((i%n)*scale,(i/n|0)*scale,scale,scale);}}
export function drawDiffusionEngraving(p,l){const[n,s]=raster(q(l,"scale")),r=floydSteinbergDither({values:grid(n,l.seed),columns:n,rows:n,threshold:q(l,"threshold"),maxWork:n*n*5});p.push();p.translate(20,20);cells(p,l,r.bits,n,s);p.pop();}
export function drawDitheredRibbons(p,l){const[n,s]=raster(q(l,"scale")),r=floydSteinbergDither({values:grid(n,l.seed,2),columns:n,rows:n,threshold:q(l,"threshold"),maxWork:n*n*5});p.noStroke();p.push();p.translate(20,20);for(let i=0;i<r.bits.length;i++)if(r.bits[i]&&i%n%3===0){paint(p,l,(i/n|0),180);p.rect((i%n)*s,(i/n|0)*s,s*3,s*.9);}p.pop();}
export function drawOrderedHalftone(p,l){const[n,s]=raster(q(l,"scale")),r=bayerDither({values:grid(n,l.seed),columns:n,rows:n,order:q(l,"order"),maxWork:n*n*q(l,"order")});p.push();p.translate(20,20);cells(p,l,r.bits,n,s);p.pop();}
export function drawBayerWeave(p,l){const[n,s]=raster(q(l,"scale")),r=bayerDither({values:grid(n,l.seed,3),columns:n,rows:n,order:q(l,"order"),maxWork:n*n*q(l,"order")});p.noStroke();p.push();p.translate(20,20);for(let i=0;i<r.bits.length;i++)if(r.bits[i]){paint(p,l,(i%n)+(i/n|0),190);const x=i%n*s,y=(i/n|0)*s;p.rect(x,y,s*1.8,s*.42);p.rect(x,y,s*.42,s*1.8);}p.pop();}
// These are replaceable scalar-image inputs to the existing portable convolution core.
// The wave formula and vertical kernel preserve previously saved study images exactly.
const reliefKernels={
 vertical:[-1,-2,-1,0,0,0,1,2,1],
 horizontal:[-1,0,1,-2,0,2,-1,0,1],
 diagonal:[-2,-1,0,-1,0,1,0,1,2],
};
const unit=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=unit(x);return t*t*(3-2*t);};
function reliefSource(n,seed,source){
 if(source==="waves")return grid(n,seed);
 // Moving the coordinates makes Seed useful for the analytic image inputs too;
 // seed 42 is the documented baseline and matches the study probe.
 const driftX=.055*Math.sin((seed-42)*.031),driftY=.055*Math.sin((seed-42)*.047);
 return Array.from({length:n*n},(_,i)=>{
  const u=((i%n)+.5)/n-driftX,v=(Math.floor(i/n)+.5)/n-driftY;
  if(source==="mounds"){
   const a=.74*Math.exp(-(((u-.28)/.2)**2+((v-.33)/.24)**2));
   const b=.68*Math.exp(-(((u-.72)/.23)**2+((v-.66)/.18)**2));
   const ridge=.3*Math.exp(-(((v-(.72-.48*u))/.075)**2));
   return unit(.08+a+b+ridge);
  }
  if(source==="cutout"){
   const disk=smooth((.3-Math.hypot(u-.31,v-.34))/.035);
   const arch=smooth((.115-Math.abs(Math.hypot(u-.67,v-.48)-.26))/.025);
   const band=smooth((.075-Math.abs(v-(.82-.28*u)))/.025);
   return unit(.1+.7*disk+.55*arch+.45*band);
  }
  throw Error(`Unknown relief source: ${source}`);
 });
}
function reliefResponse(l){
 const size=q(l,"scale"),n=Math.floor(600/size);
 if(!Number.isFinite(size)||size<4||size>120||n<5||n>150)throw Error("Pixel size must be between 4 and 120");
 const axis=l.params.axis??"vertical",kernel=reliefKernels[axis];
 if(!kernel)throw Error(`Unknown response axis: ${axis}`);
 const values=reliefSource(n,l.seed,l.params.source??"waves");
 return {n,s:600/n,response:convolve2DSigned({values,columns:n,rows:n,kernel,kernelColumns:3,kernelRows:3,boundary:"clamp",maxWork:n*n*9}).values};
}
export function drawEmbossedField(p,l){
 const {n,s,response}=reliefResponse(l),gain=q(l,"gain"),treatment=l.params.treatment??"tiles";
 if(!Number.isFinite(gain)||gain<0||gain>20)throw Error("Relief strength must be between 0 and 20");
 if(treatment!=="tiles"&&treatment!=="dots")throw Error(`Unknown emboss treatment: ${treatment}`);
 p.noStroke();p.push();p.translate(20,20);
 for(let i=0;i<response.length;i++){
  const value=response[i],magnitude=Math.abs(value),x=i%n*s,y=Math.floor(i/n)*s;
  paint(p,l,value>0?1:0,Math.min(230,magnitude*120*gain));
  if(treatment==="dots")p.circle(x+s/2,y+s/2,s*(.15+.8*Math.min(1,magnitude*gain)));
  else p.rect(x,y,s,s);
 }
 p.pop();
}
export function drawSignedEdgePrint(p,l){
 const {n,s,response}=reliefResponse(l),cutoff=l.params.cutoff===undefined?(l.params.gain===undefined?.16:.24/q(l,"gain")):q(l,"cutoff"),treatment=l.params.treatment??"tiles";
 if(!Number.isFinite(cutoff)||cutoff<0||cutoff>4)throw Error("Edge cutoff must be between 0 and 4");
 if(treatment!=="tiles"&&treatment!=="bars")throw Error(`Unknown edge treatment: ${treatment}`);
 p.noStroke();p.push();p.translate(20,20);
 for(let i=0;i<response.length;i++)if(Math.abs(response[i])>cutoff){
  paint(p,l,response[i]>0?0:2,230);
  const x=i%n*s,y=Math.floor(i/n)*s;
  if(treatment==="bars")p.rect(x+s*.2,y+s*.3,s*.6,s*.4);
  else p.rect(x,y,s,s);
 }
 p.pop();
}
function feature(n,seed,count=12){return Array.from({length:n*n},(_,i)=>{const x=i%n,y=(i/n)|0;return ((x*17+y*31+seed)%Math.max(3,Math.floor(n*n/count)))===0;});}
export function drawDistanceHalos(p,l){const[n,s]=raster(q(l,"scale"),24),d=euclideanDistanceTransform2D({mask:feature(n,l.seed),columns:n,rows:n,maxWork:n*n*6});p.noFill();p.strokeWeight(q(l,"weight"));p.push();p.translate(20,20);for(let i=0;i<d.distances.length;i++)if(d.distances[i]!==null&&Math.abs(d.distances[i]%q(l,"radius"))<.55){const c=rgb(l,Math.floor(d.distances[i]));p.stroke(...c,180);p.circle(i%n*s+s/2,(i/n|0)*s+s/2,s*.8);}p.pop();}
function drawNearestFeatureMosaicOpaque(p,l){const[n,s]=raster(q(l,"scale"),24),d=euclideanDistanceTransform2D({mask:feature(n,l.seed,q(l,"features")),columns:n,rows:n,maxWork:n*n*6});p.noStroke();p.push();p.translate(20,20);for(let i=0;i<d.nearestIndices.length;i++){paint(p,l,d.nearestIndices[i]??0,210);p.rect(i%n*s,(i/n|0)*s,s,s);}p.pop();}
export function drawNearestFeatureMosaic(p,l){
 const mode=l.params.display??"regions", width=Number(l.params.boundaryWidth??1.5), siteSize=Number(l.params.siteSize??5), showSites=l.params.showSites??false;
 if(!["regions","boundaries","both"].includes(mode))throw Error("Unknown feature display");
 if(!Number.isFinite(width)||width<0||width>30||!Number.isFinite(siteSize)||siteSize<0||siteSize>50||typeof showSites!=="boolean")throw Error("Invalid feature mark settings");
 if(mode==="regions"&&!showSites)return drawNearestFeatureMosaicOpaque(p,l);
 const[n,s]=raster(q(l,"scale"),24),sites=feature(n,l.seed,q(l,"features"));
 const d=euclideanDistanceTransform2D({mask:sites,columns:n,rows:n,maxWork:n*n*6});
 p.noStroke();p.push();p.translate(20,20);
 if(mode!=="boundaries")for(let i=0;i<d.nearestIndices.length;i++){paint(p,l,d.nearestIndices[i]??0,210);p.rect(i%n*s,(i/n|0)*s,s,s);}
 if(mode!=="regions"&&width>0){const c=rgb(l,0);p.noFill();p.stroke(c[0],c[1],c[2],220);p.strokeWeight(width);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,id=d.nearestIndices[i];
   if(x+1<n&&id!==d.nearestIndices[i+1])p.line((x+1)*s,y*s,(x+1)*s,(y+1)*s);
   if(y+1<n&&id!==d.nearestIndices[i+n])p.line(x*s,(y+1)*s,(x+1)*s,(y+1)*s);
  }
 }
 if(showSites&&siteSize>0){const c=rgb(l,1);p.noStroke();p.fill(c[0],c[1],c[2],255);
  for(let i=0;i<sites.length;i++)if(sites[i])p.circle((i%n+.5)*s,((i/n|0)+.5)*s,siteSize);
 }
 p.pop();
}
function morph(n,seed,mode,passes){let mask=Array.from({length:n*n},(_,i)=>{const x=i%n,y=(i/n)|0;return Math.sin(x*.16+seed*.01)+Math.cos(y*.14)>.15;});for(let i=0;i<passes;i++)mask=binaryMorphology2D({mask,columns:n,rows:n,element:[true,true,true,true,true,true,true,true,true],elementColumns:3,elementRows:3,mode,boundary:"zero",maxWork:n*n*9}).mask;return mask;}
export function drawErodedLace(p,l){const[n,s]=raster(q(l,"scale"));p.push();p.translate(20,20);cells(p,l,morph(n,l.seed,"erode",q(l,"passes")),n,s);p.pop();}
export function drawDilatedStamps(p,l){const[n,s]=raster(q(l,"scale"));p.push();p.translate(20,20);cells(p,l,morph(n,l.seed,"dilate",q(l,"passes")),n,s);p.pop();}
function drawPerceptualBandsOpaque(p,l){const c=oklabRamp({stops:stops(l),count:q(l,"bands"),maxWork:q(l,"bands")+3}).colors;for(let i=0;i<c.length;i++){p.noStroke();p.fill(c[i][0]*255,c[i][1]*255,c[i][2]*255);p.rect(20+15*Math.sin(q(l,"phase")+i*.3),20+i*600/c.length,600-30*Math.sin(q(l,"phase")+i*.3),600/c.length+1);}}
export function drawPerceptualBands(p,l){
 const coverage=Number(l.params.bandCoverage??1);
 if(!Number.isFinite(coverage)||coverage<0||coverage>1)throw Error("Band coverage must be between 0 and 1");
 if(coverage===1)return drawPerceptualBandsOpaque(p,l);
 if(coverage===0)return;
 const bands=q(l,"bands"), colors=oklabRamp({stops:stops(l),count:bands,maxWork:bands+3}).colors, height=600/bands;
 p.noStroke();for(let i=0;i<bands;i++){const edge=15*Math.sin(q(l,"phase")+i*.3),c=colors[i];
  p.fill(c[0]*255,c[1]*255,c[2]*255);
  p.rect(20+edge,20+i*height+(1-coverage)*height/2,600-2*edge,height*coverage);
 }
}
export function drawOklabOrbits(p,l){const c=oklabRamp({stops:stops(l),count:q(l,"orbits"),maxWork:q(l,"orbits")+3}).colors;p.noFill();p.strokeWeight(q(l,"weight"));for(let i=0;i<c.length;i++){p.stroke(c[i][0]*255,c[i][1]*255,c[i][2]*255);p.circle(320,320,40+i*570/c.length+Math.sin(i+q(l,"phase"))*14);}}
function drawReducedMosaicOpaque(p,l){const[n,s]=raster(q(l,"scale"),20),field=grid(n,l.seed),colors=field.map(v=>{const a=stops(l);return [v*a[0][0]+(1-v)*a[1][0],v*a[0][1]+(1-v)*a[1][1],v*a[0][2]+(1-v)*a[1][2]]}),r=medianCutQuantize({colors,count:q(l,"count"),maxWork:n*n*n*n*q(l,"count")+n*n*q(l,"count")+n*n});p.noStroke();p.push();p.translate(20,20);for(let i=0;i<colors.length;i++){const c=r.palette[r.indices[i]];p.fill(c[0]*255,c[1]*255,c[2]*255);p.rect(i%n*s,(i/n|0)*s,s,s);}p.pop();}
export function drawReducedMosaic(p,l){
 const mode=l.params.fieldMask??"all",threshold=Number(l.params.maskThreshold??.5);
 if(!["all","high","low"].includes(mode))throw Error("Unknown mosaic field mask");
 if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw Error("Mask threshold must be between 0 and 1");
 if(mode==="all")return drawReducedMosaicOpaque(p,l);
 const[n,s]=raster(q(l,"scale"),20),field=grid(n,l.seed),source=stops(l);
 const colors=field.map(v=>[0,1,2].map(k=>v*source[0][k]+(1-v)*source[1][k]));
 const reduced=medianCutQuantize({colors,count:q(l,"count"),maxWork:n*n*n*n*q(l,"count")+n*n*q(l,"count")+n*n});
 p.noStroke();p.push();p.translate(20,20);
 for(let i=0;i<field.length;i++){if(mode==="high"?field[i]<threshold:field[i]>=threshold)continue;
  const c=reduced.palette[reduced.indices[i]];p.fill(c[0]*255,c[1]*255,c[2]*255);p.rect(i%n*s,(i/n|0)*s,s,s);
 }p.pop();
}
function drawQuantizedStripesOpaque(p,l){const n=q(l,"stripes"),source=stops(l),colors=Array.from({length:n},(_,i)=>{const t=i/(n-1),a=source[i%3],b=source[(i+1)%3];return a.map((v,k)=>v*t+b[k]*(1-t));}),r=medianCutQuantize({colors,count:q(l,"count"),maxWork:n*n*q(l,"count")+n*q(l,"count")+n});for(let i=0;i<n;i++){const c=r.palette[r.indices[i]];p.noStroke();p.fill(c[0]*255,c[1]*255,c[2]*255);p.rect(0,i*640/n,640,640/n+1);}}
export function drawQuantizedStripes(p,l){
 const coverage=Number(l.params.bandCoverage??1);
 if(!Number.isFinite(coverage)||coverage<0||coverage>1)throw Error("Band coverage must be between 0 and 1");
 if(coverage===1)return drawQuantizedStripesOpaque(p,l);
 if(coverage===0)return;
 const n=q(l,"stripes"),source=stops(l),colors=Array.from({length:n},(_,i)=>{const t=i/(n-1),a=source[i%3],b=source[(i+1)%3];return a.map((v,k)=>v*t+b[k]*(1-t));});
 const reduced=medianCutQuantize({colors,count:q(l,"count"),maxWork:n*n*q(l,"count")+n*q(l,"count")+n}),height=640/n;
 p.noStroke();for(let i=0;i<n;i++){const c=reduced.palette[reduced.indices[i]];p.fill(c[0]*255,c[1]*255,c[2]*255);p.rect(0,i*height+(1-coverage)*height/2,640,height*coverage);}
}
