/** Local-only server for editable external-expansion studies and installed-package checks. */
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
export async function startExternalExpansionServer(port = 0, { packageRoot = resolve(root, 'packages/javascript') } = {}) {
  const pkg = resolve(packageRoot);
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      let file;
      if (pathname === '/p5.js') file = resolve(root, '.work/environments/p5js/node_modules/p5/lib/p5.min.js');
      else {
        if (!/^\/(examples|src)\//.test(pathname)) throw new Error('Route unavailable');
        file = resolve(pkg, `.${pathname}`);
        if (!file.startsWith(pkg + sep)) throw new Error('Invalid path');
        if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(readFileSync(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  return { server, baseURL: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { baseURL } = await startExternalExpansionServer(Number(process.argv[2] ?? 8790));
  console.log(baseURL);
}
