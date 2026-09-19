import { spaceColonizationStep2D } from '../../src/space-colonization-step-2d.js';

// Fixed target field: a jittered 12x12 grid the tips grow toward.
const GRID = 12;
const CELL = 640 / GRID;
const fract = x => x - Math.floor(x);
const jitter = (row, col, salt) => fract(Math.sin(row * 127.1 + col * 311.7 + salt * 74.7) * 43758.5453);
const SOURCES = (() => {
  const points = [];
  for (let row = 0; row < GRID; row++) for (let col = 0; col < GRID; col++) {
    points.push([
      (col + 0.5) * CELL + (jitter(row, col, 0) - 0.5) * CELL * 0.7,
      (row + 0.5) * CELL + (jitter(row, col, 1) - 0.5) * CELL * 0.7,
    ]);
  }
  return points;
})();

// Seed tips: a small cluster at the center the network grows out from.
const SEED = [[320, 320], [300, 332], [340, 332]];

// Growth schedule. step and reach set the growth density; branches and branchAngle
// set the branching structure. Branches/Spread are exposed as cycling controls.
const STEP = 5, REACH = 12;
const BRANCH_CHOICES = [1, 2, 3, 4];
const SPREAD_CHOICES = [0.3, 0.6, 0.9, 1.2];
const MAX_WORK = 2048 * SOURCES.length;
const PRE_GROW = 40;

let branches = 2, branchAngle = 0.6;
let state, tick, growth = false, showSources = false;

const seedState = () => ({
  tips: SEED.map(pt => [pt[0], pt[1]]),
  segments: [],
  consumed: SOURCES.map(() => false),
});

function stepOnce() {
  const result = spaceColonizationStep2D({
    tips: state.tips,
    sources: SOURCES,
    consumed: state.consumed,
    step: STEP,
    reach: REACH,
    branches,
    branchAngle,
    maxWork: MAX_WORK,
  });
  state = {
    tips: result.tips,
    segments: [...state.segments, ...result.segments],
    consumed: result.consumed,
  };
  tick++;
}

function growTo(target) {
  for (let guard = 0; guard < target && state.tips.length > 0; guard++) stepOnce();
}

function resetToSeed() {
  state = seedState(); tick = 0;
}

new window.p5(p => {
  function render() {
    const grown = state.consumed.filter(Boolean).length;
    p.background('#101d2b');
    p.stroke('#2f6f68'); p.strokeWeight(1);
    for (const [x0, y0, x1, y1] of state.segments) p.line(x0, y0, x1, y1);
    if (showSources) {
      p.noStroke();
      for (let i = 0; i < SOURCES.length; i++) {
        p.fill(state.consumed[i] ? '#3a4f5c' : '#54707f');
        p.circle(SOURCES[i][0], SOURCES[i][1], state.consumed[i] ? 2 : 3);
      }
    }
    p.noStroke(); p.fill('#f09a66');
    for (const [x, y] of state.tips) p.circle(x, y, 4);
    document.querySelector('#status').textContent =
      `Tick ${tick} · ${state.tips.length} tips · ${state.segments.length} links · ` +
      `${grown}/${SOURCES.length} sources · ${branches}-way, spread ${branchAngle}`;
  }
  const snapshot = () => ({
    tips: structuredClone(state.tips),
    segments: structuredClone(state.segments),
    consumed: structuredClone(state.consumed),
    branches, branchAngle, tick, growth, showSources,
  });
  p.setup = () => {
    p.createCanvas(640, 640).parent('art'); p.pixelDensity(1); p.noLoop();
    window.spaceColonization = Object.freeze({ snapshot });
    resetToSeed(); growTo(PRE_GROW); render();
  };
  function action(key) {
    if (key === 's') { p.saveCanvas('space-colonization', 'png'); return; }
    if (key === '.') { stepOnce(); }
    else if (key === 'n') { growth = !growth; growth ? p.loop() : p.noLoop(); }
    else if (key === 'y') showSources = !showSources;
    else if (key === 'b') {
      branches = BRANCH_CHOICES[(BRANCH_CHOICES.indexOf(branches) + 1) % BRANCH_CHOICES.length];
      resetToSeed(); growTo(PRE_GROW);
    }
    else if (key === 'a') {
      branchAngle = SPREAD_CHOICES[(SPREAD_CHOICES.indexOf(branchAngle) + 1) % SPREAD_CHOICES.length];
      resetToSeed(); growTo(PRE_GROW);
    }
    else if (key === '0') { growth = false; p.noLoop(); resetToSeed(); }
    render();
  }
  p.draw = () => { if (growth) stepOnce(); render(); };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) action(button.dataset.action);
  });
});
