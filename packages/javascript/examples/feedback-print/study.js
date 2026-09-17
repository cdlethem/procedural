import { createP5FeedbackSurface } from '../../src/p5-feedback-surface.js';

// This motif and schedule are editable example art, separate from adapter semantics.
export function createFeedbackPrintStudy() {
  const size=600, art=document.querySelector('#art'), status=document.querySelector('#status');
  let p, surface, source, warp=false, fade=false, alternate=false, revision=0;
  const identity=[1,0,0,1,0,0];
  const affine=()=>warp?[.986,.018,-.013,.982,.014,.009]:identity;
  function motif() {
    source.clear(); source.push(); source.translate(size/2,size/2); source.noStroke();
    const angle=surface.tick*.34;
    source.rotate(angle);
    for(let i=0;i<7;i++) {
      source.push(); source.rotate(i*Math.PI*2/7); source.fill(alternate?'#236c77':'#ba5c42');
      source.ellipse(0,-110,alternate?26:18,alternate?105:72); source.pop();
    }
    source.fill(alternate?'#e4b858':'#235453'); source.circle(0,0,alternate?35:24);
    source.pop();
    source.fill(alternate?'#b94e4d':'#213f51');
    for(let i=0;i<9;i++) {
      const a=i*2.399+surface.tick*.09;
      source.circle(size/2+Math.cos(a)*(75+i*14),size/2+Math.sin(a)*(75+i*14),4+i%3);
    }
  }
  function paint() {
    p.background('#e7dfcb'); p.push(); p.imageMode(p.CORNER); p.noTint(); p.blendMode(p.BLEND); p.translate(-size/2,-size/2);
    surface.draw(0,0,size,size); p.pop();
    art.dataset.tick=String(surface.tick); art.dataset.revision=String(++revision);
    status.textContent=`Tick ${surface.tick} · ${warp?'shifted':'identity'} warp · ${fade?'fast':'slow'} fade · ${alternate?'teal':'terracotta'} motif`;
  }
  function step(count=1) {
    for(let i=0;i<count;i++) {
      source.clear(); motif();
      surface.step({decay:fade?.85:.955,transform:affine(),source,sourceOpacity:.38});
    }
    paint();
  }
  function action(name) {
    if(name==='step')step(); else if(name==='many')step(24);
    else if(name==='warp'){warp=!warp;paint();}
    else if(name==='decay'){fade=!fade;paint();}
    else if(name==='motif'){alternate=!alternate;paint();}
    else if(name==='reset'){surface.reset();paint();}
    else if(name==='save')p.saveCanvas(`feedback-print-${surface.tick}`,'png');
  }
  new window.p5(instance=>{
    p=instance;
    p.setup=()=>{
      p.createCanvas(size,size,p.WEBGL).parent(art);p.pixelDensity(1);p.noLoop();
      source=p.createGraphics(size,size,p.P2D); source.pixelDensity(1);
      surface=createP5FeedbackSurface(p,{width:size,height:size,density:1});
      paint(); art.dataset.renderStatus='ready';
      window.__feedbackPrint=Object.freeze({get ready(){return true;},action,snapshot:()=>({tick:surface.tick,warp,fade,alternate}),get surface(){return surface;},get source(){return source;},get host(){return p;}});
    };
  });
  document.querySelector('#controls').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(button)action(button.dataset.action);});
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    const name={' ':'step',w:'warp',d:'decay',m:'motif','0':'reset',s:'save'}[event.key.toLowerCase()];
    if(name){event.preventDefault();action(name);}
  });
}
