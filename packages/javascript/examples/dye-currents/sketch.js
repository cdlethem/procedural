import { initialFluid, stepFluid, SIZE, CELLS } from './study.js';
import { marchingSquares2D } from '../../src/marching-squares-2d.js';
import { defaultPalettes } from '../../src/default-palettes.js';
let state = initialFluid(), dark = false, texture = false, contours = true;
let options = { injection: .1, viscosity: .01, projection: true };
let p5instance;
const palette = defaultPalettes.find(item => item.id === 'ochre-plum');
const colors = [2, 4, 1].map(index => [1, 3, 5].map(start => parseInt(palette.colors[index].slice(start, start + 2), 16)));
function draw(p) {
  const paper = dark ? [20, 30, 42] : [245, 238, 218];
  p.background(...paper); p.noStroke();
  const image = p.createImage(SIZE, SIZE); image.loadPixels();
  for (let i = 0; i < CELLS; i++) {
    const amounts = state.dyes.map(d => Math.min(1, Math.max(0, d[i])));
    const total = amounts.reduce((a, b) => a + b, 0), opacity = Math.min(.98, total * 1.7);
    for (let c = 0; c < 3; c++) {
      const ink = total ? amounts.reduce((sum, weight, k) => sum + weight * colors[k][c], 0) / total : paper[c];
      image.pixels[4 * i + c] = paper[c] * (1 - opacity) + ink * opacity;
    }
    image.pixels[4 * i + 3] = 255;
  }
  image.updatePixels(); p.image(image, 48, 48, 624, 624);
  if (contours) {
    // Draw measured dye isolines; presentation does not feed back into velocity or ink.
    const spacing = 624 / SIZE;
    p.strokeWeight(.7); p.noFill();
    for (let k = 0; k < state.dyes.length; k++) {
      p.stroke(...colors[k], dark ? 190 : 135);
      for (const threshold of [.08, .16, .28, .44, .64]) {
        const { segments } = marchingSquares2D({ values: state.dyes[k], columns: SIZE,
          rows: SIZE, origin: [48 + spacing / 2, 48 + spacing / 2],
          spacing: [spacing, spacing], threshold, maxWork: 2 * CELLS });
        for (const segment of segments) p.line(...segment);
      }
    }
  }
  p.noStroke();
  p.fill(...(dark ? [210, 211, 199] : [43, 65, 64])); p.textSize(11); p.text('DYE CURRENTS   /   STUDY 01', 48, 700);
  document.getElementById('status').textContent = `Frame ${state.tick} · ${texture ? 'striped' : 'soft'} ink · ${dark ? 'midnight' : 'paper'}`;
}
function action(name) {
  if (name === 'step') for (let n = 0; n < 30 && state.tick < 180; n++) state = stepFluid(state, options);
  if (name === 'injection') options.injection = options.injection === .1 ? .28 : .1;
  if (name === 'viscosity') options.viscosity = options.viscosity === .01 ? .2 : .01;
  if (name === 'projection') options.projection = !options.projection;
  if (name === 'contours') contours = !contours;
  if (name === 'palette') dark = !dark;
  if (name === 'texture') { texture = !texture; state = initialFluid(texture); }
  if (name === 'reset') { state = initialFluid(); texture = false; dark = false; contours = true; options = { injection: .1, viscosity: .01, projection: true }; }
  if (name === 'save') { p5instance.saveCanvas('dye-currents', 'png'); return; }
  p5instance.redraw();
}
new p5(p => {
  p5instance = p;
  p.setup = () => {
    p.createCanvas(720, 720).parent('art'); p.pixelDensity(1); p.noLoop();
    for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => action(button.dataset.action));
    window.__study = { ready: true, action, snapshot: () => structuredClone(state), config: () => ({ ...options, dark, texture, contours }), paletteCount: defaultPalettes.length };
  };
  p.draw = () => draw(p);
});
