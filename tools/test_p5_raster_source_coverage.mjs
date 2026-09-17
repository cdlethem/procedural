import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {startExternalExpansionServer} from './serve_external_expansion_studies.mjs';

const root=resolve('.'),out=join(root,'.work/gallery-quality/native-raster-coverage');
await mkdir(out,{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH=join(root,'.work/toolchains/playwright');
const {chromium}=await import(join(root,'.work/environments/p5js/node_modules/playwright/index.mjs'));
const server=await startExternalExpansionServer();
const browser=await chromium.launch({headless:true});
const baselineHashes={
  'warp-marks':'c324cc59ce9db40f901edaa8820ad60dd1bdc8c7e29fac8b5f85182cb5cac0b8',
  'blur-marks':'6e54a1ee459fcf55a8ed74cf9da74031d83494220f448c0b972505bf9c7ca884',
};
const records=[];
async function capture(page,id,name){
  const canvas=page.locator('#art canvas');
  await canvas.screenshot({path:join(out,`${id}-${name}.png`)});
  const summary=await canvas.evaluate(async node=>{
    const data=node.getContext('2d').getImageData(0,0,node.width,node.height).data;
    const digest=await crypto.subtle.digest('SHA-256',data);
    const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
    let clear=0,partial=0,opaque=0,hiddenRgb=0;
    for(let i=0;i<data.length;i+=4){
      const alpha=data[i+3];if(alpha===0){clear++;if(data[i]||data[i+1]||data[i+2])hiddenRgb++;}
      else if(alpha===255)opaque++;else partial++;
    }
    return {hash,clear,partial,opaque,hiddenRgb,total:data.length/4};
  });
  records.push({id,name,...summary});
  return summary;
}
async function changeCoverage(page,value){
  const before=Number(await page.locator('#art').getAttribute('data-revision'));
  await page.locator('#source-coverage').evaluate((node,value)=>{
    node.value=String(value);
    node.dispatchEvent(new Event('input',{bubbles:true}));
    node.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
  await page.waitForFunction(before=>Number(document.querySelector('#art')?.dataset.revision)>before,before,{timeout:60000});
}
async function action(page,name){
  const before=Number(await page.locator('#art').getAttribute('data-revision'));
  await page.locator(`#controls button[data-action="${name}"]`).click();
  await page.waitForFunction(before=>Number(document.querySelector('#art')?.dataset.revision)>before,before,{timeout:60000});
}
async function saveAndCompare(page,id){
  const download=page.waitForEvent('download');
  await page.locator('#controls button[data-action="s"]').click();
  await (await download).saveAs(join(out,`${id}-saved.png`));
  const encoded=(await readFile(join(out,`${id}-saved.png`))).toString('base64');
  const mismatch=await page.locator('#art canvas').evaluate(async(node,encoded)=>{
    const blob=await(await fetch(`data:image/png;base64,${encoded}`)).blob();
    const image=await createImageBitmap(blob),copy=document.createElement('canvas');
    copy.width=node.width;copy.height=node.height;copy.getContext('2d').drawImage(image,0,0);
    const source=node.getContext('2d').getImageData(0,0,node.width,node.height).data;
    const exported=copy.getContext('2d').getImageData(0,0,node.width,node.height).data;
    let mismatch=0;for(let i=0;i<source.length;i++)if(source[i]!==exported[i])mismatch++;
    return mismatch;
  },encoded);
  assert.equal(mismatch,0,`${id}: saved PNG pixels and alpha match canvas`);
}
try{
  for(const id of ['warp-marks','blur-marks']){
    const page=await browser.newPage({acceptDownloads:true});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`${server.baseURL}/examples/${id}/index.html`);
    await page.waitForFunction(()=>document.querySelector('#art')?.dataset.revision==='1',null,{timeout:60000});
    const baseline=await capture(page,id,'default');
    assert.equal(baseline.hash,baselineHashes[id],`${id}: opaque pre-revision pixels preserved`);
    assert.equal(baseline.opaque,baseline.total);
    await changeCoverage(page,.45);
    const masked=await capture(page,id,'masked');
    assert.ok(masked.clear>1000,`${id}: source mask creates clear gutters`);
    assert.equal(masked.hiddenRgb,0);
    if(id==='warp-marks'){
      assert.ok(masked.partial>100,`${id}: remap creates antialiased alpha edge`);
      const halo=await page.evaluate(async()=>{
        const {remapSource,createWarpMarks,SIDE}=await import('/examples/warp-marks/warp-marks.js');
        const ink=[240,128,32],pixels=Array(SIDE*SIDE).fill(0xfff08020);
        const remapped=remapSource(pixels,createWarpMarks(),32,false,.45);
        let checked=0,maxError=0;
        for(let i=0;i<pixels.length;i++){
          const value=remapped.pixelAt(i),alpha=value>>>24;
          if(alpha<64||alpha===255)continue;
          for(let channel=0;channel<3;channel++){
            const shift=16-8*channel;
            maxError=Math.max(maxError,Math.abs(((value>>>shift)&255)-ink[channel]));
          }
          checked++;
        }
        return {checked,maxError};
      });
      assert.ok(halo.checked>100);
      assert.ok(halo.maxError<=5,`masked Warp edge color remains close to source: ${JSON.stringify(halo)}`);
      records.push({id,name:'halo',...halo});
      await saveAndCompare(page,id);
      await action(page,'p');
      const stripes=await capture(page,id,'stripe-masked');
      assert.ok(stripes.clear>1000 && stripes.partial>100,
        `${id}: stripe-source edit preserves warped transparent gutters`);
    }else{
      await action(page,'m');
      const soft=await capture(page,id,'soft-masked');
      assert.ok(soft.partial>100,`${id}: premultiplied blur softens the alpha edge`);
      const calls=await page.locator('#art').getAttribute('data-filter-calls');
      await action(page,'m');
      const horizontal=await capture(page,id,'horizontal-masked');
      assert.ok(horizontal.partial>100,`${id}: horizontal-only blur keeps alpha transition`);
      assert.ok(horizontal.clear>1000);
      assert.equal(await page.locator('#art').getAttribute('data-filter-calls'),calls,
        'mode changes select retained masked filters');
      await saveAndCompare(page,id);
      await action(page,'b');
      const blended=await capture(page,id,'horizontal-blended-masked');
      assert.ok(blended.clear>1000 && blended.partial>100,
        `${id}: sharp crossfade retains transparent gutters`);
    }
    await changeCoverage(page,0);
    const empty=await capture(page,id,'empty');
    assert.equal(empty.clear,empty.total,`${id}: zero coverage yields transparent canvas`);
    assert.equal(empty.hiddenRgb,0);
    await action(page,'0');
    const reset=await capture(page,id,'reset');
    assert.equal(reset.hash,baselineHashes[id],`${id}: reset restores exact opaque baseline`);
    assert.deepEqual(errors,[],`${id}: browser errors`);
    await page.close();
  }
  await writeFile(join(out,'report.json'),JSON.stringify({scope:'native p5 source-coverage candidate; no root acceptance',records},null,2)+'\n');
  console.log(`Native source-coverage browser checks passed: ${records.length} visual states.`);
}finally{await browser.close();await server.close();}
