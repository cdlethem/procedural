import { seededPixelGrain } from '../../../packages/javascript/src/index.js';
import { pixelGrainLayout } from './layout.mjs';

// Reproduction-only layout replay, validated against java.util.Random(42).
// Motivating source: 2014/Generativos/cuadraditos, corpus revision
// 69bdd8513e4482a5e6018e36887d4bc208660eb5. No source helper is imported.
// Grain deliberately uses the unchanged public portable stream, independently.
const art = document.querySelector('#art'), status = document.querySelector('#status');
const layout = pixelGrainLayout(42);
let strong = false, revision = 0;
const sketch = new window.p5(p => {
  p.setup = () => { p.createCanvas(600, 800, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
  p.draw = () => {
    try {
      p.background(24); p.noStroke(); p.fill(200, 180);
      for (const [x, y] of layout.points) p.rect(x, y, 5, 5);
      p.loadPixels();
      if (p.pixels.length !== 600 * 800 * 4) throw Error('Expected density-one RGBA raster');
      const pixels = new Array(600 * 800);
      for (let i = 0; i < pixels.length; i++) {
        const j = i * 4;
        pixels[i] = ((p.pixels[j + 3] << 24) | (p.pixels[j] << 16) | (p.pixels[j + 1] << 8) | p.pixels[j + 2]) >>> 0;
      }
      const result = seededPixelGrain({source:{width:600,height:800,pixels},mode:'RGB_ADD',range:[0,strong?40:10],exponent:1,rngState:42,maxWork:480000});
      for (let i = 0; i < pixels.length; i++) {
        const j = i * 4, color = result.raster.pixels[i];
        p.pixels[j] = (color >>> 16) & 255; p.pixels[j + 1] = (color >>> 8) & 255;
        p.pixels[j + 2] = color & 255; p.pixels[j + 3] = color >>> 24;
      }
      p.updatePixels();
      art.dataset.geometry = JSON.stringify(layout.points);
      art.dataset.sourceCount = String(layout.points.length);
      art.dataset.rngState = String(result.rngState);
      art.dataset.revision = String(++revision); art.dataset.renderStatus = 'ready';
      status.textContent = `Layout seed 42 · ${layout.points.length} squares · grain addition 0–${strong?40:10}`;
    } catch (error) { art.dataset.renderStatus = 'error'; status.textContent = error.message; }
  };
});
function action(key) {
  if (key === 's') { sketch.saveCanvas('seeded-dot-blocks', 'png'); return; }
  if (key === 't') strong = !strong; else if (key === '0') strong = false; else return;
  sketch.redraw();
}
document.querySelector('#controls').addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (button) action(button.dataset.action); });
window.addEventListener('keydown', event => { if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return; const key = event.key.toLowerCase(); if (['t','0','s'].includes(key)) { event.preventDefault(); action(key); } });
