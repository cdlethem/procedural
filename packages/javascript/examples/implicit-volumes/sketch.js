import { raymarchImplicitRays3D } from '../../src/raymarch-implicit-rays-3d.js';

const WIDTH = 192, HEIGHT = 168, SCALE = 3;
const sphere = (center, radius) => ({ kind: 'sphere', center, radius });
const box = (center, halfExtents) => ({ kind: 'axisBox', center, halfExtents });
const binary = (kind, left, right, k) => kind === 'smoothUnion' ? { kind, left, right, k } : { kind, left, right };

function composedScene(blended = true, cut = true) {
  const spire = box([-0.95, 0.05, 0], [0.3, 1.12, 0.46]);
  const shoulder = sphere([-0.42, 0.1, -0.14], 0.74);
  const welded = blended ? binary('smoothUnion', spire, shoulder, 0.5) : binary('union', spire, shoulder);
  const vessel = sphere([0.72, -0.1, -0.18], 0.98);
  const slit = box([0.78, -0.1, 0.72], [0.16, 0.9, 0.55]);
  return binary('union', welded, cut ? binary('difference', vessel, slit) : vessel);
}
function perforatedShell() {
  const outer = sphere([0, 0, 0], 1.35);
  const bore = box([0.03, 0, 0.93], [0.22, 1.1, 0.75]);
  const port = sphere([0.65, -0.25, 0.92], 0.4);
  return binary('difference', outer, binary('union', bore, port));
}

let blended = true, cut = true, rotated = false, transfer = false, suppliedScene = null;
let records = [], stats = null, revision = 0, lastQueryMs = 0;
const currentScene = () => suppliedScene ?? (transfer ? perforatedShell() : composedScene(blended, cut));
function makeRays() {
  const rays = [];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const u = (x + 0.5 - WIDTH / 2) / (HEIGHT / 2) * 1.8;
    const v = (HEIGHT / 2 - y - 0.5) / (HEIGHT / 2) * 1.8;
    const angle = rotated ? 0.42 : 0;
    const eye = [5.5 * Math.sin(angle), 0.15, 5.5 * Math.cos(angle)];
    const right = [Math.cos(angle), 0, -Math.sin(angle)];
    rays.push({ origin: eye, direction: [u * right[0] - 5.5 * Math.sin(angle), v - 0.15, u * right[2] - 5.5 * Math.cos(angle)] });
  }
  return rays;
}
const rayInput = (scene, rays) => ({ scene, rays, maxDistance: 12, hitEpsilon: 0.003, normalStep: 0.008,
  maxSteps: 44, maxRays: WIDTH * HEIGHT, maxSceneNodes: 32, maxWork: WIDTH * HEIGHT * (44 + 6) * 32 });

new window.p5(p => {
  function render() {
    const scene = currentScene(), rays = makeRays();
    const start = performance.now();
    records = raymarchImplicitRays3D(rayInput(scene, rays)).results;
    lastQueryMs = performance.now() - start;
    const image = p.createImage(WIDTH, HEIGHT); image.loadPixels();
    const counts = { hit_epsilon: 0, inside_start: 0, miss_range: 0, miss_steps: 0, miss_stalled: 0 };
    let minimumDepth = Infinity, maximumDepth = 0, normalCount = 0;
    for (let i = 0; i < records.length; i++) {
      const ray = records[i], x = i % WIDTH, y = Math.floor(i / WIDTH);
      counts[ray.kind]++;
      let red, green, blue;
      if (ray.distance !== null) {
        minimumDepth = Math.min(minimumDepth, ray.distance); maximumDepth = Math.max(maximumDepth, ray.distance);
        const normal = ray.normal;
        if (normal) normalCount++;
        const light = normal ? Math.max(0, normal[0] * -0.38 + normal[1] * 0.56 + normal[2] * 0.74) : 0.32;
        const rim = normal ? Math.pow(1 - Math.max(0, normal[2]), 2) : 0.5;
        const depth = Math.max(0, 1 - ray.distance / 12);
        const stripe = Math.sin(ray.position[1] * 14 + ray.position[0] * 2) * 10;
        red = 61 + light * 132 + rim * 32 + stripe;
        green = 83 + light * 117 + depth * 20;
        blue = 91 + light * 80 + (normal ? normal[0] * 42 : 0);
      } else {
        const glow = Math.max(0, 1 - Math.hypot((x - WIDTH * 0.54) / WIDTH, (y - HEIGHT * 0.42) / HEIGHT) * 1.8);
        red = 14 + 13 * glow; green = 27 + 19 * glow; blue = 36 + 27 * glow;
      }
      const offset = i * 4;
      image.pixels[offset] = Math.max(0, Math.min(255, red));
      image.pixels[offset + 1] = Math.max(0, Math.min(255, green));
      image.pixels[offset + 2] = Math.max(0, Math.min(255, blue));
      image.pixels[offset + 3] = 255;
    }
    image.updatePixels();
    p.background('#111b25'); p.noSmooth(); p.image(image, 0, 0, WIDTH * SCALE, HEIGHT * SCALE);
    p.noStroke(); p.fill('#192935'); p.rect(0, HEIGHT * SCALE, WIDTH * SCALE, 64);
    p.fill('#e9dfca'); p.textFont('monospace'); p.textSize(14);
    p.text(transfer || suppliedScene ? 'PERFORATED SHELL / TRANSFER' : 'WELDED FORM / CUT VESSEL', 18, HEIGHT * SCALE + 27);
    p.fill('#9cb6ba'); p.textSize(11); p.text(`${counts.hit_epsilon} surface samples  /  ${normalCount} estimated normals`, 18, HEIGHT * SCALE + 48);
    stats = { counts, minimumDepth: Number.isFinite(minimumDepth) ? minimumDepth : null,
      maximumDepth: counts.hit_epsilon + counts.inside_start ? maximumDepth : null,
      normalCount, width: WIDTH, height: HEIGHT };
    document.querySelector('#status').textContent = `${counts.hit_epsilon + counts.inside_start} hits · depth ${stats.minimumDepth?.toFixed(2) ?? '—'}–${stats.maximumDepth?.toFixed(2) ?? '—'} · ${blended ? 'soft' : 'hard'} union · ${cut ? 'cut open' : 'uncut'}`;
    document.querySelector('#art').dataset.revision = String(++revision);
    document.querySelector('#art').dataset.renderStatus = 'ready';
  }
  function reset() { blended = true; cut = true; rotated = false; transfer = false; suppliedScene = null; render(); }
  p.setup = () => {
    p.createCanvas(WIDTH * SCALE, HEIGHT * SCALE + 64).parent('art'); p.pixelDensity(1); p.noLoop(); render();
    window.implicitVolumes = Object.freeze({
      snapshot: () => ({ blended, cut, rotated, transfer, suppliedScene: structuredClone(suppliedScene),
        stats: { ...stats, counts: { ...stats.counts } } }),
      lastQueryMs: () => lastQueryMs,
      records: () => structuredClone(records),
      scene: () => structuredClone(currentScene()),
      rays: () => makeRays(),
      setScene: value => { suppliedScene = structuredClone(value); transfer = false; render(); }
    });
  };
  document.addEventListener('click', event => {
    const key = event.target.closest('[data-action]')?.dataset.action;
    if (!key) return;
    if (key === 's') { p.saveCanvas('implicit-volumes', 'png'); return; }
    if (key === '0') { reset(); return; }
    if (key === 'b') blended = !blended;
    if (key === 'c') cut = !cut;
    if (key === 'a') rotated = !rotated;
    if (key === 'v') { transfer = !transfer; suppliedScene = null; }
    render();
  });
});
