/** Serve the three coverage studies with the existing pinned p5 runtime. */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startCoverageStudiesServer(port=0){
 const runtime='.work/environments/p5js/node_modules/p5';
 const meta=JSON.parse(await fs.readFile(path.join(root,runtime,'package.json'),'utf8'));
 if(meta.version!=='2.3.2')throw Error('Expected existing p5 2.3.2 runtime');
 const server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const relative=pathname==='/p5.js'?runtime+'/lib/p5.min.js':pathname.slice(1);
  if(pathname!=='/p5.js'&&!/^packages\/javascript\/(src\/(internal\/)?[a-z0-9-]+\.js|examples\/(pixel-grain|field-displacement|octave-noise)\/(index\.html|sketch\.js))$/.test(relative)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',relative.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(await fs.readFile(path.join(root,relative)));
 }catch{res.writeHead(500);res.end('Study file unavailable');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await startCoverageStudiesServer(8789);console.log(`http://127.0.0.1:${server.address().port}/packages/javascript/examples/pixel-grain/index.html`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
