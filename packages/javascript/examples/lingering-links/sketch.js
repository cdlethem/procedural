import { contactHistory2D } from '../../src/contact-history-2d.js';
import { radiusPairs2D } from '../../src/radius-pairs-2d.js';

const SIZE = 640, COUNT = 48;
const initial = () => Array.from({ length: COUNT }, (_, i) => ({ id: 100 + i, x: 320 + Math.cos(i * 2.4) * (70 + i % 6 * 20), y: 320 + Math.sin(i * 2.4) * (70 + i % 5 * 23), vx: Math.sin(i * 1.7) * .6, vy: Math.cos(i * 1.3) * .6 }));
let agents = initial(), contacts = [], radius = 82, linger = 12, tick = 0, running = false, dirty = true;
function pairs() { return radiusPairs2D({ points: agents.map(a => [a.x, a.y]), radius, maxWork: COUNT * COUNT }).pairs; }
function step() { const current = pairs(); contacts = contactHistory2D({ ids: agents.map(a => a.id), pairs: current, contacts, lingerSteps: linger, maxWork: 5000 }).contacts; agents = agents.map((a, i) => ({ ...a, x: a.x + a.vx + Math.sin(tick * .03 + i) * .12, y: a.y + a.vy + Math.cos(tick * .027 + i) * .12 })); tick += 1; }
new window.p5(p => {
  p.setup = () => { p.createCanvas(SIZE, SIZE).parent('art'); p.pixelDensity(1); p.noLoop(); p.redraw(); };
  function render() { p.background('#f2eee2'); p.noFill(); p.stroke('#9cb2a7'); p.rect(24, 24, SIZE - 48, SIZE - 48); const byId = new Map(agents.map(a => [a.id, a])); for (const link of contacts) { const a = byId.get(link.ids[0]), b = byId.get(link.ids[1]); if (!a || !b) continue; const alpha = Math.max(20, 220 - link.missingTicks * 16); p.stroke(36, 94, 87, alpha); p.strokeWeight(1 + Math.min(4, link.activeTicks * .28)); p.line(a.x, a.y, b.x, b.y); } for (const a of agents) { p.noStroke(); p.fill('#d05d3c'); p.circle(a.x, a.y, 5); } document.querySelector('#status').textContent = `Tick ${tick} · ${contacts.length} retained links · radius ${radius} · linger ${linger}`; window.lingeringLinks = Object.freeze({ snapshot: () => ({ tick, agents: agents.map(a => ({ ...a })), contacts: structuredClone(contacts), radius, linger }) }); dirty = false; }
  p.draw = () => { if (running) { step(); dirty = true; } if (dirty) render(); };
  function action(key) { if (key === 's') { p.saveCanvas(`lingering-links-${tick}`, 'png'); return; } if (key === 'space') running = !running; else if (key === '.') { running = false; step(); dirty = true; } else if (key === 'r') { radius = radius === 82 ? 118 : 82; } else if (key === 'l') { linger = linger === 12 ? 3 : 12; } else if (key === '0') { agents = initial(); contacts = []; radius = 82; linger = 12; tick = 0; running = false; dirty = true; } if (running) p.loop(); else { render(); p.noLoop(); } }
  document.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) action(b.dataset.action); }); window.addEventListener('keydown', e => { if (!e.repeat && [' ', '.', 'r', 'l', '0', 's'].includes(e.key)) { e.preventDefault(); action(e.key === ' ' ? 'space' : e.key); } });
});
