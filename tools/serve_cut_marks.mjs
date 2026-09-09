/** Serve the editable p5 CutMarks example locally using the pinned, repository-local runtime. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.work/environments/p5js');
export async function startCutMarksServer(port=8775) {
  try {await fs.access(path.join(runtime,'node_modules/p5/lib/p5.min.js'));}
  catch {
    await fs.mkdir(runtime,{recursive:true});
    const install=spawnSync('npm',['install','--prefix',runtime,'--save-exact','p5@2.3.2'],{stdio:'inherit'});
    if(install.status!==0)throw new Error('Could not install pinned p5 runtime');
  }
  const metadata=JSON.parse(await fs.readFile(path.join(runtime,'node_modules/p5/package.json'),'utf8'));
  if(metadata.version!=='2.3.2')throw new Error('Expected p5 2.3.2 in local runtime');
  const server=http.createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      let relative;
      if(pathname==='/'){res.writeHead(302,{Location:'/packages/javascript/examples/cut-marks/index.html'});res.end();return;}
      if(pathname==='/p5.js')relative='.work/environments/p5js/node_modules/p5/lib/p5.min.js';
      else if(/^\/packages\/javascript\/(src\/(internal\/)?[a-z0-9-]+\.js|examples\/cut-marks\/(index\.html|sketch\.js|cut-marks\.js))$/.test(pathname))relative=pathname.slice(1);
      else{res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',relative.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
      res.end(await fs.readFile(path.join(root,relative)));
    }catch{res.writeHead(500);res.end('Example file unavailable');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=await startCutMarksServer();
  console.log(`Cut marks: http://127.0.0.1:${server.address().port}/ — Ctrl-C to stop`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
