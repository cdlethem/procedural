import { P5Frame } from '/packages/javascript/src/internal/p5-frame.js';

const env=(width=64,height=64)=>({width,height,density:1,background:0});
const segment=(from,to,width=1,rgb=0xffffff,opacity8=255)=>({kind:'segment2',from,to,width,rgb,opacity8,cap:'round'});
const quad=(vertices,rgb=0xffffff,opacity8=255)=>({kind:'quad2',vertices,rgb,opacity8});
const square=(rgb,opacity8=255)=>quad([[8,8],[56,8],[56,56],[8,56]],rgb,opacity8);
function check(value,message) { if(!value)throw new Error(message); }
function data(g) { return g.drawingContext.getImageData(0,0,g.width,g.height).data; }
function pixel(g,x,y) { return Array.from(g.drawingContext.getImageData(x,y,1,1).data); }
function equal(a,b) { return a.length===b.length&&a.every((v,i)=>v===b[i]); }
function ulp(value,delta) { const b=new ArrayBuffer(4),d=new DataView(b);d.setFloat32(0,value);d.setUint32(0,d.getUint32(0)+delta);return d.getFloat32(0); }

export async function runPixels(p) {
  const groups=[],images=[],observations={};
  function render(environment,commands) {
    const frame=new P5Frame(p);
    try { frame.begin(environment);frame.batch(commands);return frame.end(); }
    catch(error) { if(frame.state!=='completed')frame.abort();throw error; }
  }
  function using(environment,commands,assertions) {
    const graphics=render(environment,commands);
    try { return assertions(graphics); } finally { P5Frame.releaseCompleted(graphics); }
  }
  async function group(id,test) {
    try { await test();groups.push({id,passed:true}); }
    catch(error) { groups.push({id,passed:false,failure:String(error.stack||error)}); }
  }
  await group('1-background-sizes',()=>{
    check(devicePixelRatio===2,'test device scale factor');
    for(const [width,height] of [[1,1],[640,640],[1920,1080],[2048,1],[1,2048],[2048,2048]]) {
      using({...env(width,height),background:0x123456},[],g=>{
        check(g.width===width&&g.height===height&&g.pixelDensity()===1,'logical size/density');
        check(g.elt.width===width&&g.elt.height===height,'backing size');
        const pixels=data(g);
        check(pixels.length===width*height*4,'byte count');
        for(let i=0;i<pixels.length;i+=4)check(pixels[i]===18&&pixels[i+1]===52&&pixels[i+2]===86&&pixels[i+3]===255,'opaque background');
      });
    }
  });
  await group('2-bounds-clipping-widths',()=>{
    using(env(),[
      segment([-64,4],[128,4],1/256),segment([4,-64],[4,128]),
      segment([ulp(-64,-1),8],[ulp(128,-1),8],ulp(1/256,1)),
      segment([8,ulp(-64,-1)],[8,ulp(128,-1)],ulp(64,-1)),
      quad([[-64,0],[0,-64],[128,0],[0,128]]),segment([32,32],[33,32],64)
    ],g=>check(pixel(g,32,32)[0]>0,'maximum width coverage'));
    using(env(),[segment([-64,-64],[-63,-63])],g=>{
      const values=data(g);for(let i=0;i<values.length;i+=4)check(values[i]===0&&values[i+1]===0&&values[i+2]===0&&values[i+3]===255,'fully clipped');
    });
    using(env(),[segment([0,32],[64,32],4)],g=>check(pixel(g,32,32)[0]>0,'central crossing'));
    using(env(),[segment([8,16],[56,16],1/256)],g=>{
      const values=data(g);let count=0;for(let i=0;i<values.length;i+=4)if(values[i]||values[i+1]||values[i+2])count++;
      observations.minimum_width_coverage_pixels=count;
    });
    for(const command of [segment([0,0],[ulp(128,1),1]),segment([0,0],[ulp(-64,1),1]),
      segment([0,0],[1,ulp(128,1)]),segment([0,0],[1,ulp(-64,1)]),
      segment([0,0],[1,1],ulp(1/256,-1)),segment([0,0],[1,1],ulp(64,1)),
      quad([[0,0],[ulp(128,1),0],[ulp(128,1),1],[0,1]])]) {
      const f=new P5Frame(p);f.begin(env());let error;
      try { f.batch([command]); } catch(e) { error=e; }
      finally { if(f.state!=='completed')f.abort(); }
      check(error?.code==='INVALID_COMMAND'&&error.commandIndex===0,'outside profile rejection');
    }
  });
  await group('3-alpha-winding-order',()=>{
    const red=quad([[8,8],[40,8],[40,40],[8,40]],0xff0000,128);
    const blue=quad([[24,8],[56,8],[56,40],[24,40]],0x0000ff,128);
    const a=using(env(),[red,blue],g=>pixel(g,30,24)),b=using(env(),[blue,red],g=>pixel(g,30,24));
    check(a[3]===255&&b[3]===255&&a[2]>a[0]&&b[0]>b[2],'ordered overlap');
    check(Math.abs(a[2]-128)<=2&&Math.abs(a[0]-64)<=2&&Math.abs(b[0]-128)<=2&&Math.abs(b[2]-64)<=2,'source over channels');
    using(env(),[square(0x123456)],g=>check(equal(pixel(g,32,32),[18,52,86,255]),'opaque exact'));
    using(env(),[square(0xffffff,0)],g=>check(equal(pixel(g,32,32),[0,0,0,255]),'zero alpha'));
    const vertices=[[8,8],[56,8],[56,56],[8,56]];
    const forward=using(env(),[quad(vertices,0x336699,173)],g=>data(g));
    const reverse=using(env(),[quad([...vertices].reverse(),0x336699,173)],g=>data(g));
    check(equal(forward,reverse),'winding equivalence');
    using(env(),[square(0x663399,128)],g=>{
      const values=data(g),center=pixel(g,32,32);
      for(let y=10;y<=54;y++)for(let x=10;x<=54;x++)check(equal(Array.from(values.slice((y*64+x)*4,(y*64+x)*4+4)),center),'quad seam');
      images.push({name:'alpha-panel',png:g.elt.toDataURL('image/png')});
    });
  });
  await group('4-style-caps-parent-isolation',()=>{
    const context=p.drawingContext;
    context.save();
    try {
      context.fillStyle='rgb(17,34,51)';context.fillRect(0,0,32,32);
      context.translate(3,5);context.beginPath();context.rect(1,1,7,9);context.clip();
      context.strokeStyle='rgb(68,85,102)';context.lineWidth=7;
      const before=context.getImageData(0,0,32,32).data,transform=context.getTransform().toString();
      const fill=context.fillStyle,stroke=context.strokeStyle;
      using(env(),[segment([16,32],[48,32],8,0xff0000),quad([[20,12],[44,12],[44,24],[20,24]],0x00ff00),segment([8,8],[56,8],2,0x0000ff)],g=>{
        check(equal(pixel(g,13,32),[255,0,0,255]),'round cap extension');
        check(equal(pixel(g,10,32),[0,0,0,255]),'round cap outer bound');
        check(equal(pixel(g,32,18),[0,255,0,255])&&equal(pixel(g,32,12),[0,255,0,255]),'quad no inherited stroke');
        images.push({name:'style-caps',png:g.elt.toDataURL('image/png')});
      });
      check(equal(before,context.getImageData(0,0,32,32).data),'parent pixels');
      check(context.getTransform().toString()===transform&&context.fillStyle===fill&&context.strokeStyle===stroke&&context.lineWidth===7,'parent state');
      context.setTransform(1,0,0,1,0,0);context.fillStyle='white';context.fillRect(0,0,32,32);
      check(equal(Array.from(context.getImageData(0,0,1,1).data),[17,34,51,255]),'parent clip preserved');
    } finally { context.restore(); }
  });
  return {profile:'drawing.fresh-raster-2d',scope:'native p5 Canvas2D pixel groups only',groups,observations,images,passed:groups.every(g=>g.passed)};
}
