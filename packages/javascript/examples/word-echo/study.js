import { sampleRecordedControls } from '../../src/sample-recorded-controls.js';

export const FONT_PATH = '/examples/glyph-marks/assets/GlyphMarks.ttf';
export const FONT_SHA256 = 'b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c';
const WINDOW = 128, WINDOWS = 40, HOP_SECONDS = .125;

// Original deterministic mono PCM, authored for this example. There is no input
// device or captured performance. Each window's feature is sqrt(mean(x*x)).
export function synthesizedPCM() {
  const pcm = new Array(WINDOWS * WINDOW);
  for (let window = 0; window < WINDOWS; window += 1) {
    const envelope = .13 + .49 * Math.exp(-(((window - 9) / 5) ** 2))
      + .38 * Math.exp(-(((window - 27) / 7) ** 2));
    for (let j = 0; j < WINDOW; j += 1) {
      const index = window * WINDOW + j;
      pcm[index] = envelope * (.72 * Math.sin(2 * Math.PI * 7 * j / WINDOW)
        + .28 * Math.sin(2 * Math.PI * 19 * j / WINDOW + window * .37));
    }
  }
  return pcm;
}

export function synthesizedFeatures() {
  const pcm = synthesizedPCM(), times = [], samples = [];
  let prior = 0;
  for (let i = 0; i < WINDOWS; i += 1) {
    let sum = 0;
    for (let j = 0; j < WINDOW; j += 1) {
      const value = pcm[i * WINDOW + j];
      sum += value * value;
    }
    const level = Math.sqrt(sum / WINDOW);
    times.push(i * HOP_SECONDS);
    samples.push([level, Math.max(0, Math.min(1, (level - prior) * 8))]);
    prior = level;
  }
  return {times, channels:['level','accent'], samples};
}

// Contrasting transfer: periodic authored tide/gust readings, same channel schema.
export function nonAudioFeatures() {
  const times = [], samples = [];
  for (let i = 0; i < WINDOWS; i += 1) {
    times.push(i * HOP_SECONDS);
    samples.push([.22 + .18 * (1 + Math.sin(i * .32)), i % 8 < 2 ? .8 : .1]);
  }
  return {times, channels:['level','accent'], samples};
}

export function controlsAt(features, time, radiusScale = 1) {
  return sampleRecordedControls({
    times:features.times, channels:features.channels, samples:features.samples,
    time, maxGap:HOP_SECONDS,
    mappings:[
      {channel:'level',interpolation:'LINEAR',domain:[0,.7],range:[2,15 * radiusScale],clamp:true},
      {channel:'accent',interpolation:'STEP',domain:[0,1],range:[2,28],clamp:true},
      {channel:'level',interpolation:'LINEAR',domain:[0,.7],range:[.12,.9],clamp:true},
    ], maxWork:features.times.length * features.channels.length + 3,
  });
}

export function createWordEchoStudy() {
  const art = document.querySelector('#art'), status = document.querySelector('#status');
  const signal = synthesizedFeatures(), other = nonAudioFeatures();
  const state = {time:0, word:'ECHO', signal:'synth', transfer:'contour', spacing:3,
    radiusScale:1, palette:'coral', revision:0};
  let host, font, contours, fontReady = false;
  const colors = {coral:{background:'#e7dfc9',ink:'#203d48',mark:'#bb513e',soft:'#dda46b'},
    blue:{background:'#d8e5e4',ink:'#183b52',mark:'#237d91',soft:'#ca885a'}};
  const feature = () => state.signal === 'synth' ? signal : other;
  const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  const snapshot = () => ({...state, ready:fontReady, contourCount:contours?.length ?? 0,
    contourPoints:contours?.reduce((sum,c)=>sum+c.length,0) ?? 0,
    source:state.signal === 'synth' ? 'project-authored synthesized PCM / derived RMS' : 'project-authored non-audio series',
    controls:controlsAt(feature(),state.time,state.radiusScale).values});
  function extract() {
    host.push(); host.textFont(font); host.textSize(158); host.textAlign(host.LEFT,host.BASELINE);
    contours = font.textToContours(state.word,60,330,{sampleFactor:.17});
    host.pop();
    if (!contours.length || contours.every(c=>!c.length)) throw Error('FONT_GLYPH_UNAVAILABLE');
  }
  function drawPathMarks(palette, radius, accent, alpha, layer) {
    host.noFill();host.stroke(palette.soft);host.strokeWeight(.7+alpha);
    const count = 80;
    host.beginShape();
    for(let i=0;i<count;i++){
      const t=i/(count-1), a=2*Math.PI*(2.3*t + layer*.11);
      const radial=42+205*t;
      host.vertex(320+Math.cos(a)*radial,278+Math.sin(a)*radial*.52);
    }
    host.endShape();host.noStroke();host.fill(palette.mark);
    for(let i=0;i<count;i+=state.spacing){
      const t=i/(count-1), a=2*Math.PI*(2.3*t + layer*.11);
      const radial=42+205*t;
      const x=320+Math.cos(a)*radial, y=278+Math.sin(a)*radial*.52;
      host.circle(x,y,Math.max(1,radius*(.5+t)*(.3+alpha)));
    }
    host.stroke(palette.soft);host.strokeWeight(1);
    host.line(55,410+accent,580,410+accent);
  }
  function drawContourMarks(palette, radius, accent, alpha, layer) {
    host.push(); host.translate((layer-2)*accent*.38, (2-layer)*accent*.25);
    host.noFill(); host.stroke(palette.ink); host.strokeWeight(.8+alpha*.65);
    for(const contour of contours){
      if(contour.length<2)continue;
      host.beginShape();for(const point of contour)host.vertex(point.x,point.y);host.endShape(host.CLOSE);
    }
    host.noStroke();host.fill(layer%2?palette.soft:palette.mark);
    for(const contour of contours)for(let i=0;i<contour.length;i+=state.spacing){
      const point=contour[i];const oscillation=Math.sin(i*.071+layer*.4);
      host.circle(point.x+oscillation*accent*.22,point.y+oscillation*accent*.18,
        Math.max(1,radius*(.3+alpha*.6)));
    }
    host.pop();
  }
  function paint() {
    if(!fontReady)return;
    const palette=colors[state.palette], p=host;
    p.background(palette.background);p.noStroke();p.fill(palette.ink);
    p.textFont(font);p.textAlign(p.LEFT,p.BASELINE);
    p.textSize(13);p.text(`WORD / ${state.word}`,44,48);
    p.text(state.signal==='synth'?'SYNTHETIC SIGNAL STUDY':'RECORDED CONTROL STUDY',403,48);
    p.stroke(palette.ink);p.strokeWeight(1);p.line(44,65,596,65);
    p.textSize(12);p.noStroke();p.fill(palette.mark);p.text(state.signal==='synth'?'SYNTH PCM → RMS':'NON-AUDIO SERIES',44,96);
    // Draw earlier logical samples first. The time passed to the operation is
    // explicit; rendering never uses the browser clock or a live audio source.
    for(let layer=0;layer<5;layer++){
      const t=Math.max(0,state.time-(4-layer)*HOP_SECONDS);
      const [radius,accent,alpha]=controlsAt(feature(),t,state.radiusScale).values;
      if(state.transfer==='contour')drawContourMarks(palette,radius,accent,alpha,layer);
      else drawPathMarks(palette,radius,accent,alpha,layer);
    }
    const samples=feature().samples;
    p.stroke(palette.ink);p.strokeWeight(1);p.line(44,440,596,440);p.noFill();p.stroke(palette.mark);p.strokeWeight(2);
    p.beginShape();for(let i=0;i<samples.length;i++)p.vertex(50+i*13.8,555-samples[i][0]*125);p.endShape();
    p.noStroke();p.fill(palette.ink);p.textSize(11);
    p.text(`TIME ${state.time.toFixed(3)}s`,44,585);p.text(`SOURCE ${state.signal.toUpperCase()}`,245,585);
    p.text(`MARKS ${state.transfer.toUpperCase()}`,448,585);
    art.dataset.revision=String(++state.revision);art.dataset.renderStatus='ready';
    status.textContent=`${state.word} · ${state.time.toFixed(3)} s · ${state.signal==='synth'?'synthesized PCM / RMS':'non-audio'} · ${state.transfer} marks · ${state.palette}`;
  }
  function action(name){
    if(!fontReady)return;
    if(name==='step')state.time=Math.min(signal.times.at(-1),state.time+HOP_SECONDS);
    else if(name==='back')state.time=Math.max(0,state.time-HOP_SECONDS);
    else if(name==='word'){state.word=state.word==='ECHO'?'OPEN':'ECHO';extract();}
    else if(name==='signal')state.signal=state.signal==='synth'?'non-audio':'synth';
    else if(name==='transfer')state.transfer=state.transfer==='contour'?'path':'contour';
    else if(name==='spacing')state.spacing=state.spacing===3?7:3;
    else if(name==='size')state.radiusScale=state.radiusScale===1?1.5:1;
    else if(name==='palette')state.palette=state.palette==='coral'?'blue':'coral';
    else if(name==='reset')Object.assign(state,{time:0,word:'ECHO',signal:'synth',transfer:'contour',spacing:3,radiusScale:1,palette:'coral'});
    else if(name==='save'){host.saveCanvas(`word-echo-${state.time.toFixed(3)}`,'png');return;}
    else return;
    if(name==='reset')extract();paint();
  }
  new window.p5(p=>{
    host=p;
    p.setup=()=>{
      p.createCanvas(640,620,p.P2D).parent(art);p.pixelDensity(1);p.noLoop();
      fetch(FONT_PATH).then(async response=>{
        if(!response.ok)throw Error('FONT_UNAVAILABLE');
        const bytes=await response.arrayBuffer();
        if(await hash(bytes)!==FONT_SHA256)throw Error('FONT_INVALID');
        // p5 parses and registers this exact verified Blob. Loading FONT_PATH
        // again would make a second mutable request after the hash check.
        const checkedURL=URL.createObjectURL(new Blob([bytes],{type:'font/ttf'}));
        try{font=await p.loadFont(checkedURL);}finally{URL.revokeObjectURL(checkedURL);}
        if(!font?.data)throw Error('FONT_GLYPH_DATA_UNAVAILABLE');
        p.textFont(font);p.textSize(158);
        extract();fontReady=true;paint();
      }).catch(error=>{art.dataset.error=String(error.message||error);status.textContent=`Word Echo cannot draw: ${art.dataset.error}`;});
    };
  },art);
  document.querySelector('#controls').addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');if(button)action(button.dataset.action);
  });
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    const name={' ':'step',b:'back',w:'word',i:'signal',m:'transfer',d:'spacing',g:'size',c:'palette','0':'reset',s:'save'}[event.key.toLowerCase()];
    if(name){event.preventDefault();action(name);}
  });
  window.__wordEcho=Object.freeze({get ready(){return fontReady;},get host(){return host;},get font(){return font;},get contours(){return contours;},action,snapshot,
    get signal(){return signal;},get nonAudio(){return other;}});
}
