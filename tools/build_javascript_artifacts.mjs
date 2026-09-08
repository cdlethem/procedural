#!/usr/bin/env node
/** Build local JavaScript artifacts without browser rendering or registry publication. */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = join(ROOT, 'packages/javascript');
const EXAMPLE = join(PACKAGE, 'examples/field-marks');
const DEFAULT_OUTPUT = join(ROOT, '.work/dist/javascript');
const VERSION = '0.1.0';
const NAME = '@procedurals/javascript';

function digest(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function digestBytes(value) { return createHash('sha256').update(value).digest('hex'); }
function display(path) { return relative(ROOT, path).split(sep).join('/'); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stdout}${result.stderr}`);
  return result;
}
function files(root) {
  const output = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...files(path));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}
function copy(source, target) { mkdirSync(dirname(target), { recursive: true }); cpSync(source, target); }
function inputHashes(paths) { return Object.fromEntries(paths.map(path => [display(path), digest(path)])); }
function assertUnchanged(hashes) {
  for (const [name, expected] of Object.entries(hashes)) {
    if (digest(join(ROOT, name)) !== expected) throw new Error(`Distribution input changed: ${name}`);
  }
}
function allowedOutput(path) {
  return path === join(ROOT, '.work') || path.startsWith(join(ROOT, '.work') + sep) ||
    path === join(ROOT, 'dist') || path.startsWith(join(ROOT, 'dist') + sep);
}
function treeManifest(root, prefix = root) {
  return files(root).map(path => ({ path: relative(prefix, path).split(sep).join('/'), sha256: digest(path) }));
}
function knownVectors() {
  const gridPath = join(ROOT, 'fixtures/operations/regular-grid.json');
  const noisePath = join(ROOT, 'fixtures/operations/gradient-noise-2d-01.json');
  const palettePath = join(ROOT, 'fixtures/operations/cyclic-palette.json');
  const grid = JSON.parse(readFileSync(gridPath, 'utf8')).cases.find(value => value.id === 'row-major-unequal-pitch');
  const noiseCase = JSON.parse(readFileSync(noisePath, 'utf8')).cases.find(value => value.id === 'seed-0');
  const noise = noiseCase?.queries.find(value => JSON.stringify(value.input) === JSON.stringify([0.25, 0.75]));
  const paletteCase = JSON.parse(readFileSync(palettePath, 'utf8')).cases.find(value => value.id === 'red-blue');
  const palette = paletteCase?.queries.find(value => value.input === 0.25);
  if (!grid || !noise || !palette) throw new Error('Required shared fixture vector is missing');
  return {
    files: [gridPath, noisePath, palettePath],
    grid: { fixture: display(gridPath), id: grid.id, input: grid.input, size: grid.size, index: 4, output: grid.points[4] },
    noise: { fixture: display(noisePath), case: noiseCase.id, input: noise.input, output: noise.output },
    palette: { fixture: display(palettePath), case: paletteCase.id, input: palette.input, output: palette.output },
  };
}
function packageReadme() {
  return '# Procedurals JavaScript\n\nLocal package artifact for the three portable operations: regular grid, gradient noise and cyclic palette. The bundled browser Field Marks example uses an internal p5 adapter and is an editable composition, not another public operation.\n';
}
function starterReadme() {
  return '# Field marks browser starter\n\nRun `npm install` and `npm start`, then open the printed localhost URL. This project installs the adjacent local Procedurals tarball and pinned `p5@2.3.2`; it does not depend on a Procedurals checkout. Edit `mark-field.js` or `sketch.js` to change this example-owned composition.\n';
}
function starterPackage(tarballName) {
  return JSON.stringify({ name: 'procedurals-field-marks-starter', private: true, version: VERSION,
    type: 'module', scripts: { start: 'node server.mjs' }, dependencies: {
      [NAME]: `file:vendor/${tarballName}`, p5: '2.3.2' } }, null, 2) + '\n';
}
function starterServer() {
  return `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
const root=resolve('.');
const port=Number.parseInt(process.env.PORT??'8765',10);
if(!Number.isInteger(port)||port<0||port>65535) throw new Error('PORT must be an integer from 0 through 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
function target(pathname) {
  if(pathname==='/') return join(root,'index.html');
  if(pathname==='/p5.js') return join(root,'node_modules/p5/lib/p5.min.js');
  if(pathname.startsWith('/node_modules/@procedurals/javascript/')) return join(root,pathname.slice(1));
  if(pathname.startsWith('/vendor/drawing/')) return join(root,pathname.slice(1));
  if(/^\\/[a-z0-9-]+\\.(html|js)$/i.test(pathname)) return join(root,pathname.slice(1));
  return null;
}
const server=createServer(async (request,response)=>{
  const path=target(new URL(request.url,'http://localhost').pathname);
  if(!path||!normalize(path).startsWith(root)){response.writeHead(404);response.end();return;}
  try {response.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});response.end(await readFile(path));}
  catch {response.writeHead(404);response.end();}
});
server.listen(port,'127.0.0.1',()=>{
  const address=server.address();
  console.log(JSON.stringify({event:'ready',url:\`http://127.0.0.1:\${address.port}\`}));
});
`;
}
function starterIndex() {
  const text = readFileSync(join(EXAMPLE, 'index.html'), 'utf8');
  const map = `<script type="importmap">{"imports":{"${NAME}":"/node_modules/${NAME}/src/index.js","${NAME}/":"/node_modules/${NAME}/"}}</script>`;
  if (!text.includes('</head>')) throw new Error('Unexpected Field Marks HTML template');
  return text.replace('</head>', `${map}</head>`);
}
function starterMarkField() {
  return readFileSync(join(EXAMPLE, 'mark-field.js'), 'utf8').replace("'../../src/index.js'", `'${NAME}'`);
}
function starterSketch() {
  return readFileSync(join(EXAMPLE, 'sketch.js'), 'utf8').replace("'../../src/internal/p5-frame.js'", "'./vendor/drawing/p5-frame.js'");
}
function packageInputs() {
  return [join(PACKAGE, 'package.json'), ...files(join(PACKAGE, 'src')),
    ...files(join(PACKAGE, 'examples')), join(ROOT, 'LICENSE'), join(ROOT, 'THIRD_PARTY_NOTICES.md'),
    ...knownVectors().files, fileURLToPath(import.meta.url)];
}
function smokeSource(vectors) {
  return `import { regularGrid, gradientNoise2D01, cyclicPalette } from '${NAME}';
import { pathToFileURL } from 'node:url';
function check(value,message){if(!value)throw new Error(message);}
const grid=regularGrid(${JSON.stringify(vectors.grid.input)});
const point=grid.pointAt(${vectors.grid.index});
check(grid.size===${vectors.grid.size}&&JSON.stringify(point)===JSON.stringify(${JSON.stringify(vectors.grid.output)}),'grid');
const noise=gradientNoise2D01({seed:0}).sample(...${JSON.stringify(vectors.noise.input)});
check(Object.is(noise,${vectors.noise.output}),'noise');
check(cyclicPalette({colors:[0xff0000,0x0000ff]}).sample(${vectors.palette.input})===${vectors.palette.output},'palette');
const resolved=await import.meta.resolve('${NAME}');
const expected=pathToFileURL(process.argv[2]).href;
check(resolved===expected,'resolved module differs: '+resolved);
console.log(JSON.stringify({resolved}));
`;
}
function jsonOutput(stdout) {
  const text = stdout.trim();
  if (!text) throw new Error('Expected npm JSON output');
  return JSON.parse(text);
}

function importSpecifiers(path) {
  const text = readFileSync(path, 'utf8');
  const matcher = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  return [...text.matchAll(matcher)].map(match => match[1]);
}
function installedStarterGraph(starter, drawingFiles) {
  const publicModule = join(starter, 'node_modules/@procedurals/javascript/src/index.js');
  const roots = [join(starter, 'sketch.js'), join(starter, 'mark-field.js'),
    ...drawingFiles.map(name => join(starter, 'vendor/drawing', name))];
  const visited = new Set();
  const edges = [];
  function visit(path) {
    path = resolve(path);
    if (visited.has(path)) return;
    if (!existsSync(path)) throw new Error(`Starter static import target is absent: ${path}`);
    visited.add(path);
    for (const specifier of importSpecifiers(path)) {
      let target;
      if (specifier === NAME) target = publicModule;
      else if (specifier.startsWith('.')) target = resolve(dirname(path), specifier);
      else throw new Error(`Starter has an unsupported static import: ${specifier} from ${path}`);
      if (!existsSync(target)) throw new Error(`Starter static import does not resolve: ${specifier} from ${path}`);
      edges.push({ from: relative(starter, path).split(sep).join('/'), specifier,
        to: relative(starter, target).split(sep).join('/') });
      visit(target);
    }
  }
  for (const root of roots) visit(root);
  return { roots: roots.map(path => relative(starter, path).split(sep).join('/')), edges };
}
async function installedStarterServer(starter, expectedFiles) {
  const child = spawn('npm', ['start'], { cwd: starter, detached: true, env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let readyUrl;
  let readyFailure;
  let readyResolve;
  const ready = new Promise(resolveReady => { readyResolve = resolveReady; });
  function receive(chunk) {
    output += chunk;
    for (const line of output.split(/\r?\n/)) {
      try {
        const message = JSON.parse(line);
        if (message?.event === 'ready' && typeof message.url === 'string') {
          readyUrl = message.url;
          readyResolve();
        }
      } catch { /* npm's ordinary output is not a readiness message. */ }
    }
  }
  child.stdout.on('data', receive);
  child.stderr.on('data', receive);
  const close = new Promise(resolveClose => child.once('close', resolveClose));
  child.once('error', error => { readyFailure = error; readyResolve(); });
  child.once('exit', (code, signal) => {
    if (!readyUrl) {
      readyFailure = new Error(`Starter static server exited before readiness: ${code ?? signal}`);
      readyResolve();
    }
  });
  try {
    await Promise.race([ready, new Promise(resolveDelay => setTimeout(resolveDelay, 5000))]);
    if (readyFailure || !readyUrl) throw readyFailure ?? new Error(`Starter static server did not become ready: ${output}`);
    const served = [];
    for (const [path, expected] of Object.entries(expectedFiles)) {
      const response = await fetch(new URL(path, readyUrl));
      const bytes = Buffer.from(await response.arrayBuffer());
      const sha256 = digestBytes(bytes);
      const expectedSha256 = digest(expected);
      if (response.status !== 200 || bytes.byteLength === 0 || sha256 !== expectedSha256)
        throw new Error(`Starter static server failed ${path}: ${response.status}`);
      served.push({ path, status: response.status, bytes: bytes.byteLength,
        sha256, expected_sha256: expectedSha256, content_type: response.headers.get('content-type') });
    }
    return { url: readyUrl, served };
  } finally {
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch { child.kill('SIGTERM'); }
    await Promise.race([close, new Promise(resolveDelay => setTimeout(resolveDelay, 2000))]);
    if (!child.killed) {
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch { child.kill('SIGKILL'); }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  let offline = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--output') output = resolve(args[++index] ?? '');
    else if (args[index] === '--offline') offline = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  output = resolve(output);
  if (!allowedOutput(output)) throw new Error('output must stay under ignored .work or dist');
  const vectors = knownVectors();
  const hashes = inputHashes(packageInputs());
  const build = join(output, 'build');
  rmSync(build, { recursive: true, force: true });
  mkdirSync(build, { recursive: true });
  const npmCache = join(output, '.npm-cache');
  mkdirSync(npmCache, { recursive: true });
  const npmEnvironment = { ...process.env, npm_config_cache: npmCache };
  const stagedPackage = join(build, 'package');
  copy(join(PACKAGE, 'package.json'), join(stagedPackage, 'package.json'));
  cpSync(join(PACKAGE, 'src'), join(stagedPackage, 'src'), { recursive: true });
  cpSync(join(PACKAGE, 'examples'), join(stagedPackage, 'examples'), { recursive: true });
  copy(join(ROOT, 'LICENSE'), join(stagedPackage, 'LICENSE'));
  copy(join(ROOT, 'THIRD_PARTY_NOTICES.md'), join(stagedPackage, 'THIRD_PARTY_NOTICES.md'));
  writeFileSync(join(stagedPackage, 'README.md'), packageReadme());
  const pack = jsonOutput(run('npm', ['pack', '--json'], { cwd: stagedPackage, env: npmEnvironment }).stdout)[0];
  if (!pack?.filename) throw new Error('npm pack did not report an artifact filename');
  const tarball = join(output, pack.filename);
  copy(join(stagedPackage, pack.filename), tarball);

  const starter = join(build, 'procedurals-field-marks-browser');
  mkdirSync(join(starter, 'vendor'), { recursive: true });
  copy(tarball, join(starter, 'vendor', pack.filename));
  writeFileSync(join(starter, 'package.json'), starterPackage(pack.filename));
  writeFileSync(join(starter, 'README.md'), starterReadme());
  writeFileSync(join(starter, 'server.mjs'), starterServer());
  const originalMarkField = readFileSync(join(EXAMPLE, 'mark-field.js'), 'utf8');
  const originalSketch = readFileSync(join(EXAMPLE, 'sketch.js'), 'utf8');
  const originalIndex = readFileSync(join(EXAMPLE, 'index.html'), 'utf8');
  const generatedIndex = starterIndex();
  const generatedMarkField = starterMarkField();
  const generatedSketch = starterSketch();
  writeFileSync(join(starter, 'index.html'), generatedIndex);
  writeFileSync(join(starter, 'mark-field.js'), generatedMarkField);
  writeFileSync(join(starter, 'sketch.js'), generatedSketch);
  const drawingFiles = ['p5-frame.js', 'drawing-state.js', 'drawing.js'];
  copy(join(ROOT, 'LICENSE'), join(starter, 'LICENSE'));
  copy(join(ROOT, 'THIRD_PARTY_NOTICES.md'), join(starter, 'THIRD_PARTY_NOTICES.md'));
  run('node', ['--check', join(starter, 'server.mjs')]);
  const starterSource = [join(starter, 'index.html'), join(starter, 'mark-field.js'), join(starter, 'sketch.js'), join(starter, 'server.mjs')]
    .map(path => readFileSync(path, 'utf8')).join('\n');
  if (starterSource.includes('../../src/') || starterSource.includes(`${NAME}/src/internal`) || starterSource.includes(ROOT))
    throw new Error('Starter retained a checkout or package-internal import path');
  const importMap = `<script type=\"importmap\">{\"imports\":{\"${NAME}\":\"/node_modules/${NAME}/src/index.js\",\"${NAME}/\":\"/node_modules/${NAME}/\"}}</script>`;
  if (generatedMarkField !== originalMarkField.replace("'../../src/index.js'", `'${NAME}'`) ||
      generatedSketch !== originalSketch.replace("'../../src/internal/p5-frame.js'", "'./vendor/drawing/p5-frame.js'") ||
      generatedIndex !== originalIndex.replace('</head>', `${importMap}</head>`))
    throw new Error('Starter changed source beyond its recorded import rewrites');
  const starterPackageJson = JSON.parse(readFileSync(join(starter, 'package.json'), 'utf8'));
  if (starterPackageJson.dependencies?.[NAME] !== `file:vendor/${pack.filename}` || starterPackageJson.dependencies?.p5 !== '2.3.2')
    throw new Error('Starter dependency declarations are not pinned to its local artifact and p5 2.3.2');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...(offline ? ['--offline'] : [])],
    { cwd: starter, env: npmEnvironment });
  const lockPath = join(starter, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const p5Lock = lock.packages?.['node_modules/p5'];
  const localLock = lock.packages?.['node_modules/@procedurals/javascript'];
  if (!p5Lock?.integrity || localLock?.resolved !== `file:vendor/${pack.filename}`)
    throw new Error('Starter lockfile does not bind pinned p5 integrity and its local tarball');
  const resolvedModule = join(starter, 'node_modules/@procedurals/javascript/src/index.js');
  const installedDrawing = join(starter, 'node_modules/@procedurals/javascript/src/internal');
  const starterTargets = [join(starter, 'node_modules/p5/lib/p5.min.js'), resolvedModule,
    ...drawingFiles.map(name => join(installedDrawing, name))];
  for (const target of starterTargets) {
    if (!existsSync(target)) throw new Error(`Installed starter import target is absent: ${target}`);
  }
  writeFileSync(join(starter, '.installed-smoke.mjs'), smokeSource(vectors));
  const smoke = run('node', ['.installed-smoke.mjs', resolvedModule], { cwd: starter });
  const smokeResult = jsonOutput(smoke.stdout);
  rmSync(join(starter, '.installed-smoke.mjs'));
  for (const name of drawingFiles) {
    const installed = join(installedDrawing, name);
    const source = join(PACKAGE, 'src/internal', name);
    const vendor = join(starter, 'vendor/drawing', name);
    copy(installed, vendor);
    if (digest(vendor) !== digest(installed) || digest(vendor) !== digest(source))
      throw new Error(`Starter internal copy does not match installed tarball and source: ${name}`);
  }
  const drawingHashes = Object.fromEntries(drawingFiles.map(name => {
    const vendor = join(starter, 'vendor/drawing', name);
    return [name, { source: digest(join(PACKAGE, 'src/internal', name)),
      installed_tarball: digest(join(installedDrawing, name)), vendor: digest(vendor) }];
  }));
  const graph = installedStarterGraph(starter, drawingFiles);
  const servedFiles = {
    '/': join(starter, 'index.html'),
    '/p5.js': join(starter, 'node_modules/p5/lib/p5.min.js'),
    '/mark-field.js': join(starter, 'mark-field.js'),
    '/sketch.js': join(starter, 'sketch.js'),
    ...Object.fromEntries(drawingFiles.map(name => [`/vendor/drawing/${name}`, join(starter, 'vendor/drawing', name)])),
    '/node_modules/@procedurals/javascript/src/index.js': resolvedModule,
  };
  const server = await installedStarterServer(starter, servedFiles);
  rmSync(join(starter, 'node_modules'), { recursive: true, force: true });
  if (existsSync(join(starter, 'node_modules'))) throw new Error('Starter node_modules remained after installation verification');
  const starterManifest = treeManifest(starter, build);
  if (starterManifest.some(entry => entry.path.includes('/node_modules/') || entry.path.startsWith('procedurals-field-marks-browser/node_modules/')))
    throw new Error('Starter ZIP input includes node_modules');
  const starterZip = join(output, `procedurals-field-marks-browser-${VERSION}.zip`);
  rmSync(starterZip, { force: true });
  run('zip', ['-q', '-r', starterZip, basename(starter)], { cwd: build });

  assertUnchanged(hashes);
  const packed = join(build, 'packed');
  mkdirSync(packed, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', packed]);
  const report = {
    status: 'passed',
    scope: 'Local JavaScript tarball and browser starter ZIP; no browser render, registry publication, or public adapter export claim',
    input_sha256: hashes,
    artifacts: {
      npm_tarball: { path: display(tarball), sha256: digest(tarball), entries: treeManifest(packed, packed) },
      browser_starter_zip: { path: display(starterZip), sha256: digest(starterZip), entries: starterManifest },
    },
    included_file_manifest: { package_stage: treeManifest(stagedPackage, stagedPackage), starter: starterManifest },
    installed_starter_smoke: { known_vectors: { grid: vectors.grid, noise: vectors.noise, palette: vectors.palette },
      resolved_module: smokeResult.resolved, expected_module: pathToFileURL(resolvedModule).href, stdout: smoke.stdout },
    environment: { node: process.version, npm: run('npm', ['--version'], { env: npmEnvironment }).stdout.trim(),
      npm_cache: display(npmCache), install_mode: offline ? 'offline' : 'default-network-enabled' },
    starter_resolution: { local_dependency: starterPackageJson.dependencies[NAME], p5: starterPackageJson.dependencies.p5,
      import_map: `${NAME} -> /node_modules/${NAME}/src/index.js`, internal_adapter: './vendor/drawing/p5-frame.js',
      installed_targets: starterTargets.map(display),
      package_lock: { path: 'procedurals-field-marks-browser/package-lock.json', sha256: digest(lockPath),
        p5_integrity: p5Lock.integrity, local_resolved: localLock.resolved },
      static_import_graph: graph,
      static_server: { command: 'PORT=0 npm start', url: server.url, served: server.served },
      copied_internal_sha256: drawingHashes,
      rewrites: {
        'mark-field.js': { from: "../../src/index.js", to: NAME },
        'sketch.js': { from: '../../src/internal/p5-frame.js', to: './vendor/drawing/p5-frame.js' },
        'index.html': { inserted: importMap },
      } },
  };
  mkdirSync(output, { recursive: true });
  const result = join(output, 'build-result.json');
  writeFileSync(result, JSON.stringify(report, null, 2) + '\n');
  const evidence = join(ROOT, 'evidence/distribution/javascript.json');
  mkdirSync(dirname(evidence), { recursive: true });
  writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ npm_tarball: display(tarball), browser_starter_zip: display(starterZip),
    result: display(result), evidence: display(evidence), scope: report.scope }));
}

main().catch(error => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
