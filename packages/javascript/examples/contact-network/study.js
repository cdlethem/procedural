import { radiusPairs2D, pairForceStep2D } from '../../src/index.js';

// Original compositions. Initial values, palettes and UI choices are example
// configuration, not operation defaults or measured recommended ranges.
const SIZE = 720, LAST_TICK = 240, BUDGET = 20000;
const PALETTES = [
  {paper:'#f2eddf', ink:['#184e59','#cb593e','#948346'], faint:'#d4ccba'},
  {paper:'#172b35', ink:['#c6dcd1','#eea781','#aca8cf'], faint:'#36505a'},
];
const copyPairs = pairs => pairs.map(pair => [...pair]);

function initialState(kind, fixed) {
  const points = [], velocities = [], groups = [], edges = [];
  if (fixed) {
    // Three supplied open glyph strokes. Connectivity is consecutive indices;
    // neither intersection detection nor graph generation is hidden here.
    for (let group=0; group<3; group++) {
      for (let j=0; j<25; j++) {
        const t=j/24, i=points.length;
        points.push([180+group*180+48*Math.sin(t*Math.PI*2+group*.55),140+t*440]);
        velocities.push([.16*Math.cos(t*Math.PI*2),0]); groups.push(group);
        if(j>0) edges.push([i-1,i]);
      }
    }
  } else if (kind === 'contact-network') {
    for(let group=0;group<3;group++) {
      const centers=[[252,295],[473,335],[349,470]];
      for(let j=0;j<42;j++) {
        const a=j*2.399963229728653, r=18+Math.sqrt(j/41)*126;
        points.push([centers[group][0]+Math.cos(a)*r,centers[group][1]+Math.sin(a)*r*.91]);
        velocities.push([Math.sin(a)*.42,-Math.cos(a)*.42]);groups.push(group);
      }
    }
  } else {
    for(let group=0;group<3;group++) {
      for(let j=0;j<36;j++) {
        const a=(j/36)*Math.PI*2+group*.12, r=120+group*52;
        points.push([360+Math.cos(a)*r,360+Math.sin(a)*r*.87]);
        velocities.push([-Math.sin(a)*(1.65-group*.16),Math.cos(a)*(1.65-group*.16)]);groups.push(group);
      }
    }
  }
  return {points,velocities,groups,edges};
}

export function createProximityStudy(kind) {
  const art=document.querySelector('#art'), status=document.querySelector('#status');
  let wide=false, strong=false, alternate=false, marks=false, fixed=false;
  let state, initial, history, currentPairs, tick=0, revision=0, running=false, dirty=true;
  const radius=()=>wide?86:54;
  function relationships() {
    return fixed ? copyPairs(initial.edges) : radiusPairs2D({points:state.points,radius:radius(),maxWork:BUDGET}).pairs;
  }
  function resetPopulation() {
    initial=initialState(kind,fixed);
    state={points:copyPairs(initial.points),velocities:copyPairs(initial.velocities),forces:initial.points.map(()=>[0,0])};
    history=[copyPairs(state.points)];tick=0;running=false;currentPairs=relationships();dirty=true;
  }
  function step() {
    if(tick>=LAST_TICK){running=false;return;}
    const pairs=relationships();
    state=pairForceStep2D({points:state.points,velocities:state.velocities,pairs,
      attraction:kind==='contact-network'?.0011:.00042,
      repulsion:strong?.64:.22,repulsionRadius:kind==='contact-network'?42:34,
      damping:kind==='contact-network'?.94:.995,dt:1,maxSpeed:2.1,maxWork:BUDGET});
    tick++;history.push(copyPairs(state.points));
    // These relationships belong to the displayed, updated positions.
    currentPairs=relationships();
    if(tick===LAST_TICK)running=false;
  }
  function snapshot() {
    return {kind,tick,settings:{wide,strong,alternate,marks,fixed,running},
      points:copyPairs(state.points),velocities:copyPairs(state.velocities),forces:copyPairs(state.forces),
      pairs:copyPairs(currentPairs),history:history.map(copyPairs),groups:[...initial.groups]};
  }
  // Detached observation for browser evidence; it cannot mutate the simulation.
  window.proximityStudy=Object.freeze({snapshot});
  const sketch=new window.p5(p=>{
    p.setup=()=>{p.createCanvas(SIZE,SIZE,p.P2D).parent(art);p.pixelDensity(1);p.frameRate(30);resetPopulation();};
    function colorStroke(hex,alpha) {const c=p.color(hex);c.setAlpha(alpha);p.stroke(c);}
    function drawPaper(palette) {
      p.background(palette.paper);p.noFill();p.stroke(palette.faint);p.strokeWeight(.65);
      p.rect(30,30,660,660);
      for(const [x,y] of [[45,45],[675,45],[45,675],[675,675]]){
        p.line(x-5,y,x+5,y);p.line(x,y-5,x,y+5);
      }
      // Small retained starting marks show displacement without a hidden boundary.
      p.strokeWeight(1.5);
      for(const [x,y] of initial.points)p.point(x,y);
    }
    function drawNetwork(palette) {
      if(!marks || fixed) {
        for(const [i,j] of currentPairs) {
          const [x,y]=state.points[i],[u,v]=state.points[j];
          colorStroke(palette.ink[initial.groups[i]],fixed?190:68);p.strokeWeight(fixed?2.2:.7);
          p.line(x,y,u,v);
        }
      }
      for(let i=0;i<state.points.length;i++) {
        const [x,y]=state.points[i];p.noStroke();p.fill(palette.ink[initial.groups[i]]);
        p.circle(x,y,marks?5.5:3.5);
      }
    }
    function drawTrails(palette) {
      for(let i=0;i<state.points.length;i++) {
        const color=palette.ink[initial.groups[i]];p.noFill();colorStroke(color,marks?180:140);p.strokeWeight(marks?2.3:1.05);
        if(marks) {
          for(let j=0;j<history.length;j+=6)p.point(...history[j][i]);
        } else {
          p.beginShape();for(const frame of history)p.vertex(...frame[i]);p.endShape();
        }
        const [x,y]=state.points[i], [vx,vy]=state.velocities[i];
        colorStroke(color,220);p.strokeWeight(.85);p.line(x,y,x+vx*7,y+vy*7);
        p.noStroke();p.fill(color);p.circle(x,y,3.2);
      }
      if(fixed){
        p.strokeWeight(1.3);
        for(const [i,j] of currentPairs){colorStroke(palette.ink[initial.groups[i]],210);p.line(...state.points[i],...state.points[j]);}
      }
    }
    p.draw=()=>{
      if(!running&&!dirty)return;
      try {
        if(running)step();
        const palette=PALETTES[alternate?1:0];drawPaper(palette);
        if(kind==='contact-network')drawNetwork(palette);else drawTrails(palette);
        art.dataset.revision=String(++revision);art.dataset.tick=String(tick);art.dataset.renderStatus='ready';
        art.dataset.pairCount=String(currentPairs.length);
        document.querySelector('[data-action="space"]').textContent=running?'Pause':'Play';
        for(const [key,value] of [['g',fixed],['r',wide],['f',strong],['c',alternate],['m',marks]])
          document.querySelector(`[data-action="${key}"]`).setAttribute('aria-pressed',String(value));
        status.textContent=`Tick ${tick} / ${LAST_TICK} · ${fixed?'fixed open chains':`radius ${radius()}`} · avoidance ${strong?'.64':'.22'} · ${currentPairs.length} ${fixed?'edges':'current relationships'} · ${running?'playing':'paused'}`;
        dirty=false;
      } catch(error){running=false;dirty=false;art.dataset.renderStatus='error';status.textContent=`Could not draw: ${error.code??error.message}`;}
    };
    function action(key) {
      if(key==='s'){p.saveCanvas(`${kind}-tick-${tick}`,'png');return;}
      if(key==='space'||key===' '){running=!running&&tick<LAST_TICK;}
      else if(key==='.') {running=false;step();}
      else if(key==='n'){running=false;for(let i=0;i<60&&tick<LAST_TICK;i++)step();}
      else if(key==='r'){wide=!wide;currentPairs=relationships();}
      else if(key==='f'){strong=!strong;}
      else if(key==='c'){alternate=!alternate;}
      else if(key==='m'){marks=!marks;}
      else if(key==='g'){fixed=!fixed;resetPopulation();}
      else if(key==='0'){wide=false;strong=false;alternate=false;marks=false;fixed=false;resetPopulation();}
      else return;
      dirty=true;
    }
    document.querySelector('#controls').addEventListener('click',event=>{
      const button=event.target.closest('button[data-action]');if(button)action(button.dataset.action);
    });
    window.addEventListener('keydown',event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
      const key=event.key.toLowerCase();
      if([' ','.','n','r','f','c','m','g','0','s'].includes(key)){event.preventDefault();action(key);}
    });
  });
  return sketch;
}
