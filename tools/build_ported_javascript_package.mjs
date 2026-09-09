#!/usr/bin/env node
/** Build and install a local review tarball. No registry publication or native rendering. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.argv[2]);
assert.ok(out.startsWith(join(root,'.work')+sep) && !existsSync(out));
const stage=join(out,'stage'),consumer=join(out,'consumer');
mkdirSync(stage,{recursive:true});mkdirSync(consumer);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]).sort();}
const inputs=[...files(join(root,'packages/javascript')),join(root,'LICENSE'),join(root,'THIRD_PARTY_NOTICES.md'),fileURLToPath(import.meta.url)];
const hashes=()=>Object.fromEntries(inputs.map(p=>[relative(root,p),hash(p)]));
const before=hashes();
for(const name of ['src','examples','package.json'])cpSync(join(root,'packages/javascript',name),join(stage,name),{recursive:true});
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])cpSync(join(root,name),join(stage,name));
writeFileSync(join(stage,'README.md'),'# Procedurals JavaScript\n\nLocal review package. Import public operations from `@procedurals/javascript`. Source examples are included; browser workflow acceptance and capability limits are recorded in the repository port integration status. This artifact is not published to a registry.\n\nThe numerical helpers preserve their upstream Sun Microsystems notices in src/fdlibm-trig.js and src/internal/fdlibm-hypot.js and src/internal/fdlibm-pow.js; retain these notices when redistributing.\n');
function run(args,cwd){const r=spawnSync('npm',args,{cwd,encoding:'utf8',timeout:60000,env:{...process.env,npm_config_cache:join(out,'npm-cache')},maxBuffer:8*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;}
const pack=JSON.parse(run(['pack','--json','--ignore-scripts','--pack-destination',out],stage))[0];
writeFileSync(join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
run(['install','--offline','--ignore-scripts','--no-audit','--no-fund',join(out,pack.filename)],consumer);
const installed=join(consumer,'node_modules/@procedurals/javascript');
const smoke=spawnSync(process.execPath,['--input-type=module','-e',"import * as api from '@procedurals/javascript'; console.log(JSON.stringify({resolved:import.meta.resolve('@procedurals/javascript'),exports:Object.keys(api)}));"],{cwd:consumer,encoding:'utf8',timeout:10000});
assert.ifError(smoke.error);assert.equal(smoke.status,0,smoke.stderr);
const resolution=JSON.parse(smoke.stdout);
assert.equal(fileURLToPath(resolution.resolved),join(installed,'src/index.js'));
const entries=files(stage).map(p=>({path:relative(stage,p),sha256:hash(p)}));
for(const entry of entries)assert.equal(hash(join(installed,entry.path)),entry.sha256,entry.path);
const after=hashes();assert.deepEqual(after,before);
writeFileSync(join(out,'report.json'),JSON.stringify({status:'passed',scope:'Locally packed and offline-installed package; byte-for-byte installed inventory, no browser or registry claim.',input_sha256_before:before,input_sha256_after:after,node:process.version,resolution,tarball:{path:relative(root,join(out,pack.filename)),sha256:hash(join(out,pack.filename))},installed_index:relative(root,join(installed,'src/index.js')),entries},null,2)+'\n');
console.log(JSON.stringify({status:'passed',out,installed_index:join(installed,'src/index.js')}));
